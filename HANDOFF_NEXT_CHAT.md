# 다음 챗으로 — 작업 인수인계

> **이 파일을 새 챗 시작할 때 제일 먼저 읽어주세요.**
> 작성: 2026·06·22 · 작성 직전 토큰 한계로 챗 종료.

---

## 한 줄 요약

트레인오라클은 **AI 코칭 도구 → 훈련 일지 메인** 으로 방향 전환 중. v2 (코치·AI 중심)는 archive로 두고, **v3 (일지 중심, 모바일 우선)** 가 새 메인. 작업 절반쯤 와 있음 — 화면 7개 다 만들었고 syntax 버그 다 잡혔지만 **시각 검증·자산 등록·핸드오프 갱신**이 남았음.

---

## 지금 어디까지 와 있나

### ✓ 완료
1. **사용자 요구 14개 질문 답변 받음** — `로그`는 위에 있고, 핵심 결론은:
   - 메인 = **오늘 일지 쓰기 CTA + 어제 요약**
   - 4 진입점: 훈련 직후 / 하루 마무리 / 경기 직전 / 경기 직후
   - "**손으로 적던 일지처럼, 꾸미고 싶고, 프린트해서 가지고 싶게**" ← 가장 중요한 단서
   - AI는 거의 안 보임 — Home에 1-2줄, Tweaks로 토글
   - 화면별 2-3개 변형 (Tweaks로 전환)
2. **새 토큰 CSS** — `colors_and_type_journal.css` (종이톤·손글씨·테이프·잉크 스탬프·mood 5단계·pain 5단계·하이라이터)
3. **v3 모바일 UI Kit** — `ui_kits/trainoracle-app-v3/` 안에 다음 파일 다 있음:
   - `MobileFrame.jsx` — 직각 직사각 베젤
   - `JournalPrimitives.jsx` — IndexCard, MoodStrip, IntensityDots, IntensityStack, Stamp, PainDot, Sparkline, Delta, SectionLb
   - `Home.jsx` — 3 변형 (A.Journal · B.Sparkline · C.Recall)
   - `LogEntry.jsx` — Chooser + Post-session + Evening + Race (pre·post 토글) + BodyDiagram
   - `LogDetail.jsx` — 2 변형 (A.Journal page · B.Dashboard)
   - `Trends.jsx` — 2 변형 (A.Scroll · B.Tabs)
   - `App.jsx` — 모든 화면 가로로 펼친 통합 미리보기 + Tweaks
   - `tweaks_panel.jsx` — starter
   - `index.html` — 엔트리
4. **syntax 버그 다 잡음** — v2의 escape 안 된 따옴표 (`SessionDetail.jsx`), v3의 style 객체 따옴표 묶임 2건, `useTweaks` 튜플 destructure 오류, TweakSection/Toggle/Radio API 정정
5. **`design_handoff_trainoracle/`** 패키지는 이미 한 번 만들어졌음 — **단, v2 상태 기준이라 v3 반영 필요**

### ⛔ 남은 작업 (우선순위)
1. **시각 검증** — `show_to_user("ui_kits/trainoracle-app-v3/index.html")` + `screenshot_user_view`로 7개 phone frame이 wrap 되어 잘 떠 있는지 확인. flex-wrap 적용은 마지막 커밋에 들어있음.
2. **`preview/` 카드 5개 추가**:
   - `journal-tokens.html` — paper / grid / handwritten font 견본
   - `mood-strip.html` — 5단계 MoodStrip
   - `pain-scale.html` — 5단계 PainDot + body diagram mini
   - `index-card.html` — 인덱스 카드 헤더 미감
   - `intensity-stack.html` — 강도 분포 stack bar
3. **`register_assets`** — 위 5개 카드 + v3 화면 4-5개 (모바일 viewport 400×800)
4. **`design_handoff_trainoracle/` 갱신**:
   - `ui_kits/trainoracle-app-v3/` 전체 복사
   - `colors_and_type_journal.css` 복사
   - `README.md`에 "**일지가 메인** · v3" 섹션 추가 (v2 화면들은 archive 표기)
   - `present_fs_item_for_download` 다시 호출 → 새 zip 다운로드 카드
5. **(보너스) 인쇄 스타일시트** — `LogDetail.jsx`에 `@media print`로 종이같이 출력되게. 사용자 요구사항 — "프린트해서 가지고 싶다".
6. **(보너스) 사이드바 줄바꿈 수정 후 `thumbnail.png` 재촬영** — v3 Home 변형 A의 모바일 frame이 thumbnail로 더 적합할 수도.

---

## 디자인 결정 핵심 — 새 챗에서 잊지 말 것

