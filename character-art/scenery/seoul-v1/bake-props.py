"""Offline miniature prop bake. Imported Tripo GLBs override clearly labelled local prototypes.

blender --background --python bake-props.py -- <output-dir> [<source-dir>]
Source names: tree.glb, rock.glb, hurdle.glb, gate.glb, shoe.glb, tower.glb.
No networking or credits. Every output records whether its source was imported or local.
"""
import bpy, sys, math, json
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
out = Path(args[0]).resolve(); out.mkdir(parents=True, exist_ok=True)
source = Path(args[1]) if len(args) > 1 else Path(__file__).parent / 'sources'
colors = {'green': '54B991', 'trunk': 'B97948', 'rock': '8DA5B4', 'cream': 'FFF5D8',
          'coral': 'EC7160', 'navy': '334A68', 'gold': 'FFD052', 'blue': '65BDD0'}

def material(key):
    mat = bpy.data.materials.get(key) or bpy.data.materials.new(key)
    hx = colors[key]; mat.diffuse_color = tuple(int(hx[i:i+2],16)/255 for i in (0,2,4)) + (1,)
    return mat

def cube(name, at, scale, color, bevel=.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    ob = bpy.context.object; ob.name = name; ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new('Soft toy edges', 'BEVEL'); mod.width=bevel; mod.segments=3
        ob.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    ob.data.materials.append(material(color)); return ob

def ball(name, at, scale, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=at)
    ob=bpy.context.object; ob.name=name; ob.scale=scale
    ob.data.materials.append(material(color))
    for p in ob.data.polygons: p.use_smooth=True
    return ob

def make(prop):
    if prop == 'tree':
        cube('Trunk',(0,0,.65),(.36,.4,1.3),'trunk')
        for at,s in [((-.42,0,1.5),(.72,.58,.7)),((.4,.05,1.6),(.65,.58,.7)),((0,0,2.12),(.72,.62,.72))]: ball('Canopy',at,s,'green')
    elif prop == 'rock':
        ob=ball('Boulder',(0,0,.38),(.85,.55,.48),'rock'); ob.rotation_euler.y=.18
    elif prop in ('hurdle','gate'):
        h=1.05 if prop=='hurdle' else 2.6; w=2.2
        for x in [-.95,.95]:
            cube('Upright',(x,0,h/2),(.21,.25,h),'navy',.06)
            cube('Foot',(x,0,.1),(.48,.7,.2),'navy',.08)
        cube('Crossbar',(0,0,h),(w,.32,.4 if prop=='hurdle' else .55),'coral' if prop=='hurdle' else 'gold')
        for x in [-.72,0,.72]: cube('Visible marker',(x,-.172,h),(.3,.02,.22),'cream',.025)
    elif prop == 'shoe':
        cube('Sole',(0,0,.18),(2.2,.95,.36),'cream',.16)
        ball('Upper',(.22,0,.52),(1,.44,.4),'blue')
        cube('Heel',(-.7,0,.58),(.62,.83,.73),'blue',.17)
        ball('Collar',(-.72,0,.95),(.28,.3,.05),'navy')
        cube('Broad strap',(-.08,0,.8),(.24,.77,.13),'cream',.04)
    elif prop == 'tower':
        ball('Hill',(0,0,.15),(1,.8,.32),'green')
        cube('Pillar',(0,0,1.5),(.21,.21,2.75),'cream',.04)
        cube('Observation deck',(0,0,2.55),(.95,.65,.32),'cream',.12)
        cube('Window',(0,-.335,2.55),(.7,.035,.14),'blue',.025)
        cube('Antenna',(0,0,3.03),(.055,.055,.68),'coral',.015)

reports=[]
for prop in ['tree','rock','hurdle','gate','shoe','tower']:
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    path=source/f'{prop}.glb'
    if path.exists(): bpy.ops.import_scene.gltf(filepath=str(path))
    else: make(prop)
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    points=[o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    center=sum(points,Vector())/len(points)
    # One consistent orthographic toy-camera; crop and base alignment happen in packing.
    bpy.ops.object.camera_add(location=center + Vector((3,-8,3)))
    cam=bpy.context.object; cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    bpy.context.view_layer.update()
    view=cam.matrix_world.inverted()
    projected=[view @ p for p in points]
    cam.data.ortho_scale=max(max(p.x for p in projected)-min(p.x for p in projected),max(p.y for p in projected)-min(p.y for p in projected))*1.18
    scene=bpy.context.scene; scene.camera=cam; scene.render.engine='BLENDER_WORKBENCH'
    scene.view_settings.view_transform='Standard'; scene.view_settings.look='None'; scene.view_settings.exposure=.35
    sh=scene.display.shading; sh.light='STUDIO'; sh.color_type='MATERIAL'; sh.show_shadows=True
    sh.show_cavity=True; sh.cavity_type='BOTH'; sh.curvature_ridge_factor=1.1; sh.curvature_valley_factor=.6
    sh.show_specular_highlight=False; sh.show_object_outline=False
    scene.render.film_transparent=True
    scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=str(out/f'{prop}.png'); bpy.ops.render.render(write_still=True)
    reports.append({'id':prop,'source':'imported-glb' if path.exists() else 'local-parametric-prototype','file':str(path.name) if path.exists() else None})
(out/'bake-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
