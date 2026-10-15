# 백업 파일과 일지 안내 에셋 · 2026-10-15

## 완료 범위

복원 파일을 고르는 첫 화면의 제목 옆에서 64px로 표시할 중립 안내 삽화 한 종을 제작했다. 아이보리 파일철과 앰버 표지의 닫힌 일지를 두 대상으로 묶었다. 실제 복원 성공, 계정 저장, 보안 확인, 원격 전송의 상태를 그림으로 주장하지 않는다.

이 문서는 에셋 제작·파일 검수 기록이다. 실제 앱 연결과 이미지 실패 시 동작은 통합 담당자의 범위이며, 앱 브라우저 흐름·CI·배포·실계정 복원 검증 완료를 뜻하지 않는다. 소스 파일과 소스 registry는 수정하지 않았다.

## 출처와 생성 방식

- 도구: 내장 `image_gen.imagegen` 한 번 호출. `transparent_background: true`.
- 표시: 도구 결과를 `generatedImage(result)`로 직접 표시했다.
- 생성 분류: `stylized-concept`, 새 이미지 한 종. CLI/API key/별도 SDK/Python 드로잉은 사용하지 않았다.
- 생성 입력: 아래의 일반 사물 설명 프롬프트만 전달했다. 개인 사진, 훈련 기록, 건강 데이터, 비밀 값, 사용자 레퍼런스 원본은 전달하지 않았다.
- 톤 기준: 기존 `pace-calculator-announcement-v1.webp`와 `running-game-announcement-v1.webp`를 각각 `view_image`로 직접 열어, 무광 clay·둥근 실루엣·밝은 재질·절제된 teal/ivory 계열을 확인했다. 기존 이미지를 생성 입력으로 업로드하거나 변경하지 않았다.
- 적용 기준: 현재 `AGENTS.md`, `PRODUCT_NORTH_STAR.md`, `docs/UX_UI_VISUAL_STANDARD.md`의 작은 안내 삽화·중복 생성 방지·저장 상태 정직성 기준. `lean-delivery`, `imagegen`, `design-toss-card-ui`와 필수 참조를 읽고 두 대상·64px·중립 안내로 범위를 좁혔다.

## 파일과 무결성

| 구분 | 경로 | 실제 메타데이터 | SHA-256 |
|---|---|---|---|
| 내장 도구 원본 | `C:/Users/admin/.codex/generated_images/01a13dc9-7edb-78e2-ae30-e5184e3a919e/exec-a3d2e49c-d1b8-470d-9437-d5f59333a193.png` | PNG, 1254×1254, RGBA, sRGB, 1,007,826 bytes | `1fb9fc2f1b5922be1f1e5f1faf4cef0a4272cb4d4bd137fa9d859383746344f8` |
| 프로젝트 원본 사본 | `.scratch/more-design/assets/backup-journal-file-v1-original.png` | PNG, 1254×1254, RGBA, sRGB, 1,007,826 bytes | `1fb9fc2f1b5922be1f1e5f1faf4cef0a4272cb4d4bd137fa9d859383746344f8` |
| 최종 제공 파일 | `app/public/illustrations/backup-journal-file-v1.webp` | WebP, 384×384, RGBA, sRGB, 13,640 bytes | `e5d934ee44715d8c9cae645b546a2d63b4109f02676f71af4c3061fdf1c03915` |
| 실제 축소 검수본 | `.scratch/more-design/assets/backup-journal-file-v1-64px.png` | PNG, 64×64, RGBA, sRGB, 5,443 bytes | `5aa7bbccc5cc3e7b713dd24e132ab5586d3c27ced83aa1984effb05010059894` |

원본과 사본의 해시가 일치한다. 원본 파일과 기존 앱 그림은 덮어쓰지 않았다. 최종 WebP는 새 파일 이름으로만 저장했고 40 KiB 목표를 충족한다.

## 변환과 투명도

