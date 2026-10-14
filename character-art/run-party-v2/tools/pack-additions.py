"""Pack rendered Tripo assets; measure actual bounds, geometry, bytes and hashes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib, struct
ROOT=Path(__file__).resolve().parent.parent
REPO=ROOT.parents[1]
OUT=REPO/'app/public/game/run-party-v2'; OUT.mkdir(parents=True,exist_ok=True)
REVIEW=ROOT/'review'; REVIEW.mkdir(exist_ok=True)
names=['jump-pad','supply-capsule','upgrade-core']
labels=['점프 발판','보급 캡슐','강화 코어']
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',24)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(name):
    im=Image.open(ROOT/'renders'/f'{name}.png').convert('RGBA')
    b=im.getchannel('A').getbbox()
    assert im.size==(512,512) and b and 0<b[0]<b[2]<512 and 0<b[1]<b[3]<512,(name,b)
    return im
def glb(path):
    b=path.read_bytes();magic,v,length=struct.unpack_from('<4sII',b)
    assert magic==b'glTF' and v==2 and length==len(b)
    n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n])
    tris=sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes'] for p in m['primitives'])
    return {'file':path.name,'bytes':len(b),'sha256':sha(path),'triangles':tris}
atlas=Image.new('RGBA',(768,512))
manifest={'version':1,'status':'asset-ready-not-gameplay-integrated','icons':{'file':'icons.webp','size':[768,512]},'assets':[]}
board=Image.new('RGB',(960,640),'#F5F6F8');draw=ImageDraw.Draw(board)
draw.text((32,22),'러닝 파티 · Tripo 추가 에셋',fill='#252337',font=font)
draw.text((32,61),'맵 소품 / 64px 아이콘 / 0.64초 효과',fill='#586174',font=small)
preview_frames=[Image.new('RGB',(960,420),'#EDF3F3') for _ in range(8)]
for col,(name,label) in enumerate(zip(names,labels)):
    source=glb(ROOT/'sources'/f'{name}.glb');working=glb(ROOT/'working'/f'{name}.glb')
    assert working['triangles']<=3000,working
    entry={'id':name,'label':label,'source':source,'working':working,'views':[]}
    for row,suffix in enumerate(['','-icon']):
        im=read(name+suffix);thumb=im.resize((256,256),Image.Resampling.LANCZOS)
        atlas.alpha_composite(thumb,(col*256,row*256))
        entry['views'].append({'kind':'world' if row==0 else 'icon','rect':[col*256,row*256,256,256]})
    im=read(name+'-icon')
    board.paste(im.resize((280,280),Image.Resampling.LANCZOS),(col*320+20,105),im.resize((280,280),Image.Resampling.LANCZOS))
    draw.text((col*320+32,390),label,fill='#252337',font=font)
    for size,x in [(64,40),(75,140)]:
        thumb=im.resize((size,size),Image.Resampling.LANCZOS)
        board.paste(thumb,(col*320+x,445),thumb)
        draw.text((col*320+x,530),f'{size}px',fill='#586174',font=small)
    sheet=Image.new('RGBA',(1024,512));frame_rects=[]
    for i in range(8):
        frame=read(f'{name}-fx-{i+1:02d}');thumb=frame.resize((256,256),Image.Resampling.LANCZOS)
        x=(i%4)*256;y=(i//4)*256;sheet.alpha_composite(thumb,(x,y));frame_rects.append([x,y,256,256])
        p=frame.resize((300,300),Image.Resampling.LANCZOS);preview_frames[i].paste(p,(col*320+10,60),p)
        ImageDraw.Draw(preview_frames[i]).text((col*320+35,20),label,fill='#252337',font=font)
    path=OUT/f'{name}-fx.webp';sheet.save(path,quality=90,method=6)
    entry['effect']={'file':path.name,'sha256':sha(path),'frames':frame_rects,'durationMs':640,
        'loop':False,'pivot':[128,128],'localAuthored':['pulse','ring','sparkles'],
        'reducedMotion':'use static icon; skip ring and sparkles'}
    manifest['assets'].append(entry)
atlas.save(OUT/'icons.webp',quality=90,method=6)
manifest['icons']['sha256']=sha(OUT/'icons.webp')
total=sum(p.stat().st_size for p in OUT.glob('*.webp'));assert total<=1048576,total
manifest['payloadBytes']=total;manifest['decodedBytes']=(768*512+3*1024*512)*4
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
board.save(REVIEW/'contact.png')
preview_frames[0].save(REVIEW/'effects-preview.webp',save_all=True,append_images=preview_frames[1:],duration=80,loop=1,quality=90,method=6)
report={'status':'passed','sourceCount':3,'workingCount':3,'staticViews':6,'effectFrames':24,
    'payloadBytes':total,'decodedBytes':manifest['decodedBytes'],'allFramesWithinBounds':True,
    'gameplayIntegration':False,'productionDeployment':False}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
