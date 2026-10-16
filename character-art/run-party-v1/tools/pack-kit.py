"""Pack reviewed 512px renders into one WebP atlas, with ground pivots."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

root=Path(__file__).resolve().parent.parent
runtime=root.parents[1]/'app/public/game/run-party-v1'
runtime.mkdir(parents=True,exist_ok=True)
review=root/'review'; review.mkdir(exist_ok=True)
report=json.loads((root/'bake-report.json').read_text())
atlas=Image.new('RGBA',(1024,1024))
sheet=Image.new('RGB',(1024,1160),'#FFF3D6'); draw=ImageDraw.Draw(sheet)
tiny=Image.new('RGB',(1024,300),'#FFF3D6'); td=ImageDraw.Draw(tiny)
assets=[]
order=['tree','rock','hurdle','gate','tower','tower-pad','ball-launcher','supply-flag','supply-token','wind-rotor','dust-runner-base','dust-fast','dust-armored','wind-device']
for i,name in enumerate(order):
    entry=next(r for r in report['assets'] if r['id']==name)
    im=Image.open(root/'renders'/f'{name}.png').convert('RGBA')
    bounds=im.getchannel('A').getbbox()
    assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<512 and bounds[3]<512,(name,bounds)
    cell=im.resize((256,256),Image.Resampling.LANCZOS)
    x=i%4*256; y=i//4*256; atlas.paste(cell,(x,y))
    sheet.paste(cell,(x,i//4*290),cell); draw.text((x+12,i//4*290+260),name,fill='#252337')
    # Measure the silhouette at actual 64/75px bounding-box height, not a full cell.
    for size,row in [(64,0),(75,150)]:
        icon=im.crop(bounds); icon.thumbnail((size,size),Image.Resampling.LANCZOS)
        tx=i%7*146; ty=row+(i//7)*72
        tiny.paste(icon,(tx,ty),icon)
        td.text((tx+76,ty+20),name.replace('dust-',''),fill='#252337')
    assets.append({'id':name,'rect':[x,y,256,256],
      'pivot':[round(v/2,3) for v in entry['groundPixel']],
      'alphaBounds':[round(v/2,3) for v in bounds],
      'source':entry['source'],'cameraMatrix':entry['cameraMatrix'],
      'collision':'Define in world units; never infer collision from transparent padding.'})
target=runtime/'props.webp'; atlas.save(target,format='WEBP',quality=90,method=6)
sheet.save(review/'asset-contact.png'); tiny.save(review/'readability-64-75.png')
size=target.stat().st_size
meta={'version':1,'status':'asset-ready-not-gameplay-integrated','file':'props.webp','width':1024,'height':1024,
      'bytes':size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'assets':assets,
      'decodedBytes':1024*1024*4,'toriAtlas':'tori-diagonal.webp',
      'toriFrames':{'run':[0,8],'idle':[8,2],'jump':[10,3],'hit':[13,1],'fall':[14,1],'cheer':[15,1]}}
(runtime/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
total=sum(p.stat().st_size for p in runtime.glob('*.webp'))
assert total<=1048576,total
print(json.dumps({'assets':len(assets),'propsBytes':size,'totalWebPBytes':total,'decodedAtlasBytes':8388608}))