- 런타임: Node v24.19.0 / Sharp 0.35.5.
- 변환: 원본을 384×384로 축소, WebP quality 82 / alphaQuality 100 / effort 6. 확대·합성·마스킹·재색칠·알파 보정은 하지 않았다.
- 64px PNG는 최종 WebP를 다시 64×64로 축소한 검수 파생본이다.
- 원본 PNG 알파: 완전 투명 881,582 / 부분 투명 690,257 / 완전 불투명 677 pixels.
- 최종 WebP 알파: 완전 투명 82,313 / 부분 투명 64,396 / 완전 불투명 747 pixels.
- 최종 WebP의 alpha > 16 영역: x=47..338, y=60..335. 가장자리에 여백이 있고 대상이 잘리지 않는다.
- 검증 스크립트: `.scratch/more-design/assets/prepare-backup-journal-asset.mjs`. 원본 복사·최종 출력은 존재하는 파일을 덮어쓰지 않도록 배타적 생성 옵션을 썼다.

## 직접 시각 검수

- 생성 원본, 최종 384px WebP, 실제 64px PNG를 직접 열어 확인했다.
- 64px에서 뒤의 파일철과 앞의 앰버 일지가 서로 다른 대상으로 읽힌다. 실제 글·숫자·로고가 없다.
- 금지한 cloud/arrow/check/lock/shield/character/money/reward 등의 기호와 작은 추가 아이콘이 없다.
- 원격 전송·복원 성공·보안 확인을 암시하는 상태 표식이 없다.
- 흰색·아이보리 바탕의 64px 나란히 검수 완료: headless Chrome, 375×220 viewport, deviceScaleFactor 1에서 기존 계산기·게임 이미지와 같은 64×64 CSS px로 렌더링했다. 파일철과 일지가 구분되고, 밝은 바탕에 사각 배경·과도한 테두리 잔상 없이 보인다. 무광 재질과 둥근 실루엣은 기존 두 그림의 톤에 맞는다.
- 캡처: `.scratch/more-design/assets/backup-journal-file-v1-64px-review.png` (375×220). 실제 픽셀을 `view_image`로 직접 열어 확인했다. 검수 스크립트는 `.scratch/more-design/assets/review-backup-journal-asset.mjs`이며, 네트워크 요청을 차단한 로컬 인라인 이미지 비교다. 이는 실제 앱 복원 화면 검증과 별개다.
- 화면 연결·키보드·실제 파일 선택·읽기/복원 상태·이미지 로드 실패·실기기·실계정·공개 배포는 이 에셋 제작 작업에서 검사하지 않았다.

## 정확한 생성 프롬프트

```text
Use case: stylized-concept.
Asset type: one transparent helper illustration for a Korean running training app's backup-file selection screen; it will display at only 64 by 64 CSS pixels beside a real UI heading.
Primary request: a compact pair of objects that neutrally represents a backup file and a training journal. Exactly two objects: a small upright ivory file folder with one simple unmarked page shape peeking out, and a small closed notebook with a warm muted amber cover and visible ivory page block. The two objects sit together as one balanced emblem, folder slightly behind the journal. The folder may have a very small muted teal tab; the notebook may have a simple teal spine. No marks on their faces.
Scene/backdrop: genuine transparent alpha background; isolated cutout. No floor, no background rectangle, no colored backdrop, no circular plinth and no cast shadow outside the objects.
Style/medium: premium friendly matte clay 3D illustration, soft rounded chunky simple forms, restrained object shading, clean crisp silhouette; luminous ivory material and softly rounded corners. Match a family of small matte clay app illustrations with ivory objects, deep muted teal, soft blue and warm amber accents. Gentle front three-quarter view, not dramatic perspective.
Composition/framing: centered square, one compact cluster using about 80 percent of the canvas with balanced transparent padding; fully visible objects. Make the file folder and amber journal clearly distinguishable when reduced to 64 pixels. Use broad surfaces and clear overlapping silhouettes. Keep page detail minimal.
Lighting/mood: soft neutral studio light, calm and practical, gentle surface depth without dramatic highlights or gritty texture.
Color palette: primarily warm ivory and muted amber; restrained deep muted teal #0D5F5A details. No neon and no rainbow.
Text: none.
Constraints: original artwork, exactly the folder with its plain page and the closed journal notebook; empty unmarked faces, no personal content, no numbers, no letters, no logo, no watermark.
Avoid: any cloud, upload or download symbol, any arrow, checkmark, lock, shield, badge, plus sign, tick, notification dot, spinner, progress indicator, sparkle, confetti, character, face, hand, human, device, money, coin, gift, trophy or reward symbol; no success, security or remote-transfer claim; no floating tiny icons and no extra objects. The app renders the actual heading and all controls separately.
```
