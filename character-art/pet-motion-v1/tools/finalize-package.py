"""Record the exact six-species render inputs and register walk aliases.

Run only after key-pose review and packing all ten clips per animal. This is an
asset receipt, not evidence of production deployment or real-account storage.
"""
import hashlib,json,shutil
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parent.parent
repo=root.parent.parent
public=repo/'app/public/games/pet-motion-v1'
catalog=json.loads((public/'catalog.json').read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
pets={
 'cat':('3a2ff544-bec3-4e93-8da7-e3e6b0b0dbe6','nareun-motion-master.blend',40,'text-to-model'),
 'puppy':('8aed8caa-3362-4cd5-a9b4-9bfac59d6fdb','dubu-motion-v2.blend',40,'text-to-model'),
 'rabbit':('348d2f5b-acf6-4228-91e5-478da1113f8b','rabbit-motion-v2.blend',340,'Studio-image-to-model'),
 'duck':('70e57354-2740-4308-aceb-07b9a867737a','duck-motion-v2.blend',120,'text-to-model'),
 'seal':('f03c6947-36f4-4415-95ce-f0203ca20bdc','seal-motion-v3.blend',120,'Studio-image-to-model'),
 'otter':('4babf375-ac66-4b2f-ad9a-ad157e425941','otter-motion-v2.blend',120,'Studio-image-to-model'),
}
motions=['idle','pet','lie-down','sleep','wake','eat','play','hello','walk-left','walk-right']
if set(catalog) - set(pets):
    raise ValueError('This historical six-pet receipt must not overwrite later pets. Use finalize-expansion.py for the expansion.')
manifest={'date':'2026-10-22','baseSourceSha':'872f82fe35d1bee3b8fe134f8546192f2ae1f4fd',
          'status':'six-pets-integrated-in-source','published':False,'pets':{},
          'checks':{'typecheck':'passed','focusedTests':{'files':4,'passed':24},
          'artReview':'species-specific petting, settling, walk and greeting key poses; fixed-cell packing checks every output frame'},
          'limits':['42 other catalog pets still use their existing static art.',
                    'This receipt does not prove production deployment or real-account persistence.',
                    'Blender masters contain authored procedural materials. Future realtime 3D export needs material baking.']}
for pet,(task,latest,cost,route) in pets.items():
    rows=[];masters={}
    for motion in motions:
        clip=catalog[pet][motion]
        audit=json.loads((root/f'review/approved/{pet}/{pet}-{motion}.json').read_text(encoding='utf-8'))
        sheet=public/clip['sheet']
        if sha(sheet)!=audit['sheetSha256']:raise ValueError('Changed reviewed sheet: '+str(sheet))
        with Image.open(sheet) as im:
            if im.size!=(clip['columns']*256,clip['rows']*256):raise ValueError('Wrong atlas size')
        source=root/'working'/pet/audit['render']['source']
        if sha(source)!=audit['render']['sourceSha256']:raise ValueError('Changed render source: '+str(source))
        masters[source.name]=source
        rows.append({'motion':motion,'sheet':clip['sheet'],'frames':clip['frames'],'bytes':sheet.stat().st_size,'sha256':sha(sheet),'source':source.name})
    masters[latest]=root/'working'/pet/latest
    master_dir=root/'masters'/pet;master_dir.mkdir(parents=True,exist_ok=True)
    receipts=[]
    for name,source in masters.items():
        destination=master_dir/name;shutil.copyfile(source,destination)
        receipts.append({'path':str(destination.relative_to(root)).replace('\\','/'),'sha256':sha(destination),'bytes':destination.stat().st_size})
    source_dir=root/'sources/tripo'/pet
    exports=[{'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(source_dir.glob('*.zip'))]
    provenance={'date':'2026-10-22','tool':'Tripo Studio Pro + Blender 4.5.14 LTS','modelId':task,
                'sourceUrl':'https://studio.tripo3d.ai/ko/workspace/generate/'+task,'visibility':'private',
                'seed':None,'route':route,'referenceWasUploaded':False,'reference':'references/'+pet+'-master.png',
                'promptRecord':'PROMPTS.md','creditsIncludingRejectedAttempts':cost,
                'exports':exports,'editableMasters':receipts,'gameClips':rows,
                'runtimeStatus':'registered in source; not published by this task',
                'sourcePolicy':'Original exports retained unchanged; Blender derivatives and rendered clips stored separately.',
                'licenseEvidence':'Created under observed Pro plan/private setting; provider pricing/license research in PRODUCTION.md. Local motion scripts are original work.',
                'motionSource':'Adapted Tripo quadruped walk plus locally authored reactions' if pet in ('cat','puppy') else 'Species-specific locally authored rig and actions; no stock humanoid motion'}
    (source_dir/'PROVENANCE.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    catalog[pet]['walk']=dict(catalog[pet]['walk-right'])
    manifest['pets'][pet]={'latestMaster':f'masters/{pet}/{latest}','clips':rows,'credits':cost}
manifest['uniqueSheets']=sum(len(v['clips']) for v in manifest['pets'].values())
manifest['frames']=sum(c['frames'] for v in manifest['pets'].values() for c in v['clips'])
manifest['sheetBytes']=sum(c['bytes'] for v in manifest['pets'].values() for c in v['clips'])
(root/'DELIVERY.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(public/'catalog.json').write_text(json.dumps(catalog,indent=2,sort_keys=True)+'\n',encoding='utf-8')
(repo/'app/src/screens/pet-room/pet-motion-catalog.ts').write_text("import type { PetMotionCatalog } from './pet-motion'\n\n// Generated from visually reviewed Blender clips; see character-art/pet-motion-v1.\nexport const PET_MOTION_CATALOG: PetMotionCatalog = "+json.dumps(catalog,indent=2,sort_keys=True)+'\n',encoding='utf-8')
ledger=json.loads((root/'credit-ledger.json').read_text(encoding='utf-8'));ledger['status']='six-models-exported-60-reviewed-game-sheets-registered';ledger['note']='780 credits used, including 200 for rejected rabbit meshes. Six species with ten unique clip sheets each are source-integrated. No new subscription, API purchase or production publication.'
(root/'credit-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:manifest[key] for key in ('uniqueSheets','frames','sheetBytes','published')}))
