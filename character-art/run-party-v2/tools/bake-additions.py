"""Bake original Tripo props into matching game views and short local FX clips.

Blender 4.5 --background --factory-startup --threads 2 --python this-file
Sources are immutable. No network, paid conversions or rigging calls.
"""
from pathlib import Path
import json, math, sys, colorsys
BASE = Path(__file__).resolve().parents[2] / 'run-party-v1/tools/bake-kit.py'
# Reuse the reviewed lighting, import, normalization and palette functions only.
exec(compile(BASE.read_text(encoding='utf-8').split('\njobs=')[0], str(BASE), 'exec'))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'renders'; OUT.mkdir(parents=True, exist_ok=True)
(ROOT/'working').mkdir(exist_ok=True)
names = ['jump-pad', 'supply-capsule', 'upgrade-core']
only = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else names
reports = []
if (ROOT/'bake-report.json').exists():
    reports=[r for r in json.loads((ROOT/'bake-report.json').read_text())['assets']
             if r['id'].removesuffix('-icon') not in only]
for name in names:
    if name not in only: continue
    source = ROOT/'sources'/f'{name}.glb'
    if not source.exists(): raise FileNotFoundError(source)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects = imported(source)
    original = optimize(objects, name)
    if name=='jump-pad':
        # Recolor the generated texture, preserving its clean shape boundaries.
        # Height-based material bands cut through triangles and cause jagged rims.
        seen=set()
        for o in objects:
            for material in o.data.materials:
                for node in material.node_tree.nodes:
                    if node.type!='TEX_IMAGE' or not node.image or node.image.name in seen:continue
                    im=node.image;seen.add(im.name);pixels=list(im.pixels[:])
                    for p in range(0,len(pixels),4):
                        h,s,v=colorsys.rgb_to_hsv(*pixels[p:p+3])
                        key='navy' if .50<h<.80 else ('mint' if .30<h<=.50 else 'cream')
                        rgb=[int(COLORS[key][k:k+2],16)/255 for k in (0,2,4)]
                        pixels[p:p+3]=[c*(.75+.25*v) for c in rgb]
                    im.pixels[:]=pixels;im.pack()
    # Keep pads low rather than normalizing their apparent thickness to a runner.
    if name == 'jump-pad':
        for o in objects:o.scale = (.28,.28,.28)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'working'/f'{name}.glb'),
        export_format='GLB',use_selection=True,export_apply=True)
    render(name, objects, source)
    reports[-1]['originalTriangles'] = original
    # Map/menu icon: a slightly higher view makes the pad arrow readable.
    OFFSET = Vector((-6.4,-6.4,6.0))
    render(name+'-icon',objects,source)
    OFFSET = Vector((-7.698,-5.391,3.420))
    # FX uses the Tripo object as anchor. Rings and sparkles are local geometry.
    # Freeze framing across all frames so the animation has no camera jitter.
    scene=bpy.context.scene; camera=scene.camera
    camera.data.ortho_scale *= 1.42
    center=sum((o.matrix_world@Vector(c) for o in objects for c in o.bound_box),Vector())/(8*len(objects))
    transforms=[o.matrix_world.copy() for o in objects]
    frames=[]
    for i in range(8):
        t=i/7; pulse=math.sin(math.pi*t)
        for o,m in zip(objects,transforms):
            o.matrix_world=m.copy()
            o.scale *= 1+.10*pulse
            o.location.z += .10*pulse
        bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,
            major_radius=.22+.48*t,minor_radius=.025*(1-.7*t),
            location=(center.x,center.y, .035))
        ring=bpy.context.object; ring.data.materials.append(mat('mint' if name=='jump-pad' else 'yellow'))
        sparkles=[]
        for j in range(4):
            a=j*math.pi/2+.3
            radius=.25+.35*t
            sparkles.append(sphere('Local sparkle',
                (center.x+math.cos(a)*radius,center.y+math.sin(a)*radius,center.z+.35*t),
                (.035*(1-.6*t),)*3, 'cream'))
        filename=f'{name}-fx-{i+1:02d}.png'
        scene.render.filepath=str(OUT/filename); bpy.ops.render.render(write_still=True)
        frames.append(filename)
        for o in [ring]+sparkles:bpy.data.objects.remove(o,do_unlink=True)
    reports[-1]['effect']={'frames':frames,'durationMs':640,'loop':False,
        'provenance':'Tripo source plus locally authored pulse, expanding ring and four sparkles',
        'reducedMotion':name+'-icon.png'}
(ROOT/'bake-report.json').write_text(json.dumps({'blender':bpy.app.version_string,
    'assets':reports,'gameplayIntegration':False},indent=2)+'\n',encoding='utf-8')
