"""Pack approved original PNGs for the game. Only resize and WebP encode; never alter sources."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
OUTPUT = ROOT / "app/public/game/image-library-v1"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify deterministic output and sources without writing")
    args = parser.parse_args()
    plan = json.loads((SOURCE / "production-plan.json").read_text(encoding="utf-8-sig"))["assets"]
    if len(plan) != 30 or len({a["id"] for a in plan}) != 30:
        raise ValueError("Expected the approved 30-asset production list")
    assets = []
    for group in ("defense", "world", "fx"):
        paths = sorted(SOURCE / a["file"] for a in plan if a["group"] == group)
        for path in paths:
            original = path.read_bytes()
            with Image.open(io.BytesIO(original)) as image:
                source = image.convert("RGBA")
            if source.getchannel("A").getextrema()[0] != 0:
                raise ValueError(f"Source has no transparent background: {path.name}")
            edge = 512 if path.stem == "fx-dash-trail" else 256
            packed = source.copy()
            packed.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            stream = io.BytesIO()
            packed.save(stream, format="WEBP", quality=88, method=6, alpha_quality=100, exact=True)
            encoded = stream.getvalue()
            relative = Path(group) / f"{path.stem}.webp"
            destination = OUTPUT / relative
            if args.check:
                if not destination.is_file() or destination.read_bytes() != encoded:
                    raise ValueError(f"Runtime output differs: {relative}")
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(encoded)
            with Image.open(io.BytesIO(encoded)) as decoded:
                rgba = decoded.convert("RGBA")
                alpha = rgba.getchannel("A")
                meaningful = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
                if alpha.getextrema()[0] != 0 or meaningful is None:
                    raise ValueError(f"Runtime alpha or silhouette invalid: {relative}")
            if path.read_bytes() != original:
                raise ValueError(f"Original changed during packing: {path.name}")
            assets.append({
                "id": path.stem, "group": group,
                "source": str(path.relative_to(ROOT)).replace("\\", "/"),
                "sourceSha256": sha(original), "sourceBytes": len(original),
                "sourceWidth": source.width, "sourceHeight": source.height,
                "file": relative.as_posix(), "sha256": sha(encoded), "bytes": len(encoded),
                "width": rgba.width, "height": rgba.height,
                "visibleRectAlpha128": list(meaningful), "alphaExtrema": list(alpha.getextrema()),
                "runtimeUsable": True,
            })
    result = {
        "schemaVersion": 1, "collection": "image-library-v1", "assetCount": len(assets),
        "packing": {"operation": "resize-and-WebP-encode-only", "longEdge": 256,
                    "dashTrailLongEdge": 512, "quality": 88, "alphaQuality": 100,
                    "sourceFilesUnchanged": True, "runtimeUsableIsIntegrationClaim": False},
        "sourceBytes": sum(a["sourceBytes"] for a in assets),
        "runtimeBytes": sum(a["bytes"] for a in assets), "assets": assets,
    }
    manifest = (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    target = OUTPUT / "manifest.json"
    if args.check:
        if target.read_bytes() != manifest:
            raise ValueError("Runtime manifest differs")
    else:
        target.write_bytes(manifest)
    print(json.dumps({"checked" if args.check else "packed": len(assets),
                      "sourceBytes": result["sourceBytes"], "runtimeBytes": result["runtimeBytes"]}))


if __name__ == "__main__":
    main()
