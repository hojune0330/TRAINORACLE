"""Give the cat a visible paw reach/wave; keep approved petting/resting actions."""
import argparse, math, sys
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector
p=argparse.ArgumentParser()
p.add_argument('--source',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()),load_ui=False)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
up=Vector((0,0,1)); across=Vector((.953,-.303,0)); front=Vector((-.303,-.953,0))
def reset():
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
        pb.rotation_mode='QUATERNION'
        for constraint in pb.constraints:
            if constraint.type=='IK':constraint.influence=0
def rotate(name,axis,amount):
    pb=rig.pose.bones[name]
    pb.rotation_quaternion=Quaternion(pb.bone.matrix_local.to_quaternion().inverted()@axis,amount)
for name in ('PetPlayReach','PetHelloWave'):
    action=bpy.data.actions.new(name); action.use_fake_user=True
    rig.animation_data.action=action
    for frame,t in [(1,0),(10,.45),(22,1),(36,.65),(49,1),(61,.2),(73,0)]:
        reset()
        target=rig.pose.bones['PetPaw.front-left']
        delta=front*(.12 if name=='PetPlayReach' else .05)*t+up*(.09 if name=='PetPlayReach' else .16)*t
        target.location=target.bone.matrix_local.to_quaternion().inverted()@delta
        rig.pose.bones['tripo::0_Left_Limb_2'].constraints['Keep paw on blanket'].influence=1
        rotate('tripo::Head_3',front,-.08*t)
        rotate('tripo::Tail_0',up,.22*math.sin(frame*.13)*t)
        if name=='PetHelloWave':
            rotate('tripo::0_Left_Limb_3',front,.18*math.sin(frame*.35)*t)
            for i in range(2):rig.pose.bones[f'PetEye.{i}'].scale=(1,1-.45*t,1)
        for pb in rig.pose.bones:
            for channel in ('location','rotation_quaternion','scale'):pb.keyframe_insert(data_path=channel,frame=frame,group=pb.name)
            for constraint in pb.constraints:
                if constraint.type=='IK':constraint.keyframe_insert(data_path='influence',frame=frame)
rig.animation_data.action=bpy.data.actions['PetIdle']
rig.animation_data.action_slot=rig.animation_data.action.slots[0]
reset();bpy.context.scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(a.output.resolve()))
