"""Retain Tripo gait timing, reducing its oversized stride for the short pet body."""
import argparse, sys, math
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()), load_ui=False)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
original = bpy.data.actions['TripoOriginalWalk']
samples = []
rig.animation_data.action = original
rig.animation_data.action_slot = original.slots[0]
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
    for constraint in pb.constraints:
        if constraint.type == 'IK': constraint.influence = 0
for frame in range(1, 79):
    bpy.context.scene.frame_set(frame)
    samples.append({pb.name: (pb.location.copy(), pb.rotation_quaternion.copy(), pb.scale.copy()) for pb in rig.pose.bones})
action = bpy.data.actions.new('PetWalk')
action.use_fake_user = True
rig.animation_data.action = action
for frame, sample in enumerate(samples, 1):
    for pb in rig.pose.bones:
        location, rotation, scale = sample[pb.name]
        strength = .55
        if pb.name in ('tripo::Root', 'tripo::Head_0', 'tripo::Head_1', 'tripo::Head_2', 'tripo::Head_3', 'tripo::1_Left_Limb_0'):
            strength = .28
        if 'Tail' in pb.name: strength = .32
        pb.rotation_quaternion = Quaternion((1,0,0,0)).slerp(rotation, strength)
        pb.location = location * strength
        pb.scale = Vector((1,1,1)).lerp(scale, strength)
        for channel in ('location','rotation_quaternion','scale'):
            pb.keyframe_insert(data_path=channel, frame=frame, group=pb.name)
    for pb in rig.pose.bones:
        for constraint in pb.constraints:
            if constraint.type == 'IK': constraint.keyframe_insert(data_path='influence',frame=frame)
rig.animation_data.action = bpy.data.actions['PetIdle']
rig.animation_data.action_slot = rig.animation_data.action.slots[0]
bpy.context.scene.frame_set(1)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(a.output.resolve()))
