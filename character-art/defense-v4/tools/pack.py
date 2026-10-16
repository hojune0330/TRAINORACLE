"""Pack reviewed 3D renders as small transparent runtime images."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib
ROOT = Path(__file__).resolve().parent.parent; REPO = ROOT.parents[1]
OUT = REPO/'app/public/game/defense-v4'; OUT.mkdir(parents=True, exist_ok=True)
(ROOT/'review').mkdir(exist_ok=True)
names = ['cannon','fan','flag','normal','rush','armor','base','finish-gate']
labels = ['공 발사기','바람 장치','회복 깃발','일반 적','돌진 적','껍질 적','기지','완주 아치']
fallback = {'rush':'dust-fast', 'armor':'dust-armored'}
board = Image.new('RGB',(1000,320*((len(names)+4)//5)), '#F5F6F8'); d = ImageDraw.Draw(board)
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',21)
entries = []
for i,name in enumerate(names):
    source = ROOT/'renders'/f'{name}.png'
    if not source.exists(): source = ROOT.parent/'run-party-v1/renders'/f'{fallback[name]}.png'
    im = Image.open(source).convert('RGBA'); box = im.getchannel('A').getbbox()
    assert box and 0 < box[0] < box[2] < 512 and 0 < box[1] < box[3] < 512, (name,box)
    crop = im.crop(box); crop.thumbnail((224,224),Image.Resampling.LANCZOS)
    icon = Image.new('RGBA',(256,256)); icon.alpha_composite(crop,((256-crop.width)//2,240-crop.height))
    path = OUT/f'{name}.webp'; icon.save(path,quality=90,method=6)
    bx,by = (i%5)*200,(i//5)*320
    p = icon.resize((176,176),Image.Resampling.LANCZOS); board.paste(p,(bx+12,by+18),p)
    d.text((bx+20,by+208),labels[['cannon','fan','flag','normal','rush','armor','base','finish-gate'].index(name)],fill='#252337',font=font)
    p = icon.resize((64,64),Image.Resampling.LANCZOS); board.paste(p,(bx+68,by+248),p)
    entries.append({'id':name,'file':path.name,'size':[256,256],'baseline':240,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':str(source.relative_to(REPO)).replace('\\','/'),'alphaBounds':list(box)})
total = sum(e['bytes'] for e in entries); assert total < 250000,total
(OUT/'manifest.json').write_text(json.dumps({'assets':entries,'payloadBytes':total},indent=2)+'\n',encoding='utf-8')
board.save(ROOT/'review/contact.png')
print(json.dumps({'icons':len(entries),'bytes':total}))
