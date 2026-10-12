"""Pack already-rendered frames without changing their layout (Python/Pillow)."""
from pathlib import Path
import hashlib, json
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parent.parent
manifest=json.loads((root/'motion/bake-manifest.json').read_text())
atlas=Image.new('RGBA',(1024,1024))
contact=Image.new('RGB',(1024,1120),'#e8eee8')
draw=ImageDraw.Draw(contact)
small=Image.new('RGB',(960,210),'#e8eee8')
sd=ImageDraw.Draw(small)
all_frames=[]
for f in manifest['frames']:
    im=Image.open(root/'motion/frames'/f['file']).convert('RGBA')
    assert im.size==(512,512)
    box=im.getchannel('A').getbbox()
    assert box and box[0]>0 and box[1]>0 and box[2]<512 and box[3]<512, (f['file'],box)
    f['alphaBounds']=list(box)
    cell=im.resize((256,256),Image.Resampling.LANCZOS)
    x=(f['index']%4)*256; y=(f['index']//4)*256
    atlas.paste(cell,(x,y))
    contact.paste(cell,(x,(f['index']//4)*280),cell)
    draw.text((x+12,(f['index']//4)*280+258),f['file'],fill='#163831')
    if f['index']<8:
        for size,row in [(64,0),(75,105)]:
            factor=size/420
            tiny=im.resize((round(512*factor),round(512*factor)),Image.Resampling.LANCZOS)
            small.paste(tiny,(f['index']*120,row),tiny)
            sd.text((f['index']*120+4,row+90),f'{size}px / {f["index"]+1}',fill='#163831')
        animation=Image.new('RGBA',(256,256),'#e8eee8'); animation.alpha_composite(cell)
        all_frames.append(animation.convert('RGB'))
runtime=root.parents[3]/'app/public/game/characters/tori'
runtime.mkdir(parents=True,exist_ok=True)
atlas.save(runtime/'tori-atlas-v1.webp',format='WEBP',lossless=True,method=6)
contact.save(root/'motion/contact-sheet.png')
small.save(root/'motion/readability-64-75.png')
all_frames[0].save(root/'motion/run-preview.webp',save_all=True,append_images=all_frames[1:],duration=156,loop=0,lossless=True)
manifest['atlas']={'file':'app/public/game/characters/tori/tori-atlas-v1.webp','bytes':(runtime/'tori-atlas-v1.webp').stat().st_size,'sha256':hashlib.sha256((runtime/'tori-atlas-v1.webp').read_bytes()).hexdigest()}
(root/'motion/bake-manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps(manifest['atlas']))
