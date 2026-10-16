"""Bake directional combat atlases from paid Tripo sources. No source is modified.

Blender 4.5.14: blender --background --factory-startup --python .../tools/bake.py
Directions: E SE S SW W NW N NE. Rows: six action samples, origin (.5,.68).
Use pack.py after baking. --probe renders the first direction only for art review.
"""
import bpy, bmesh, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]; REPO=ROOT.parents[1]
OUT=ROOT/'renders'; OUT.mkdir(parents=True,exist_ok=True)
NAMES=['rapid','cannon','frost','scout','swift','armored','boss']
SOURCES={
 'rapid':'defense-v4/working/cannon.glb','cannon':'defense-v4/working/cannon.glb',
 'frost':'defense-v4/working/fan.glb','scout':'defense-v4/working/normal.glb',
 'swift':'run-party-v1/working/dust-fast.glb','armored':'run-party-v1/working/dust-armored.glb',
 'boss':'defense-v4/working/normal.glb'}
COLORS={'cream':'F6E3B1','navy':'244B68','blue':'328CD4','mint':'149E9B','orange':'D95032','gold':'F6B334','ice':'B0EDFF'}

def material(key):
 m=bpy.data.materials.get(key) or bpy.data.materials.new(key); m.use_nodes=True
 h=COLORS[key];color=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))+(1,)
 m.diffuse_color=color;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=.78
 return m

def ball(name,at,scale,color):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=at)
 o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material(color))
 for p in o.data.polygons:p.use_smooth=True
 return o

def cube(name,at,scale,color):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material(color));b=o.modifiers.new('Rounded toy edge','BEVEL');b.width=.06;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o

def barrel(at,radius,length,color):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=length,location=at,rotation=(math.pi/2,0,0))
 o=bpy.context.object;o.name='Barrel';o.data.materials.append(material(color));b=o.modifiers.new('Soft barrel edge','BEVEL');b.width=.025;b.segments=2
 for p in o.data.polygons:p.use_smooth=True
 return o

def flatten_transform(o):
 bpy.context.view_layer.update()
 world=o.matrix_world.copy()
 for v in o.data.vertices:v.co=world@v.co
 o.matrix_world.identity();o.rotation_mode='XYZ'

def cut(o,keep_top,height):
 cp=o.copy();cp.data=o.data.copy();bpy.context.collection.objects.link(cp)
 bm=bmesh.new();bm.from_mesh(cp.data)
 geom=list(bm.verts)+list(bm.edges)+list(bm.faces)
 part=bmesh.ops.bisect_plane(bm,geom=geom,plane_co=(0,0,height),plane_no=(0,0,1),clear_inner=keep_top,clear_outer=not keep_top)
 edges=[e for e in part['geom_cut'] if isinstance(e,bmesh.types.BMEdge) and e.is_boundary]
 if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(cp.data);bm.free()
 return cp

