"""Offline Blender 4.5 asset preparation; imported Tripo sources stay untouched.

blender --background --factory-startup --python character-art/run-party-v1/tools/bake-kit.py
No remote services. Missing generated sources are reported, never substituted.
"""
import bpy, bmesh, math, json, hashlib, sys, tempfile
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
OLD = ROOT.parent / 'scenery/seoul-v1/sources'
OUT = ROOT / 'renders'
OUT.mkdir(parents=True, exist_ok=True)
TEMP = ROOT.parents[1]/'.scratch/run-party-temp'
TEMP.mkdir(parents=True, exist_ok=True)
tempfile.tempdir=str(TEMP)
COLORS = {'navy':'252337','cream':'FFF3D6','mint':'20BEA7','coral':'F46C66','yellow':'FFCE3A','road':'8EA7B5'}
OFFSET = Vector((-7.698,-5.391,3.420))
reports = []

def mat(key):
    m=bpy.data.materials.get(key) or bpy.data.materials.new(key)
    h=COLORS[key]; m.diffuse_color=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))+(1,)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=m.diffuse_color
    p.inputs['Roughness'].default_value=.85
    return m

def cube(name,at,size,color,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at)
    o=bpy.context.object; o.name=name; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat(color))
    if bevel:
        b=o.modifiers.new('Rounded silhouette','BEVEL'); b.width=bevel; b.segments=2
        o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

def sphere(name,at,size,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=at)
    o=bpy.context.object; o.name=name; o.scale=size; o.data.materials.append(mat(color))
    for p in o.data.polygons:p.use_smooth=True
    return o

def normalize(objects):
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    scale=1/(hi.z-lo.z)
    # Bake transforms on the working copy only; no skeletons in this prop kit.
    for o in objects:
        transform=o.matrix_world.copy()
        for v in o.data.vertices:v.co=(transform@v.co-center)*scale
        o.matrix_world.identity()
    bpy.context.view_layer.update()

def imported(path):
    before=set(bpy.data.objects)
    if path.suffix=='.fbx':bpy.ops.import_scene.fbx(filepath=str(path))
    else:bpy.ops.import_scene.gltf(filepath=str(path))
    objects=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    normalize(objects)
    return objects

def optimize(objects,name):
    original=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    for o in objects:
        bm=bmesh.new(); bm.from_mesh(o.data)
        # Studio splits vertices at UV seams. Weld before reducing geometry so
        # simplification cannot open visible cracks along those seams.
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
        if name=='wind-device':
            cut=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
              plane_co=(0,0,.64),plane_no=(0,0,1),clear_outer=True,clear_inner=False)
            edges=[g for g in cut['geom_cut'] if isinstance(g,bmesh.types.BMEdge) and g.is_boundary]
            if edges:bmesh.ops.holes_fill(bm,edges=edges,sides=0)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
        bpy.context.view_layer.objects.active=o
        if original>2600:
            mod=o.modifiers.new('Mobile authoring copy','DECIMATE'); mod.ratio=(2000 if name=='wind-device' else 2600)/original
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for m in o.data.materials:
            if m and m.use_nodes:
                for n in m.node_tree.nodes:
                    if n.type=='TEX_IMAGE' and n.image and max(n.image.size)>512:n.image.scale(512,512)
        for p in o.data.polygons:p.use_smooth=True
        if name=='wind-device':
            o.data.materials.clear()
            for key in ['mint','navy','cream']:o.data.materials.append(mat(key))
            for p in o.data.polygons:
                p.material_index=1 if p.center.z<.18 else 0
    return original

def local(name):
    if name=='ball-launcher':
        cube('Base',(0,0,.12),(.8,.75,.24),'navy')
        sphere('Housing',(0,0,.48),(.38,.34,.36),'coral')
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.22,depth=.6,location=(0,-.3,.55),rotation=(math.pi/2,0,0))
        bpy.context.object.data.materials.append(mat('cream'))
        sphere('Opening',(0,-.61,.55),(.17,.025,.17),'navy')
    elif name=='supply-flag':
        cube('Base',(0,0,.09),(.7,.6,.18),'navy')
        cube('Pole',(0,0,.65),(.08,.08,1.2),'cream',.02)
        cube('Flag',(.27,0,1),(.52,.07,.36),'mint',.03)
    elif name=='supply-token':
        sphere('Token',(0,0,.2),(.3,.3,.2),'yellow')
        cube('Token mark',(0,-.27,.22),(.09,.04,.25),'navy',.02)
    elif name=='tower-pad':
        cube('Pad',(0,0,.07),(1,1,.14),'navy')
        cube('Top',(0,0,.15),(.8,.8,.06),'mint')
    elif name=='wind-rotor':
        sphere('Hub',(0,0,.5),(.10,.07,.10),'yellow')
        for a in range(3):
            angle=a*2*math.pi/3
            o=cube('Blade',(math.sin(angle)*.19,0,.5+math.cos(angle)*.19),(.15,.08,.34),'cream',.06)
            o.rotation_euler.y=angle
    return [o for o in bpy.context.scene.objects if o.type=='MESH']

