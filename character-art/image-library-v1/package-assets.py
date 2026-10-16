"""Package existing asset bytes without editing any image."""
from pathlib import Path
import json, zipfile
root=Path(__file__).resolve().parent
manifest=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
if manifest["generatedCount"] != 30:
    raise SystemExit("All 30 assets must be produced before packaging.")
files=[a["file"] for a in manifest["assets"]]
files += ["README.md","manifest.json","file-audit.json","production-plan.json","tripo-queue.json","VALIDATION.md","INTEGRATION.md","runtime-usage.json"]
for group in ["defense","world","fx"]:
    files += [group+"/PROMPTS.md", group+"/assets.json"]
for file in files:
    if not (root/file).is_file(): raise SystemExit("Missing "+file)
out=root/"trainoracle-image-library-v1.zip"
with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as archive:
    for file in files: archive.write(root/file, file)
print(json.dumps({"files":len(files),"bytes":out.stat().st_size,"archive":out.name}))
