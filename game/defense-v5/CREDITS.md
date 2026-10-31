# Defense v5 — asset and engine credits

Recorded 2026-10-16 KST. Different files in the game have different rights;
the engine's MIT license and Kenney's CC0 dedication do not apply to Tripo art.

## Directional creature and tower art

The 18 WebP images in this directory comprise **11 animation atlases and 7 UI
previews**. The atlases include 7 movement/attack sheets and 4 impact/death sheets.
They were rendered from the project's existing paid Tripo Studio outputs, with
local Blender 4.5.14 modeling and animation work:

- Cannon: original Tripo task `51063ad6-7231-4dfd-ac21-86ddb2fcd5fa`.
- Fan/frost: original Tripo task `37628cb7-1d11-4c85-bc2b-c0b6b0c69c87`.
- Scout/boss creature: original Tripo task `f2af54b1-b942-4e19-9814-28cc84f9830b`.
- Swift/armored creature family: original Tripo task
  `634968c0-a239-49ba-b9e2-5971623d7f84`, with existing local variants.

Blender work includes separating the rotating turret from its base, a twin-barrel
rapid tower, frost pressure-tank geometry, armor/crest variants, six authored
walking poses, impact compression and death deflation. Eight directions were
rendered from the 3D geometry. Movement is locally authored; these creatures do
not use motion capture, Mixamo downloads or Tripo animation retargeting.

**This v5 batch submitted no new Tripo generation/processing tasks and spent
0 additional Tripo credits.** The source generations were paid Studio outputs;
their earlier costs are recorded separately. Studio and API credits are separate.
No current Studio balance is asserted here.

Source records and reproducible files:

- [v5 authoring notes and editable scenes](https://github.com/hojune0330/TRAINORACLE/tree/main/character-art/defense-v5)
- [v4 original prompts, task IDs and cost ledger](https://github.com/hojune0330/TRAINORACLE/blob/main/character-art/defense-v4/ledger.json)
- [Original creature-family production receipt](https://github.com/hojune0330/TRAINORACLE/blob/main/character-art/run-party-v1/PRODUCTION_RECEIPT.md)
- [Recorded paid-output rights review](https://github.com/hojune0330/TRAINORACLE/blob/main/character-art/tori/tripo/2026-10-12/USAGE_AND_RIGHTS.md)
- [Runtime file hashes and frame metadata](manifest.json)

The original rights review cites [Tripo terms](https://www.tripo3d.ai/terms) and
its [commercial-use guidance](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially).
This notice records provenance and modifications; it does not assign MIT, CC0
or another blanket public reuse license to generated art. Public availability of
the repository is not a separate unlimited art-reuse grant. No third-party game
characters or game screenshots were used as inputs for these source models.

## Existing Kenney terrain and fallback assets

The separate `../kenney-td/` directory contains selected files from **Tower Defense
(top-down) Pack**, by **Kenney Vleugels / Kenney.nl**. Its included license states
**Creative Commons Zero (CC0)** and permits personal and commercial use.

- [Included original Kenney license](../kenney-td/License.txt)
- [Kenney](https://kenney.nl/)
- [CC0 dedication](https://creativecommons.org/publicdomain/zero/1.0/)

This credit applies to the Kenney files, not the Tripo models or their renders.

## Phaser engine

The installed package used for this integration is **Phaser 3.90.0 (Tsugumi)**,
by Richard Davey / Phaser Studio Inc. Its package declares MIT. The full license
is copied unchanged from that installed package's `LICENSE.md`:

- [Phaser MIT license](PHASER-LICENSE.txt)
- [Phaser project](https://github.com/phaserjs/phaser)

Copyright (c) 2024 Richard Davey, Phaser Studio Inc.

Phaser's bundled dependency **EventEmitter3 5.0.4** is also MIT, Copyright (c)
2014 Arnout Kazemier. Its unmodified license ships as
[EventEmitter3 MIT license](EVENTEMITTER3-LICENSE.txt).

## Audio

The game effects in `../defense-audio/` are original procedural PCM synthesis,
independent of the visual and engine licenses. See [audio provenance](../defense-audio/CREDITS.md).

## File-size scope

The 18 runtime WebP files total **730,028 bytes**. The seven editable v5 `.blend`
scenes total **6,075,235 bytes** and are authoring files, not runtime downloads.
Four unique underlying original GLB files total **2,614,488 bytes**; the five
existing optimized/variant GLB inputs used by the baker total **497,520 bytes**.
These categories are distinct stages of the same assets and are not one runtime
payload. Generated frame PNGs and Blender backup files are excluded.
