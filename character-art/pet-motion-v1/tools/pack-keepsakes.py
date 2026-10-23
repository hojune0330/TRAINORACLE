"""Package the inspected originals; only resize and encode, preserving alpha."""
from pathlib import Path
from PIL import Image
import hashlib, json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parents[1] / 'app/public/games/pet-room-v1/keepsakes-v1'
OUT.mkdir(parents=True, exist_ok=True)
records = []
for source in sorted((ROOT / 'keepsakes-v1/originals').glob('*.png')):
    with Image.open(source) as image:
        image = image.convert('RGBA')
        alpha = image.getchannel('A')
        assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] == 255
        size = list(image.size)
        bounds = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
        target = OUT / (source.stem + '.webp')
        image.resize((512, 512), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=92, method=6)
    records.append({'id': source.stem, 'sourceSize': size, 'visibleAlphaBounds': bounds, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'runtime': target.relative_to(ROOT.parents[1]).as_posix(), 'bytes': target.stat().st_size, 'runtimeSha256': hashlib.sha256(target.read_bytes()).hexdigest()})
(ROOT / 'keepsakes-v1/manifest.json').write_text(json.dumps({'generated': '2026-10-23', 'tool': 'image_gen built-in', 'runtimeSize': [512, 512], 'assets': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'assets': len(records), 'runtimeBytes': sum(item['bytes'] for item in records)}, ensure_ascii=False))
