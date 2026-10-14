# 몸 부위 확대 에셋 v2 — 2026-10-14

## 범위와 상태

- 오너가 승인한 몸 상태 입력 UI 개선 중 **부위 확대용 생성 비트맵 두 개**를 제작했다.
- 첫 화면의 `body-check-emoji-v1.webp`와 기존 front/back v1은 수정하지 않았다.
- 코드/CSS/저장 데이터/임상 기준/서비스 워커 사전 저장 목록은 이 에셋 작업에서 변경하지 않았다.
- 내장 `image_gen`을 사용했다. CLI/API fallback, Tripo 생성/인증/크레딧 조회는 실행하지 않았다.
- 기존 제품의 일반 몸 기호만 참조했다. 실제 인물 사진·몸 기록·메모·계정 데이터는 생성 입력으로 사용하지 않았다.
- 생성 이미지 자체와 WebP 변환물을 시각 점검했다. 통합 UI 배치, 공개 배포, 실제 사용자 공동 검수 완료를 뜻하지 않는다.

## 파일

| 용도 | 경로 | 크기 |
|---|---|---|
| 웹 앞면 | `app/public/illustrations/body-check-focus-front-v2.webp` | 67,652 bytes |
| 웹 뒷면 | `app/public/illustrations/body-check-focus-back-v2.webp` | 72,938 bytes |
| 생성 원본 앞면 | `reports/assets/body-check-v2-20261014/body-check-focus-front-v2.png` | 453,394 bytes |
| 생성 원본 뒷면 | `reports/assets/body-check-v2-20261014/body-check-focus-back-v2.png` | 478,277 bytes |

두 웹 파일은 모두 **1254 × 1254 RGBA**, alpha 범위 0–255다. 원본 PNG를 그대로 보존하고 Pillow WebP 품질 90/method 6으로 형식만 변환했다. 자르기·그리기·합성·색 보정·알파 마스크 재작성은 하지 않았다.

SHA-256:
- front: `4db6be8acab017ba8df02bd8bc1063b9bfd4f37cbeb024fe2ddbf9d7a7a1fec7`
- back: `b052b32ff5a95ba882201ba6900650689a646b46e0e2541af02ff22177533f38`

생성 도구 원본 위치:
- front: `C:\Users\admin\.codex\generated_images\01a13819-31df-7152-b1d8-00ca75e01b35\exec-ed5a5c30-71a2-44aa-9b8f-c51ace1ef463.png`
- back: `C:\Users\admin\.codex\generated_images\01a13819-31df-7152-b1d8-00ca75e01b35\exec-21223e0b-7a65-4eaf-8b53-f56a8caafe84.png`

프로젝트에서는 위 사용자 폴더 경로가 아니라 저장소 안의 상대 경로만 참조한다.

## 시각 검수와 표시 기준

- 기존 민트/틸, 무성별·무표정·의복 없는 기호의 정체성을 유지한다.
- 무릎의 가벼운 굴곡, 종아리와 발목 폭, 연결된 둥근 발을 추가했다. 사실적인 근육·뼈·피부·얼굴·문자·통증 표시는 없다.
- 앞뒤는 같은 시리즈이며 뒷면은 얕은 등/허리 윤곽으로 구분한다. 신체 구조를 임상적으로 판정하는 자료가 아니다.
- alpha >= 128 기준 실루엣: front [351, 91, 902, 1163], back [343, 96, 912, 1190] (left, top, right exclusive, bottom exclusive).
- 일부 가장자리 밖 alpha 1–6/255 픽셀이 생성 원본에 있다. 원시 RGB 미리보기에서 청록 외곽으로 보일 수 있으나 거의 투명하다. 제거/재작성하지 않았다. 실제 앱 배경에서 최종 표시를 확인한다.
- 이미지 위 위치 표시는 별도의 UI로 표시한다. 그림 내용에서 좌우·통증·상태를 추론하지 않는다.

### 확대 기준점

전체 정사각 캔버스에 대한 상대 좌표다. **배치용 검수 좌표이지 저장 값이나 의학적 위치 정확도 보증이 아니다.** 앞면에서 사용자의 오른쪽은 그림 왼쪽이고, 뒷면에서는 그림 오른쪽이다.

| 기존 ID | 면 | x | y |
|---|---|---:|---:|
| rKnee | front | 0.444 | 0.716 |
| lKnee | front | 0.556 | 0.716 |
| rFoot | front | 0.435 | 0.896 |
| lFoot | front | 0.565 | 0.896 |
| rHam | back | 0.556 | 0.655 |
| lHam | back | 0.444 | 0.655 |
| rCalf | back | 0.556 | 0.800 |
| lCalf | back | 0.444 | 0.800 |
| lBack | back | 0.500 | 0.490 |
| rShin | front | 0.500 | 0.800 |

