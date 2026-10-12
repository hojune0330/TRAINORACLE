# Tori motion pilot

2026-10-12. The user-authorized Studio model was transferred through the official
Blender DCC Bridge after local-network permission was granted. The original
browser download failure is not claimed to be diagnosed or repaired by this.

## Source and rights

- Untouched source: `tori-game-motions.fbx`, 3,858,348 bytes.
- SHA-256: `e6d3417b3727bf13fcf987d6e2400e78fa0f9414c2db51e325bc69019ae2314e`.
- Tripo Studio task: `15d4e91d-7b0c-4471-af5a-8fcf70d73920`.
- Official Studio presets: run, idle, jump, hit_to_body_01, fall, cheer.
- The Mixamo-named skeleton preset was supplied by Studio; no Adobe model or
  motion library was downloaded separately.
- [Tripo terms](https://www.tripo3d.ai/terms) and
  [commercial-use explanation](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially)
  govern the generated source. This package does not grant an MIT/CC license to
  character artwork. No account screenshots, credentials or signed URLs are included.

## Reproduce

Use Blender 4.5 LTS and Python with Pillow, from this package's parent directory:

```text
blender --background --factory-startup --python-exit-code 1 --python tools/bake-motion.py
python tools/pack-motion.py
```

The FBX remains unchanged. The authoring script preserves geometry, skin weights,
motion keys, facial texture and hair. It replaces neutral incomplete texture
regions with rest-space palette colours. Whole-body vertex colouring was rejected
because it blurred clothing boundaries. This is a small 2D runtime pilot, not a
claim that all views of the underlying 3D model are production-ready.

The generated editable `tori-authoring.blend` has packed textures and all six clips.
The reproducible script and FBX are the source of truth; the large local Blend
file is not included in Git. The runtime does not download the FBX or Blender file.

## Frame contract

- 512×512 transparent PNG; pelvis horizontally centred at x=256.
- 420 px reference height, ground baseline y=480. Run uses one shared ground so
  flight and body bounce remain intact. Other poses anchor the visible sole to
  the baseline; game physics supplies jump displacement.
- Run: 8 samples over the original 30-frame period. Idle: 2. Jump: 3.
- Hit/fall/cheer: one representative pose each, not complete animated sequences.
- Runtime: 1024×1024 lossless WebP, 4×4 cells of 256px. Manifest includes hash,
  clip times, camera targets and alpha bounds.
- Dash and tired reuse the run/idle artwork with existing small canvas transforms.

`contact-sheet.png`, `readability-64-75.png` and `run-preview.webp` are inspection
outputs. The atlas is used only for Tori; other five characters and load-failure
fallback retain their current Canvas rendering. User acceptance, runtime browser
checks and production release are recorded separately in the handoff.
