# Runtime Tripo props

These are real Tripo source meshes prepared in Blender, not presentation-only
concept images. Runtime PNGs and GLBs live in
`app/public/games/sleep-inn/tripo/`. The game uses the lightweight rendered PNGs;
the optimized GLBs remain available for future interactive 3D use.

## Reproduce

Use Blender 4.5.14 LTS and run `tools/prepare-prop.py` in background mode:

```powershell
& $blender --background --threads 2 --python `
  character-art/dream-guest-inn-v1/tripo/tools/prepare-prop.py -- `
  --source character-art/dream-guest-inn-v1/tripo/sources/hooded-lamp-source.glb `
  --id hooded-lamp --output app/public/games/sleep-inn/tripo `
  --report character-art/dream-guest-inn-v1/tripo/hooded-lamp-manifest.json `
  --task 91a343ee-bd3a-45e5-bdb5-492ccc430292 --directions
```

The script hashes the source before and after processing. It normalizes the
working copy to a bottom-centred pivot and two-unit height. High-poly sources
are voxel reconstructed **before** collapse simplification, then receive a
512×512 base-color bake from the original source. It exports a GLB and renders
512×512 transparent sprites from a fixed orthographic camera. The limit is
6,000 triangles, including locally added lamp geometry.

The first rejected experiment collapsed the disconnected source triangles
before remeshing and lost surfaces. None of those rejected meshes or sprites
are delivery artifacts. The original sources were not changed.

## Orientation and use

- South is the lamp's forward lens facing the viewer (`-Y` in Blender).
- East, north and west rotate the actual mesh by 90°, 180°, and 270°.
- All four lamp sprites share camera, scale, feet/bottom pivot and framing.
- The long stone occupies two horizontal cells. Display its single wide sprite
  across the anchor and tail cells; do not show two duplicate sprites.
- The sealed letter is a standalone prop used in the chapter-five window slot;
  it contains no written player data or generated text.
- Lighting footprints belong to the game rule layer and are not baked into the
  artwork. PNG alpha contains only the prop, with no fake beam or floor plane.

Source metadata, task IDs, polygon budgets, texture sizes and file hashes are
recorded in per-prop manifests. Exact prompts are in `PROMPTS.md`. Original
64–67 MB sources and Blender diagnostics remain local through `.gitignore`.

## Acceptance

Inspect every cardinal render on a light board and at 64 px before wiring it
into the game. A successful Blender process alone is not visual acceptance.
Runtime integration, browser proof and deployment are verified separately.
