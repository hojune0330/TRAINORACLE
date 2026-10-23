"""Adapt the downloaded Tripo cat in a new editable Blender source.

Preserves the original mesh, rig and walk in sources/tripo/cat. This creates a
separate file with the approved cream/caramel palette, expression bones and
authored interaction actions. It never uploads or overwrites the original.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Quaternion


def linear(value):
    value = value / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def rgba(hex_color):
    return tuple(linear(int(hex_color[i:i + 2], 16)) for i in (0, 2, 4)) + (1,)


def solid(name, color):
    material = bpy.data.materials.new(name)
    material.diffuse_color = rgba(color)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = rgba(color)
    bsdf.inputs['Roughness'].default_value = 1
    return material


def components(mesh):
    adjacent = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        adjacent[a].append(b)
        adjacent[b].append(a)
    unseen = set(range(len(adjacent)))
    groups = []
    while unseen:
        stack, group = [unseen.pop()], []
        while stack:
            i = stack.pop()
            group.append(i)
            for j in adjacent[i]:
                if j in unseen:
                    unseen.remove(j)
                    stack.append(j)
        groups.append(group)
    return sorted(groups, key=len, reverse=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.fbx(filepath=str(args.source.resolve()))
    scene = bpy.context.scene
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    mesh = next(o for o in scene.objects if o.type == 'MESH')
    original_walk = rig.animation_data.action
    original_walk.name = 'TripoOriginalWalk'
    original_walk.use_fake_user = True
    rig.animation_data.action = None
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    scene.frame_set(1)
    bpy.context.view_layer.update()
    # Imported coordinates are retained: the source head is turned about 18 deg.
    groups = components(mesh.data)
    eyes = [group for group in groups if 100 <= len(group) <= 150]
    if len(eyes) != 2:
        raise ValueError('Expected the two separate eye components in this fixed source')
    up = Vector((0, 0, 1))
    across = Vector((.953, -.303, 0)).normalized()
    front = Vector((-.303, -.953, 0)).normalized()
    eye_centers = [sum((mesh.data.vertices[i].co for i in group), Vector()) / len(group) for group in eyes]
    face = sum(eye_centers, Vector()) / 2
    source_image = next(node.image for material in mesh.data.materials for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image)
    cream = solid('Nareun cream #ffedca', 'ffedca')
    caramel = solid('Nareun caramel #d49b67', 'd49b67')
    pink = solid('Nareun pink #f6b89c', 'f6b89c')
    brown = solid('Nareun brown #573722', '573722')
    mesh.data.materials.clear()
    for mat in (cream, caramel, pink, brown):
        mesh.data.materials.append(mat)
    # Static rest-position coordinates keep these patches attached while bending.
    rest = mesh.data.attributes.new('pet_rest_position', 'FLOAT_VECTOR', 'POINT')
    for vertex, attribute in zip(mesh.data.vertices, rest.data):
        attribute.vector = vertex.co
    material = cream
    nodes, links = material.node_tree.nodes, material.node_tree.links
    attribute = nodes.new('ShaderNodeAttribute')
    attribute.attribute_name = 'pet_rest_position'
    separate = nodes.new('ShaderNodeSeparateXYZ')
    links.new(attribute.outputs['Vector'], separate.inputs[0])
    def math_node(op, a, b=None):
        node = nodes.new('ShaderNodeMath')
        node.operation = op
        for i, value in enumerate((a, b)):
            if value is None:
                continue
            if isinstance(value, (int, float)):
                node.inputs[i].default_value = value
            else:
                links.new(value, node.inputs[i])
        return node.outputs[0]
    x, y, z = separate.outputs['X'], separate.outputs['Y'], separate.outputs['Z']
    # Large right-forehead patch; no tiger stripes, brows, fur or freckles.
    face_x = math_node('ADD', math_node('MULTIPLY', x, across.x), math_node('MULTIPLY', y, across.y))
    head_u = math_node('DIVIDE', math_node('ADD', face_x, .10), .24)
    head_v = math_node('DIVIDE', math_node('SUBTRACT', z, .80), .23)
    head_ellipse = math_node('ADD', math_node('MULTIPLY', head_u, head_u), math_node('MULTIPLY', head_v, head_v))
    head_patch = math_node('MULTIPLY', math_node('LESS_THAN', head_ellipse, 1), math_node('LESS_THAN', y, -.13))
    # One broad oval flank patch, mirrored around the body rather than stripes.
    body_y = math_node('DIVIDE', math_node('SUBTRACT', y, .135), .205)
    body_z = math_node('DIVIDE', math_node('SUBTRACT', z, .345), .15)
    oval = math_node('ADD', math_node('MULTIPLY', body_y, body_y), math_node('MULTIPLY', body_z, body_z))
    body_patch = math_node('MULTIPLY', math_node('LESS_THAN', oval, 1), math_node('GREATER_THAN', math_node('ABSOLUTE', x), .115))
    tail_patch = math_node('MULTIPLY', math_node('GREATER_THAN', y, .29), math_node('LESS_THAN', z, .70))
    mask = math_node('MAXIMUM', head_patch, math_node('MAXIMUM', body_patch, tail_patch))
    mix = nodes.new('ShaderNodeMixRGB')
    mix.inputs[1].default_value = rgba('ffedca')
    mix.inputs[2].default_value = rgba('d49b67')
    links.new(mask, mix.inputs[0])
    # Retain only the original UV location of pink ear interiors; repaint them
    # with one flat approved color. This avoids polygon-stepped hand masks.
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = source_image
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(tex.outputs['Color'], channels.inputs['Color'])
    r, g, b = channels.outputs['Red'], channels.outputs['Green'], channels.outputs['Blue']
    ear_mask = math_node('MULTIPLY', math_node('GREATER_THAN', math_node('DIVIDE', b, math_node('MAXIMUM', g, .001)), .70), math_node('GREATER_THAN', math_node('DIVIDE', r, math_node('MAXIMUM', g, .001)), 1.35))
    ear_mask = math_node('MULTIPLY', ear_mask, math_node('GREATER_THAN', z, .67))
    cheek_masks = []
    for cheek_u in (-.117,.117):
        du = math_node('DIVIDE', math_node('SUBTRACT', face_x, face.dot(across)+cheek_u), .024)
        dz = math_node('DIVIDE', math_node('SUBTRACT', z, .520), .017)
        circle = math_node('LESS_THAN', math_node('ADD', math_node('MULTIPLY',du,du), math_node('MULTIPLY',dz,dz)),1)
        cheek_masks.append(math_node('MULTIPLY',circle,math_node('LESS_THAN',y,-.32)))
    pink_mask = math_node('MAXIMUM',ear_mask,math_node('MAXIMUM',*cheek_masks))
    face_mix = nodes.new('ShaderNodeMixRGB')
    links.new(pink_mask,face_mix.inputs[0])
    links.new(mix.outputs[0],face_mix.inputs[1])
    face_mix.inputs[2].default_value=rgba('f6b89c')
    links.new(face_mix.outputs[0], nodes.get('Principled BSDF').inputs['Base Color'])
    eye_indices = set(i for group in eyes for i in group)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True
        polygon.material_index = 3 if all(i in eye_indices for i in polygon.vertices) else 0
    # Smaller oval eyes match the 2D art instead of shiny round toy eyes.
    for group, center in zip(eyes, eye_centers):
        for index in group:
            vertex = mesh.data.vertices[index]
            offset = vertex.co - center
            vertex.co = center + across * offset.dot(across) * .62 + up * offset.z * .83 + front * offset.dot(front) * .30 + front * .006
    # Expression bones keep blinking in the same rig/action as the body.
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    mesh.select_set(False)
    bpy.ops.object.mode_set(mode='EDIT')
    for index, center in enumerate(eye_centers):
        bone = rig.data.edit_bones.new(f'PetEye.{index}')
        bone.head, bone.tail = center, center + up * .05
        bone.parent = rig.data.edit_bones['tripo::Head_3']
    ik_defs = [('front-left','tripo::0_Left_Limb_2',3),('front-right','tripo::0_Right_Limb_1',3),('back-left','tripo::1_Left_Limb_2',2),('back-right','bone_7',2)]
    for label,end,count in ik_defs:
        target = rig.data.edit_bones.new('PetPaw.'+label)
        target.head=rig.data.edit_bones[end].tail.copy()
        target.tail=target.head+up*.06
        target.use_deform=False
    bpy.ops.object.mode_set(mode='OBJECT')
    ik_constraints=[]
    for label,end,count in ik_defs:
        ik=rig.pose.bones[end].constraints.new('IK')
        ik.name='Keep paw on blanket'
        ik.target=rig
        ik.subtarget='PetPaw.'+label
        ik.chain_count=count
        ik.influence=0
        ik.iterations=64
        ik_constraints.append(ik)
    for index, group in enumerate(eyes):
        for vg in mesh.vertex_groups:
            vg.remove(group)
        vg = mesh.vertex_groups.new(name=f'PetEye.{index}')
        vg.add(group, 1, 'REPLACE')
    bpy.context.view_layer.update()

    def surface(u, height, offset=.004):
        point = face + across * u
        point.z = height
        origin = point + front * 2
        hit, location, normal, _ = mesh.ray_cast(origin, -front)
        if not hit:
            raise ValueError(f'Face ray missed at {u}, {height}')
        return location + front * offset

    def bind(obj, bone='tripo::Head_3'):
        obj.parent = rig
        obj.matrix_parent_inverse = rig.matrix_world.inverted()
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        mod = obj.modifiers.new('Pet face follows head', 'ARMATURE')
        mod.object = rig
        return obj

    def curve_mesh(name, points, radius, material):
        data = bpy.data.curves.new(name, 'CURVE')
        data.dimensions = '3D'
        data.resolution_u = 16
        data.bevel_depth, data.bevel_resolution = radius, 3
        spline = data.splines.new('BEZIER')
        spline.bezier_points.add(len(points) - 1)
        for bp, point in zip(spline.bezier_points, points):
            bp.co = point
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj.data.materials.append(material)
        for poly in obj.data.polygons:
            poly.use_smooth = True
        return bind(obj)

    # Friendly W mouth with a small nose and blush, without texture shadows.
    curve_mesh('Nareun smile left', [surface(u, h) for u, h in [(-.038,.515),(-.026,.503),(-.012,.507),(0,.527)]], .0028, brown)
    curve_mesh('Nareun smile right', [surface(u, h) for u, h in [(0,.527),(.012,.507),(.026,.503),(.038,.515)]], .0028, brown)
    for name, u, h, size in [('nose',0,.537,(.014,.008,.009))]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=surface(u,h,.006))
        obj = bpy.context.object
        obj.name = 'Nareun ' + name
        obj.rotation_euler.z = math.atan2(across.y, across.x)
        obj.scale = size
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.data.materials.append(pink)
        for poly in obj.data.polygons:
            poly.use_smooth = True
        bind(obj)
    # Add a light subdivision for joint deformation; keep the original topology.
    sub = mesh.modifiers.new('Smooth authored pet silhouette', 'SUBSURF')
    sub.levels = sub.render_levels = 1

    # Body actions are authored on the actual Tripo animal rig. The untouched
    # downloaded gait remains available as TripoOriginalWalk for comparison.
    def reset_pose():
        for bone in rig.pose.bones:
            bone.rotation_mode = 'QUATERNION'
            bone.location = (0,0,0)
            bone.rotation_quaternion = (1,0,0,0)
            bone.scale = (1,1,1)
        for ik in ik_constraints:
            ik.influence=0

    def rotate(name, axis, angle):
        pb = rig.pose.bones[name]
        local_axis = pb.bone.matrix_local.to_quaternion().inverted() @ axis
        pb.rotation_quaternion = Quaternion(local_axis, angle)

    def move(name, displacement):
        pb = rig.pose.bones[name]
        pb.location = pb.bone.matrix_local.to_quaternion().inverted() @ displacement

    def blink(amount):
        for i in range(2):
            rig.pose.bones[f'PetEye.{i}'].scale = (1, max(.045,1-amount),1)

    def key_all(frame):
        for bone in rig.pose.bones:
            for path in ('location','rotation_quaternion','scale'):
                bone.keyframe_insert(data_path=path, frame=frame, group=bone.name)
        for ik in ik_constraints:
            ik.keyframe_insert(data_path='influence',frame=frame)

    def new_action(name):
        reset_pose()
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        rig.animation_data.action = action
        return action

    def resting(t, breathing=0):
        # The source belly starts only .099 above ground. Lowering the entire
        # body by .18 buries it; fold the neck/legs while keeping the belly clear.
        move('tripo::Root', up*(-.075*t + breathing))
        rotate('tripo::Head_1', across, -.06*t)
        move('tripo::Head_2', up*(-.225*t))
        rotate('tripo::Head_3', across, .38*t)
        rotate('tripo::0_Left_Limb_0', across, -.65*t)
        rotate('tripo::0_Left_Limb_1', across, 1.2*t)
        rotate('tripo::0_Left_Limb_2', across, -.55*t)
        rotate('bone_21', across, -.65*t)
        rotate('tripo::0_Right_Limb_0', across, 1.2*t)
        rotate('tripo::0_Right_Limb_1', across, -.55*t)
        rotate('tripo::1_Left_Limb_1', across, .8*t)
        rotate('tripo::1_Left_Limb_2', across, -1.25*t)
        rotate('bone_6', across, .8*t)
        rotate('bone_7', across, -1.25*t)
        rotate('tripo::Tail_0', across, -1.15*t)
        rotate('tripo::Tail_1', up, -.85*t)
        rotate('tripo::Tail_2', across, .50*t)
        for (label,end,count),ik in zip(ik_defs,ik_constraints):
            ik.influence=1
            # Rear-right sole vertices are weighted to bone_7/8. Their rest
            # toe extends behind the ankle, so its folded contact needs .032.
            lift={'front-left':.018,'front-right':0,'back-left':.044,'back-right':.032}[label]
            move('PetPaw.'+label,front*(.065*t if label.startswith('front') else .025*t)+up*lift*t)
        blink(t)

    new_action('PetIdle')
    for frame in range(1,122,4):
        reset_pose()
        phase=(frame-1)/120*math.tau
        rotate('tripo::Head_3', front, .025*math.sin(phase))
        rotate('tripo::Tail_0', up, .11*math.sin(phase))
        move('tripo::Head_1', up*(.002*math.sin(phase)))
        blink(max(0,1-abs(frame-85)/5))
        key_all(frame)

    new_action('PetStroke')
    for frame,t in [(1,0),(9,.45),(20,1),(36,.85),(48,1),(60,.4),(73,0)]:
        reset_pose()
        rotate('tripo::Head_3', front, -.22*t)
        rotate('tripo::Head_2', across, -.08*t)
        rotate('tripo::Tail_0', up, .20*math.sin(frame*.18)*t)
        move('tripo::Head_2', across*(-.012*t))
        blink(.97*t)
        key_all(frame)

    new_action('PetLieDown')
    for frame,t in [(1,0),(12,.12),(25,.4),(40,.75),(55,1),(73,1)]:
        reset_pose()
        resting(t)
        key_all(frame)

    new_action('PetSleep')
    for frame in range(1,98,4):
        reset_pose()
        resting(1,.0025*math.sin((frame-1)/96*math.tau))
        key_all(frame)

    new_action('PetWake')
    for frame,t in [(1,1),(15,1),(25,.8),(40,.3),(58,0),(73,0)]:
        reset_pose()
        resting(t)
        blink(t if frame<25 else t*.4)
        if frame==58:
            rotate('tripo::Head_3', across,-.15)
        key_all(frame)

    new_action('PetEat')
    for frame,t in [(1,0),(12,.6),(25,1),(34,.85),(43,1),(52,.85),(61,1),(73,0)]:
        reset_pose()
        rotate('tripo::Head_2', across,.28*t)
        rotate('tripo::Head_3', across,.15*t)
        move('tripo::Head_2', up*(-.04*t))
        blink(.8*t)
        rotate('tripo::Tail_0', up,.08*math.sin(frame*.2))
        key_all(frame)

    new_action('PetPlay')
    for frame,t in [(1,0),(10,.3),(22,1),(36,.2),(49,1),(61,.1),(73,0)]:
        reset_pose()
        rotate('tripo::0_Left_Limb_0', across,-.35*t)
        rotate('tripo::0_Left_Limb_1', across,-.15*t)
        rotate('tripo::Head_3', front,-.09*t)
        rotate('tripo::Tail_0', up,.3*math.sin(frame*.12)*t)
        key_all(frame)

    new_action('PetHello')
    for frame,t in [(1,0),(10,.5),(20,1),(34,.55),(47,1),(61,.3),(73,0)]:
        reset_pose()
        rotate('tripo::Head_3', across,-.1*t)
        rotate('tripo::0_Left_Limb_0', across,-.45*t)
        rotate('tripo::0_Left_Limb_1', across,.9*t)
        rotate('tripo::Tail_0', up,.25*math.sin(frame*.13)*t)
        blink(.5*t)
        key_all(frame)

    rig.animation_data.action = bpy.data.actions['PetIdle']
    reset_pose()
    scene.frame_start, scene.frame_end = 1,121
    scene.frame_set(1)
    scene.render.fps = 30
    args.output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    print(json.dumps({'source':str(args.output),'actions':[a.name for a in bpy.data.actions], 'eyeCenters':[list(c) for c in eye_centers]}))


main()
