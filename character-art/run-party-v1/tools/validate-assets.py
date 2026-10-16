"""Validate delivered bytes, GLB geometry and alpha bounds; no account/network access."""
from pathlib import Path
import json, struct, hashlib
from PIL import Image
root=Path(__file__).resolve().parent.parent
repo=root.parents[1]; runtime=repo/'app/public/game/run-party-v1'
def glb(path):
    data=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data),path
    n,kind=struct.unpack_from('<I4s',data,12);assert kind==b'JSON'
    j=json.loads(data[20:20+n]);triangles=0
    for m in j.get('meshes',[]):
        for p in m['primitives']:
            assert p.get('mode',4)==4
            triangles+=j['accessors'][p['indices']]['count']//3
    return {'file':str(path.relative_to(repo)).replace('\\','/'),'bytes':len(data),
      'sha256':hashlib.sha256(data).hexdigest(),'triangles':triangles,
      'materials':len(j.get('materials',[])),'images':len(j.get('images',[]))}
sources=[glb(p) for p in sorted((root/'sources').glob('*.glb'))]
working=[glb(p) for p in sorted((root/'working').glob('*.glb'))]
assert len(sources)==2 and len(working)==4
assert all(x['triangles']<=3000 for x in working),working
m=json.loads((runtime/'manifest.json').read_text()); atlas=Image.open(runtime/m['file'])
assert atlas.size==(1024,1024) and atlas.mode=='RGBA'
assert hashlib.sha256((runtime/m['file']).read_bytes()).hexdigest()==m['sha256']
assert len(m['assets'])==14 and len({a['id'] for a in m['assets']})==14
for a in m['assets']:
    x,y,w,h=a['rect'];box=atlas.crop((x,y,x+w,y+h)).getchannel('A').getbbox()
    assert box and box[0]>0 and box[1]>0 and box[2]<w and box[3]<h,(a['id'],box)
    assert all(0<=v<=256 for v in a['pivot']),(a['id'],a['pivot'])
t=json.loads((root/'tori/bake-manifest.json').read_text());assert len(t['frames'])==16
assert hashlib.sha256((runtime/'tori-diagonal.webp').read_bytes()).hexdigest()==t['atlas']['sha256']
for f in t['frames']:
    im=Image.open(root/'tori/frames'/f['file']);assert im.size==(512,512)
    b=im.getchannel('A').getbbox();assert b and 0<b[0]<b[2]<512 and 0<b[1]<b[3]<512
total=sum(p.stat().st_size for p in runtime.glob('*.webp'));assert total<=1048576
report={'status':'passed','scope':'asset files only; not gameplay, browser or deployment verification',
 'sources':sources,'workingModels':working,'props':14,'toriFrames':16,
 'runtimeWebPBytes':total,'decodedAtlasBytes':2*1024*1024*4,
 'alphaBounds':'all 14 props and 16 tori frames inside cells',
 'creditsSpent':50,'balanceBefore':2910,'balanceAfter':2860,
 'browserPreview':'not verified; browser connection timed out',
 'gameplayIntegration':False,'productionDeployment':False}
(root/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
