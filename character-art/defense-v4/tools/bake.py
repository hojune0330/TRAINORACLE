"""Bake original Tripo props offline; source GLBs are never modified."""
from pathlib import Path
BASE = Path(__file__).resolve().parents[2] / 'run-party-v1/tools/bake-kit.py'
exec(compile(BASE.read_text(encoding='utf-8').split('\njobs=')[0], str(BASE), 'exec'))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'renders'; OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'working').mkdir(exist_ok=True)
names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [p.stem for p in (ROOT/'sources').glob('*.glb')]
reports = json.loads((ROOT/'bake-report.json').read_text())['assets'] if (ROOT/'bake-report.json').exists() else []
reports = [r for r in reports if r['id'] not in names]
for name in names:
    source = ROOT / 'sources' / f'{name}.glb'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects = imported(source)
    original = optimize(objects, name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'working'/f'{name}.glb'), export_format='GLB', use_selection=True, export_apply=True)
    render(name, objects, source)
    reports[-1]['originalTriangles'] = original
(ROOT/'bake-report.json').write_text(json.dumps({'assets':reports, 'blender':bpy.app.version_string}, indent=2)+'\n', encoding='utf-8')