def render(name,objects,source=None):
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    center=sum(points,Vector())/len(points)
    bpy.ops.object.camera_add(location=center+OFFSET)
    camera=bpy.context.object; camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; bpy.context.view_layer.update()
    projected=[camera.matrix_world.inverted()@p for p in points]
    mid=Vector(((max(p.x for p in projected)+min(p.x for p in projected))/2,
      (max(p.y for p in projected)+min(p.y for p in projected))/2,0))
    camera.location+=camera.matrix_world.to_3x3()@mid
    bpy.context.view_layer.update()
    span=max(max(p.x for p in projected)-min(p.x for p in projected),max(p.y for p in projected)-min(p.y for p in projected))*1.2
    camera.data.ortho_scale=span
    scene=bpy.context.scene; scene.camera=camera; scene.render.engine='CYCLES'
    scene.cycles.samples=16; scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('SoftWorld'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.85,.95,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    bpy.ops.object.light_add(type='AREA',location=center+Vector((-3,-4,7))*span)
    light=bpy.context.object; light.data.energy=1000*span*span; light.data.size=5*span
    light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
    scene.render.film_transparent=True; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=str(OUT/f'{name}.png'); bpy.ops.render.render(write_still=True)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    ground=camera.matrix_world.inverted()@Vector((0,0,.5 if name=='wind-rotor' else 0))
    reports.append({'id':name,'source':str(source.relative_to(ROOT.parents[1])).replace('\\','/') if source else 'local-primitives',
      'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest() if source else None,
      'sourceTriangles':triangles,'cameraMatrix':[list(row) for row in camera.matrix_world],
      'orthoScale':span,'groundPixel':[256+ground.x/span*512,256-ground.y/span*512]})

jobs=[(n,OLD/f'{n}.fbx') for n in ['tree','rock','hurdle','gate','tower']]
jobs += [(n,ROOT/'sources'/f'{"dust-runner-base" if n.startswith("dust-") else n}.fbx') for n in ['dust-runner-base','dust-fast','dust-armored','wind-device']]
jobs += [(n,None) for n in ['ball-launcher','supply-flag','supply-token','tower-pad','wind-rotor']]
only=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if only:
    jobs=[j for j in jobs if j[0] in only]
    existing=ROOT/'bake-report.json'
    if existing.exists():reports=[r for r in json.loads(existing.read_text())['assets'] if r['id'] not in only]
missing=[]
for name,path in jobs:
    if path and not path.exists():
        glb=path.with_suffix('.glb')
        if glb.exists():path=glb
        else:missing.append(name); continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs=imported(path) if path else local(name)
    original=None
    if name.startswith('dust-') or name=='wind-device':
        original=optimize(objs,name)
    if name=='wind-device':
        sphere('Repaired rounded cap',(0,.01,.62),(.35,.30,.10),'mint')
        sphere('Clean dark opening',(0,-.31,.40),(.19,.025,.19),'navy')
        bpy.ops.mesh.primitive_torus_add(major_segments=16,minor_segments=8,location=(0,-.34,.4),
          rotation=(math.pi/2,0,0),major_radius=.20,minor_radius=.045)
        bpy.context.object.name='Clean opening rim'; bpy.context.object.data.materials.append(mat('cream'))
    if name=='dust-fast':
        for o in objs:o.scale=(.8,.8,1.18)
        cube('Fast crest',(0,0,1.08),(.13,.5,.15),'yellow',.04)
    elif name=='dust-armored':
        for o in objs:o.scale=(1.16,1.16,.95)
        cube('Armor belt',(0,0,.4),(1.2,.76,.17),'navy',.07)
        cube('Armor badge',(0,-.4,.4),(.2,.06,.12),'yellow',.03)
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if original:
        target=ROOT/'working'; target.mkdir(exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(target/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True)
    render(name,objs,path)
    if original:reports[-1]['originalTriangles']=original
(ROOT/'bake-report.json').write_text(json.dumps({'blender':bpy.app.version_string,'assets':reports,'missingSources':missing},indent=2)+'\n',encoding='utf-8')