### 톤 — Tufte × Linear + Field Journal
기존 v2 = "의학 저널" → v3 = "**연구자 노트북 + 모눈 일지장**". 두 미감 동시 만족:
- **UI 영역** (라벨·버튼·meta) = 모노 + 직각 + hairline, 기존 v2 규칙 그대로
- **사용자 입력 영역** (메모·일기) = `Caveat` 영문 + `Gowun Dodum` 한글 손글씨, `var(--ink-blue)` 만년필 잉크색
- **인덱스 카드 헤더** = 도서관 카드 카탈로그 미감 (날짜·요일·날씨·사이클 라벨)
- **사진 첨부** = 마스킹 테이프 미감 (`.tape` / `.tape.sage`)
- **마일스톤** = 잉크 도장 (`<Stamp kind="pb">`)
- **메모 배경** = `.paper-grid` (8px dot grid) 또는 `.paper-lines` (24px 줄)

### 절대 깨지 말 것 (v2 규칙 유지)
- 직각 (radius ≤ 4px). avatar circle 50% 만 예외.
- 그라데이션 금지.
- UI에서 이모지 금지. **사용자 입력만 자유**.
- 모든 숫자 `tabular-nums`.
- 에너지 시스템 (BA/LT/V2/GL/AP/RE) = 도트 + 코드 + underline. 배경색 X.

### Tweaks로 노출되는 옵션
- Home variant: A.Journal / B.Sparkline / C.Recall
- Log detail variant: A.Journal / B.Dashboard
- Trends variant: A.Scroll / B.Tabs
- AI 보임 토글
- 강도 인코딩: dot-code / chip / glyph

---

## 파일 빠른 인덱스

| 파일 | 무엇 |
|---|---|
| `ui_kits/trainoracle-app-v3/index.html` | **새 챗에서 가장 먼저 보여야 할 화면** |
| `ui_kits/trainoracle-app-v3/App.jsx` | 7개 frame + Tweaks 컨트롤 |
| `colors_and_type.css` | v2 토큰 (그대로 유지) |
| `colors_and_type_journal.css` | v3 일지용 토큰 (위에 얹어 씀) |
| `ui_kits/trainoracle-app/` | v2 — archive 됐지만 아직 안 옮김 |
| `design_handoff_trainoracle/` | 핸드오프 패키지 — v3 반영 안 됨 |
| `reference_designs/` | 원본 v2 sprint HTML 6종 (Landing, SessionDetail, AIChat 등) |
| `design-system/*.md` | 토큰·컴포넌트·시스템 가이드 — v2 기준 |
| `PHILOSOPHY.md` | 10 규칙 + 10 금지. **v3 진행에도 모두 유효**. |
| `SKILL.md` | 다른 프로젝트에서 attach될 때 metadata |

---

## 새 챗에서 첫 메시지로 던지면 좋은 것

> **이 프로젝트는 트레인오라클 디자인 시스템. v3 일지 중심 작업 이어가는 중.**
> **`HANDOFF_NEXT_CHAT.md` 먼저 읽고 현재 상태 파악해줘. 그 다음:**
> **1. `ui_kits/trainoracle-app-v3/index.html`을 `show_to_user`로 띄우고 스크린샷으로 시각 검증**
> **2. preview 카드 5개 + 자산 등록**
> **3. 핸드오프 패키지 v3 반영해서 새로 떨궈줘**

이러면 컨텍스트 한 번에 잡힙니다.

---

## 캐비어트 (새 챗이 알아야 할 함정)

1. **`useTweaks` API** — 튜플 `[t, setTweak]`이지 객체 `{t, setTweak}` 아님. 잘못 쓰면 `t.homeVariant` undefined.
2. **`TweakSection`** — prop은 `label` (not `title`).
3. **`TweakToggle`** — prop은 `value` (not `checked`).
4. **`TweakRadio` options** — `{ value, label }` 형태. label이 너무 길면 자동으로 `TweakSelect`로 떨어짐.
5. **JSX 텍스트 안의 `'`와 `"`** — `3'20"` 같은 페이스 표기는 JSX 텍스트로는 OK지만, **prop value로는** 반드시 `{"3'20\""}` 처럼 중괄호+escape.
6. **style 객체 따옴표** — `color: 'var(--ink), fontWeight: 600'` 같은 실수 (한 따옴표가 두 prop 묶음) 가 v3에서 두 번 났었음. 새 컴포넌트 쓸 때 주의.
7. **사용자 preview viewport가 좁음 (~352px)** — 7 frame을 한 줄로 펼치면 안 보임. `flex-wrap: wrap` 적용했지만 재확인 필요.
8. **v2 SessionDetail.jsx** — 핸드오프 패키지에도 동기화 완료 (escape 따옴표 fix).
9. **v3는 변형 + AI 토글이 Tweaks 패널 안에 있음** — 사용자가 toolbar에서 "Tweaks" 토글 켜야 보임. 안 보이면 그래서임.

---

## 한 가지만 기억한다면

> **"이 도구는 매일 들여다보고 싶은, 손으로 쓰던 일지여야 한다.**
> **AI는 가끔 옆에서 패턴을 짚어주는 정도. 메인은 사용자가 쌓는 데이터."**

v3 작업 전부가 이 한 줄을 통과해야 합니다.
