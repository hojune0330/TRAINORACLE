"""Reuse paid Tripo props for three original Starlight Relay Forest landmarks.

Blender 4.5.14, offline only. Inputs remain untouched. Writes only this package.
All models share the defense-v5 camera direction, lighting and ground pivot.
"""
import bpy, bmesh, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1];ART=ROOT.parent
SOURCES={'gate':ART/'defense-v4/working/finish-gate.glb','crystal':ART/'run-party-v2/working/upgrade-core.glb','bridge':ART/'scenery/seoul-v1/sources/rock.fbx'}
ORIGINALS={'gate':ART/'defense-v4/sources/finish-gate.glb','crystal':ART/'run-party-v2/sources/upgrade-core.glb','bridge':ART/'scenery/seoul-v1/sources/rock.fbx'}
COLORS={'stone':'697293','stoneDark':'414F70','stoneLight':'BAC4D3','moss':'5EA992','mossLight':'9ED1AB','rune':'D7F3CE','gold':'EAD49D','crystalDark':'5663BD','crystal':'79C9D6','crystalLight':'C4EFF0','violet':'A4A0DB'}
SIZE=512;ORIGIN=(.5,.78)
for sub in ['renders','working','review']: (ROOT/sub).mkdir(parents=True,exist_ok=True)

def mat(key):
 m=bpy.data.materials.get('Forest '+key)
 if m:return m
 m=bpy.data.materials.new('Forest '+key);m.use_nodes=True
 h=COLORS[key]
 def linear(value):return value/12.92 if value<=.04045 else ((value+.055)/1.055)**2.4
 c=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))+(1,)
 m.diffuse_color=c;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.8
 if key in ['rune','crystalLight']:
  p.inputs['Emission Color'].default_value=c;p.inputs['Emission Strength'].default_value=.14
 return m

def mesh_object(name,verts,faces,colors):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for color in colors:o.data.materials.append(mat(color))
 for p in mesh.polygons:p.material_index=p.index%len(colors)
 return o

def rounded(name,at,size,color,bevel=.07):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat(color))
 if bevel:
  mod=o.modifiers.new('Broad rounded edge','BEVEL');mod.width=bevel;mod.segments=2
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def source_objects(path):
 before=set(bpy.data.objects)
 if path.suffix.lower()=='.fbx':bpy.ops.import_scene.fbx(filepath=str(path))
 else:bpy.ops.import_scene.gltf(filepath=str(path))
 objects=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
 bpy.context.view_layer.update()
 pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 lo=Vector([min(p[k] for p in pts) for k in range(3)]);hi=Vector([max(p[k] for p in pts) for k in range(3)])
 center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=1/(hi.z-lo.z)
 for o in objects:
  transform=o.matrix_world.copy();o.parent=None
  for v in o.data.vertices:v.co=(transform@v.co-center)*scale
  o.matrix_world.identity();o.data.materials.clear();o.data.materials.append(mat('stone'))
  triangles=sum(len(p.vertices)-2 for p in o.data.polygons)
  if triangles>2800:
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002);bm.to_mesh(o.data);bm.free()
   bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Local working simplification','DECIMATE');mod.ratio=2600/triangles;bpy.ops.object.modifier_apply(modifier=mod.name)
 return objects

def flatten(o):
 bpy.context.view_layer.update()
 transform=o.matrix_world.copy()
 for v in o.data.vertices:v.co=transform@v.co
 o.matrix_world.identity()

def prism(name,at,radius,height,lean=0):
 # Three chunky faceted shafts, not transparent glass or tiny particles.
 verts=[]
 for z,r,shift in [(0,.72*radius,0),(.70*height,radius,lean*.7)]:
  for i in range(6):
   a=math.pi/3*i+math.pi/6;verts.append((at[0]+r*math.cos(a)+shift,at[1]+r*math.sin(a),at[2]+z))
 verts.append((at[0]+lean,at[1],at[2]+height));faces=[tuple(reversed(range(6)))]
 for i in range(6):faces.extend([(i,(i+1)%6,(i+1)%6+6,i+6),(i+6,(i+1)%6+6,12)])
 return mesh_object(name,verts,faces,['crystalDark','crystal','crystalLight','violet'])

