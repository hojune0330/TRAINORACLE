"""Pack rendered animation cells; no painting or substitution of missing frames."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,sys
ROOT=Path(__file__).resolve().parents[1];REPO=ROOT.parents[1];OUT=REPO/'app/public/game/defense-v5'
names=['rapid','cannon','frost','scout','swift','armored','boss'];entries=[];previews=[]
probe='--probe' in sys.argv
board=Image.new('RGB',(128*7,160*4),'#DCE9DC');draw=ImageDraw.Draw(board)
for n,name in enumerate(names):
 path=ROOT/'renders'/name;tower=n<3
 if probe:
  for row in range(4):
   f=path/f'0-{min(row,2) if tower else row}.png';im=Image.open(f).convert('RGBA');board.paste(im,(n*128,row*160),im);draw.text((n*128+8,row*160+128),f'{name} / {row}',fill='#234034')
  continue
 for reaction in (False,True) if not tower else (False,):
  sheet=Image.new('RGBA',(1024,768));bounds=[];hashes=[]
  for row in range(6):
   source_row=([0,1,2,0,0,0][row] if tower else row)
   for direction in range(8):
    f=path/f'{direction}-{"reaction-" if reaction else ""}{source_row}.png';im=Image.open(f).convert('RGBA')
    assert im.size==(128,128),f
    box=im.getchannel('A').getbbox();assert box and min(box[:2])>0 and max(box[2:])<128,(f,box)
    sheet.alpha_composite(im,(direction*128,row*128));bounds.append(list(box));hashes.append(hashlib.sha256(im.tobytes()).hexdigest())
  filename=f'{name}-{"reactions" if reaction else "atlas"}.webp';out=OUT/filename
  sheet.save(out,quality=90,method=6,alpha_quality=100)
  entries.append({'id':name+('-reactions' if reaction else ''),'file':filename,'size':[1024,768],'frameSize':[128,128],'columns':8,'rows':6,'origin':[.5,.68],'directions':['E','SE','S','SW','W','NW','N','NE'],'layout':'frame = actionRow * 8 + direction','rowsMeaning':['hit-compress','hit-recover','death-1','death-2','death-3','death-4'] if reaction else (['idle','recoil','recover','idle','idle','idle'] if tower else ['walk-1','walk-2','walk-3','walk-4','walk-5','walk-6']),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'uniqueFrames':len(set(hashes)),'alphaBounds':bounds})
 for row in range(4):
  f=path/f'{[0,2,4,6][row]}-0.png';im=Image.open(f).convert('RGBA');board.paste(im,(n*128,row*160),im);draw.text((n*128+8,row*160+128),f'{name} / {"ESWN"[row]}',fill='#234034')
 # Workshop icons use the exact SE render, with empty atlas padding removed.
 # Runtime animation cells keep their original pivot and are never trimmed.
 preview=OUT/f'{name}-preview.webp';sample=Image.open(path/'1-0.png').convert('RGBA');sample=sample.crop(sample.getchannel('A').getbbox());sample.thumbnail((112,112),Image.Resampling.LANCZOS)
 icon=Image.new('RGBA',(128,128));icon.alpha_composite(sample,((128-sample.width)//2,(128-sample.height)//2));icon.save(preview,quality=92,method=6)
 previews.append({'id':name,'file':preview.name,'size':[128,128],'sourceFrame':1,'bytes':preview.stat().st_size,'sha256':hashlib.sha256(preview.read_bytes()).hexdigest()})
board.save(ROOT/'review'/('probe-contact.png' if probe else 'directions-contact.png'))
if not probe:
 (OUT/'manifest.json').write_text(json.dumps({'version':5,'pipeline':'Tripo GLB -> Blender 4.5.14 directional action bake -> WebP','origin':[.5,.68],'assets':entries,'previews':previews,'payloadBytes':sum(x['bytes'] for x in entries+previews)},indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'atlases':len(entries),'bytes':sum(x['bytes'] for x in entries),'uniqueFrames':sum(x['uniqueFrames'] for x in entries)}))
 motion=[]
 for t in range(48):
  frame=Image.new('RGB',(896,290),'#DCE9DC');d=ImageDraw.Draw(frame)
  for n,name in enumerate(names):
   tower=n<3;direction=(t//6)%8;row=([0,1,2,0,0,0][t%6] if tower else t%6)
   im=Image.open(ROOT/'renders'/name/f'{direction}-{row}.png').convert('RGBA');frame.paste(im,(n*128,10),im);d.text((n*128+8,140),name,fill='#234034')
   if not tower:
    im=Image.open(ROOT/'renders'/name/f'{direction}-reaction-{t%6}.png').convert('RGBA');frame.paste(im,(n*128,160),im)
  motion.append(frame)
 motion[0].save(ROOT/'review/motion.webp',save_all=True,append_images=motion[1:],duration=100,loop=0,quality=85,method=5)
 small_board=Image.new('RGB',(896,140),'#E8EDE5');small_draw=ImageDraw.Draw(small_board)
 for i,name in enumerate(names):
  icon=Image.open(OUT/f'{name}-preview.webp').convert('RGBA').resize((64,64),Image.Resampling.LANCZOS)
  small_board.paste(icon,(i*128+32,24),icon);small_draw.text((i*128+24,106),name,fill='#173F34')
 small_board.save(ROOT/'review/readability-64.png')
