"""Add both reusable review cameras to the baked working copy; change no action."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'tori-two-view-authoring.blend'))
manifest=json.loads((ROOT/'bake-manifest.json').read_text())
idle=next(c for c in manifest['clips'] if c['id']=='idle')
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
action=bpy.data.actions['Armature|idle'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
scene=bpy.context.scene;scene.frame_set(1);scene.frame_start=1;scene.frame_end=369
existing=scene.camera
for name,data in idle['views'].items():
 if name=='side':camera=existing
 else:
  camera=bpy.data.objects.new('ToriDiagonalCamera',existing.data.copy());scene.collection.objects.link(camera)
 camera.name='Tori'+name.title()+'Camera';camera.data.name=camera.name
 target=Vector(data['cameraTarget']);camera.location=target+Vector(data['offset']);camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
 camera['view_id']=name;camera['ground_anchor_px']=manifest['groundAnchor'];camera['source_sha256']=manifest['sourceSha256']
scene.camera=bpy.data.objects['ToriSideCamera']
scene['integration_status']='Offline preproduction only; original actions unchanged; use manifests for timing and anchors.'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tori-two-view-authoring.blend'),compress=True)
print('WORKING_COPY_CAMERAS',[o.name for o in bpy.data.objects if o.type=='CAMERA'],flush=True)
