# 돌보기 소품 보완 — 2026-10-22

도구: 내장 image_gen. 투명 배경. 시드와 세부 모델 식별자는 반환되지 않았다.
참조: app/public/games/pet-room-v1/care-props-v2.webp.
기존 그림 파일은 보존하고, 아래 두 파일만 새로 생성했다. Tripo 크레딧은 사용하지 않았다.

## 이불

문제: 기존 3×2 시트에서 이불의 오른쪽 끝이 512px 셀을 넘어가 잘린다.
한 장짜리 투명 이미지로 바꿔 방·잠자리·이야기에서 함께 사용한다.

Use case: background-extraction / precise-object-edit. Game-ready 2D prop on an actual fully transparent background. The supplied sprite sheet is the edit reference. Extract and faithfully redraw ONLY the unfolded lavender blanket at the bottom left as a standalone square sprite. Preserve its simple cozy hand-drawn brown outline, soft lavender flat fill, four small curved fold marks, shallow three-quarter overhead perspective and rounded trapezoid silhouette. The WHOLE blanket must fit inside the canvas, including the right edge: leave at least 12 percent transparent padding on all four sides. Center the blanket in the square, width about 76 percent of the square, height about 36 percent. Closed intact outline. No animal, no other props, no floor, no contact shadow, no glow, no text, no watermark, no background artifacts, no checkerboard pixels. Very simple and readable at 160 pixels. Deliver one single blanket, never a grid or sprite sheet.

## 빈 그릇

용도: 먹는 동작이 끝난 뒤 같은 자리에 놓인다. 간식을 놓는 행동에서 돌봄이
한 번 저장되며, 빈 그릇으로 바뀌는 시점에는 추가 기록을 만들지 않는다.

Use case: precise-object-edit / background-extraction. Game-ready 2D prop on an actual fully transparent background. The supplied sprite sheet is the edit reference. Make ONLY an EMPTY version of the sage green food bowl at the top center, for the moment after the pet has eaten. Preserve the same shallow three-quarter overhead perspective, wide squat flared bowl silhouette, dark warm brown outline, soft sage green flat sides and tiny simple rim. Remove all three pieces of food. Show the empty inside as one clean muted olive green oval without water, crumbs or objects. Center the complete bowl in a square canvas, width about 72 percent of the canvas and height about 49 percent, with at least 12 percent transparent padding on all sides. No other props, no floor, no contact shadow, no glow, no text, no watermark, no background artifacts, no checkerboard pixels. Simple clean cozy cartoon, readable at 64 pixels. Deliver one single empty bowl, never a grid or sprite sheet.

## 파일

- originals/blanket.png, originals/bowl-empty.png: 생성 원본.
- app/public/games/pet-room-v1/blanket-v3.webp, bowl-empty-v3.webp: 512px 게임용.
- 소품은 독립 이미지라 셀 경계나 옆 그림이 노출되지 않는다.
- 기존 care-props-v2.webp는 다른 소품과 기존 이력을 위해 유지한다.
