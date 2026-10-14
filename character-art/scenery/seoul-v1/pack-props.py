"""Pack generated offline renders for Canvas; preserves alpha and tight foot origin."""
import sys, json, hashlib
from pathlib import Path
from PIL import Image

source=Path(sys.argv[1]); destination=Path(sys.argv[2]); destination.mkdir(parents=True,exist_ok=True)
report=json.loads((source/'bake-report.json').read_text(encoding='utf-8'))
for entry in report:
    image=Image.open(source/f"{entry['id']}.png").convert('RGBA')
    bounds=image.getchannel('A').getbbox()
    if not bounds: raise ValueError(f"Empty render: {entry['id']}")
    image=image.crop(bounds)
    image.thumbnail((256,256),Image.Resampling.LANCZOS)
    target=destination/f"{entry['id']}.webp"
    image.save(target,format='WEBP',quality=88,method=6)
    entry.update(width=image.width,height=image.height,bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
(destination/'manifest.json').write_text(json.dumps({'version':1,'assets':report},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'count':len(report),'bytes':sum(x['bytes'] for x in report)}))
