"""Offline working copies and renders; original Tripo GLBs remain immutable."""
from pathlib import Path
BASE=Path(__file__).resolve().parents[2]/'run-party-v1/tools/bake-kit.py'
exec(compile(BASE.read_text(encoding='utf-8').split('\njobs=')[0],str(BASE),'exec'))
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'renders';OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'working').mkdir(exist_ok=True)
reports=[]
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['track-island','respawn-beacon']
if (ROOT/'bake-report.json').exists():
    reports=[r for r in json.loads((ROOT/'bake-report.json').read_text())['assets'] if r['id'] not in names]
for name in names:
    path=ROOT/'sources'/f'{name}.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects=imported(path)
    if name=='track-island':
        from mathutils import Matrix
        # The generated plaque is upright. Rotate baked vertices, not object
        # Euler values (normalize clears the imported object transforms).
        rotation=Matrix.Rotation(-math.pi/2,4,'X')
        for o in objects:
            for v in o.data.vertices:v.co=rotation@v.co
        normalize(objects)
    original=optimize(objects,name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'working'/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True)
    OFFSET=Vector((-6.4,-6.4,6.0)) if name=='track-island' else Vector((-7.698,-5.391,3.420))
    render(name,objects,path);reports[-1]['originalTriangles']=original
(ROOT/'bake-report.json').write_text(json.dumps({'assets':reports,'blender':bpy.app.version_string},indent=2)+'\n',encoding='utf-8')
