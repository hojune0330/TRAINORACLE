# Directional combat assets v5

Prepared 2026-10-16 KST from the existing paid Tripo Studio models. These are
combat animation assets, not another set of static inventory icons. Original
downloaded sources in `defense-v4/sources` and `run-party-v1/sources` remain untouched.

## Runtime contract

- `app/public/game/defense-v5/{rapid,cannon,frost,scout,swift,armored,boss}-atlas.webp`
- Each atlas is 1024 × 768: 8 columns × 6 rows, 128 × 128 pixels per frame.
- `frame = row * 8 + direction`; directions are **E, SE, S, SW, W, NW, N, NE**.
  E is screen/world +x; S is screen/world +y. Do not rotate the flat sprite again.
- Ground origin is **(0.5, 0.68)** in every frame. No per-frame trimming.
- Workshop `*-preview.webp` files use the exact SE idle render in a 128px icon,
  with empty cell padding removed and an 8px margin. Their identity matches the
  battle sprite. Previews are UI icons and do not use the ground pivot.
- Tower rows: idle, recoil, recovery, idle, idle, idle. Play 0 → 1 → 2 → 0
  after an actual shot. The lower base stays fixed while the upper turret turns.
- Enemy rows: six evenly sampled walk poses. Loop rows at approximately 10–12 fps;
  derive the direction from path tangent. Animation pace is separate from game speed.
- Each enemy also has `*-reactions.webp`, same dimensions and directions.
  Rows 0–1 are impact compression/recovery. Rows 2–5 collapse toward the ground.
  A practical death presentation is rows 2 → 3 → 4 → 5 over 0.32 seconds followed
  by a fade. Collision/reward timing belongs to the simulation, not these images.
- These atlases contain alpha and no drop shadows. Runtime shadows and status
  rings should be separate, anchored at the ground origin.
- All sources use the same fixed orthographic camera and lighting. Foot placement
  is stable; directional heading is baked from the 3D geometry rather than flipping
  one side-view image. `manifest.json` records exact bounds and unique-frame counts.

## Authored movement and variants

The original Tripo models have no deformable skeleton. The small dust creatures
use an authored six-pose body/foot deformation suitable for a soft toy silhouette:
alternating foot travel, planted-foot height, body compression and a small bounce.
The Blender files retain these poses as shape keys with a looping action. This is
not motion capture or Tripo retargeting. Reactions are separately baked.

The cannon and fan are split into lower and upper geometry in working copies.
The rapid tower uses the cannon base with an original simple twin-barrel upper
assembly. Frost uses the Tripo fan plus an original pressure tank so the side
view is readable. Armor and boss reuse existing creatures with chunky shell and
crest additions; their silhouette and palette distinguish their role.

Editable scenes are `{id}.blend`. Geometry, packed textures, camera, light and
action are retained. `tools/bake.py` rebuilds all frames. `tools/pack.py` packs
only successfully rendered cells; it fails if cells are absent or touch the edge.

## Reproduction

1. Blender 4.5.14: `blender --background --factory-startup --python character-art/defense-v5/tools/bake.py`
2. Python with Pillow: `python character-art/defense-v5/tools/pack.py`
3. Inspect `review/directions-contact.png`, `review/motion.webp`, and
   `app/public/game/defense-v5/manifest.json`.

Pass a specific asset after `--` to the Blender command for a focused rebuild.
The `--probe` option renders only direction E for an initial comparison.

## Cost, source and rights

Tripo CLI doctor was checked during this work: the saved account connection was
valid, with API balance **0 credits / 0 frozen**. No new paid task, top-up or
subscription change was submitted. This bake uses existing Studio outputs;
incremental Tripo cost is **0 credits**. The older Studio balance is not represented
as a current live balance.

Task IDs, prompts and original paid-generation evidence are preserved in
[`../defense-v4/ledger.json`](../defense-v4/ledger.json) and
[`../run-party-v1/PRODUCTION_RECEIPT.md`](../run-party-v1/PRODUCTION_RECEIPT.md).
The original rights record is
[`../tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md`](../tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md).
This work does not assign MIT/CC0 to generated art. Source-code licenses do not
grant separate rights to these models or renders. No reference-game characters,
licensed screenshots, account information or signed download URLs are embedded.

Offline frame validation establishes the atlas contract and authored animation.
Actual battle readability, timing and mobile performance require the integrated
game review; successful baking alone is not a claim of game completion.
