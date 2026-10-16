"""Render approved Tripo rigs into small, transparent app assets. Sources stay unchanged.
Blender 4.5 LTS; --source <v3-folder> --output <folder> [--pilot | --idle-only].
Original run/walk/warm_up clips are sampled at their source timing. The new nod is
an authored 10-degree head gesture on a frozen warm-up pose, not an exercise demo.
"""
import bpy, math, json, argparse, sys, hashlib
from pathlib import Path
from mathutils import Vector, Quaternion

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--pilot', action='store_true')
p.add_argument('--idle-only', action='store_true')
args = p.parse_args(sys.argv[sys.argv.index('--')+1:])
args.source=args.source.resolve()
args.output=args.output.resolve()
args.output.mkdir(parents=True, exist_ok=True)
records = []

for animal in (['otter'] if args.pilot or args.idle_only else ['otter','cat','bear']):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = 24
    scene.view_settings.view_transform = 'Standard'
    path = args.source / f'trainoracle-{animal}-exercise-set-v3.glb'
    bpy.ops.import_scene.gltf(filepath=str(path))
    rig = next(o for o in scene.objects if o.type == 'ARMATURE')
    meshes = [o for o in scene.objects if o.type == 'MESH']
    actions = {name: next(a for a in bpy.data.actions if name in a.name.lower()) for name in ['run','walk','warm_up']}
    for o in scene.objects:
        if o.animation_data:
            o.animation_data.use_nla = False
    def pose(motion, time):
        rig.animation_data.action = actions['warm_up' if motion == 'nod' else motion]
        if rig.animation_data.action.slots:
            rig.animation_data.action_slot = rig.animation_data.action.slots[0]
        scene.frame_set(int(time*24), subframe=time*24-int(time*24))
        bpy.context.view_layer.update()
    def points():
        dg = bpy.context.evaluated_depsgraph_get()
        return [o.matrix_world @ v.co for o in meshes for v in o.evaluated_get(dg).data.vertices]
    pose('warm_up',0)
    base = {bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
    def nod(t, clear=True):
        if clear: rig.animation_data.action = None
        for bone in rig.pose.bones: bone.matrix_basis = base[bone.name]
        head = rig.pose.bones.get('mixamorig:Head')
        if head:
            angle = math.radians(-10) * math.sin(math.pi * t / 1.2)**2
            head.rotation_mode='QUATERNION'
            head.rotation_quaternion = head.rotation_quaternion @ Quaternion((1,0,0),angle)
        bpy.context.view_layer.update()
    duration = {'run':1.25, 'walk':2.333333, 'warm_up':2.8, 'nod':1.2}
    all_points=[]
    for motion in ['run','walk','warm_up']:
        for i in range(8):
            pose(motion,duration[motion]*i/8)
            all_points.extend(points())
    low = Vector([min(v[i] for v in all_points) for i in range(3)])
    high = Vector([max(v[i] for v in all_points) for i in range(3)])
    center = (low+high)/2
    height = max(high.z-low.z,high.x-low.x)*1.24
    camera_data = bpy.data.cameras.new('CompanionCamera')
    camera=bpy.data.objects.new('CompanionCamera',camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((.7,-3.5,.6))*height
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type='ORTHO'; camera_data.ortho_scale=height
    scene.camera=camera
    world = bpy.data.worlds.new('Soft studio')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.85,.88,1,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
    scene.world=world
    for name,loc,energy,size in [('Key',(-2,-3,4),90,3),('Fill',(3,-2,1.5),45,3),('Rim',(0,3,3),70,2)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size*height
        light=bpy.data.objects.new(name,data); scene.collection.objects.link(light)
        light.location=center+Vector(loc)*height
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    def render(name,size):
        scene.render.resolution_x=scene.render.resolution_y=size
        scene.render.resolution_percentage=100
        scene.render.filepath=str(args.output/name)
        bpy.ops.render.render(write_still=True)
    if args.idle_only:
        # Add a calm performance without replacing the approved exercise clips.
        idle_seconds=5.6
        head=rig.pose.bones['mixamorig:Head']
        chest=rig.pose.bones['mixamorig:Spine2']
        feet=[rig.pose.bones[f'mixamorig:{side}Foot'] for side in ['Left','Right']]
        def idle(t, clear=True):
            if clear: rig.animation_data.action=None
            for bone in rig.pose.bones: bone.matrix_basis=base[bone.name]
            phase=2*math.pi*t/idle_seconds
            chest.scale.y*=1+.017*(1-math.cos(phase))/2
            head.rotation_mode='QUATERNION'
            head.rotation_quaternion=head.rotation_quaternion @ Quaternion((0,1,0),math.radians(3.5)*math.sin(phase)) @ Quaternion((1,0,0),math.radians(1.2)*math.sin(phase))
            bpy.context.view_layer.update()
        idle(0)
        initial_feet=[bone.matrix.translation.copy() for bone in feet]
        initial_pose={bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
        foot_drift=0.0
        for frame in range(16):
            idle(idle_seconds*frame/16)
            foot_drift=max(foot_drift,max((bone.matrix.translation-start).length for bone,start in zip(feet,initial_feet)))
            render(f'otter-idle-{frame:02}.png',512)
        idle(idle_seconds)
        loop_error=max(abs(bone.matrix_basis[i][j]-initial_pose[bone.name][i][j]) for bone in rig.pose.bones for i in range(4) for j in range(4))
        idle(0)
        rig.animation_data.action=bpy.data.actions.new('TrainOracle_calm_idle')
        for frame in range(136):
            idle(idle_seconds*frame/135,clear=False)
            for bone in [head,chest]:
                bone.keyframe_insert('rotation_quaternion',frame=frame)
                bone.keyframe_insert('scale',frame=frame)
        scene.frame_start=0;scene.frame_end=135
        bpy.ops.wm.save_as_mainfile(filepath=str(args.output/'otter-app-idle.blend'))
        (args.output/'idle-render-record.json').write_text(json.dumps({'source':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'durationSeconds':idle_seconds,'frameCount':16,'headTurnDegrees':3.5,'chestExpansion':.017,'maxFootDrift':foot_drift,'loopPoseError':loop_error,'camera':list(camera.location),'orthographicScale':height},indent=2),encoding='utf8')
        continue
    for motion,t in [('run',.2),('walk',.5),('warm_up',1.0)]:
        pose(motion,t)
        render(f'{animal}-{motion}.png',768)
    if animal=='otter':
        nod(0)
        render('otter-nod.png',768)
        if not args.pilot:
            for motion in ['run','walk','warm_up','nod']:
                for frame in range(16):
                    t=duration[motion]*frame/15
                    nod(t) if motion=='nod' else pose(motion,t)
                    render(f'otter-{motion}-{frame:02}.png',512)
            # Store an editable nod action separately from untouched source motions.
            nod(0)
            rig.animation_data.action=bpy.data.actions.new('TrainOracle_saved_nod')
            for frame in range(30):
                t=1.2*frame/29; nod(t,clear=False)
                for bone in rig.pose.bones:
                    bone.keyframe_insert('rotation_quaternion',frame=frame)
                    bone.keyframe_insert('location',frame=frame)
                    bone.keyframe_insert('scale',frame=frame)
            if rig.animation_data.action: rig.animation_data.action.name='TrainOracle_saved_nod'
            bpy.ops.wm.save_as_mainfile(filepath=str(args.output/'otter-app-nod.blend'))
    records.append({'animal':animal,'source':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'clips':duration if animal=='otter' else ['run','walk','warm_up'],'camera':list(camera.location),'orthographicScale':height})
    (args.output/'render-record.json').write_text(json.dumps(records,indent=2),encoding='utf8')
print('IDLE_FRAMES_RENDERED 16' if args.idle_only else f'COMPANIONS_RENDERED {len(records)}',flush=True)
