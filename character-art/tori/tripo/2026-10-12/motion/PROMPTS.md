# Motion provenance

- Date: 2026-10-12 (KST).
- Tools: Tripo Studio, official Blender DCC Bridge 1.0.34, Blender 4.5.14 LTS,
  Python/Pillow for atlas packing.
- Character prompt and reference: see `../PROMPTS.md`. The existing character
  was reused; no new character or text-to-motion generation was submitted.
- Presets: run, idle, jump, hit_to_body_01, fall, cheer; export with skeleton
  and in-place playback enabled. Bridge delivered FBX.
- Seed: not exposed for these Studio presets; no seed is invented.
- Local modifications: neutral-region material correction, fixed-camera pose
  sampling, transparent rendering and downsampling/packing. Reproducible scripts
  are `../tools/bake-motion.py` and `../tools/pack-motion.py`.
- Source FBX hash and exact sampled action frames: `bake-manifest.json`.
