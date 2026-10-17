"""Pack only the three owned landmark files. Never touch ground/panorama assets."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,struct,datetime
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parent.parent
PUBLIC=REPO/'app/public/game/fantasy-world-v1';PUBLIC.mkdir(parents=True,exist_ok=True)
report=json.loads((ROOT/'bake-report.json').read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def projected(record,p):
 m=record['cameraMatrix'];delta=[p[i]-m[i][3] for i in range(3)]
 x=sum(delta[i]*m[i][0] for i in range(3));y=sum(delta[i]*m[i][1] for i in range(3));s=record['orthoScale']
 return [.5+x/s,.5-y/s]
def glb_triangles(path):
 raw=path.read_bytes();length,kind=struct.unpack_from('<II',raw,12)
 assert raw[:4]==b'glTF' and kind==0x4e4f534a
 data=json.loads(raw[20:20+length]);return sum(data['accessors'][p['indices']]['count']//3 for m in data['meshes'] for p in m['primitives'] if p.get('mode',4)==4)
TASKS={'gate':'ee1027bd-13c1-4127-843f-78f1a4915bb2','crystal':'07c2704f-a238-4cc1-bd40-8a70043a4b6a','bridge':'23168032-2c39-4dbe-a29b-17ae6c143fcd'}
manifest={'version':1,'world':'starlight-relay-forest','format':'RGBA lossless WebP','camera':'defense-v5 matched fixed orthographic view','runtimeMode':'2D sprites support pan/zoom; not free camera orbit','newTripoTasks':0,'newTripoCredits':0,'assets':[]}
for name in ['gate','crystal','bridge']:
 r=next(a for a in report['assets'] if a['id']==name)
 assert sha(REPO/r['originalSource'])==r['originalSha256']
 image=Image.open(ROOT/r['render']).convert('RGBA');bounds=image.getchannel('A').getbbox()
 assert image.size==(512,512) and bounds and 0<bounds[0]<bounds[2]<512 and 0<bounds[1]<bounds[3]<512,(name,bounds)
 output=PUBLIC/f'{name}.webp';image.save(output,lossless=True,method=6)
 working=ROOT/r['workingGLB'];surface=projected(r,(0,0,.9545)) if name=='bridge' else r['origin']
 manifest['assets'].append({'id':name,'file':output.name,'size':[512,512],'aspectRatio':1,'origin':[round(v,6) for v in r['origin']],'pathAlignmentOrigin':[round(v,6) for v in surface],'pathAlignmentNote':'Use this origin when a ground-plane path must visually meet the raised central walking surface.' if name=='bridge' else 'Ground-plane centre; landmark is decorative unless gameplay explicitly defines interaction.','alphaBounds':bounds,'bytes':output.stat().st_size,'sha256':sha(output),'source':r['source'],'originalSource':r['originalSource'],'originalSha256':r['originalSha256'],'originalTaskId':TASKS[name],'workingGLB':str(working.relative_to(REPO)).replace('\\','/'),'workingGLBBytes':working.stat().st_size,'workingGLBSha256':sha(working),'triangles':glb_triangles(working),'authoring':str((ROOT/f'{name}.blend').relative_to(REPO)).replace('\\','/'),'renderOrthoSpan':r['orthoScale'],'worldBounds':r['worldBounds'],'cameraMatrix':r['cameraMatrix'],'shadow':'No ground-plane shadow baked; draw a separate contact shadow if required.','physics':'Alpha bounds and image padding are not collision geometry.'})
manifest['totalBytes']=sum(a['bytes'] for a in manifest['assets']);manifest['decodedRGBABytes']=3*512*512*4
(PUBLIC/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
ledger={'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'generator':'Existing paid Tripo source + original local Blender construction','newTripoTasks':0,'newCredits':0,'liveStudioBalanceQueried':False,'sourcesUnchanged':True,'assets':manifest['assets'],'scripts':[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)} for p in sorted((ROOT/'tools').glob('*.py'))],'scope':'Rendered and visually inspected local assets. Runtime placement, gameplay and deployment are separate.'}
(ROOT/'ledger.json').write_text(json.dumps(ledger,indent=2),encoding='utf-8')
try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
except OSError:font=ImageFont.load_default()
contact=Image.new('RGB',(1008,856),(231,238,231));draw=ImageDraw.Draw(contact)
for row,bg in enumerate([(231,238,231),(35,47,62)]):
 for col,name in enumerate(['gate','crystal','bridge']):
  x=col*336;y=row*428;draw.rectangle((x,y,x+335,y+427),fill=bg)
  im=Image.open(PUBLIC/f'{name}.webp').convert('RGBA');contact.paste(im.resize((320,320),Image.Resampling.LANCZOS),(x+8,y+38),im.resize((320,320),Image.Resampling.LANCZOS))
  draw.text((x+16,y+10),name+' / 320 px',font=font,fill=(20,37,47) if row==0 else (225,239,231))
  small=im.resize((96,96),Image.Resampling.LANCZOS);contact.paste(small,(x+224,y+326),small)
  draw.text((x+16,y+381),'96 px inset',font=font,fill=(20,37,47) if row==0 else (225,239,231))
contact.save(ROOT/'review/contact.png')
print(json.dumps({'bytes':manifest['totalBytes'],'decodedRGBABytes':manifest['decodedRGBABytes'],'assets':[{'id':a['id'],'origin':a['origin'],'pathAlignmentOrigin':a['pathAlignmentOrigin'],'bounds':a['alphaBounds'],'bytes':a['bytes'],'triangles':a['triangles']} for a in manifest['assets']]},indent=2))
