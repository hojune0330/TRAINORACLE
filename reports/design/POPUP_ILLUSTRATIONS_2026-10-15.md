# 게임·훈련 계산기 안내 이미지 · 2026-10-15

내장 이미지 생성 도구로 제작한 프로젝트용 투명 배경 에셋이다. 그림에 글자·버튼·실제 계산값을 넣지 않고, 문구와 동작은 UI에서 분리한다.

| 목적 | 프로젝트 파일 | 크기/용량 | 현재 적용 |
|---|---|---|---|
| 게임 출시 | `app/public/illustrations/running-game-announcement-v1.webp` | 480×480 / 31,190 bytes | 기존 게임 출시 카드, 64px |
| 훈련 계산기 안내 | `app/public/illustrations/pace-calculator-announcement-v1.webp` | 480×480 / 28,696 bytes | 공통 일러스트/공지에서 사용 가능. 자동 노출은 추가하지 않음 |

팝업에서는 160px 정도로 사용하고 제목·한 문장·주 행동·닫기를 실제 UI로 배치한다. 앱의 계산 화면 명칭인 `페이스 계산`을 버튼에 유지하며 새 처방이나 계산 기능의 출시로 표현하지 않는다. 이 작업은 자동 모달 추가·배포·계산 방식 변경 승인이 아니다.

원본 사본은 `.scratch/popup-art/*-original.png`, 최초 생성 원본은 Codex `generated_images/01a0bcfe-66fc-7a22-ae04-426aa6d6bcb0/`의 다음 파일에 보존했다.
- 게임: `exec-d2bdd6d6-baa6-4a64-9ded-9d9f875f78e6.png`
- 계산기: `exec-86390565-91f2-48e5-ab0d-3c42d2ff5007.png`

## 표시와 동작

- 기존 게임 공지 ID/version은 유지한다. 이미 닫은 안내를 다시 띄우지 않는다.
- 그림은 장식용이며 읽기 지원에서는 제목·버튼만 전달한다. 그림 로드 실패에도 글과 버튼은 남는다.
- 이미지 조회나 확인만으로 훈련·보상·계정 데이터를 쓰지 않는다. 기존 공지 닫기/열기의 확인 상태 저장만 유지한다.
- 사전 캐시 목록과 자동 팝업은 추가하지 않는다. 그림을 불러오는 컴포넌트는 기존 lazy loading을 유지한다.
- 실제 팝업이 아닌 배치 시안: `.scratch/popup-art/preview.html`.

## 최종 생성 프롬프트

검수: 두 생성 원본과 투명 WebP를 직접 확인했다. 실제 기존 게임 안내를 Chrome 320/375px에서 렌더링해 그림 표시, 가로 넘침 없음, 두 행동의 44px 터치 영역을 확인했다. 기존 공지 관련 자동 검사 6개는 실행기 시작 시간 초과로 미실행이며 통과가 아니다(threads/forks 각 1회 시도 후 중단). 운영 배포·실기기·실계정 검수는 하지 않았다.

무결성 SHA256:
- 게임: `11a3bfe291f991e5d8632859c434e92bb13edfb304770ae2318fc8701498c9c8`
- 계산기: `8e14911978ca30038ee02b2ea82fbffad9e64da51df4002fd36ce24f2f50fd53`

### running-game-announcement-v1

```text
Use case: stylized-concept. Asset type: transparent illustration for a Korean running training app's announcement popup, also readable as a small notice-card image. Premium friendly matte clay 3D, soft rounded simple forms, restrained object shading, clean silhouette. Compact centered composition in a square with about 10 percent transparent padding. Gentle front three-quarter view. Consistent series palette: deep muted teal #0D5F5A, ivory, muted medium blue and soft lavender, small warm yellow accents. True transparent background. No floor, no background rectangle, no cast shadow outside the objects, no letters, numbers, logos, watermark, badges, coins, trophies, arrows, confetti, sparkles, humans or faces. The app adds real typography and buttons separately. Original artwork, no other brand's assets. Subject: a small playful ivory and lavender game controller with teal controls, paired with a miniature simple curved blue running track and one tiny yellow start flag. The controller is dominant; the track curls neatly behind and underneath, united as one compact emblem. Clearly conveys a running mini-game, not gambling or a fitness measurement. Only these three objects; no screen or phone.
```

### pace-calculator-announcement-v1

```text
Use case: stylized-concept. Asset type: transparent illustration for a Korean running training app's announcement popup, also readable as a small notice-card image. Premium friendly matte clay 3D, soft rounded simple forms, restrained object shading, clean silhouette. Compact centered composition in a square with about 10 percent transparent padding. Gentle front three-quarter view. Consistent series palette: deep muted teal #0D5F5A, ivory, muted medium blue and soft lavender, small warm yellow accents. True transparent background. No floor, no background rectangle, no cast shadow outside the objects, no letters, numbers, logos, watermark, badges, coins, trophies, arrows, confetti, sparkles, humans or faces. The app adds real typography and buttons separately. Original artwork, no other brand's assets. Subject: a friendly rounded medium-blue pocket calculator with an unmarked pale display and six simple ivory buttons, next to a chunky teal analog stopwatch with a plain ivory dial, two dark hands and a few simple tick marks but no numerals. A short curved lavender running lane ribbon joins the base of the two objects. Calculator dominant, stopwatch slightly smaller. Clearly conveys calculating running pace/time, not money, health diagnosis or a guaranteed performance result. Only these three objects.
```
