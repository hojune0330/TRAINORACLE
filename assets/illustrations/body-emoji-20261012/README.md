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

## Approved follow-up: body-part focus

- The original 80px overview remains unchanged.
- `body-check-focus-front-v1.webp`: 768 × 768, 9,580 bytes, resized from the approved original for a legible zoom.
- `body-check-emoji-back-v1.png`: new companion rear-view image generated using the approved front as reference; no private user data.
- `body-check-focus-back-v1.webp`: 768 × 768, 10,518 bytes.
- Runtime files are in `app/public/illustrations/`. Sharp only resized and encoded generated bitmap originals.
- Display-only focus anchors crop/scale the generated picture. They do not create anatomical geometry or infer pain. Native part names remain authoritative; shin and lower back are unsided legacy fields.
- No service-worker precache addition.

Exact rear-view prompt:

Use case: precise-object-edit. Input image 1 is the approved edit target and style invariant. Create ONE companion rear-view bitmap for this exact simple genderless body emoji used in a body-area selector. Keep its round detached head, simple rounded rectangular torso, pill arms, two separated straight legs and detached oval feet, muted teal color, gentle matte shading, warm ivory background, full body centered same scale and square composition. Change only the view cue: show a subtle shallow central back groove between shoulder blades and a subtle waist crease on the back, no muscular anatomy. Maintain a very simple pictogram, not a person. Legs viewed from behind, keep smooth and neutral. No face, no hair, no gender, no clothes, no nipples, no buttock details, no outlines, no labels, no letters, no symbols, no arrows, no pain marks, no medical claims. Single figure, not front/back pair. This is an unmarked decorative location guide; app supplies labels separately. Preserve overall silhouette and simplicity.
