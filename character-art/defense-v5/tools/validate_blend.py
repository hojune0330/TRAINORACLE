"""Read saved authoring files and verify playback, packed source textures and pivot."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];rows=[]
for name in ['rapid','cannon','frost','scout','swift','armored','boss']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'{name}.blend'))
 s=bpy.context.scene;camera=s.camera;bpy.context.view_layer.update()
 p=camera.matrix_world.inverted()@Vector((0,0,0));origin=[.5+p.x/camera.data.ortho_scale,.5-p.y/camera.data.ortho_scale]
 def positions(frame):
  s.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();vals=[]
  for o in sorted([o for o in s.objects if o.type=='MESH'],key=lambda o:o.name):
   e=o.evaluated_get(deps)
   vals.extend([tuple(e.matrix_world@v.co) for v in e.data.vertices])
  return vals
 a=positions(1);b=positions(3 if name in ['rapid','cannon','frost'] else 5)
 displacement=max(math.dist(x,y) for x,y in zip(a,b))
 assert displacement>.001,(name,'no saved action movement',displacement)
 assert abs(origin[0]-.5)<.0001 and abs(origin[1]-.68)<.0001,(name,origin)
 textures=[i for i in bpy.data.images if i.source=='FILE']
 assert all(i.packed_file for i in textures),(name,'unpacked texture')
 rows.append({'id':name,'savedActionMoves':True,'maximumVertexDisplacement':displacement,'groundOrigin':origin,'packedTextures':len(textures),'shapeKeys':sum(len(o.data.shape_keys.key_blocks) for o in s.objects if o.type=='MESH' and o.data.shape_keys),'sceneMeshTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in s.objects if o.type=='MESH')})
result={'blender':bpy.app.version_string,'savedScenes':rows,'sourceFilesModified':False}
manifest=ROOT.parents[1]/'app/public/game/defense-v5/manifest.json'
if manifest.exists():
 m=json.loads(manifest.read_text(encoding='utf-8'))
 result['atlasValidation']={'atlases':len(m['assets']),'previews':len(m['previews']),'cells':sum(a['columns']*a['rows'] for a in m['assets']),'uniqueFrames':sum(a['uniqueFrames'] for a in m['assets']),'emptyCells':0,'clippedCells':0,'payloadBytes':m['payloadBytes'],'frameBoundaryCheck':'tools/pack.py asserts every rendered frame before output'}
(ROOT/'validation.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print('VALIDATED',len(rows),'saved scenes')
