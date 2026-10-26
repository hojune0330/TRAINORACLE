# 훈련 구간 설명 삽화 기록 — 2026-10-26

## 범위와 승인

사용자가 훈련계획·읽을거리·오라클에 사용할 생성형 구간 그림과 마리 설명의 최종 추천 계획 실행을 요청했다. 이 기록은 새 그림 두 개의 생성·보존·파생본·시각 검수를 설명한다. 훈련 계산·처방·저장·배포는 변경하지 않는다.

기존 `running-shoe-v2.webp`, `pace-stopwatch-v3.webp`, `training-map-v3.webp`, `mari-profile-explain-v4.webp`를 직접 열어 비교했다. 달리기 신발과 마리는 재사용한다. 마리의 외형·정체성은 재생성하지 않았다. 새 걷기·회복 삽화는 같은 틸·아이보리 무광 오브젝트 계열을 따른다.

## 산출물

| 역할 | 앱 경로 | 크기 | 용량 |
|---|---|---:|---:|
| 걷기 | `app/public/illustrations/training-walk-v1.webp` | 256 × 256 RGBA | 13,178 bytes |
| 회복 | `app/public/illustrations/training-recovery-v1.webp` | 256 × 256 RGBA | 9,182 bytes |

원본과 검수 자료는 `assets/illustrations/training-guide-20261026/`에 보존했다.

- `training-walk-v1.png`: 1254 × 1254, 857,869 bytes, 생성 원본 그대로 복사.
- `training-recovery-v1.png`: 1254 × 1254, 807,465 bytes, 생성 원본 그대로 복사.
- `asset-metadata.json`: 원본·파생본의 SHA-256, 크기, 알파 범위, 용량.
- `visual-qa-contact-sheet.png`: 기존 달리기·마리와 신규 걷기·회복을 아이보리 바탕의 96/48/64px로 비교한 검수 시트.

생성은 built-in `image_gen`을 두 번 사용했다. API/CLI 대체 생성은 사용하지 않았다. 참조 파일을 생성기에 보내지 않았으며, 직접 확인한 기존 자산의 색·재질·배치를 프롬프트로 설명했다. 생성기의 기본 원본 경로도 유지했다.

- 걷기 기본 원본: `C:/Users/admin/.codex/generated_images/01a176c5-fe65-7ea0-bfc7-a00d43e51d91/exec-691ed108-e4c8-4804-a2b9-fb52d2b06e67.png`
- 회복 기본 원본: `C:/Users/admin/.codex/generated_images/01a176c5-fe65-7ea0-bfc7-a00d43e51d91/exec-14532074-c002-4f76-a8fe-22d7b05b427f.png`

파생본은 Pillow RGBA 변환 → LANCZOS 256 × 256 축소 → WebP quality=86, method=6, exact=true로 저장했다. 배경 제거·재채색·형태 재구성 없이 원래 알파를 보존했다. 원본과 WebP 모두 알파 최솟값 0, 최댓값 255를 확인했다.

## 실제 시각 검수와 사용 조건

- 두 생성 결과와 최종 비교 시트를 직접 열어 확인했다.
- 걷기는 좌우 신발 밑창 두 개로, 회복은 물병과 접은 수건으로 구분된다. 48px에서도 두 실루엣이 구별된다.
- 기존 신발·마리와 무광 재질, 짙은 틸·아이보리 색이 어울린다. 텍스트·숫자·로고·인물은 새 자산에 없다.
- 투명 배경과 온전한 오브젝트 경계를 확인했다. WebP 총합은 22,360 bytes다.
- 회복 그림은 보조 삽화다. 수분 섭취량·회복 방법·건강 상태를 지시하는 기호로 사용하지 않는다.
- 구간 이름과 시간·거리·페이스 등 실제 처방 글자를 항상 함께 둔다. 그림 실패에도 해당 글자와 버튼을 유지한다.
- 이번 검수는 자산의 크기별 육안 비교다. 실제 앱의 배치·터치·팝업·키보드·스크린리더 검수와 공개 배포 증거는 통합 담당자의 별도 검사다.

## 최종 생성 프롬프트

### 걷기

```text
Use case: stylized-concept. Asset type: a small transparent bitmap object illustration for the TrainOracle running-training app. Primary request: make a coherent WALKING / easy walk symbol, TWO separated sneaker outsole footprints arranged in a calm alternating forward walking step (left and right, no feet or legs). Style: polished soft matte 3D clay/rubber object, simple rounded forms with restrained subtle embossed sole grooves, matches existing TrainOracle objects: deep muted teal running shoe with warm ivory sole, ivory map with teal track, matte teal stopwatch. Color palette: muted deep teal and warm ivory only, dark teal detail. Composition: square isolated compact centered pair of sole prints, balanced approximately square bounding box, generous clean transparent margin, silhouettes easily recognizable at 48px. Lighting: soft diffuse studio, gentle form shading only, no background or drop shadow plane. Keep the two footprints visually distinct without extra objects. Output true transparent alpha. No text, numbers, letters, logos, trademarks, characters, arrows, sparkles, decorative dots, border, tile, circle background, gradient background, floor, checkerboard pattern.
```

### 회복

```text
Use case: stylized-concept. Asset type: a small transparent bitmap object illustration for the TrainOracle running-training app. Primary request: a calm REST / RECOVERY object illustration: one squat reusable sports water bottle, closed cap, standing next to a small neatly folded towel. Style: polished soft matte 3D clay/rubber object, simple softly rounded forms, matches existing TrainOracle objects: deep muted teal running shoe with warm ivory sole, ivory map with teal track, matte teal stopwatch. Color palette: muted deep teal bottle and warm ivory towel, minimal dark teal detail. Composition: square isolated compact centered arrangement, balanced approximately square bounding box, full objects visible, generous clean transparent margin, easy silhouette readable at 48px. Lighting: soft diffuse studio, gentle object form shading only, no background or drop shadow plane. Bottle has plain continuous surface with no markings; towel is simple folded thick ivory fabric with one subtle teal hem. Output true transparent alpha. No text, numbers, letters, logos, trademarks, characters, hands, arrows, sparkles, droplets, decorative dots, border, tile, circle background, gradient background, floor, checkerboard pattern.
```
