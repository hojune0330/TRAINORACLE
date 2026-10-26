# Pet observation art

Created: 2026-10-26. Tool: OpenAI built-in image_gen. Each of the 12 observation scenes and 3 prop icons was generated separately using existing TrainOracle pet artwork as identity/style references. No external franchise artwork was used. Seed was not exposed by the tool.

PNG originals are preserved under `source/`. Runtime assets are WebP under `app/public/games/pet-room-v1/observations/`, resized proportionally to fit 640 x 640 with alpha preserved. No artistic edits were made by the conversion pipeline.

The exact prompts are recorded in `generation-prompts.jsonl`. `asset-check.json` reports source dimensions and alpha distribution. `contact-sheet.jpg` composites a cream background for visual inspection only, not game consumption. Runtime anchor is bottom center (0.5, 1.0); each sprite includes its pet(s) and prop as one transparent layer. The gameplay catalog remains authoritative for eligible pets/items/locations and rarity.

The pair scenes must only be shown when both actual pets are present. Existing pet sheets remain available for regular observations for all other animals. No new pet identity or adoption rule is introduced by these art files.
