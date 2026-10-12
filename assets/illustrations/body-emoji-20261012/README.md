# Body check emoji — 2026-10-12

## Provenance and intended placement

- Owner asked for a much simpler genderless, emoji-like body asset, generated as an image rather than drawn in code.
- Created with built-in `image_gen`; no CLI/API fallback and no user photo or personal health data.
- Selected original: `body-check-emoji-v1.png`.
- Runtime: `../../../app/public/illustrations/body-check-emoji-v1.webp`, 256 × 256, 2,218 bytes; displayed at 80 × 80.
- Sharp was used only for resizing and WebP encoding. No redraw, vector tracing, cutout or pixel painting.
- The previous human/front-back asset remains preserved but is no longer used by `BodyDiagram`.
- Decorative support only. Actual body-part names, side IDs and 1–5/clear choices remain native buttons. No health inference or diagnosis is encoded in the picture.
- No service-worker precache entry. Image failure removes the picture slot while leaving the input usable.

## Exact final generation prompt

Use case: stylized-concept. Asset type: very small supportive bitmap icon for a body-discomfort selector in the TrainOracle running journal. Generate ONE original genderless emoji-like body symbol, full body facing forward. Radically simple: a blank circular head, a rounded rectangular torso, two smooth pill arms slightly apart, two separated straight soft legs and two tiny rounded feet. One muted teal material with only subtle soft volume, no detailed anatomy. Absolutely no face, hair, ears, chest, breasts, waist curves, muscles, skin color, clothes, fingers or gender cues. Not a person, athlete, child, robot or medical anatomical model. Friendly universal body pictogram, simple enough to remain clear at 80 pixels tall. Center the one complete symbol occupying about 85 percent of canvas height. Square canvas with perfectly flat solid warm ivory background #faf9f6 edge to edge; no transparency, no ground shadow, no halo, no specks or loose shapes. No writing, labels, numbers, pain markers, texture, watermark or additional objects. Crisp continuous clean silhouette edges.

## Rejected draft

A preliminary transparent front/back pair was not adopted: the two featureless figures repeated the same information and the generated transparent edges were uneven. The final single symbol above was generated anew on ivory, not programmatically edited from that draft.
