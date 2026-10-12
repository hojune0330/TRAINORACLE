"""Offline orthographic review of a static GLB, using only NumPy and Pillow.

Read-only source handling. Embedded base-color texture, z-buffer and simple
diffuse light; this is not a PBR renderer or a skeletal-animation validator.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

DTYPES = {5120: '<i1', 5121: '<u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
WIDTHS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load_glb(filename):
    raw = filename.read_bytes()
    magic, version, length = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or length != len(raw):
        raise ValueError('Invalid GLB 2.0 header')
    pos, document, binary = 12, None, None
    while pos < len(raw):
        size, kind = struct.unpack_from('<II', raw, pos)
        chunk = raw[pos + 8:pos + 8 + size]
        if len(chunk) != size:
            raise ValueError('Truncated GLB chunk')
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode('utf-8').rstrip())
        elif kind == 0x004E4942:
            binary = chunk
        pos += 8 + size
    if document is None or binary is None:
        raise ValueError('Expected embedded GLB JSON and BIN')
    if any(buffer.get('uri') for buffer in document.get('buffers', [])):
        raise ValueError('External or data-URI buffers are unsupported')
    if document.get('skins'):
        raise ValueError('Static review only: skeletal deformation is unsupported')
    return raw, document, binary


def accessor(document, binary, index):
    item = document['accessors'][index]
    if item.get('sparse'):
        raise ValueError('Sparse accessors are unsupported')
    view = document['bufferViews'][item['bufferView']]
    if view.get('buffer', 0) != 0:
        raise ValueError('Only embedded buffer 0 is supported')
    dtype = np.dtype(DTYPES[item['componentType']])
    width = WIDTHS[item['type']]
    offset = view.get('byteOffset', 0) + item.get('byteOffset', 0)
    stride = view.get('byteStride', dtype.itemsize * width)
    values = np.ndarray((item['count'], width), dtype=dtype, buffer=binary,
                        offset=offset, strides=(stride, dtype.itemsize)).copy()
    return values[:, 0] if width == 1 else values


def node_matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix'], dtype=float).reshape((4, 4), order='F')
    x, y, z, w = node.get('rotation', [0, 0, 0, 1])
    rotation = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
        [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
    ])
    result = np.eye(4)
    result[:3, :3] = rotation @ np.diag(node.get('scale', [1, 1, 1]))
    result[:3, 3] = node.get('translation', [0, 0, 0])
    return result


def load_primitives(document, binary):
    primitives = []
    nodes = document.get('nodes', [])
    default_scene = document.get('scene', 0)
    roots = document.get('scenes', [{}])[default_scene].get('nodes', [])

    def visit(index, parent):
        node = nodes[index]
        world = parent @ node_matrix(node)
        if 'mesh' in node:
            for primitive in document['meshes'][node['mesh']].get('primitives', []):
                if primitive.get('mode', 4) != 4:
                    raise ValueError('Only triangle primitive mode is supported')
                attributes = primitive['attributes']
                positions = accessor(document, binary, attributes['POSITION']).astype(float)
                positions = np.c_[positions, np.ones(len(positions))] @ world.T
                positions = positions[:, :3]
                normals = accessor(document, binary, attributes['NORMAL']).astype(float) if 'NORMAL' in attributes else None
                if normals is not None:
                    normals = normals @ np.linalg.inv(world[:3, :3])
                    normals /= np.maximum(1e-12, np.linalg.norm(normals, axis=1, keepdims=True))
                uv = accessor(document, binary, attributes['TEXCOORD_0']).astype(float) if 'TEXCOORD_0' in attributes else None
                indices = accessor(document, binary, primitive['indices']) if 'indices' in primitive else np.arange(len(positions))
                faces = indices.reshape((-1, 3)).astype(int)
                material = document.get('materials', [{}])[primitive.get('material', 0)]
                pbr = material.get('pbrMetallicRoughness', {})
                factor = np.array(pbr.get('baseColorFactor', [1, 1, 1, 1]))
                texture = None
                if 'baseColorTexture' in pbr:
                    tex = document['textures'][pbr['baseColorTexture']['index']]
                    image = document['images'][tex['source']]
                    if 'bufferView' not in image:
                        raise ValueError('Only embedded bufferView textures are supported')
                    view = document['bufferViews'][image['bufferView']]
                    start = view.get('byteOffset', 0)
                    texture = np.asarray(Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB'), dtype=float) / 255.0
                primitives.append((positions, normals, uv, faces, texture, factor))
        for child in node.get('children', []):
            visit(child, world)

    for root in roots:
        visit(root, np.eye(4))
    if not primitives:
        raise ValueError('No drawable triangle primitives in default scene')
    return primitives


def render(primitives, yaw, size=512):
    all_positions = np.concatenate([primitive[0] for primitive in primitives])
    bounds_min, bounds_max = all_positions.min(axis=0), all_positions.max(axis=0)
    height = float(bounds_max[1] - bounds_min[1])
    if height <= 0:
        raise ValueError('Model has no vertical extent')
    center = (bounds_min + bounds_max) / 2
    center[1] = bounds_min[1]
    angle = math.radians(yaw)
    camera = np.array([math.sin(angle), 0, math.cos(angle)])
    right = np.array([math.cos(angle), 0, -math.sin(angle)])
    light = 0.35*right + 0.65*camera + np.array([0, 0.8, 0])
    light /= np.linalg.norm(light)
    scale = (420 / 512 * size) / height
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    zbuffer = np.full((size, size), -np.inf)

    for positions, normals, uv, faces, texture, factor in primitives:
        local = positions - center
        pixels = np.c_[size/2 + (local @ right)*scale, (480/512*size) - local[:, 1]*scale]
        depths = local @ camera
        for face in faces:
            pts = pixels[face]
            minimum = np.maximum(0, np.floor(pts.min(axis=0)).astype(int))
            maximum = np.minimum(size-1, np.ceil(pts.max(axis=0)).astype(int))
            if np.any(minimum > maximum):
                continue
            a, b, c = pts
            denom = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
            if abs(denom) < 1e-10:
                continue
            xs, ys = np.meshgrid(np.arange(minimum[0], maximum[0]+1)+0.5,
                                 np.arange(minimum[1], maximum[1]+1)+0.5)
            wa = ((b[1]-c[1])*(xs-c[0]) + (c[0]-b[0])*(ys-c[1])) / denom
            wb = ((c[1]-a[1])*(xs-c[0]) + (a[0]-c[0])*(ys-c[1])) / denom
            wc = 1-wa-wb
            depth = wa*depths[face[0]] + wb*depths[face[1]] + wc*depths[face[2]]
            zregion = zbuffer[minimum[1]:maximum[1]+1, minimum[0]:maximum[0]+1]
            mask = (wa >= -1e-6) & (wb >= -1e-6) & (wc >= -1e-6) & (depth > zregion)
            if not mask.any():
                continue
            weights = np.stack([wa[mask], wb[mask], wc[mask]], axis=1)
            if texture is not None and uv is not None:
                coordinates = weights @ uv[face]
                # glTF image UV origin is the upper left; no vertical flip.
                tx = np.clip(coordinates[:, 0], 0, 1) * (texture.shape[1]-1)
                ty = np.clip(coordinates[:, 1], 0, 1) * (texture.shape[0]-1)
                x0, y0 = np.floor(tx).astype(int), np.floor(ty).astype(int)
                x1, y1 = np.minimum(x0+1, texture.shape[1]-1), np.minimum(y0+1, texture.shape[0]-1)
                wx, wy = (tx-x0)[:, None], (ty-y0)[:, None]
                colors = texture[y0, x0]*(1-wx)*(1-wy) + texture[y0, x1]*wx*(1-wy) + texture[y1, x0]*(1-wx)*wy + texture[y1, x1]*wx*wy
            else:
                colors = np.ones((len(weights), 3))
            if normals is not None:
                interpolated_normals = weights @ normals[face]
                interpolated_normals /= np.maximum(1e-12, np.linalg.norm(interpolated_normals, axis=1, keepdims=True))
                diffuse = np.clip(interpolated_normals @ light, 0, 1)
            else:
                geometric = np.cross(positions[face[1]]-positions[face[0]], positions[face[2]]-positions[face[0]])
                geometric /= max(1e-12, float(np.linalg.norm(geometric)))
                diffuse = np.full(len(weights), max(0, float(geometric @ light)))
            # Simple linear-space light, without changing the embedded texture.
            colors = np.clip((colors**2.2 * factor[:3] * (0.78+0.22*diffuse[:, None]))**(1/2.2), 0, 1)
            region = rgba[minimum[1]:maximum[1]+1, minimum[0]:maximum[0]+1]
            region[mask, :3] = np.rint(colors*255).astype(np.uint8)
            region[mask, 3] = round(float(factor[3])*255)
            zregion[mask] = depth[mask]
    return Image.fromarray(rgba, 'RGBA')


def font(size):
    candidate = Path('C:/Windows/Fonts/arial.ttf')
    return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default(size=size)


def thumbnail(rendered, size):
    bounds = rendered.getchannel('A').getbbox()
    cropped = rendered.crop(bounds)
    scale = size / max(cropped.width, cropped.height)
    reduced = cropped.resize((max(1, round(cropped.width*scale)), max(1, round(cropped.height*scale))), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    frame.alpha_composite(reduced, ((size-reduced.width)//2, size-reduced.height))
    return frame


def composite(rendered, background, size, tight=False):
    result = Image.new('RGBA', (size, size), background)
    result.alpha_composite(thumbnail(rendered, size) if tight else rendered.resize((size, size), Image.Resampling.LANCZOS))
    return result.convert('RGB')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('model', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    raw, document, binary = load_glb(args.model)
    original_hash = hashlib.sha256(raw).hexdigest()
    primitives = load_primitives(document, binary)
    args.output.mkdir(parents=True, exist_ok=True)
    # Negative yaw displays this model's front toward screen-right, matching
    # the running-game art brief; these labels describe screen direction.
    views = [('front', 0), ('right', -90), ('back', 180), ('three-quarter', -45)]
    images = {}
    outputs = []
    for name, yaw in views:
        rendered = render(primitives, yaw)
        images[name] = rendered
        filename = f'base-review-{name}.png'
        rendered.save(args.output / filename)
        outputs.append(filename)
        for small in (64, 75):
            filename = f'base-review-{name}-{small}px.png'
            thumbnail(rendered, small).save(args.output / filename)
            outputs.append(filename)

    sheet = Image.new('RGB', (1024, 1220), '#f1f4f5')
    draw = ImageDraw.Draw(sheet)
    draw.text((28, 20), 'TORI / TRIPO BASE MODEL / OFFLINE REVIEW', fill='#152838', font=font(27))
    draw.text((28, 59), 'Static T-pose | Embedded texture | Orthographic | Basic diffuse light', fill='#536572', font=font(18))
    for index, (name, yaw) in enumerate(views):
        x, y = (index % 2)*512, 92+(index // 2)*540
        draw.text((x+28, y), f'{name.upper()}  /  yaw {yaw} deg', fill='#152838', font=font(20))
        sheet.paste(composite(images[name], '#f1f4f5', 496), (x+8, y+32))
    draw.text((28, 1180), 'Source GLB unchanged. Review only; not game integration or rig validation.', fill='#536572', font=font(18))
    sheet.save(args.output / 'base-review-contact.png')
    outputs.append('base-review-contact.png')

    small_sheet = Image.new('RGB', (900, 520), '#f1f4f5')
    draw = ImageDraw.Draw(small_sheet)
    draw.text((24, 20), 'TORI / 64 px AND 75 px READABILITY', fill='#152838', font=font(25))
    draw.text((24, 59), 'Character silhouette fills 64 or 75 pixels of height; identical light/navy copies.', fill='#536572', font=font(17))
    for index, (name, yaw) in enumerate(views):
        x = 30+index*216
        draw.text((x, 94), name, fill='#152838', font=font(18))
        for row, size in enumerate((64, 75)):
            y = 137+row*170
            draw.text((x, y), f'{size}px', fill='#536572', font=font(17))
            small_sheet.paste(composite(images[name], '#ffffff', size, tight=True), (x, y+34))
            small_sheet.paste(composite(images[name], '#202838', size, tight=True), (x+size+16, y+34))
    draw.text((24, 490), 'White and navy backgrounds. Small faces do not imply readable running poses.', fill='#536572', font=font(17))
    small_sheet.save(args.output / 'base-review-readability.png')
    outputs.append('base-review-readability.png')

    if hashlib.sha256(args.model.read_bytes()).hexdigest() != original_hash:
        raise RuntimeError('Source hash changed while rendering')
    record = {
        'kind': 'TRAINORACLE_OFFLINE_STATIC_MODEL_REVIEW',
        'date': '2026-10-12',
        'renderer': 'Local NumPy/Pillow CPU orthographic z-buffer renderer',
        'sourceFile': args.model.name,
        'sourceSha256BeforeAndAfter': original_hash,
        'sourceUnchanged': True,
        'views': [{'name': name, 'yawDegrees': yaw} for name, yaw in views],
        'outputFrame': {'width': 512, 'height': 512, 'heightScalePixels': 420, 'groundBaselineY': 480},
        'thumbnailSizes': [64, 75],
        'thumbnailMeaning': 'Alpha-cropped model fits a square; this Tori model is taller than wide so its silhouette is 64 or 75 pixels tall.',
        'outputs': outputs,
        'scope': 'Static default scene, embedded base-color texture, simple diffuse light. No package downloads or user-browser control. Not full PBR, skeletal animation, mesh topology, app rendering or owner approval proof.',
    }
    (args.output / 'base-review-renders.json').write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'rendered': len(outputs), 'sourceUnchanged': True, 'sourceSha256': original_hash}))


if __name__ == '__main__':
    main()
