# 별빛 릴레이 숲 · 배경 생성 기록

생성일: **2026-10-17, Asia/Seoul (KST)**. 도구: **imagegen**.
시드: 도구에서 제공하지 않음. 입력: 아래 텍스트 프롬프트만 사용한 신규 생성.
참조 이미지 입력 없음. 개인 출력 경로는 공개 문서에서 제외한다.

두 프롬프트는 생성 담당자가 실제 imagegen 호출에 사용한 원문이다.
프롬프트의 구도·비율 요청과 실제 출력 크기는 구분해 기록한다.
동일 프롬프트가 동일 픽셀을 재생성한다는 보장은 없다.

## ground.webp

역할: 디펜스의 넓은 지형 바탕. 길·타워 지점·적·충돌 영역은 런타임에서
별도로 그린다. 장식 그림이 통행 가능 지형이나 물리 판정을 정의하지 않는다.

```text
Use case: stylized-concept. Production asset: a NEW large overhead terrain painting for a mobile fantasy tower defense and running-adventure shared world, 'Starlight Relay Forest'. Landscape 4:3 composition, orthographic high bird's-eye camera looking straight down enough that gameplay paths can be drawn over it. Polished charming simple 3D-to-painterly mobile game art; broad readable forms, soft mint and deep teal grass, magical lavender blue crystal outcrops and luminous small streams at the extreme perimeter, mossy ancient ruins, beautiful large tree canopies framing edges, distant tiny floating stone islets near upper corners. The CENTRAL 80% must be unobstructed low-contrast grassy meadow with subtle organic terrain patches; no objects covering playable areas. Deliberately NO roads, NO paths, NO towers, NO characters, NO buildings in central area, no perspective horizon, no text, labels, UI, borders, watermark or logos. Leave all gameplay routes for programmatic overlay. Render as a single coherent detailed environment background with gentle directional daylight, attractive color composition and quiet center. This is an actual game terrain asset, not a screenshot or poster.
```

## panorama.webp

역할: 러닝의 측면 원경과 라운지의 공유 세계 소개. 실제 달리는 바닥·장애물·
캐릭터는 앞쪽에 별도로 그린다. 이미지에 그려진 다리·관문은 그 자체로
상호작용이나 이동 가능한 3D 메시가 아니다.

```text
Use case: stylized-concept. Production asset for a fast side-scrolling fantasy running game: an expansive panoramic fantasy valley background, wide 3:2 image. Original Starlight Relay Forest setting. Side-on view, clear pale turquoise sky in top 45%, distant floating green islands and thin waterfalls, violet crystalline ridge, moss-covered ancient arched stone bridge across the valley and a softly glowing turquoise portal far in the middle distance. Charming premium mobile game environment, simple broad shapes, painterly stylized 3D lighting, consistent mint / teal / lavender palette, readable soft silhouettes. Lower 25% is unobstructed low-detail meadow rolling gently into the distance; the actual running platform and obstacles will be rendered separately in front. No people, character, creatures, actual foreground track, UI, text, letters, logos, numbers, borders or watermark. Full edge-to-edge landscape, not a mockup. Keep distant landmarks beautiful but muted so runner and hazards remain dominant.
```

## 납품 변환과 파일 식별

생성 도구의 성공 결과 PNG를 Pillow로 **원본 크기 유지, WebP quality=88,
method=6**으로 형식 변환했다. 잘라내기·합성·크기 변경은 하지 않았다.
생성 원본은 도구의 로컬 출력에 있고 저장소 납품본은 아래 WebP다.
이 기록은 공개 경로의 파일 바이트 수와 SHA-256을 직접 읽어 작성했다.

| 공개 파일 | 크기 | 바이트 | SHA-256 |
|---|---|---|---|
| `app/public/game/fantasy-world-v1/ground.webp` | 1448 × 1086 | 445,048 | `981b0f84394c4b62abfbb8b0d80abe029062ed1ccd7b2847da26996dd0b27ac5` |
| `app/public/game/fantasy-world-v1/panorama.webp` | 1536 × 1024 | 271,410 | `a78807a6d73526cf92bb3318cc0f3922be7d94baa40eca338897038042ea45a0` |

두 장 합계 **716,458 바이트**. 이미지 생성 비용이나 계정 사용량은 이 기록에서
추정하지 않는다. 기존 Tripo 원본을 가공한 `gate`, `crystal`, `bridge`의
**신규 Tripo 생성 0건·크레딧 0**과 이 두 장의 imagegen 사용은 별도 항목이다.

## 기존 소품 및 권리 기록

기존 Tripo 3종의 작업 ID·원본 해시·Blender 재현 정보는
[`README.md`](README.md), `ledger.json`, 공개 `manifest.json`에 그대로 유지한다.
원본 모델과 이 두 배경은 서로 다른 도구·출처를 가진다. 코드의 MIT 라이선스를
아트에 확대하지 않는다. 공식 게임 스크린샷은 배치 연구용 참고이며, 원본 그림·
캐릭터·로고를 생성 입력으로 제공하거나 런타임 에셋으로 추출하지 않았다.

현재 파일 생성·변환 기록과 게임 통합 검증·배포 완료는 구분한다. 이 문서는
두 배경을 게임에서 모든 화면 크기로 검수했다거나 배포했다고 주장하지 않는다.
