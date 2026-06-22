# Session Timeline — 두 디자인 세션의 작업 순서

> 트레인오라클 디자인 시스템이 어떤 순서로 만들어졌는지의 기록.
> 결정을 다시 검토할 때 "그때 무슨 맥락이었지?" 를 빠르게 찾기 위한 문서.

---

## Session 1 — Design System + v2 (2026 초)

### 1-1. 첫 대화
- 호준 코치가 "AI 코칭 도구" 를 만들고 싶다는 의도로 시작
- 30년 방법론 (9.5-day cycle, BA/LT/V2/GL/AP/RE 에너지 시스템) 을 디지털로 옮긴다는 비전
- 1500m–10000m 중장거리 선수가 타겟

### 1-2. 디자인 시스템 토대
- **`PHILOSOPHY.md`** — 10 규칙 + 10 금지 작성
- **`colors_and_type.css`** — Tufte × Linear 톤의 토큰 시스템
  - `--ink` `--ink-2` `--ink-3` 세 단계 잉크
  - `--brand` 단일 액센트
  - Inter (sans) + JetBrains Mono (mono) 페어, **serif 없음**
- **`DESIGN_DECISIONS.md`** — v1 → v2 전환 근거 (Instrument Serif 제거, 둥근 모서리 제거, 다크 테마 제거)

### 1-3. v2 UI Kit (데스크탑)
5개 화면:
- `Dashboard.jsx` — 홈
- `SessionDetail.jsx` — 훈련 한 건
- `Calendar.jsx` — 9.5-cycle 캘린더 (차별화)
- `AIChat.jsx` — AI 대화
- `Inbox.jsx` — 코치 AI 인박스

핵심 컴포넌트 (`Primitives.jsx`):
- `EnergyTag` — 에너지 시스템 인코딩 (도트 + 코드)
- `Verdict` — AI 판단 + 신뢰도 + 대안
- `MainMark` — 메인 메트릭 강조
- `CycleRail` — 9.5-day cycle visualization

### 1-4. Reference Designs
- 6개 standalone HTML (`reference_designs/`) — 디자인 스프린트의 결과물
- 일부는 v1 (둥근 모서리, 어두운 테마) — archive 표기

### 1-5. 핸드오프 패키지 1차
- `design_handoff_trainoracle/` 생성
- README · PHILOSOPHY · DESIGN_DECISIONS · colors_and_type · UI kit · preview 카드 21개 포함

**Session 1 종료 시점 상태:**
> AI 코칭 도구의 v2 데스크탑 디자인 시스템 완성. 출시 가능 수준.

---

## Session 2 — v3 피벗 (2026·06)

### 2-1. 사용자의 재방문 + 방향 전환 신호
호준 코치가 v2 를 검토한 뒤 의문 제기:
> "이게 AI 가 코치를 대체하는 그림인데, 내가 원한 게 아니다."
> "선수가 매일 본인 일지를 쓰는 게 먼저고, AI 는 보조여야 한다."

### 2-2. 14개 질문 세션
디자이너가 14개 질문을 던지고 답변을 받음. 핵심 단서들:

| Q | 답 |
|---|---|
| 메인 화면은? | "오늘 일지 쓰기 CTA + 어제 요약" |
| 누가 언제? | "훈련 직후 / 하루 마무리 / 경기 직전 / 경기 직후" |
| 어떤 일지? | **"손으로 적던 일지처럼. 꾸미고 싶다. 프린트해서 가지고 싶다."** |
| AI 는? | "거의 안 보임. 1-2줄. 끄고 켜기." |
| 변형은? | "화면별 2-3개. Tweaks 로 전환." |
| 통증·부상? | "숨기지 말고 며칠 째인지 보여줘." |
| 기분? | "수치보다 색깔. 5단계." |
| 에너지 시스템? | "코드 + 도트 + 텍스트 다 같이. 색만으로 X." |
| 코치는? | "코치는 일지를 읽는 사람. 시스템 안 캐릭터 X." |

(전체 14개 → `DECISION_LOG.md`)

### 2-3. 새 토큰 시스템
**`colors_and_type_journal.css`** — 기존 v2 토큰 위에 얹는 확장:
- 종이톤 (`--paper`, `.paper-grid`, `.paper-lines`)
- 손글씨 색 (`--ink-blue` 만년필 청색, `--pencil`)
- 손글씨 폰트 import (`Caveat`, `Gowun Dodum`)
- Mood scale 5단계 (`--mood-1..5` — cool slate → warm clay)
- Pain scale 5단계 (`--pain-1..5` — light → dark)
- 마스킹 테이프 (`.tape`, `.tape.sage`)
- 잉크 스탬프 (`.stamp`)
- 형광펜 (`.hl`)
- 인덱스 카드 헤더 (`.idx-card`)

