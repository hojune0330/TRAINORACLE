# 홈 첫인상 개선 · 2026-10-15

## 요청과 범위

오너 승인: 처음 보고 느끼는 것이 핵심이며 이미지 생성을 적극 활용해 개선한다.
별도 강제 스플래시 대신 홈 자체에서 앱의 목적과 실제 목적지를 함께 제공한다.
계획의 처방·안전·계정·저장 알고리즘 및 보상은 변경하지 않는다. 이번 요청에 배포는 포함하지 않는다.

| 상태 | 첫 화면 |
|---|---|
| 읽기 완료, 기록·계획 없음, 소개를 처음 봄 | 112px 생성 심볼 + 운동 분석/훈련 계획 제목 + 계획/분석 선택 |
| 기록 없이 다시 방문 | 작은 제목, 같은 목적지; 큰 심볼 반복 안 함 |
| 기록·계획 보유 | 기존 다음 훈련/기록 먼저, 브랜드 아래 한 줄 앱 정의 |
| 기록 읽기 실패·대기 | 기존 상태 안내; 큰 소개로 바꾸거나 실패를 빈 기록으로 판단하지 않음 |
| 직접 링크·계정·중단 화면 복귀 | 기존 목적지 유지, 소개로 가로채지 않음 |

큰 심볼은 학습을 위한 장식이며 실제 분석·목표 달성·훈련 완료를 의미하지 않는다.
제목과 버튼이 의미를 전달하므로 그림은 화면 읽기에서 중복 낭독하지 않는다.
게임 소식은 실제 분석/기록 목적지 뒤로 내린다. 소개 자동 팝업·타이머·보상은 없다.

## 생성 에셋

- 생성 도구: Codex 내장 이미지 생성. 사용자 사진·브랜드 이미지 입력 없음.
- 원본: `C:/Users/admin/.codex/generated_images/01a0bcfe-66fc-7a22-ae04-426aa6d6bcb0/exec-16fd1688-ee1f-418c-bc07-4c494a1d4a53.png`
- 작업용 원본 사본: `.scratch/home-introduction/training-analysis-plan-v1-original.png` (공개 번들 제외).
- 제공 파일: `app/public/illustrations/training-analysis-plan-v1.webp`, 336×336, 투명, 16,670 bytes.
- SHA256: `4f7c242a085937198fd70a0d0908cc9135074417bfbeef2ff34a23a9a502242b`.
- 원본을 다시 그리지 않고 크기/형식만 변환했다. 서비스 워커 사전 저장 목록은 늘리지 않았다.

### 최종 생성 프롬프트

```text
Use case: stylized-concept. Asset type: original transparent hero emblem for TRAINORACLE, a running training analysis and planning app, displayed at about 112px. Primary request: a friendly, exceptionally clear premium matte-clay illustration combining one simplified teal running shoe in front, a small ivory training calendar with a muted blue top binding behind it on the right, and one small lavender rounded analysis tile with three simple vertical bars behind it on the left. These three forms should feel like one compact balanced emblem, not three separate illustrations. A child should recognize exercise, analysis and a plan immediately. Composition: centered compact square, large simple silhouettes, generous transparent padding only about 8 percent; near front view with gentle 3D depth. Color palette: deep desaturated teal #0D5F5A, ivory, muted medium blue and soft lavender, minimal dark details. Materials: soft smooth matte clay, restrained soft shading on the objects only. Calendar has a few simple square cells without numerals. No upward arrow, no victory/check mark, no numbers, no letters, no captions, no logos, no humans, no faces, no mascots, no sparkles, no floating decoration, no ground plane, no backdrop or cast shadow. True transparent background. Not a financial or fortune-telling app. Original artwork, not a copy of another brand.
```

## 구현 경계

- UI 설정 키: `trainoracle.home-introduction.v1=seen`. 계정 ID, 개인 정보, 원문을 저장하지 않는다.
- 읽기 완료와 기본 홈의 가시성이 모두 확인돼야 표시/기록한다. 실패하면 sessionStorage를 시도하며 둘 다 실패해도 기능은 열 수 있다.
- 훈련 계획 버튼은 기존 계획 진입, 분석 버튼은 기존 개인/예시 판단과 읽기 화면을 그대로 사용한다.
- 큰 그림의 움직임은 200ms/8px이며 입력을 잠그거나 대기 시간을 만들지 않는다.
- 일반 해설·훈련 용어를 새로 추가하지 않는다. 기존 색 토큰과 Lucide 버튼 아이콘을 유지한다.

## 검수 기록

- 관련 테스트 5개 파일 71개 통과: 첫인상, 홈 모드, 안전/접근성, 기록 읽기 상태, 일지 복귀.
- 직접 링크/계정 진입에서 소개를 억제하는 AppShell 연결 검사 4개 통과. 그 파일의 무관한 19개는 선택 실행에서 제외했으며 통과로 세지 않는다.
- 최종 앱 타입 검사와 `git diff --check` 통과.
- 결함 주입: UI의 기록 읽기 완료 조건만 제거했을 때 `does not consume an introduction from ERROR data`가 실제로 실패했다. 별도 검사 변환으로 주입했으므로 실제 소스에는 결함을 쓰지 않았다.
- Chrome 320×812, 375×812, 1024×812: 첫 방문/재방문, 계획 진입, 분석 예시 진입, 이미지 실패, 가로 넘침, 44px 터치, OS 움직임 줄이기 확인. 일반 글씨에서 주요 두 선택이 하단 탭 위에 모두 보였다.
- 추가 320px 검사에서 홈의 실제 계산된 글자 크기를 200%로 확대했다. 가로 넘침/잘림 없이 자연스럽게 세로로 읽고 이동할 수 있었다. 확대 상황에서 두 버튼이 한 화면에 들어온다는 주장은 하지 않는다.
- 테스트가 발견한 분석 카드의 설명 접근성 연결 누락도 보완했다. 확인되지 않은 데이터의 설명은 계속 표시/연결하지 않는다.
- 최초 실행의 Windows 테스트 작업자 시작 실패 및 개발 서버 준비 지연은 제품 성공/실패로 세지 않았다. 작업자 방식을 바꾸고 브라우저 확인을 순차 실행해 위 결과를 얻었다.
- 로컬 증거: `.scratch/home-introduction/captures/first-375.png`, `first-320.png`, `first-1024.png`, `return-375.png`, `large-text-first-320.png`; 실행 스크립트 `.scratch/home-introduction/review.mjs`.
- 이번 변경은 운영 배포하지 않았다. 합성 검사/데스크톱 모바일 크기 확인은 실제 어린 사용자·iPhone·실계정 검수를 대신하지 않는다.
