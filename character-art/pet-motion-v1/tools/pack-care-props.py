"""Convert generated transparent originals to web assets without changing their art."""
from pathlib import Path
import hashlib
import json
from PIL import Image

root = Path(__file__).resolve().parents[1]
project = root.parents[1]
output = project / "app/public/games/pet-room-v1"
records = []
for source_name, output_name in (("blanket.png", "blanket-v3.webp"), ("bowl-empty.png", "bowl-empty-v3.webp")):
    source = root / "props-v3/originals" / source_name
    image = Image.open(source)
    assert image.mode == "RGBA", f"Missing transparency: {source}"
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    # Generator output contains isolated alpha=1 pixels. Inspect the visible
    # silhouette without deleting or repainting any original pixels.
    visible_bounds = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
    assert visible_bounds and min(visible_bounds[:2]) > 0 and visible_bounds[2] < image.width and visible_bounds[3] < image.height, "Visible art must not touch an edge"
    assert alpha.getextrema() == (0, 255)
    assert image.width == image.height
    target = output / output_name
    image.resize((512, 512), Image.Resampling.LANCZOS).save(target, quality=92, method=4, alpha_quality=100)
    records.append({"source": source.relative_to(project).as_posix(), "output": target.relative_to(project).as_posix(),
                    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "bytes": target.stat().st_size,
                    "sourceSize": image.size, "sourceAlphaBounds": bounds, "visibleAlphaBounds": visible_bounds, "visibleAlphaThreshold": 16, "size": [512, 512]})
(root / "props-v3/manifest.json").write_text(json.dumps({"date": "2026-10-22", "generator": "built-in image_gen", "assets": records}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(records, ensure_ascii=False, indent=2))
