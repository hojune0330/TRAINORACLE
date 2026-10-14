"""Deterministic offline layout studies made from the delivered atlas, not gameplay screenshots."""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent.parent
runtime=root.parents[1]/'app/public/game/run-party-v1'
meta=json.loads((runtime/'manifest.json').read_text())
props=Image.open(runtime/'props.webp').convert('RGBA'); tori=Image.open(runtime/'tori-diagonal.webp').convert('RGBA')
assets={a['id']:a for a in meta['assets']}
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',28)
small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',19)
def project(x,y):return (450+(x*.573634-y*.819112)*65,420+(x*.280110+y*.196165)*65)
for mode in ['run','defense']:
    im=Image.new('RGBA',(900,760),'#d7e8e6'); d=ImageDraw.Draw(im)
    d.polygon([(0,220),(900,140),(900,760),(0,760)],fill='#9ac8ad')
    curve=lambda x:math.sin(x*(.32 if mode=='run' else .22))*(1.25 if mode=='run' else .5)
    for i in range(-140,140):
        x=i/10
        d.polygon([project(x,curve(x)-1.5),project(x+.11,curve(x+.11)-1.5),project(x+.11,curve(x+.11)+1.5),project(x,curve(x)+1.5)],fill='#8ea7b5')
    for i in range(-12,14):
        x=i*1.2;y=curve(x)
        d.polygon([project(x,y-.04),project(x+.5,y-.04),project(x+.5,y+.04),project(x,y+.04)],fill='#fff3d6')
    items=[]
    def place(name,x,y,size):
        sx,sy=project(x,y);items.append((sy,name,sx,sy,size))
    for x,y,size in [(-8,-4,135),(-5,4,185),(-1,5.5,125),(10,-4,135),(-12,4,160)]:place('tree',x,y,size)
    place('rock',0,4,68);place('rock',7,3.8,65)
    if mode=='run':
        for x in [2,6]:place('hurdle',x,curve(x),130)
        place('gate',10,curve(10),170)
        for x in [3.5,4.3,5.1]:place('supply-token',x,curve(x),45)
    else:
        place('gate',8,curve(8),175)
        for name,x,y in [('wind-device',-1,-3),('ball-launcher',3,3),('supply-flag',6,-3)]:
            place('tower-pad',x,y,125);place(name,x,y,150)
        for name,x in [('dust-runner-base',-7),('dust-fast',-3.5),('dust-armored',1)]:place(name,x,curve(x),104)
        place('@friend',4,curve(4),155)
    place('@tori',-1.4,curve(-1.4),155)
    for _,name,sx,sy,size in sorted(items,key=lambda i:i[0]):
        if name.startswith('@'):
            index=2 if name=='@tori' else 6
            cell=tori.crop((index%4*256,index//4*256,index%4*256+256,index//4*256+256));pivot=[128,240]
        else:
            a=assets[name];x,y,w,h=a['rect'];cell=props.crop((x,y,x+w,y+h));pivot=a['pivot']
        cell=cell.resize((size,size),Image.Resampling.LANCZOS)
        d.ellipse([sx-size*.2,sy-5,sx+size*.2,sy+5],fill='#78a68e')
        im.alpha_composite(cell,(round(sx-pivot[0]*size/256),round(sy-pivot[1]*size/256)))
        if name=='@friend':d.text((sx-25,sy+12),'친구',font=small,fill='#252337')
    d.rounded_rectangle((24,24,876,120),radius=22,fill='#252337')
    d.text((48,38),'커브 러닝' if mode=='run' else '함께 디펜스',font=font,fill='#fff3d6')
    d.text((48,81),'Tripo 에셋 + 같은 사선 투영 · 맵 배치 검수',font=small,fill='#ffce3a')
    d.text((30,698),'에셋 배치 시안 · 실제 게임 플레이 화면 아님',font=small,fill='#252337')
    im.convert('RGB').save(root/'review'/f'layout-{mode}.png')
