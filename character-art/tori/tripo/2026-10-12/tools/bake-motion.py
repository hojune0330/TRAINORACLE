"""Blender 4.5 LTS: preserve FBX, simplify body material, bake 16 transparent poses.

Run: blender --background --factory-startup --python tools/bake-motion.py
Output is next to the untouched motion source. No external services are called.
"""
import bpy, json, math, hashlib
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parent.parent
out=root/'motion'/'frames'; out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
source=root/'motion'/'tori-game-motions.fbx'
bpy.ops.import_scene.fbx(filepath=str(source))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH')
for track in rig.animation_data.nla_tracks: track.mute=True
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=16
scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
scene.render.film_transparent=True; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard'
# Preserve the source texture, repairing its neutral unpainted regions using
# rest-space colours; no geometry, skin weights or animation keys are changed.
# Emission avoids adding lighting over the source's painted lighting.
col=mesh.data.color_attributes.new(name='NeutralRepair',type='FLOAT_COLOR',domain='POINT')
threshold=mesh.data.color_attributes.new(name='RepairThreshold',type='FLOAT_COLOR',domain='POINT')
col=mesh.data.color_attributes['NeutralRepair']
threshold=mesh.data.color_attributes['RepairThreshold']
def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
for v in mesh.data.vertices:
    x,y,z=(mesh.matrix_world@v.co)
    rgb=(.97,.70,.45)
    if z<.023: rgb=(1,.36,.13)
    elif z<.14: rgb=(.97,.98,1)
    elif .32<z<.44 and abs(x)<.15: rgb=(.14,.24,.80)
    elif .44<=z<.575 and abs(x)<.088: rgb=(.02,.77,.59)
    elif z>=.71: rgb=(.26,.18,.31)
    col.data[v.index].color=(*[linear(c) for c in rgb],1)
    t=.75 if z<.575 else .35
    threshold.data[v.index].color=(t,t,t,1)
for mat in mesh.data.materials:
    nodes=mat.node_tree.nodes
    tex=next(n for n in nodes if n.type=='TEX_IMAGE')
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    emission=nodes.new('ShaderNodeEmission'); emission.inputs['Strength'].default_value=1
    hsv=nodes.new('ShaderNodeSeparateColor'); hsv.mode='HSV'; mat.node_tree.links.new(tex.outputs['Color'],hsv.inputs[0])
    sat=nodes.new('ShaderNodeMath'); sat.operation='LESS_THAN'; sat.inputs[1].default_value=.28; mat.node_tree.links.new(hsv.outputs[1],sat.inputs[0])
    th=nodes.new('ShaderNodeVertexColor'); th.layer_name=threshold.name; mat.node_tree.links.new(th.outputs['Color'],sat.inputs[1])
    val=nodes.new('ShaderNodeMath'); val.operation='LESS_THAN'; val.inputs[1].default_value=.65; mat.node_tree.links.new(hsv.outputs[2],val.inputs[0])
    mul=nodes.new('ShaderNodeMath'); mul.operation='MULTIPLY'; mat.node_tree.links.new(sat.outputs[0],mul.inputs[0]); mat.node_tree.links.new(val.outputs[0],mul.inputs[1])
    attr=nodes.new('ShaderNodeVertexColor'); attr.layer_name=col.name
    mix=nodes.new('ShaderNodeMixRGB'); mat.node_tree.links.new(mul.outputs[0],mix.inputs[0]); mat.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]); mat.node_tree.links.new(attr.outputs['Color'],mix.inputs[2])
    mat.node_tree.links.new(mix.outputs[0],emission.inputs['Color'])
    mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
camera_data=bpy.data.cameras.new('FixedCamera'); camera=bpy.data.objects.new('FixedCamera',camera_data); scene.collection.objects.link(camera); scene.camera=camera
camera_data.type='ORTHO'; camera_data.ortho_scale=512/420
target=Vector((0,0,224/420)); camera.location=target+Vector((-8,-5,0)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
samples=[('run',1+i*30/8) for i in range(8)]+[('idle',1),('idle',31),('jump',15),('jump',27),('jump',40),('hit_to_body_01',12),('fall',18),('cheer',60)]
def set_pose(name,frame):
    a=bpy.data.actions['Armature|'+name]; rig.animation_data.action=a; rig.animation_data.action_slot=a.slots[0]
    scene.frame_set(int(frame),subframe=frame%1)
    evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)
# One ground across the run cycle preserves its vertical bounce and flight.
run_ground=min(set_pose(name,frame) for name,frame in samples[:8])
manifest={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'cameraOffset':[-8,-5,0],'orthoScale':camera_data.ortho_scale,'fps':scene.render.fps,'baseline':480,'pivotX':256,'runGround':run_ground,'frames':[]}
counts={}
for index,(name,frame) in enumerate(samples):
    ground=set_pose(name,frame)
    hip=rig.matrix_world@rig.pose.bones['mixamorig:Hips'].head
    target.x=hip.x; target.y=hip.y
    target.z=(run_ground if name=='run' else ground)+224/420
    camera.location=target+Vector((-8,-5,0)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    label={'hit_to_body_01':'hit'}.get(name,name); counts[label]=counts.get(label,0)+1
    filename=f'tori_{label}_{counts[label]:02d}.png'
    scene.render.filepath=str(out/filename); bpy.ops.render.render(write_still=True)
    manifest['frames'].append({'index':index,'file':filename,'action':name,'frame':frame,'cameraTarget':list(target)})
    print('RENDERED',index,name,frame,flush=True)
(root/'motion'/'bake-manifest.json').write_text(json.dumps(manifest,indent=2))
set_pose('idle',1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(root/'motion'/'tori-authoring.blend'))
