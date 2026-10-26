"""Inventory completed preproduction outputs; no external or runtime claims."""
from pathlib import Path
from PIL import Image
import hashlib,json,datetime
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
bake=json.loads((ROOT/'bake-manifest.json').read_text());sprites=json.loads((ROOT/'sprite-manifest.json').read_text());preserved=json.loads((ROOT/'preservation-check.json').read_text())
assert preserved['allUnchanged']
assert not sprites['clippedFrames'] and not sprites['emptyFrames']
for clip in bake['clips']:
 assert [r['sourceFrame'] for r in clip['views']['side']['records']]==[r['sourceFrame'] for r in clip['views']['diagonal']['records']]
outputs=[]
for p in sorted([*ROOT.glob('*.blend'),*ROOT.glob('sheets/*.webp'),*ROOT.glob('review/*.webp'),*ROOT.glob('review/contact-*.png')]):
 row={'file':str(p.relative_to(ROOT)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)}
 if p.suffix in ['.png','.webp']:
  with Image.open(p) as im:
   row['size']=list(im.size);row['frames']=im.n_frames
   total=0
   for i in range(im.n_frames):
    im.seek(i);im.load();total+=im.info.get('duration',0)
   row['animationDurationMs']=total
 outputs.append(row)
scripts=[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)} for p in sorted(ROOT.glob('tools/*.py'))]
ledger={'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'offline_preproduction_not_integrated','originalSource':bake['source'],'originalSourceSha256':bake['sourceSha256'],'sourceTaskId':'15d4e91d-7b0c-4471-af5a-8fcf70d73920','newTripoTasks':0,'newTripoCredits':0,'runtimeChanges':False,'sourcePreservationChecks':preserved['unchangedChecks'],'cameraSamplesMatch':True,'sampledFrames':sprites['sampledFrames'],'uniqueFrames':sprites['uniqueFrames'],'exactDuplicateCellsRemoved':sprites['exactDuplicatesRemoved'],'emptyFrames':len(sprites['emptyFrames']),'clippedFrames':len(sprites['clippedFrames']),'totalSheetBytes':sprites['webpBytes'],'outputs':outputs,'scripts':scripts,'deferred':['jump: source repeats small hops; not adopted as one high obstacle jump','new dash/landing keyframes: not invented','game playback rate, interruption/blending, mobile performance: not tested'],'rightsRecord':'../tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md'}
(ROOT/'ledger.json').write_text(json.dumps(ledger,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in ledger.items() if k not in ['outputs','scripts']},indent=2))
print('OUTPUT_BYTES',sum(o['bytes'] for o in outputs))
