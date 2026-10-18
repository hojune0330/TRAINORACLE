# 일지 달력 디자인 정합성 — 2026-10-18

## 범위

사용자 제공 지난 일지 화면과 직전 간결한 탐색 개선을 기준으로 상위 섹션/보기 방식/실제 날짜의 위계를 정리한다. 훈련 계산, 계정·저장소, 개인 원문 노출 범위, 사용자 종이·장식 좌표는 변경하지 않는다. 이 작업의 로컬 검수는 배포나 실계정 검증이 아니다.

공통 개인 스킬 `design-toss-card-ui`에 `references/compact-navigation-calendar.md`를 추가하고 SKILL.md와 TrainOracle 라우팅을 갱신했다. 저장소의 재현 기준은 `docs/UX_UI_VISUAL_STANDARD.md` §8.15이다. Python 기본 검증기는 PyYAML 부재로 실행되지 않아, 기존 Node YAML 패키지로 frontmatter·이름·설명·미완성 TODO·상대 링크를 검증했다. 새 의존성은 설치하지 않았다.

## 새 이미지

- 경로: `app/public/illustrations/journal-empty-v1.png`
- 사용: 실제 기록 없음이 확인된 일지 달력 아래, 기존 예시 진입 옆의 64px 보조 그림. 장식 이미지라 대체 텍스트는 비워 둔다.
- 불러오기 중·실패·실제 기록이 있는 경우에는 숨긴다. 로딩 실패는 이미지에만 영향을 주고 기존 탐색을 유지한다.
- 생성 원본: `exec-643622b6-c1c8-465c-b6a5-e07309a45909.png` (Codex 생성 이미지 폴더에 보존).
- 배포용 변환: 이미지 생성 도구의 투명 PNG 원본을 기존 Sharp로 192×179px, PNG palette quality90/compression9로 축소. 11,587바이트, alpha 유지. 새 도형이나 달력을 코드로 그리지 않았다.

생성 프롬프트:

> Create one tiny premium app empty-state illustration on transparent background, for a young athlete's journal calendar. A single rounded warm ivory notebook/calendar tile, angled slightly with soft clay-like dimension, two small muted amber binder loops at the top, a tiny pale teal pencil leaning beside it. Very simple friendly emoji-like object, no human or animal, no face. On the paper use only 4 subtle rounded empty cells, NO numbers, NO letters, NO text, NO check mark, NO progress symbol, NO ribbons or sparkles. Muted amber #9A5C13 and warm cream with a small deep teal #126865 accent; sophisticated restrained soft lighting, crisp clean silhouette, enough margin, centered composition. It must stay legible at 64px and complement a clean white mobile UI, not look like a busy calendar screenshot. One isolated object only; actual transparent alpha, no background card, no checkerboard, no cast rectangle.

## 검수 기록

`.scratch/journal-calendar-polish-review.mjs`는 외부 요청을 차단하는 격리된 로컬 브라우저에서 합성 일지로 검수하며 개인 기록을 사용하지 않는다. 기준 날짜는 2026-10-18로 고정했다.

- 관련 계약 6파일, 최종 48개 통과: JournalArchive19, MonthCalendar11, JournalMonthCalendar.return5, JournalInputLayout3, ViewSwitcher2, CalendarTrainingColors8. 각 파일의 최종 변경에 해당하는 실행 결과를 합산했으며 전체 CI는 실행하지 않았다.
- 최종 앱 TypeScript 검사와 `git diff --check` 통과. 기존 소스 체크아웃의 다른 미추적 보고서·작업물은 수정하지 않았다.
- 320·375·1024px에서 빈 달력과 다중 기록 달력: 가로 넘침 없음, 표시된 버튼·펼침 조작 44px 이상, 장식 없는 날짜 숫자 중심 정렬 확인.
- 날짜 상세 열기·닫기 후 날짜 포커스 복귀, 이전 달·오늘, 키보드 날짜 이동, 일지/몸 기록 및 달력/묶음 전환 확인. 합성 일지 저장 원문 불변.
- 320px에서 실제 계산된 글자 크기를 2배로 확대하는 스트레스 검사: 가로 넘침·잘림 없이 기록 줄바꿈. 좁은 7열에서 오전/오후 문구가 세로로 길어지는 것은 확인했으며 일반 크기와 같은 밀도라고 주장하지 않는다.
- 합성 보유 종이·상단 그림·날짜 그림: 달력 읽기 면 투명, 날짜 숫자와 그림 비겹침, 상단 장식 내용 높이72px(기존 경계선 별도), 월 이동 후 저장 좌표·종이 상태 불변.
- Luna 읽기 전용 독립 리뷰의 추가 P2 확인: 다중 기록 주에서 이웃 빈 날짜 아래가 비활성 공간이 되는 문제를 일지 전용 날짜 버튼의 행 높이 채움으로 보완하고 실제 브라우저에서 확인했다. 기록 분류·시간대는 삭제하지 않았다.
- 새 그림 192×179px alpha PNG가 정상 로드됨을 확인. 기록이 있는 경우 그림 없음, 빈 상태의 훈련 범례 숨김, 실패/대기 상태에서 빈 상태 그림이 나오지 않는 경계는 계약 검사로 확인했다.
- 캡처와 결과: `.scratch/journal-calendar-polish-visual/`의 `empty-375.png`, `records-375.png`, `decorated-375.png`, `*-320-text200.png`, `results.json`.

검사 도구의 첫 시도에서는 Windows Temp의 Vitest EPERM이 있어 테스트가 실행되지 않았다. 작업 전용 TEMP/TMP로 해결했다. 브라우저 합성 fixture의 회복 분류 값과 장식72px 내용 높이에 기존1px 테두리를 더한 검증 기대값을 바로잡았으며 제품 계산·기록 스키마를 변경하지 않았다.

실제 iOS/Kakao 인앱 브라우저, 실계정 읽기/저장, 전체 앱 CI, 커밋·푸시·운영 배포는 이 작업의 검증 범위가 아니다.