def setup_scene():
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True
 s.world=bpy.data.worlds.new('Soft daylight');s.world.use_nodes=True
 s.world.node_tree.nodes['Background'].inputs[0].default_value=(.82,.88,1,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.75
 bpy.ops.object.camera_add(location=(0,-6,7));c=bpy.context.object;c.rotation_euler=(Vector((0,0,.4))-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=1.78
 bpy.context.view_layer.update();ground=c.matrix_world.inverted()@Vector((0,0,0));delta=ground.y+.18*c.data.ortho_scale
 c.location+=c.matrix_world.to_3x3()@Vector((0,delta,0));s.camera=c
 bpy.ops.object.light_add(type='AREA',location=(-3,-4,7));light=bpy.context.object;light.data.energy=550;light.data.size=5;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
 s.render.resolution_x=128;s.render.resolution_y=128;s.render.resolution_percentage=100;s.render.film_transparent=True
 s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast'
 s.render.image_settings.color_depth='8'
 return s

def import_source(name):
 source=ROOT.parent/SOURCES[name];bpy.ops.import_scene.gltf(filepath=str(source))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in objects:flatten_transform(o)
 return source,objects

def tower_parts(name,objects):
 top=[];base=[]
 for o in objects:
  height=.42 if name!='frost' else .28
  base.append(cut(o,False,height));top.append(cut(o,True,height));bpy.data.objects.remove(o,do_unlink=True)
 if name=='rapid':
  for o in top:bpy.data.objects.remove(o,do_unlink=True)
  top=[ball('Rapid housing',(0,.02,.59),(.28,.24,.25),'blue')]
  for x in (-.13,.13):
   top.append(barrel((x,-.26,.61),.095,.50,'cream'));top.append(ball('Dark muzzle',(x,-.515,.61),(.075,.015,.075),'navy'))
  top.append(cube('Top sight',(0,.06,.84),(.11,.22,.09),'mint'))
  for o in top:flatten_transform(o)
 if name=='frost':
  additions=[ball('Frost pressure tank',(0,.06,.46),(.25,.23,.23),'blue'),ball('Ice core',(0,-.20,.47),(.17,.08,.17),'ice')]
  for o in additions:flatten_transform(o)
  top.extend(additions)
 pivot=ball('Turret swivel',(0,0,.42 if name!='frost' else .28),(.21,.21,.07),'navy');flatten_transform(pivot);base.append(pivot)
 return base,top

def enemy_variant(name,objects):
 if name=='boss':
  # The same original creature becomes a distinct shield carrier, not a scaled clone.
  objects.append(cube('Boss shoulder shell',(0,.02,.56),(1.16,.70,.27),'navy'))
  objects.append(cube('Boss gold front plate',(0,-.40,.48),(.48,.12,.35),'gold'))
  for x in (-.30,0,.30):objects.append(ball('Crown crest',(x,.02,1.0),(.10,.13,.17),'orange'))
  for o in objects:flatten_transform(o)
 if name=='armored':
  objects.append(cube('Readable armor shell',(0,.08,.67),(1.12,.68,.30),'navy'))
  objects.append(cube('Armor stripe',(0,-.30,.64),(.48,.10,.18),'gold'))
  for o in objects:flatten_transform(o)
 return objects

def neutral_coords(objects):return {o.name:[v.co.copy() for v in o.data.vertices] for o in objects}

def deform_walk(objects,coords,phase,kind,reaction=None):
 swing=math.sin(phase);bounce=.035*(1-math.cos(2*phase));stretch=1+.045*math.cos(2*phase)
 if kind=='swift':swing*=1.3;bounce*=1.3
 for o in objects:
  for v,p in zip(o.data.vertices,coords[o.name]):
   x,y,z=p
   foot=max(0,min(1,(.32-z)/.23));side=1 if x>=0 else -1
   # Cosine foot lift distinguishes the approach and return halves of each stride.
   zz=z*stretch+bounce*(1-foot*.8)+max(0,math.cos(phase)*side)*.075*foot
   yy=y+swing*side*.08*foot
   xx=x*(2-stretch)+swing*.018*max(0,z)
   if reaction is not None:
    if reaction<2:
     squash=[.78,.96][reaction];zz*=squash;xx*=1+(1-squash)*.5;yy*=1+(1-squash)*.5
    else:
     # A defeated soft creature deflates into its footprint instead of expanding
     # across adjacent cells (especially important for armored/boss silhouettes).
     collapse=[.80,.50,.23,.10][reaction-2];zz*=collapse;xx*=1-(1-collapse)*.45;yy*=1-(1-collapse)*.45
   v.co=(xx,yy,zz)

def retain_editable_motion(objects,coords,name,is_tower):
 """Leave an actual Blender action rather than only a folder of baked images."""
 for o in objects:o.rotation_euler.z=math.pi/2;o.location=(0,0,0)
 if is_tower:
  for o in objects:
   for frame,recoil in [(1,0),(3,.11),(6,.045),(10,0)]:
    o.location.x=-recoil;o.keyframe_insert(data_path='location',frame=frame)
 else:
  for o in objects:
   for v,p in zip(o.data.vertices,coords[o.name]):v.co=p
   o.shape_key_add(name='Neutral')
  for row in range(6):
   deform_walk(objects,coords,row*math.tau/6,name)
   for o in objects:
    key=o.shape_key_add(name=f'Walk {row+1}',from_mix=False)
    for v,p in zip(key.data,[v.co.copy() for v in o.data.vertices]):v.co=p
    for frame,value in [(1+row*4-4,0),(1+row*4,1),(1+row*4+4,0)]:
     key.value=value;key.keyframe_insert(data_path='value',frame=frame)
    if row==0:
     key.value=0;key.keyframe_insert(data_path='value',frame=21);key.value=1;key.keyframe_insert(data_path='value',frame=25)
   # Neutral mesh coordinates stay stable while each shape is stored independently.
  for o in objects:
   for v,p in zip(o.data.vertices,coords[o.name]):v.co=p
 bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=10 if is_tower else 24
 bpy.context.scene.render.fps=24;bpy.context.scene.frame_set(1)
 bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'{name}.blend'))

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
only=[n for n in args if n in NAMES] or NAMES
report=[r for r in json.loads((ROOT/'bake-report.json').read_text(encoding='utf-8'))['assets'] if r['id'] not in only] if (ROOT/'bake-report.json').exists() else []
for name in only:
 bpy.ops.wm.read_factory_settings(use_empty=True);source,objects=import_source(name)
 s=setup_scene();is_tower=name in ('rapid','cannon','frost')
 if is_tower:base,objects=tower_parts(name,objects)
 else:objects=enemy_variant(name,objects)
 coords=neutral_coords(objects)
 out=OUT/name;out.mkdir(exist_ok=True)
 for direction in range(1 if '--probe' in args else 8):
  angle=math.pi/2-direction*math.pi/4
  for o in objects:o.rotation_euler.z=angle
  for row in range(0 if '--reactions-only' in args else (3 if is_tower else 6)):
   if is_tower:
    recoil=[0,.11,.045][row]
    for o in objects:
     o.location=(math.sin(angle)*-recoil,math.cos(angle)*recoil,0)
   else:deform_walk(objects,coords,row*math.tau/6,name)
   bpy.context.view_layer.update();s.render.filepath=str(out/f'{direction}-{row}.png');bpy.ops.render.render(write_still=True)
  if not is_tower:
   for row in range(6):
    deform_walk(objects,coords,0,name,row);bpy.context.view_layer.update();s.render.filepath=str(out/f'{direction}-reaction-{row}.png');bpy.ops.render.render(write_still=True)
 retain_editable_motion(objects,coords,name,is_tower)
 report.append({'id':name,'source':str(source.relative_to(REPO)).replace('\\','/'),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'renderedDirections':1 if '--probe' in args else 8,'actionRows':3 if is_tower else 6,'reactionRows':0 if is_tower else 6})
 (ROOT/'bake-report.json').write_text(json.dumps({'blender':bpy.app.version_string,'frameSize':128,'origin':[.5,.68],'directions':['E','SE','S','SW','W','NW','N','NE'],'assets':report},indent=2)+'\n',encoding='utf-8')
 print('BAKE_FINISHED',name,flush=True)
