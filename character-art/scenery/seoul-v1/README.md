# Seoul miniature scenery pilot

## Delivery status — 2026-10-14

The six WebP files currently in `app/public/game/seoul-v1` are **local parametric prototypes**, rendered with Blender from `bake-props.py`. They are not Tripo output. They are original simple geometry, with no downloaded textures, logos, fonts or third-party models. `manifest.json` records provenance, dimensions, size and SHA-256 per file. Current total image payload: 36,766 bytes.

Tripo Studio H3.1 generated two separate source candidates, but their GLB files have **not** been delivered to this folder:

| Candidate | Studio task | Credits | File delivery |
|---|---|---:|---|
| Park tree | b8c802be-7561-4dee-802e-d54b9a5a532a | 25 | Pending browser/Bridge export |
| Smooth rock | 23168032-2c39-4dbe-a29b-17ae6c143fcd | 25 | Pending browser/Bridge export |

Observed Studio balance: 3,060 → 3,010; total spent 50 credits. No API credits or new payment. Hurdle, gate, shoe and tower Tripo generation remain pending; do not claim six Tripo assets are finished. Source licensing must accompany the actual delivered GLBs before any Tripo source is published.

## Reproducible handoff

1. Put verified delivered GLBs into `sources/` with IDs `tree`, `rock`, `hurdle`, `gate`, `shoe`, `tower`. Do not commit account pages, signed URLs, credentials or the browser cache.
2. Run Blender in background with `--python bake-props.py -- <absolute-render-folder> [<absolute-source-folder>]`.
3. Run `pack-props.py <render-folder> <app/public/game/seoul-v1>`. Requires Pillow. Renders are cropped to nontransparent bounds, kept within 256×256, encoded as WebP, and individually recorded in the manifest.
4. Inspect every imported model's orientation, materials, silhouette and foot/base alignment at game size. The prototype renderer uses material colors; imported textured assets may require a material-aware renderer instead. An imported filename alone is not visual acceptance.
5. Recheck map preview, all three Seoul surfaces, hurdle hit-box alignment, upgrade shoe icon, and blocked-image fallback before release.

The game stays Canvas 2D. The same offline artwork is reused by the course and map preview. Map preview is rendered from the live course renderer, avoiding a separate misleading illustration. Physics, scoring, duration, upgrade arithmetic, account data and other city courses are unchanged.

Review: [phone map](review/map-phone.png), [mud stage](review/mud-phone.png), [night stage](review/night-phone.png), [validation details](VALIDATION.md).

## Candidate prompts

Common: Single isolated miniature toy prop for a cheerful running game. Extremely simple chunky rounded shapes, only 25 percent of typical detail. Matte flat colors, no realistic textures, no tiny details, no lettering, no logos, no ground plane. Readable at 64 pixels.

- Tree (generated): One park tree: short thick warm brown trunk, one large rounded emerald green canopy made of three broad soft lobes. No individual leaves, no thin branches, no exposed roots. Friendly compact silhouette.
- Rock (generated): One low broad smooth river boulder, rounded asymmetrical silhouette, muted blue-gray stone, three broad facets, no cracks, no moss, no sharp points. Wider than tall.
- Hurdle (pending): One low running hurdle, thick coral crossbar with three broad cream markings, two short dark navy legs and wide rounded feet. Straight readable silhouette, no text.
- Gate (pending): One freestanding park checkpoint gate, two chunky navy posts and one broad yellow rounded crossbar, three cream blocks, open passage, no signage or text.
- Shoe (pending): One chunky turquoise running shoe, broad cream sole, simple dark oval opening, one cream strap. No laces, seams, tread details, logos or tiny panels. Toe pointing right.
- Tower (pending): A simple fictional miniature Seoul observation tower, slim cream pillar, one broad rounded observation deck, blue window band, short coral antenna, small green rounded hill base. No text or logo.

No generated seed was exposed by Studio in this workflow; no seed is invented here.
