"""Compare source mesh/skin/rest rig/motion keys to the saved working copy."""
import bpy, hashlib, struct, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT.parent/'tori/tripo/2026-10-12/motion/tori-game-motions.fbx'
def digest(values):
 h=hashlib.sha256()
 for v in values:h.update(struct.pack('<d',float(v)))
 return h.hexdigest()
def curves(action):return [f for layer in action.layers for strip in layer.strips for bag in strip.channelbags for f in bag.fcurves]
def snapshot():
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');mesh=next(o for o in bpy.data.objects if o.type=='MESH')
 actions={}
 for action in bpy.data.actions:
  fc=curves(action)
  actions[action.name]={'range':list(action.frame_range),'channels':len(fc),'keyCount':sum(len(f.keyframe_points) for f in fc),'paths':[(f.data_path,f.array_index) for f in fc],'keysHash':digest(x for f in fc for k in f.keyframe_points for x in (*k.co,*k.handle_left,*k.handle_right)),'interpolation':[k.interpolation for f in fc for k in f.keyframe_points]}
 return {'vertexCount':len(mesh.data.vertices),'polygonCount':len(mesh.data.polygons),'geometryHash':digest(x for v in mesh.data.vertices for x in v.co),'topologyHash':digest(v for p in mesh.data.polygons for v in p.vertices),'weightsHash':digest(x for v in mesh.data.vertices for g in v.groups for x in (v.index,g.group,g.weight)),'vertexGroups':[g.name for g in mesh.vertex_groups],'bones':[(b.name,b.parent.name if b.parent else None) for b in rig.data.bones],'restRigHash':digest(x for b in rig.data.bones for row in b.matrix_local for x in row),'actions':actions}
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.fbx(filepath=str(SOURCE));before=snapshot()
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'tori-two-view-authoring.blend'));after=snapshot()
checks={key:before[key]==after[key] for key in before}
packed=[{'name':i.name,'packed':bool(i.packed_file),'bytes':len(i.packed_file.data) if i.packed_file else 0,'sha256':hashlib.sha256(i.packed_file.data).hexdigest() if i.packed_file else None} for i in bpy.data.images if i.name not in ['Render Result','Viewer Node']]
summary={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'workingCopySha256':hashlib.sha256((ROOT/'tori-two-view-authoring.blend').read_bytes()).hexdigest(),'unchangedChecks':checks,'allUnchanged':all(checks.values()),'packedImages':packed,'sourceMetrics':{k:v for k,v in before.items() if k not in ['actions','bones','vertexGroups']},'actions':[{'name':name,'range':data['range'],'channels':data['channels'],'keyCount':data['keyCount'],'keysHash':data['keysHash']} for name,data in after['actions'].items()],'scope':'Offline preservation check only. Not runtime integration, transition, gameplay or mobile performance acceptance.'}
(ROOT/'preservation-check.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2),flush=True)
assert all(checks.values()),'Preserved source data changed'
assert all(i['packed'] for i in packed),'Unpacked texture'