현재 `rShin`의 사용자 라벨은 좌우 없는 **정강이**다. ID 접두사를 이유로 오른쪽 상태로 바꾸지 않는다. 중심 확대는 (0.500, 0.800)을 쓰되 양쪽 위치를 안내하려면 같은 표시를 (0.444, 0.800)/(0.556, 0.800)에 제공할 수 있다. 정강이 값의 좌우 분리나 새 저장 ID는 이번 에셋 작업에 없다.

## 생성 입력

### 앞면

- 모드: 내장 `image_gen`, 투명 배경, 기존 앞면 v1 참조.
- 참조: `app/public/illustrations/body-check-focus-front-v1.webp`
- 프롬프트:

```text
Use case: stylized-concept.
Asset type: transparent UI illustration for TrainOracle's body-location input; front-view master of a matching front/back pair.
Input image 1: the existing front-view reference; preserve its faceless genderless mint-teal body-symbol identity, proportions, upright pose, and matte soft 3D emoji style. It is not a patient photo.
Primary request: refine this body symbol so knees, lower legs and feet are easier to locate when the UI zooms into a body region, without turning it into an anatomical human. Give the long rounded legs only a very subtle knee contour at the thigh/shin junction, a gently narrower ankle, and simple connected rounded feet. Keep the torso and limbs smooth, soft, and abstract. The improvements should feel quiet, not like an action figure with separate ball joints.
Composition: exactly one complete symmetrical front-view body symbol, orthographic eye-level camera, square canvas, body centered, head top near 7% canvas height and feet bottom near 93%; total arm-span about 44% canvas width, legs vertical with a small clear gap. Arms relaxed diagonally outward like the reference; full body visible, no clipping.
Palette/material: same muted mint teal as reference; smooth matte surface, broad soft light from upper left, restrained shading; clean clear silhouette.
Background: genuinely transparent alpha, no floor or cast shadow, no checkerboard painted into the image.
Text: none.
Constraints: NO face, eyes, expression, hair, ears, gender features, chest features, genitalia, buttock cleft, muscles, veins, bones, clothes, shoes, fingers, toes, clinical labels, pain markers, diagrams, extra symbols, frame, decoration, text or watermark. This is a simple body-location guide, not medical anatomy. Do not add multiple views or turn the figure sideways. Preserve the reference's understated friendly visual language.
```

### 뒷면

- 모드: 내장 `image_gen`, 투명 배경, 새 앞면 결과 및 기존 뒷면 v1 참조.
- 참조: 앞면 v2 PNG 원본, `app/public/illustrations/body-check-focus-back-v1.webp`
- 아래 프롬프트의 "approved"는 제작 마스터를 지정한 문구이며 오너의 별도 결과물 공동 검수 완료를 뜻하지 않는다.
- 프롬프트:

```text
Use case: stylized-concept.
Asset type: transparent UI body-location illustration, BACK-VIEW matching pair.
Input image 1: the newly approved front-view master. This is the exact character to turn around. Match its canvas, head/body proportions, silhouette width, placement, color, matte lighting style and softly shaped legs and connected rounded feet. Input image 2: older back-view reference, only to show the subtle back cue; do not copy its older disconnected feet or rigid legs.
Primary request: produce ONE straight orthographic REAR VIEW of image 1's faceless genderless mint-teal body-symbol, looking directly at its back. Same standing stance, arms gently angled down outward, separated straight legs. Hint at upper back with a very soft shallow central contour and lower-back waist contour. Subtle back-of-knee transition and calves. No anatomical detail. The difference between front and rear must be readable but minimal.
Composition: square canvas, full body centered at exactly same scale as image 1, head top ~7% and feet bottom ~92% canvas height. No tilt or perspective, exactly one figure, no side-by-side layout.
Style: friendly simple soft matte 3D emoji object, NOT a realistic human; smooth muted teal, gentle broad upper-left light. Keep the full feet visible.
Background: genuinely transparent alpha, absolutely no colored halo, fringe, floor shadow, painted checkerboard or backdrop.
Constraints: NO face, eyes, expression, ears, hair, gender, chest features, genitalia, buttock cleft, muscles, veins, bones, clothes, shoes, fingers, toes, clinical labels, pain markers, diagrams, extra symbols, text or watermark. Do not turn the head or body toward camera; show only the back. Do not add articulated ball joints. Keep the understated neutral guide identity.
```
