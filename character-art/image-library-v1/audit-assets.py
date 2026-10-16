"""Read-only PNG integrity/alpha audit; never edits image pixels."""
from pathlib import Path
import hashlib, json
from PIL import Image

root = Path(__file__).resolve().parent
plan = json.loads((root / "production-plan.json").read_text(encoding="utf-8"))
rows, errors, seen = [], [], {}
for spec in plan["assets"]:
    path = root / spec["file"]
    if not path.exists():
        errors.append(spec["id"] + ": missing")
        continue
    blob = path.read_bytes()
    digest = hashlib.sha256(blob).hexdigest()
    if digest in seen:
        errors.append(spec["id"] + ": duplicated bytes of " + seen[digest])
    seen[digest] = spec["id"]
    with Image.open(path) as image:
        image.load()
        bands = image.getbands()
        if image.format != "PNG" or "A" not in bands:
            errors.append(spec["id"] + ": PNG alpha required")
            continue
        alpha = image.getchannel("A")
        histogram = alpha.histogram()
        corners = [alpha.getpixel((x, y)) for x, y in [(0,0), (image.width-1,0), (0,image.height-1), (image.width-1,image.height-1)]]
        visible = alpha.point(lambda v: 255 if v > 16 else 0).getbbox()
        if min(alpha.getextrema()) != 0 or max(alpha.getextrema()) < 200 or any(value > 1 for value in corners):
            errors.append(spec["id"] + ": alpha review required")
        if min(image.size) < 512:
            errors.append(spec["id"] + ": master below 512px")
        rows.append({"id": spec["id"], "file": spec["file"], "format": image.format,
            "width": image.width, "height": image.height, "mode": image.mode, "sha256": digest,
            "bytes": len(blob), "alphaExtrema": alpha.getextrema(), "cornerAlpha": corners,
            "transparentPixels": histogram[0], "transparentFraction": round(histogram[0]/(image.width*image.height),4),
            "visibleBoundsAlphaAbove16": visible, "runtimeIntegrated": False})
report = {"schemaVersion":1, "plannedCount":len(plan["assets"]), "checkedCount":len(rows),
    "pass":not errors and len(rows)==len(plan["assets"]), "errors":errors, "assets":rows,
    "scope":"Original file integrity, uniqueness, dimensions and alpha only. Visual readability is reviewed separately."}
(root/"file-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
print(json.dumps({"planned":report["plannedCount"],"checked":report["checkedCount"],"pass":report["pass"],"errors":errors}, ensure_ascii=False))
raise SystemExit(0 if report["pass"] else 1)
