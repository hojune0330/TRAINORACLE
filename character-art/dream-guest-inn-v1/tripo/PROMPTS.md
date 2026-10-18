# Tripo source records — dream guest inn

Generated in the user's connected Tripo Studio account on 2026-10-18 using
H3.1 text-to-model. Each source generation cost 55 Studio credits as observed by
the operator. Blender preparation and rendering cost no additional credits.
Generation seeds were not exposed by Studio.

For this batch the operator observed 165 Studio credits consumed (three
generations × 55) and 2,060 Studio credits remaining. This is the Studio balance,
not an API-credit balance. There were no paid retries or Blender credit charges.

The original high-poly GLBs stay in the local `sources/` directory and are
ignored by Git. The per-prop manifests record their SHA-256 digests. Signed
download URLs, account identifiers, and credentials are intentionally not stored.

## Hooded lamp

- Task: `91a343ee-bd3a-45e5-bdb5-492ccc430292`
- [Public model page](https://studio.tripo3d.ai/3d-model/one-simple-low-detail-game-prop-a-cozy-directional-hooded-bedside-lan-91a343ee-bd3a-45e5-bdb5-492ccc430292)
- Output: `hooded-lamp.glb`; four cardinal-direction PNG sprites.

Exact generation prompt:

> One simple low-detail game prop: a cozy directional hooded bedside lantern for a tiny fantasy animal inn. Compact round bronze pedestal, one thick curved stem, a matte muted blue-gray half-dome shade covering the back and top of one warm amber lens. Lens faces forward only. Large smooth rounded forms, chunky silhouette, no tiny screws, no ornament, no writing, no complex patterns. Cream, warm brass, slate blue palette. Toy-like stylized 3D, minimal polygons, clean self-contained object. No room, floor, background objects, no beam mesh and no particles. The hood clearly shields the light so it can rotate to illuminate only one adjacent board tile.

The generated shade was nearly symmetric front/back. The preparation script
adds a small opaque rear shield and a forward amber lens in Blender so the
visual direction matches the game's one-cell light rule. These local additions
are recorded separately from Tripo generation in the manifest.

## Long warm stone

- Task: `3063d6ee-a1c5-4c39-8748-da0f2eec16eb`
- Output: `long-warm-stone.glb`; one wide transparent sprite.
- The exact public model page was not captured; the task ID is the source key.

Exact generation prompt:

> A single extremely simple cozy game prop: an elongated warm beige sandstone resting bench, no backrest, no legs, a low solid rounded rectangular slab. Width twice its depth, height one third its depth. Two equal softly rounded square stone blocks joined seamlessly side by side with one subtle center groove so the two occupied game board cells are readable. Large smooth matte shapes, pale cream beige, tiny amber warmth at the center seam, no detailed texture, no carvings, no lettering, no cushion, no moss, no extra items, no floor, no base, no environment. Clean stylized toy geometry for a quiet animal inn.

## Sealed window letter

- Task: `8c433d7e-5017-4280-be71-85a5d40f5c6a`
- Output: `sealed-letter.glb`; one transparent envelope sprite.
- [Public model page](https://studio.tripo3d.ai/3d-model/one-small-game-prop-only-a-chunky-cream-parchment-envelope-with-a-sin-8c433d7e-5017-4280-be71-85a5d40f5c6a)

Exact generation prompt:

> One small game prop only: a chunky cream parchment envelope with a single warm amber round wax seal shaped like a simple leaf. Thick soft rounded rectangular silhouette, folded triangular flap visible, no writing or symbols except one plain leaf impression on the seal. Ultra simple cozy stylized toy 3D, large clean matte forms, ivory cream and warm amber palette, no paper texture, no weathering, no fine detail, no room or background or additional objects. Self-contained solid prop, envelope width 1.6 times height, thickness enough for a low-poly mobile game.
