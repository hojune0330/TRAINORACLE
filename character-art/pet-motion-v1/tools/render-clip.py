"""Render a reviewed, rigged GLB/Blend action to transparent game frames.

Blender CLI: --background --factory-startup --disable-autoexec --python FILE -- ...
Never writes over the input mesh or imports its embedded Python scripts.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--action', required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--frames', type=int, default=24)
    p.add_argument('--fps', type=int, default=12)
    p.add_argument('--size', type=int, default=512)
    p.add_argument('--azimuth', type=float, default=20)
    p.add_argument('--elevation', type=float, default=12)
    p.add_argument('--ortho', type=float, default=1.65)
    p.add_argument('--target-height', type=float, default=.55)
    p.add_argument('--flat', action='store_true')
    p.add_argument('--outline-hull', action='store_true', help='Simple silhouette shell for new low-detail pets; existing Freestyle renders stay unchanged')
    p.add_argument('--loop', action='store_true', help='Sample the cycle without duplicating its closing frame')
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if args.frames < 2 or args.frames > 96:
        raise ValueError('Expected 2..96 frames')
    source = args.source.resolve()
    if source.suffix.lower() == '.blend':
        bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
    scene = bpy.context.scene
    meshes = [o for o in scene.objects if o.type == 'MESH' and not o.hide_render]
    rigs = [o for o in scene.objects if o.type == 'ARMATURE']
    if not rigs or not meshes:
        raise ValueError('A deformable mesh and skeleton are required; no substitute drawing is generated')
    action = bpy.data.actions.get(args.action)
    if not action:
        raise ValueError('Action missing: ' + args.action + '; available: ' + ', '.join(a.name for a in bpy.data.actions))
    for rig in rigs:
        rig.data.pose_position = 'REST'
        if rig.animation_data:
            for track in rig.animation_data.nla_tracks:
                track.mute = True
    bpy.context.view_layer.update()
    coords = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    low = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
    height = high.z - low.z
    if height <= .0001:
        raise ValueError('The model has no measurable height')
    root = bpy.data.objects.new('PetRenderSpace', None)
    scene.collection.objects.link(root)
    for obj in list(scene.objects):
        if obj is not root and obj.parent is None:
            obj.parent = root
    root.scale = (1 / height,) * 3
    root.location = (-(high.x + low.x) / 2 / height, -(high.y + low.y) / 2 / height, -low.z / height)
    for rig in rigs:
        rig.data.pose_position = 'POSE'
        rig.animation_data_create()
        rig.animation_data.action = action
        if action.slots:
            rig.animation_data.action_slot = action.slots[0]
    if args.flat:
        for material in bpy.data.materials:
            if not material.use_nodes:
                continue
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
            output = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None)
            if not bsdf or not output:
                continue
            emission = nodes.new('ShaderNodeEmission')
            base = bsdf.inputs['Base Color']
            emission.inputs['Color'].default_value = base.default_value
            if base.is_linked:
                links.new(base.links[0].from_socket, emission.inputs['Color'])
            links.new(emission.outputs[0], output.inputs['Surface'])
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if args.outline_hull else 'CYCLES'
    # Several independent pets can render without each taking every CPU core.
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    if args.outline_hull:
        # Flat emission needs no lighting denoiser. This mode is opt-in and is
        # reviewed independently; never re-renders previously accepted pets.
        scene.cycles.use_denoising = False
        scene.render.use_persistent_data = True
        if hasattr(scene.eevee, 'taa_render_samples'):
            scene.eevee.taa_render_samples = 16
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = args.size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = args.fps
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'Medium High Contrast' if not args.flat else 'None'
    scene.world = bpy.data.worlds.new('PetRenderWorld')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
    camera_data = bpy.data.cameras.new('PetSpriteCamera')
    camera = bpy.data.objects.new('PetSpriteCamera', camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = args.ortho
    target = Vector((0, 0, args.target_height))
    yaw, pitch = math.radians(args.azimuth), math.radians(args.elevation)
    camera.location = target + Vector((math.sin(yaw) * math.cos(pitch), -math.cos(yaw) * math.cos(pitch), math.sin(pitch))) * 5
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    lamp_data = bpy.data.lights.new('SoftLight', 'AREA')
    lamp = bpy.data.objects.new('SoftLight', lamp_data)
    scene.collection.objects.link(lamp)
    lamp.location = (-3, -4, 5)
    lamp.rotation_euler = (-lamp.location).to_track_quat('-Z', 'Y').to_euler()
    lamp_data.energy, lamp_data.size = 250, 5
    scene.render.use_freestyle = True
    lines = bpy.context.view_layer.freestyle_settings.linesets[0]
    lines.select_crease = False
    lines.select_silhouette = lines.select_contour = lines.select_border = True
    if lines.linestyle is None:
        lines.linestyle = bpy.data.linestyles.new('WarmPetOutline')
    # Blender stores linear colors; keep the final outline at the UI's #493b32.
    def linear(channel):
        value = channel / 255
        return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4
    lines.linestyle.color = tuple(linear(value) for value in (73, 59, 50))
    lines.linestyle.thickness = 2.5
    if args.outline_hull:
        import bmesh
        scene.render.use_freestyle = False
        outline = bpy.data.materials.new('Simple warm silhouette')
        outline.use_nodes = True
        nodes = outline.node_tree.nodes; links = outline.node_tree.links
        nodes.clear()
        output = nodes.new('ShaderNodeOutputMaterial')
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs['Color'].default_value = tuple(linear(v) for v in (73, 59, 50)) + (1,)
        transparent = nodes.new('ShaderNodeBsdfTransparent')
        geom = nodes.new('ShaderNodeNewGeometry')
        mix = nodes.new('ShaderNodeMixShader')
        links.new(geom.outputs['Backfacing'], mix.inputs[0])
        links.new(emission.outputs[0], mix.inputs[1])
        links.new(transparent.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], output.inputs['Surface'])
        for mesh in meshes:
            shell = mesh.copy(); shell.data = mesh.data.copy()
            shell.name = mesh.name + ' silhouette'
            scene.collection.objects.link(shell)
            shell.data.materials.clear(); shell.data.materials.append(outline)
            for face in shell.data.polygons: face.material_index = 0
            bm = bmesh.new(); bm.from_mesh(shell.data)
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
            bm.to_mesh(shell.data); bm.free()
            expand = shell.modifiers.new('Outline width', 'DISPLACE')
            expand.direction = 'NORMAL'; expand.strength = -.008 * height; expand.mid_level = 0
    args.output.mkdir(parents=True, exist_ok=True)
    start, end = action.frame_range
    if args.outline_hull:
        # Render the clip as a single animation job so Blender keeps its render
        # engine and shaders between frames. Only the temporary action is retimed.
        sampled = action.copy(); sampled.name = 'Temporary sprite sampling'
        intervals = args.frames if args.loop else args.frames - 1
        ratio = intervals / (float(end) - float(start))
        for curve in sampled.fcurves:
            for point in curve.keyframe_points:
                for vector in (point.co, point.handle_left, point.handle_right):
                    vector.x = (vector.x - float(start)) * ratio
        for rig in rigs:
            rig.animation_data.action = sampled
            if sampled.slots: rig.animation_data.action_slot = sampled.slots[0]
        scene.frame_start = 0; scene.frame_end = args.frames - 1
        scene.render.filepath = str((args.output / 'batch-').resolve())
        bpy.ops.render.render(animation=True)
        for index in range(args.frames):
            (args.output / f'batch-{index:04}.png').replace(args.output / f'{index:03}.png')
    else:
        for index in range(args.frames):
            # A loop's closing pose equals its first pose. Showing both adds a pause.
            intervals = args.frames if args.loop else args.frames - 1
            sample = float(start) + (float(end) - float(start)) * index / intervals
            scene.frame_set(math.floor(sample), subframe=sample % 1)
            scene.render.filepath = str((args.output / f'{index:03}.png').resolve())
            bpy.ops.render.render(write_still=True)
    metadata = {'source': source.name, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'action': args.action, 'sourceFrames': [start, end], 'frames': args.frames,
                'fps': args.fps, 'size': args.size, 'blender': bpy.app.version_string,
                'camera': {'azimuth': args.azimuth, 'elevation': args.elevation, 'ortho': args.ortho, 'targetHeight': args.target_height},
                'flat': args.flat, 'loop': args.loop,
                'outline': 'inverted-hull' if args.outline_hull else 'freestyle'}
    (args.output / 'render.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print('Rendered ' + str(args.output))


main()
