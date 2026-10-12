# Body check guide — 2026-10-12

Original asset generated with the built-in `image_gen` tool, not drawn or rendered by code. No photograph or real athlete data was used. It is a friendly visual guide, not an anatomical diagram, diagnosis, or health status.

- Final source: `body-check-guide-v2.png` (clean ivory background). The initial transparent `body-check-guide-v1.png` is retained as an unused generation draft: its edge artifacts failed visual inspection.
- Runtime: `app/public/illustrations/body-check-guide-v1.webp`, 640 × 640, 31,886 bytes, opaque ivory background.
- Optimization: Sharp resize and WebP encoding only; no compositing, drawing, or generated overlays.
- UI: decorative fixed-size image beside named body-part controls. No clickable body points, hidden meaning, health scoring, or repeating animation. The controls work if the image fails.
- Not added to service-worker pre-cache.

## Original generation prompt

Use case: stylized-concept. Asset type: original raster illustration for TrainOracle Korean youth-friendly running journal body-check UI. Create a beautifully polished, calm and cute editorial character illustration, two full-body views of the SAME androgynous friendly athletic mannequin standing neutrally, front view and back view side-by-side. Warm ivory skin, simple charcoal short hair, muted deep-teal short-sleeve running shirt and above-knee running shorts, ivory running shoes, softly rounded forms with subtle painted depth, restrained matte finish, clean readable silhouettes. Not an anatomical medical chart and not a muscular idealized body. Arms slightly away from torso so legs, knees, calves, feet and lower back are recognizable. Exactly two arms and two legs per view. Balanced compact square composition with modest transparent padding, both complete bodies including feet visible. Truly transparent background. No text, numbers, labels, arrows, dots, injury highlights, anatomy lines, charts, frames, floor or background scene, brand logos or watermark. This is a decorative body-check guide used beside actual labelled accessible controls; do not depict health scores or diagnoses. Make it legible at small UI size, premium friendly Korean fintech-app illustration atmosphere, original character not copied from any company. Deliver one cohesive bitmap asset.

## Final cleanup prompt (built-in image edit)

Edit this raster illustration for a small body-check guide inside TrainOracle. Preserve both full-body front and back views, the exact friendly character, clothing, pose, framing, proportions and colors. Change ONLY the background and cutout edge cleanup: replace all transparency and ALL speckles, stray pixels, colored fragments, checkerboard-like spots or noise between/outside the two figures with one completely clean solid warm off-white ivory background (#FAF9F5). The result must be opaque and smooth, a flat uniform ivory background including between arms and legs. Carefully clean the silhouette edges with no colored halo. Do not add text, captions, labels, shadows on the ground, diagrams, controls or objects. The existing painted characters must remain unchanged. Deliver a production-ready clean bitmap UI illustration, square, complete feet visible.