def gate():
 objects=source_objects(SOURCES['gate'])
 for o in objects:
  o.name='Tripo gate stone body';o.scale=(2.45,2.45,2.45);flatten(o)
  o.data.materials.clear()
  for key in ['stone','stoneDark','stoneLight']:o.data.materials.append(mat(key))
  for p in o.data.polygons:
   z=sum(o.data.vertices[i].co.z for i in p.vertices)/len(p.vertices)
   p.material_index=2 if z>1.65 else (1 if z<.22 else 0)
 # Large original diamond and one stroke per column; no text or fine engraving.
 pts=[(-.22,-.40,2.02),(0,-.46,2.31),(.22,-.40,2.02),(0,-.47,1.78),(0,-.59,2.02)]
 mesh_object('Broad rune crest',pts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)],['crystal','crystalLight','violet'])
 for x in [-.68,.68]:
  rounded('Single inset rune stroke',(x,-.29,1.05),(.075,.045,.48),'rune',.025)
  rounded('Moss foot cushion',(x,.02,.10),(.57,.58,.12),'moss',.10)
 # Two low crystal stones repeat the palette without blocking the opening.
 prism('Small gate crystal',(-1.0,-.02,.02),.11,.34,-.04)
 prism('Small gate crystal',(1.01,.08,.02),.10,.27,.03)

def crystal():
 objects=source_objects(SOURCES['crystal'])
 for o in objects:
  o.name='Tripo core flattened mineral foundation';o.scale=(1.55,1.35,.28);flatten(o)
  o.data.materials.clear();o.data.materials.append(mat('stoneDark'))
 prism('Main crystal',(.02,.12,.20),.34,1.55,.05)
 prism('Left crystal',(-.48,-.05,.12),.26,1.03,-.20)
 prism('Right crystal',(.48,-.06,.13),.24,.87,.19)
 for x,y,s in [(-.60,.05,.25),(.56,.08,.23),(0,-.30,.28)]:
  rounded('Broad moss patch',(x,y,.16),(s,.23,.09),'moss',.06)

def bridge():
 rocks=source_objects(SOURCES['bridge'])
 for i,(x,y) in enumerate([(-1.46,-.38),(-1.46,.38),(1.46,-.38),(1.46,.38)]):
  for original in rocks:
   o=original if i==0 else original.copy()
   if i:o.data=original.data.copy();bpy.context.collection.objects.link(o)
   o.name='Tripo rock abutment';o.scale=(.48,.50,.34);o.location=(x,y,-.01);o.rotation_euler.z=i*.7
   o.data.materials.clear();o.data.materials.append(mat('stoneDark'))
 # Seven distinct broad voussoir/deck blocks create an open stone arch.
 for i in range(7):
  x0=-1.65+i*3.3/7+.008;x1=-1.65+(i+1)*3.3/7-.008
  def z(x):return .28+.42*math.cos(x/1.65*math.pi/2)
  verts=[(x0,-.54,z(x0)),(x1,-.54,z(x1)),(x1,.54,z(x1)),(x0,.54,z(x0)),(x0,-.54,z(x0)+.22),(x1,-.54,z(x1)+.22),(x1,.54,z(x1)+.22),(x0,.54,z(x0)+.22)]
  o=mesh_object('Arch deck block '+str(i),verts,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],['stone','stoneLight','stoneDark'])
  o.data.polygons[-1].material_index=1
  bevel=o.modifiers.new('Rounded stone corners','BEVEL');bevel.width=.025;bevel.segments=2;o.modifiers.new('Stone normals','WEIGHTED_NORMAL')
  for y in [-.55,.55]:
   rounded('Low parapet',(0.5*(x0+x1),y,z(.5*(x0+x1))+.32),(x1-x0,.20,.29),'stone',.045)
   if i in [0,2,5,6]:rounded('Moss cap',(0.5*(x0+x1),y,z(.5*(x0+x1))+.48),(x1-x0,.25,.07),'moss' if i%2 else 'mossLight',.035)
 # Broad pale stepping surfaces communicate walkable space; no runes on the path.
 for x in [-1.28,-.62,.0,.62,1.28]:
  rounded('Walkable stone',(x,0,.28+.42*math.cos(x/1.65*math.pi/2)+.237),(.42,.76,.035),'gold',.018)

