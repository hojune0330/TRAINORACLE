"""Pack baked PNGs into honest, timed sprite strips and review WebP animations."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, hashlib, math, sys
ROOT=Path(__file__).resolve().parents[1]
PROBE='--probe' in sys.argv
manifest=json.loads((ROOT/('probe-manifest.json' if PROBE else 'bake-manifest.json')).read_text())
# Cumulative millisecond rounding preserves source duration at fractional fps.
for clip in manifest['clips']:
  for view in clip['views'].values():
    records=view['records'];start,end=clip['excerptFrameRange'];fps=manifest['sourceFps']
    for i,r in enumerate(records):
      next_frame=records[i+1]['sourceFrame'] if i+1<len(records) else end
      r['durationMs']=round((next_frame-start)/fps*1000)-round((r['sourceFrame']-start)/fps*1000) if next_frame>r['sourceFrame'] else 100
if not PROBE:(ROOT/'bake-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
OUT=ROOT/('probe-review' if PROBE else 'review');OUT.mkdir(exist_ok=True)
SHEETS=ROOT/'sheets'
if not PROBE:SHEETS.mkdir(exist_ok=True)
try:
    FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
    SMALL=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',12)
except OSError: FONT=SMALL=ImageFont.load_default()
BG=(234,244,244,255); INK=(28,53,65,255); GRID=(176,202,202,255)
def board(w,h):return Image.new('RGBA',(w,h),BG)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def contact(cell,show_all=False):
    count=9 if PROBE else 8
    rows=len(manifest['clips'])*2
    img=board(130+cell*count,40+(cell+26)*rows);d=ImageDraw.Draw(img)
    d.text((12,10),f'Tori / source timing / {cell}px cell / fixed per-clip ground',font=FONT,fill=INK)
    r=0
    for clip in manifest['clips']:
      for view,data in clip['views'].items():
        records=data['records'];chosen=[round(i*(len(records)-1)/(count-1)) for i in range(count)]
        y=40+r*(cell+26);r+=1
        d.text((8,y+8),clip['id']+' / '+view,font=SMALL,fill=INK)
        for j,idx in enumerate(chosen):
          record=records[idx];frame=Image.open(ROOT/record['file']).convert('RGBA').resize((cell,cell),Image.Resampling.LANCZOS)
          x=130+j*cell;line=y+manifest['groundAnchor'][1]/256*cell
          d.line((x,line,x+cell,line),fill=GRID,width=1)
          img.alpha_composite(frame,(x,y));d.text((x+2,y+cell+2),f"f{record['sourceFrame']:.1f}",font=SMALL,fill=INK)
    img.convert('RGB').save(OUT/('contact-256.png' if cell==256 else f'contact-{cell}.png'))
contact(128)
# 104 px cells produce ~75 px neutral character height with the frozen 180 px/unit.
contact(104)
inventory={'cell':[256,256],'origin':manifest['origin'],'sampledFrames':0,'uniqueFrames':0,'exactDuplicatesRemoved':0,'clippedFrames':[],'emptyFrames':[],'clips':[]}
for clip in manifest['clips']:
  previews={}
  for view,data in clip['views'].items():
    records=data['records']; unique=[]; indices=[]; hashes={};timed=[]
    for record in records:
      frame=Image.open(ROOT/record['file']).convert('RGBA'); digest=hashlib.sha256(frame.tobytes()).hexdigest();bbox=frame.getchannel('A').getbbox()
      inventory['sampledFrames']+=1
      if not bbox:inventory['emptyFrames'].append(record['file'])
      elif bbox[0]==0 or bbox[1]==0 or bbox[2]==256 or bbox[3]==256:inventory['clippedFrames'].append({'file':record['file'],'bounds':bbox})
      if digest not in hashes:hashes[digest]=len(unique);unique.append(frame)
      idx=hashes[digest];indices.append(idx)
      # Temporal duplicate samples merge duration instead of accelerating time.
      if timed and timed[-1]['frame']==idx:timed[-1]['durationMs']+=record['durationMs']
      else:timed.append({'frame':idx,'durationMs':record['durationMs'],'sourceFrame':record['sourceFrame']})
    inventory['uniqueFrames']+=len(unique)
    inventory['exactDuplicatesRemoved']+=len(records)-len(unique)
    if not PROBE:
      cols=min(8,len(unique));rows=math.ceil(len(unique)/cols)
      sheet=Image.new('RGBA',(cols*256,rows*256),(0,0,0,0))
      for i,frame in enumerate(unique):sheet.alpha_composite(frame,((i%cols)*256,(i//cols)*256))
      path=SHEETS/f'tori-{view}-{clip["id"]}.webp';sheet.save(path,lossless=True,method=6)
      item={'clip':clip['id'],'view':view,'file':str(path.relative_to(ROOT)).replace('\\','/'),'bytes':path.stat().st_size,'sha256':sha(path),'columns':cols,'rows':rows,'uniqueFrames':len(unique),'timeline':timed,'sampleToUniqueFrame':indices,'loop':clip['loop'],'sourceDurationSeconds':clip['sourceDurationSeconds'],'excerptDurationSeconds':clip['durationSeconds']}
      inventory['clips'].append(item)
    previews[view]=[Image.open(ROOT/r['file']).convert('RGBA') for r in records]
  # The two cameras share exact source samples, not interpolated duplicate frames.
  count=len(next(iter(clip['views'].values()))['records']);movie=[];durations=[]
  for i in range(count):
    stage=board(640,390);d=ImageDraw.Draw(stage)
    d.text((20,12),f"{clip['id'].upper()} | original source timing",font=FONT,fill=INK)
    for v,view in enumerate(['side','diagonal']):
      x=20+v*310;y=48
      d.text((x,y),view+' / same pose & scale',font=SMALL,fill=INK)
      d.line((x,84+manifest['groundAnchor'][1],x+256,84+manifest['groundAnchor'][1]),fill=GRID,width=1)
      stage.alpha_composite(previews[view][i],(x,84))
      small=previews[view][i].resize((104,104),Image.Resampling.LANCZOS)
      stage.alpha_composite(small,(x+190,265))
      d.text((x+190,365),'~75px hero',font=SMALL,fill=INK)
    record=clip['views']['side']['records'][i]
    d.text((20,365),f"source frame {record['sourceFrame']:.2f} / {record['sourceTimeSeconds']:.3f}s",font=SMALL,fill=INK)
    movie.append(stage.convert('RGB'));durations.append(record['durationMs'])
  # Probe samples span the original full clip; normal clips retain original time.
  if not PROBE:
    movie[0].save(OUT/f'{clip["id"]}-two-view.webp',save_all=True,append_images=movie[1:],duration=durations,loop=0,lossless=True,method=4)
    movie[0].save(OUT/f'{clip["id"]}-first-frame.png')
if not PROBE:
  inventory['webpBytes']=sum(p.stat().st_size for p in SHEETS.glob('*.webp'))
  (ROOT/'sprite-manifest.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in inventory.items() if k!='clips'},indent=2))
