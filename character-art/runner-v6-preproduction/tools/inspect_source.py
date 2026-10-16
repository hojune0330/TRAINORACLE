"""Inspect the existing Tori FBX without changing it; write only this package."""
import bpy, json, hashlib, struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'tori/tripo/2026-10-12/motion/tori-game-motions.fbx'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(SOURCE))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH')
for t in rig.animation_data.nla_tracks: t.mute=True
scene=bpy.context.scene
def digest_values(values):
    h=hashlib.sha256()
    for v in values: h.update(struct.pack('<d',float(v)))
    return h.hexdigest()
def curves(action):
    return [f for layer in action.layers for strip in layer.strips for bag in strip.channelbags for f in bag.fcurves]
result={'source':str(SOURCE.relative_to(ROOT.parent.parent)).replace('\\','/'),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceBytes':SOURCE.stat().st_size,'blender':bpy.app.version_string,'fps':scene.render.fps,'meshVertices':len(mesh.data.vertices),'meshPolygons':len(mesh.data.polygons),'boneNames':[b.name for b in rig.data.bones],'restVerticesSha256':digest_values(c for v in mesh.data.vertices for c in v.co),'clips':[]}
for a in bpy.data.actions:
    fc=curves(a)
    start,end=map(float,a.frame_range)
    rig.animation_data.action=a; rig.animation_data.action_slot=a.slots[0]
    samples=[]
    for i in range(9):
        f=start+(end-start)*i/8
        scene.frame_set(int(f),subframe=f%1)
        ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        pts=[ev.matrix_world@v.co for v in ev.data.vertices]
        bones={name:list(rig.matrix_world@rig.pose.bones['mixamorig:'+name].head) for name in ['Hips','LeftFoot','RightFoot','Head']}
        samples.append({'frame':f,'boundsMin':[min(p[k] for p in pts) for k in range(3)],'boundsMax':[max(p[k] for p in pts) for k in range(3)],'bones':bones})
    result['clips'].append({'name':a.name,'frameRange':[start,end],'durationSeconds':(end-start)/scene.render.fps,'channels':len(fc),'keyframes':sum(len(f.keyframe_points) for f in fc),'keysSha256':digest_values(v for f in fc for k in f.keyframe_points for v in (*k.co,*k.handle_left,*k.handle_right)),'samples':samples})
ROOT.mkdir(exist_ok=True,parents=True)
(ROOT/'source-inspection.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print('SOURCE_REPORT',json.dumps({k:v for k,v in result.items() if k not in ['clips','boneNames']}),flush=True)
print('CLIPS',json.dumps([{k:v for k,v in c.items() if k!='samples'} for c in result['clips']]),flush=True)
