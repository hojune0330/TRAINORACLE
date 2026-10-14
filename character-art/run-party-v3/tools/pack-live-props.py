from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,struct
ROOT=Path(__file__).resolve().parent.parent;REPO=ROOT.parents[1]
OUT=REPO/'app/public/game/run-party-v3';OUT.mkdir(parents=True,exist_ok=True)
(ROOT/'review').mkdir(exist_ok=True)
names=['track-island','respawn-beacon','jump-pad','supply-capsule','upgrade-core']
labels=['코스 아이콘','리젠 비콘','점프 안내','보급 획득','강화 연출']
board=Image.new('RGB',(1000,320),'#F5F6F8');d=ImageDraw.Draw(board)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',21)
entries=[]
for i,name in enumerate(names):
    source=ROOT/'renders'/f'{name}.png' if i<2 else ROOT.parent/'run-party-v2/renders'/f'{name}-icon.png'
    im=Image.open(source).convert('RGBA');box=im.getchannel('A').getbbox()
    assert box and 0<box[0]<box[2]<512 and 0<box[1]<box[3]<512,(name,box)
    crop=im.crop(box);crop.thumbnail((224,224),Image.Resampling.LANCZOS)
    icon=Image.new('RGBA',(256,256));icon.alpha_composite(crop,((256-crop.width)//2,(256-crop.height)//2))
    path=OUT/f'{name}.webp';icon.save(path,quality=90,method=6)
    p=icon.resize((176,176),Image.Resampling.LANCZOS);board.paste(p,(i*200+12,18),p)
    d.text((i*200+20,208),labels[i],fill='#252337',font=font)
    p=icon.resize((64,64),Image.Resampling.LANCZOS);board.paste(p,(i*200+68,248),p)
    entry={'id':name,'file':path.name,'size':[256,256],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'source':str(source.relative_to(REPO)).replace('\\','/'),'alphaBounds':list(box)}
    if i<2:
        for kind in ['sources','working']:
            b=(ROOT/kind/f'{name}.glb').read_bytes();magic,v,length=struct.unpack_from('<4sII',b)
            assert magic==b'glTF' and v==2 and length==len(b)
            n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n])
            triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
            if kind=='working':assert triangles<=3000,triangles
            entry[kind]={'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'triangles':triangles}
    entries.append(entry)
total=sum(e['bytes'] for e in entries);assert total<200000,total
(OUT/'manifest.json').write_text(json.dumps({'assets':entries,'payloadBytes':total,'decodedBytes':5*256*256*4},indent=2)+'\n',encoding='utf-8')
board.save(ROOT/'review/contact.png')
(ROOT/'validation.json').write_text(json.dumps({'status':'passed','newModels':2,'runtimeIcons':5,'payloadBytes':total,
    'allImagesInsideBounds':True,'workingTriangleLimit':3000},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','icons':5,'bytes':total}))