### 2-4. v3 모바일 UI Kit
`ui_kits/trainoracle-app-v3/` 7 화면:
- `Home.jsx` — 3 변형 (A.Journal · B.Sparkline · C.Recall)
- `LogEntry.jsx` — Chooser + 4 폼 (post-session · evening · race-pre · race-post)
- `LogDetail.jsx` — 2 변형 (A.Journal page · B.Dashboard)
- `Trends.jsx` — 2 변형 (A.Scroll · B.Tabs)

공통:
- `MobileFrame.jsx` — 직각 직사각 베젤
- `JournalPrimitives.jsx` — IndexCard · MoodStrip · IntensityDots · IntensityStack · Stamp · PainDot · Sparkline · Delta · SectionLb
- `App.jsx` — 7 frame 통합 미리보기 + Tweaks 패널

### 2-5. 디버깅 라운드
중간에 잡은 버그들:
- v2 `SessionDetail.jsx` 의 escape 안 된 따옴표 (`3'20"` 같은 페이스 표기)
- v3 의 style 객체 따옴표 묶임 (한 따옴표가 두 prop 묶임)
- `useTweaks` 튜플 destructure 오류
- `TweakSection` / `TweakToggle` / `TweakRadio` API 정정

→ 이 경험은 `HANDOFF_NEXT_CHAT.md` 의 "캐비어트" 섹션에 보존.

### 2-6. 컨텍스트 한계 도달
- 토큰 한계로 첫 세션이 종료
- `HANDOFF_NEXT_CHAT.md` 작성 — 다음 챗으로 인수인계

---

## Session 2.5 — 마감 (이번 세션)

### 2.5-1. 인수인계 받음
새 챗이 `HANDOFF_NEXT_CHAT.md` 를 읽고 시작.

### 2.5-2. 시각 검증
- `ui_kits/trainoracle-app-v3/index.html` 띄움
- 7개 모바일 frame 이 flex-wrap 으로 두 줄에 잘 배치됨 확인
- 콘솔 에러 0
- 손글씨 폰트 정상 로드, 종이톤·잉크·스탬프 다 살아있음

### 2.5-3. Preview 카드 5개 추가
디자인 시스템 탭에 v3 신규 토큰 노출:
- `journal-tokens.html` — 종이·손글씨·잉크
- `mood-strip.html` — 5단계 감정
- `pain-scale.html` — 5단계 통증 + body marker
- `index-card.html` — 도서관 카탈로그 헤더
- `intensity-stack.html` — 에너지 시스템 분포

### 2.5-4. 자산 등록
- 6건 등록 (카드 5개 + v3 App)
- 그룹: Colors / Components / Brand

### 2.5-5. 핸드오프 패키지 v3 반영
- `design_handoff_trainoracle/ui_kits/trainoracle-app-v3/` 전체 복사
- `colors_and_type_journal.css` 복사
- preview 카드 5개 복사
- `HANDOFF_NEXT_CHAT.md` 복사
- `README.md` 에 "v2 → v3 방향 전환" 섹션 추가, Files 표에 v3 9개 파일 명시

### 2.5-6. 인쇄 스타일 (보너스)
사용자 요구 "프린트해서 가지고 싶다" 실현:
- `@media print` A5 portrait
- 모바일 베젤·status bar·home indicator 자동 해제
- 종이톤은 살리되 잉크 색 보장
- LogDetail variant A 만 `.print-target` 클래스로 단독 출력

### 2.5-7. Thumbnail 재촬영
- v3 의 대표 화면을 표지로
- 워드마크 + 핵심 메시지 ("매일 손으로 쓰던 일지를, 프린트해서 가지고 싶게") + 손글씨 인용 + 실제 LogDetail journal page + 색상 스와치
- 1280×800 PNG

### 2.5-8. 이 문서들 추가 (지금)
사용자 요구 "왜 일지로 가는지 맥락 다 넣어줘" 실현:
- `DECISION_LOG.md` — 왜 일지인가 + 14개 질문 원문
- `VARIANTS.md` — 각 변형이 누구를 노리나
- `NEGATIVE_SPACE.md` — 안 한 것들 + 거부한 옵션
- `SESSION_TIMELINE.md` — 이 문서

---

## 다음에 할 일 (출시 전)

1. **호준 코치 검토** — 7개 화면 + Tweaks 옵션 다 돌려보고 디폴트 변형 확정
2. **인쇄 실제 테스트** — Cmd+P 로 LogDetail A 가 종이로 잘 빠지는지
3. **사용자 4-5명 테스트** — 4 진입점 (훈련 직후 / 하루 마무리 / 경기 직전 / 경기 직후) 별로 진짜 쓸 만한지
4. **v3 출시판 코드 이식** — 이 디자인 시스템 → 실제 프로덕션 코드베이스 (Next.js + Tailwind + Radix)
5. **데이터 6개월 축적 후** AI 인사이트 모듈 진짜 가동

---

## 한 줄로

> v1 (SaaS 톤) → v2 (Tufte × Linear, AI 중심) → **v3 (Journal-first, mobile, 출시판)**.
> 각 피벗은 호준 코치의 명확한 신호에서 나왔지, 디자이너의 변덕이 아닙니다.