def points():
 dg=bpy.context.evaluated_depsgraph_get();out=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  ev=o.evaluated_get(dg);out.extend(ev.matrix_world@v.co for v in ev.data.vertices)
 return out

def setup_and_render(name):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
 scene.render.threads_mode='FIXED';scene.render.threads=3
 scene.world=bpy.data.worlds.new('Soft daylight');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.82,.88,1,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.75
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 scene.render.resolution_x=SIZE;scene.render.resolution_y=SIZE;scene.render.resolution_percentage=100;scene.render.film_transparent=True
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.color_depth='8'
 bpy.ops.object.camera_add(location=(0,-6,7));camera=bpy.context.object;camera.name='Defense v5 matched camera';camera.rotation_euler=(Vector((0,0,.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';scene.camera=camera
 bpy.context.view_layer.update();pts=points();basis=camera.matrix_world.inverted()
 projected=[basis@p for p in pts];ground=basis@Vector((0,0,0))
 # A fixed ground pivot with a fitted per-asset scale; never crop silhouettes.
 span=max(max(abs(p.x-ground.x) for p in projected)/.44,max(p.y-ground.y for p in projected)/.70,max(ground.y-p.y for p in projected)/.16)
 camera.data.ortho_scale=span
 delta=ground.y+(ORIGIN[1]-.5)*span
 camera.location+=camera.matrix_world.to_3x3()@Vector((ground.x,delta,0))
 bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));light=bpy.context.object;light.name='Large soft key';light.data.energy=550;light.data.size=5;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(ROOT/'renders'/f'{name}.png');bpy.ops.render.render(write_still=True)
 bpy.context.view_layer.update();ndc=world_to_camera_view(scene,camera,Vector((0,0,0)))
 geometry=[o for o in scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in geometry:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'working'/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True)
 bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=True,do_recursive=True)
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}.blend'),compress=True)
 return {'id':name,'source':str(SOURCES[name].relative_to(ART.parent)).replace('\\','/'),'sourceSha256':hashlib.sha256(SOURCES[name].read_bytes()).hexdigest(),'originalSource':str(ORIGINALS[name].relative_to(ART.parent)).replace('\\','/'),'originalSha256':hashlib.sha256(ORIGINALS[name].read_bytes()).hexdigest(),'origin':[ndc.x,1-ndc.y],'groundPixel':[ndc.x*SIZE,(1-ndc.y)*SIZE],'orthoScale':span,'cameraMatrix':[list(row) for row in camera.matrix_world],'meshCount':len(geometry),'sourceGeometryTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in geometry),'worldBounds':[[min(p[k] for p in pts) for k in range(3)],[max(p[k] for p in pts) for k in range(3)]],'workingGLB':f'working/{name}.glb','render':f'renders/{name}.png'}

names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['gate','crystal','bridge']
report=json.loads((ROOT/'bake-report.json').read_text()) if (ROOT/'bake-report.json').exists() else {'blender':bpy.app.version_string,'newTripoTasks':0,'newCredits':0,'size':[SIZE,SIZE],'origin':ORIGIN,'assets':[]}
report['assets']=[a for a in report['assets'] if a['id'] not in names]
for name in names:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 globals()[name]()
 report['assets'].append(setup_and_render(name))
 (ROOT/'bake-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('DONE',name,flush=True)
