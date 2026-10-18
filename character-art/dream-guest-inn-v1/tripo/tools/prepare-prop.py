"""Preserve Tripo source; locally simplify and render reproducible game sprites.

Run in Blender 4.5+: blender --background --python prepare-prop.py --
  --source sources/model.glb --id hooded-lamp --output public/tripo
This script makes no network or Tripo API calls and never writes the source.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--id', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--report', required=True)
parser.add_argument('--triangles', type=int, default=4800)
parser.add_argument('--texture', type=int, default=512)
parser.add_argument('--front-yaw', type=float, default=0)
parser.add_argument('--task', default='')
parser.add_argument('--credits', type=int, default=55)
parser.add_argument('--directions', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = Path(args.source).resolve()
out = Path(args.output).resolve()
out.mkdir(parents=True, exist_ok=True)
before_hash = hashlib.sha256(source.read_bytes()).hexdigest()

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not meshes:
    raise RuntimeError('No mesh imported')
def triangles(objects):
    return sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons) for obj in objects)
source_triangles = triangles(meshes)
source_meshes = len(meshes)
source_materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})

# Apply source transforms before centering and scaling a working mesh.
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.object
obj.name = args.id
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
obj.rotation_mode = 'XYZ'
vertices = [vertex.co.copy() for vertex in obj.data.vertices]
low = Vector(tuple(min(v[i] for v in vertices) for i in range(3)))
high = Vector(tuple(max(v[i] for v in vertices) for i in range(3)))
source_bounds = {'min': list(low), 'max': list(high)}
center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
height = high.z - low.z
if height <= 0:
    raise RuntimeError('Mesh has no height')
# A normalized height is a presentation scale, not a claimed physical size.
scale = 2.0 / height
for vertex in obj.data.vertices:
    vertex.co = (vertex.co - center) * scale
obj.data.update()

reconstruction = False
if source_triangles > 100000:
    # Rebuild the untouched source, not a previously collapsed triangle soup.
    # Collapsing first can open the surface and erase it during voxel remeshing.
    reconstruction = True
    high_object = obj
    high_object.name = args.id + '-bake-source'
    obj = high_object.copy()
    obj.data = high_object.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.name = args.id
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    remesh = obj.modifiers.new('Connected mobile surface', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = 0.016
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    if triangles([obj]) > args.triangles:
        reduction = obj.modifiers.new('Reconstructed surface budget', 'DECIMATE')
        reduction.ratio = args.triangles / triangles([obj])
        reduction.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=reduction.name)
    obj.data.validate(clean_customdata=True)
    obj.data.update(calc_edges=True)
    while obj.data.uv_layers:
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
    obj.data.uv_layers.new(name='Mobile UV')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.015)
    bpy.ops.object.mode_set(mode='OBJECT')
    for slot in high_object.material_slots:
        if not slot.material:
            continue
        slot.material = slot.material.copy()
        nodes, links = slot.material.node_tree.nodes, slot.material.node_tree.links
        shader = next((node for node in nodes if node.type == 'BSDF_PRINCIPLED'), None)
        output = next((node for node in nodes if node.type == 'OUTPUT_MATERIAL'), None)
        if shader and output:
            color = shader.inputs['Base Color']
            emission = nodes.new('ShaderNodeEmission')
            emission.inputs['Strength'].default_value = 1
            if color.links:
                links.new(color.links[0].from_socket, emission.inputs['Color'])
            else:
                emission.inputs['Color'].default_value = color.default_value
            links.new(emission.outputs[0], output.inputs['Surface'])
    baked = bpy.data.images.new(args.id + '-basecolor-mobile', width=args.texture, height=args.texture, alpha=True)
    material = bpy.data.materials.new(args.id + '-matte-mobile')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = 0.85
    shader.inputs['Metallic'].default_value = 0.05
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = baked
    nodes.active = texture
    obj.data.materials.clear()
    obj.data.materials.append(material)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 8
    scene.cycles.device = 'CPU'
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.06
    scene.render.bake.max_ray_distance = 0.18
    high_object.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='EMIT')
    links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    baked.pack()
    bpy.data.objects.remove(high_object, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
elif source_triangles > args.triangles:
    modifier = obj.modifiers.new('Local mobile simplification', 'DECIMATE')
    modifier.ratio = args.triangles / source_triangles
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
obj.data.validate(clean_customdata=True)
obj.data.update(calc_edges=True)
for poly in obj.data.polygons:
    poly.use_smooth = True
actual_triangles = triangles([obj])
if actual_triangles > 6000:
    raise RuntimeError(f'Mobile triangle budget exceeded: {actual_triangles}')
images = []
runtime_images = {node.image for slot in obj.material_slots if slot.material and slot.material.use_nodes for node in slot.material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image}
for image in runtime_images:
    if image.type != 'IMAGE' or image.size[0] <= 0:
        continue
    original = list(image.size)
    if max(original) > args.texture:
        image.scale(max(1, round(original[0] * args.texture / max(original))), max(1, round(original[1] * args.texture / max(original))))
    image.pack()
    images.append({'name': image.name, 'sourceSize': original, 'runtimeSize': list(image.size)})

refinements = []
if args.id == 'hooded-lamp':
    # The generated shade is almost front/back symmetric. Add a real opaque
    # rear shield and an unmistakable front lens; yaw now has visual meaning.
    def flat_material(name, color, emission=0):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*color, 1)
        shader.inputs['Roughness'].default_value = 0.85
        if emission:
            shader.inputs['Emission Color'].default_value = (*color, 1)
            shader.inputs['Emission Strength'].default_value = emission
        return material
    shield_mat = flat_material('Local opaque slate rear shield', (0.18, 0.29, 0.36))
    lens_mat = flat_material('Local warm forward lens', (1.0, 0.66, 0.21), 0.45)
    parts = [obj]
    vertices, faces = [], []
    segments = 20
    # +Y is the back; the opening and lens face -Y (south on the board).
    for radius in (0.355, 0.325):
        for z in (0.72, 1.25):
            for index in range(segments + 1):
                angle = math.pi * index / segments
                vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
    row = segments + 1
    for index in range(segments):
        for a, b in ((0, 1), (2, 3), (0, 2), (1, 3)):
            faces.append((a * row + index, a * row + index + 1, b * row + index + 1, b * row + index))
    faces.extend([(0, row, 3 * row, 2 * row), (segments, row + segments, 3 * row + segments, 2 * row + segments)])
    mesh = bpy.data.meshes.new('Directional rear shield mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    shield = bpy.data.objects.new('Directional rear shield', mesh)
    bpy.context.scene.collection.objects.link(shield)
    shield.data.materials.append(shield_mat)
    parts.append(shield)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.235, location=(0, -0.27, 0.99))
    lens = bpy.context.object
    lens.name = 'Forward amber lens'
    lens.scale = (1.0, 0.24, 1.06)
    lens.data.materials.append(lens_mat)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parts.append(lens)
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    obj.data.validate(clean_customdata=True)
    obj.data.update(calc_edges=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    actual_triangles = triangles([obj])
    if actual_triangles > 6000:
        raise RuntimeError(f'Refined lamp triangle budget exceeded: {actual_triangles}')
    refinements.append('Blender-authored opaque rear half-cylinder shield and warm forward lens; original Tripo shade was front/back symmetric')

obj.rotation_euler[2] = math.radians(args.front_yaw)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
glb = out / f'{args.id}.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=True, export_materials='EXPORT', export_image_format='AUTO')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.device = 'CPU'
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.render.film_transparent = True
scene.render.image_settings.compression = 30
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.7
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.76, 0.82, 0.92, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55

def area(name, location, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size, data.color = energy, 'DISK', size, color
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
area('Soft warm key', (-3, -4, 6), 400, 5, (1.0, 0.88, 0.72))
area('Cool fill', (4, -1, 4), 200, 5, (0.76, 0.86, 1.0))
area('Rim', (0, 4, 5), 250, 4, (1.0, 0.94, 0.82))
camera_data = bpy.data.cameras.new('Fixed sprite camera')
camera = bpy.data.objects.new('Fixed sprite camera', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
target = Vector((0, 0, 1.08))
camera.location = target + Vector((0, -6, 3.6))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
# Wide props are fitted as a whole; all directions share one scale and pivot.
horizontal = max(high.x - low.x, high.y - low.y) * scale
camera_data.ortho_scale = max(2.9, horizontal * 1.22)
directions = [('south', 0), ('east', 90), ('north', 180), ('west', 270)] if args.directions else [('south', 0)]
renders = []
for direction, yaw in directions:
    obj.rotation_euler[2] = math.radians(yaw)
    png = out / f'{args.id}-{direction}.png'
    scene.render.filepath = str(png)
    bpy.ops.render.render(write_still=True)
    renders.append({'direction': direction, 'yawDegreesAfterCanonicalization': yaw, 'file': png.name, 'bytes': png.stat().st_size, 'sha256': hashlib.sha256(png.read_bytes()).hexdigest()})

if hashlib.sha256(source.read_bytes()).hexdigest() != before_hash:
    raise RuntimeError('Source changed during processing')
report = {
    'id': args.id, 'generator': 'Tripo Studio H3.1 text-to-model', 'taskId': args.task,
    'generationCreditsReportedByOperator': args.credits, 'localProcessingCredits': 0,
    'source': {'file': source.name, 'bytes': source.stat().st_size, 'sha256': before_hash, 'meshes': source_meshes, 'triangles': source_triangles, 'materials': source_materials, 'bounds': source_bounds},
    'runtime': {'file': glb.name, 'bytes': glb.stat().st_size, 'sha256': hashlib.sha256(glb.read_bytes()).hexdigest(), 'triangles': actual_triangles, 'textureMaximum': args.texture, 'images': images},
    'processing': {'tool': bpy.app.version_string, 'targetTriangles': args.triangles, 'decimation': 'Voxel reconstruction + collapse + 512px source-color bake' if reconstruction else 'Blender collapse modifier, original UVs retained', 'pivot': 'source XY center, bottom Z=0; normalized height=2', 'frontYawDegrees': args.front_yaw, 'sourcePreserved': True, 'localRefinements': refinements},
    'sprites': {'size': [512, 512], 'transparent': True, 'fixedCamera': list(camera.location), 'target': list(target), 'orthoScale': camera_data.ortho_scale, 'directions': renders, 'orientationVerification': 'Requires visual check of the generated hood before runtime acceptance'},
}
Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('SLEEP_INN_PROP_RESULT ' + json.dumps(report, ensure_ascii=False))
