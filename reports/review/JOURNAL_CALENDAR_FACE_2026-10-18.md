# 달력 면 자체 개선 — 2026-10-18

## 요청과 범위

사용자의 정정: 달력 옆에 생성 그림을 더 붙이는 것이 아니라 **달력 자체를 예쁘게** 만든다.
직전 일지 탐색 정리 위에 달력 면의 타이포그래피·그리드·선택 상태·기본 종이 표면을 개선한다.
훈련 계산·저장·개인 원문·종이 좌표·달력 탐색 계약은 변경하지 않는다.
공통 디자인 스킬의 위계/그리드/상태 규칙을 적용하며, 이번 오너 정정에 따른 기본 종이 표면
허용 기준은 저장소 시각 표준 §8.16에 명시한다.

## 실제 생성 에셋

- 내장 이미지 생성 도구 사용. 새 API/서버/의존성 없음.
- 원본: Codex 생성 이미지 `exec-7b66a07d-595e-4968-8b13-9dec05ff4aea.png`.
- 적용 파일: `app/public/illustrations/journal-calendar-paper-v1.webp`.
- 기존 Sharp로 768×768 WebP quality78 최적화, 7,922바이트. 원본 보존.
- 이미지에는 숫자·날짜·선택·훈련이 없으며, 표면 질감만 제공한다.
- 사용자 종이가 있으면 기본 이미지 미적용. 실패 시 색상 폴백. 실제 날짜는 HTML 버튼이다.

### 최종 생성 프롬프트

```text
Use case: stylized-concept
Asset type: blank full-bleed paper material for a real interactive Korean journal calendar; this is a subtle surface texture, not an illustration of a calendar.
Primary request: a beautiful softly tactile warm-white stationery paper surface, refined and modern, with barely visible fine paper fibers and an extremely faint warm ivory / pale amber light wash near the upper edge. It should make a live monthly calendar feel like one intentional, beautiful sheet without drawing attention away from black date numbers laid on top later.
Composition: straight-on flat evenly illuminated square texture filling the entire image edge to edge, uniform and calm across the middle and lower portions, suitable for cropping and variable calendar height.
Palette: near white #fffdf8 through #f8f4e9; no dark marks, high contrast detail or saturated yellow.
Constraints: completely blank. NO writing, letters, digits, date grid, dots representing dates, rings, binding, frame, borders, shadows of objects, icons, mascots, flowers, stickers, folds, tear edges, or calendar UI. No perspective, no desk or surrounding background. Do not draw a calendar. A clean premium paper material only, minimal low-contrast grain. Opaque background.
```

## 검수

- 작은 연도/큰 월, 오늘·이전/다음 도구 묶음, 요일 띠/주 구분선을 적용했다.
  날짜 숫자는 기존16.5px 토큰, 연도/요일12px, 월28px 위계를 사용한다.
- 기본 생성 재질은60% 중립 표면을 겹쳐 질감을 낮췄다. 오늘은 윤곽 원, 선택일은 채운 원이며,
  오늘을 선택했을 때도 얇은 바깥 원이 남는다. 셀 전체의 진한 배경과 밑줄 중첩은 제거했다.
- 관련 계약3파일25개 통과: MonthCalendar12, CalendarTrainingColors8, JournalMonthCalendar.return5.
  Node24.19와 작업 전용 TEMP 사용. 달력 행동/접근 이름/키보드 복귀, 기존 역할 표시는 유지했다.
- 최종CSS로320·375·1024px의 빈 달/다중 기록 달 총6경우를 로컬 Chromium에서 확인했다.
  가로 넘침 없음, 표시 버튼/펼침 영역44px 이상, 날짜 중앙 정렬, 날짜 읽기/복귀 포커스,
  월 이동/오늘/키보드 날짜 이동, 일지/몸 기록 및 달력/묶음 전환, 합성 일지 저장 원문 불변.
- 320px에서 계산된 글자 크기를2배로 확대한 스트레스 검사도 넘침/작은 조작 영역이 없었다.
  좁은7열에서 훈련 분류는 줄바꿈되며 다중 기록 주가 길어질 수 있다. 실제iOS 글자 확대 검증은 아니다.
- 생성 이미지 정상 로드와 로드 차단 후 색상 폴백/날짜 조작을 확인했다. 사용자 종이 활성화 시
  기본 배경 이미지가none이며,72px 여백 장식·날짜 그림 비겹침·월 이동 후 저장 좌표 불변을 확인했다.
- 다중 기록 주의 빈 날짜 버튼294.75px, 셀295.75px 차이는 새1px 주 구분선이었다.
  테스트는 경계선을 제외한 실제 내부 높이를 비교하도록 바로잡았으며 비활성 빈 공간은 없었다.
- 캡처/측정 결과: `.scratch/journal-calendar-face-visual/`.
  실행 도구: `.scratch/journal-calendar-polish-review.mjs`. 모든 외부 요청은 차단하고 합성 기록만 사용했다.
- 첫 브라우저 시도는 Vite 초기 모듈 로딩 중30초 제한으로 중단되었다. 앱 준비 이후 DOM/실제 그리드를
  기다리도록 검수 도구를 보완한 뒤 위 결과를 확인했다. 중단된 실행은 통과로 계산하지 않았다.

### 독립 시각 리뷰

Luna의 이전/이후 캡처 비교에서 막히는 시각 결함은 확인되지 않았다. 연·월 위계, 요일 띠,
주 구분선, 오늘/선택일 구분과 사용자 종이 우선 적용을 확인했다. 제안 중 달력 아래 예시 그림은
직전 작업의 기존 진입 보조이므로 이번 달력 면 변경에서는 그대로 보존했다.
320px/글자2배에서는 두 자리 날짜 사이가 촘촘해지는 한계가 남는다. 숫자 축소나 훈련 정보 삭제로
숨기지 않았으며 실제 기기에서의 큰 글자 가독성 검토 대상으로 남긴다. 스크린샷 리뷰이며 실기기 검증은 아니다.

최종 앱 TypeScript `tsc --noEmit` 검사도 종료 코드0으로 통과했다.
기존 변경이 있는 소스 체크아웃을 보존했고 커밋·푸시하지 않았다. 검수용 로컬 개발 서버는 종료했다.
전체 앱 CI, 실제 iOS/카카오 인앱 브라우저, 실계정 저장, 커밋·푸시·운영 배포는 수행하지 않았다.
