# 작업지시서 UX1 수행 보고 — 손가락 피로 줄이기

**작업일:** 2026-07-27
**지시서:** `WORK_ORDER_UX1_TAP_FATIGUE.md`
**성격:** 화면 작업. 계산·처방 로직은 건드리지 않았다.

---

## 0. 먼저 말할 것 — 지시서를 고쳤다

착수해서 실제로 재 보니 지시서에 **통과할 수 없는 조건**과 **서로 부딪히는
조건**이 있었다. 숫자를 슬쩍 올려 통과시키는 대신 지시서를 고치고 근거를
남겼다. 고친 내용은 지시서 `§0-A ~ §0-C` 에 들어가 있다.

| # | 무게 | 문제 | 처리 |
|---|---|---|---|
| D1 | 치명적 | 재는 자와 검사하는 자가 다르다. 지시서는 390×844(스크롤 영역 787px)에서 재고 검사는 `mobile-chromium`(393×727, 670px)에서 돈다 | **비율 상한을 폐기하고 px 상한으로 바꿨다** |
| D2 | 치명적 | "다 채운 뒤 1.3 화면"(=1023px)은 지시서가 허용한 접기를 전부 해도 1039px 이 최선이라 16px 부족하다 | **폐기.** 빈 상태를 줄이는 것으로 목적을 달성했다 |
| D3 | 치명적 | §2-1 "답하면 즉시 접기" 와 §4-3(나) "사람이 펼친 건 안 접기" 가 충돌. RPE 를 처음 고르는 사람은 (나)의 보호를 못 받아 버튼 10개가 눈앞에서 사라진다 | **자동 접기 폐기.** 접기는 사람이 누를 때만 |
| D4 | 중대 | §5-5 는 판정어 0건을 요구하지만 기존 코드가 이미 3건 위반 (`EveningCheckin.tsx:14-15`, `RaceSelfChecks.tsx:5`) | 기대값을 **0 → 3(작업 전과 같음)** 으로 고쳤다. 선택지 이름은 앱의 판정이 아니다 |
| D5 | 중대 | `done` 은 "답했다"는 판정을 `FormSec` 에 넣는 이름인데, 판정은 각 화면이 한다며 §4-3 이 스스로 부인한다 | `collapsible`·`defaultOpen`·`autoOpenWhen` 으로 바꿨다 |
| D6 | 보통 | §1-2 구획 합계가 §1-1 스크롤 높이와 정확히 240px 어긋난다 (둘 다) | 재는 범위를 명시했다 (TopBar+IndexCard+StickyBar 포함) |
| D7 | 보통 | "한 화면 45줄"에 재는 방법 정의가 없다 | **폐기.** 접기로 줄이면 스크롤 길이와 같은 것을 두 번 재는 것이다 |

**D1 이 가장 중요하다.** 오너가 요구한 절약량(787px 기준 1.6화면 = 1259px)은
**이미 달성했다** — 훈련 후 1250px. "목표 미달"로 보였던 것은 순전히 지시서가
자를 두 개 쓴 탓이었다.

---

## 1. 만든·고친 파일

| 파일 | 무엇을 |
|---|---|
| `app/src/screens/log-entry/shared.tsx` | `FormSec` 에 접기 추가. `collapsible` 없으면 예전과 같은 DOM |
| `app/src/screens/log-entry/BodyDiagram.tsx` | 몸 그림 기본 닫힘, 통증 고르면 자동 펼침 |
| `app/src/screens/log-entry/IntensityAssessmentField.tsx` | 객관 기록 기본 닫힘 |
| `app/src/styles/app.css` | 입력칸 `:active` 테두리, `formsec-settle`, 움직임 줄이기 2줄 |
| `app/src/screens/log-entry/FormSec.contract.test.tsx` | **새 파일.** 12개 |
| `app/src/components/Motion.contract.test.tsx` | 4개 **추가** (+39 / −0) |
| `app/e2e/scroll-depth.spec.ts` | **새 파일.** 6개. px 상한 |
| `app/src/screens/LogEntry.contract.test.tsx` | 2개가 접힌 구획을 먼저 펼치도록 |
| `app/e2e/intensity-assessment.spec.ts` | `openPostSession()` 이 객관 기록을 펼침 |
| `app/e2e/touch-targets.spec.ts` | 그림 닫힘 확인 + 자동 펼침 확인 |
| `WORK_ORDER_UX1_TAP_FATIGUE.md` | §0-A~0-C 추가, 폐기 항목 표시 |

`impl/` · `specs/` · `journal-*` **변경 0건.**

---

## 2. 스크롤 길이 before → after (px, 실측)

`main.app-scroll-region` 의 `scrollHeight`. before 는 `git worktree` 로 HEAD 를
따로 빌드해서 쟀다 (`git stash` 로는 안 된다 — §6 참고).

### mobile-chromium (393×727, 스크롤 영역 670px)

| 화면 | before | after | 절약 | 상한 | 판정 |
|---|---|---|---|---|---|
| 훈련 후 (빈 상태) | 1581px | **1250px** | **−331px** | 1300 | 통과 |
| 하루 마무리 (빈 상태) | 1685px | **1260px** | **−425px** | 1300 | 통과 |
| 경기 일지 | 956px | 956px | 0 | 1000 | 회귀 없음 |

### touch-narrow (320×568, 스크롤 영역 511px)

| 화면 | before | after | 절약 | 상한 | 판정 |
|---|---|---|---|---|---|
| 훈련 후 (빈 상태) | 1747px | **1265px** | **−482px** | 1350 | 통과 |
| 하루 마무리 (빈 상태) | 1700px | **1275px** | **−425px** | 1350 | 통과 |
| 경기 일지 | 970px | 970px | 0 | 1000 | 회귀 없음 |

### 오너의 원래 요구와 대조

오너가 쓴 자(787px)로 환산하면:

| 화면 | before | after | 오너 목표(1.6화면=1259px) |
|---|---|---|---|
| 훈련 후 | 2.01 화면 | **1.59 화면** | 달성 |
| 하루 마무리 | 2.14 화면 | **1.60 화면** | 달성 |

상한만 걸면 원래도 통과하는 값이 섞이므로 `toBeLessThan(before)` 도 함께 걸어
**"줄었다"는 사실 자체를 잠갔다.**

---

## 3. 구획별 높이 before → after

| 화면 | 구획 | before | after | 방법 |
|---|---|---|---|---|
| 훈련 후 | 객관 기록 · 0개 | 393px | 44px | 닫힌 채 시작 |
| 하루 마무리 | 몸 그림 (SVG) | 476px | 0px | 닫힌 채 시작 (`display:none`, DOM 에는 남음) |

건드리지 않은 구획: 강도 시스템 146 / 세션 제목 85 / 거리·시간·페이스 114 /
RPE 160 / 예상 강도 131 / 메모 312 / 수면 / 수면 질 / 체중·심박 / 감정 / 한 줄.
전부 그대로다. **§2-1 자동 접기를 폐기했기 때문이다 (D3).**

---

## 4. §4-1 `FormSec` 근거 추적표 — 실제 파일·줄번호

| 서명 요소 | 실제 위치 | 근거 | 다르게 만들면 |
|---|---|---|---|
| `collapsible?: boolean` (원본 `done?`) | `shared.tsx:46` | `FormSec` 쓰는 화면 6개, 이번에 고친 건 2개 | 필수로 만들면 나머지 4개가 깨진다 |
| `summary?: string` | `shared.tsx:52` | 판정 문구 들어올 자리를 안 만든다 | 객체로 받으면 `{level:"높음"}` 이 들어온다 |
| 접힌 줄이 `<button>` | `shared.tsx:87` | `app.css:442` 의 `:active` 가 `button` 에만 붙는다 | `<div onClick>` 이면 누른 느낌이 안 생긴다 |
| 접힌 높이 `minHeight: 44` | `shared.tsx:93` | `touch-audit.ts` `meetsTouchContract` | e2e 터치 검사가 실패한다 |
| `display:none` 으로 감추기만 | `shared.tsx:112` | 오너 지침 "지우거나 하라는 게 아니야" | 접었다 펼치면 답이 사라진다 |
| 자동으로 접지 않음 | `shared.tsx:30-32` (주석) | 시간·개수 규칙은 근거가 없다 (D3) | 화면이 저절로 튀어 사용자가 놓친다 |
| 몸 그림 `aria-hidden` 유지 | `BodyDiagram.tsx:59` | 버튼과 같은 정보다. 두 번 읽히면 나쁘다 | 스크린리더가 20번 읽는다 |

## §4-4 CSS 값 근거 추적표

| 값 | 실제 위치 | 근거 |
|---|---|---|
| 입력칸 `90ms` | `app.css:449` | `app.css:444` 버튼과 같은 값 |
| 입력칸에 `transform` 없음 | `app.css:447-450` | 글자 커서가 흔들린다 |
| 접힘 `120ms` | `app.css` `.formsec--collapsed` | 버튼 90ms 다음에 오는 반응이라 살짝 길다 |
| `translateY(-2px)` | `@keyframes formsec-settle` | 6px 넘으면 화면이 튄다 |
| 시작 `opacity: 0.55` | `@keyframes formsec-settle` | `0` 이면 새로 나타나는 느낌이라 산만하다 |
| `height` 애니메이션 없음 | `@keyframes formsec-settle` | 아래 구획이 밀려 올라오면 눈이 위치를 잃는다 |
| 색 새로 안 만듦 | hex 3개 그대로 | ADR A3 토큰 단일 소스 |

---

## 5. §4-2 검산표 — 손으로 정한 값과 실제 렌더

원본 표의 `done` 열은 `collapsible`+`defaultOpen` 으로 바뀌었다 (D5).
6줄 모두 `FormSec.contract.test.tsx` 에 들어가 있다.

| # | 입력 | 기대 렌더 | 기대 높이 | children | 실제 | 테스트 |
|---|---|---|---|---|---|---|
| 1 | `collapsible` 없음 | 예전과 같이 펼쳐짐 | 기존 값 | 보인다 | 같음. `queryByRole("button")` 이 `null` | 통과 |
| 2 | `collapsible defaultOpen` | 펼쳐짐 | 기존 값 | 보인다 | 같음 | 통과 |
| 3 | `collapsible defaultOpen={false}` + `summary` | 접힌 한 줄 + 요약 | ≥44px | 숨는다 | `minHeight:44`, `not.toBeVisible()` | 통과 |
| 4 | 위에서 `summary` 없음 | 접힌 한 줄, 값 칸 비움 | ≥44px | 숨는다 | 같음 | 통과 |
| 5 | 3번에서 접힌 줄 클릭 | 다시 펼쳐짐 | 기존 값 | 보인다 | `aria-expanded=true` | 통과 |
| 6 | 5번에서 다시 클릭 | 다시 접힘 | ≥44px | 숨는다 | 값이 그대로 남음 | 통과 |

---

## 6. §4-3 (가)(나) — 어떻게 정했고 왜

**(가) 답을 지워 빈 값이 되면 다시 펼친다** → 이 형태로는 넣지 않았다.
`autoOpenWhen` 이 `false → true` 로 바뀔 때만 펼치고, 되돌아갈 때는 아무것도
하지 않는다. 이유: 사람이 방금 접은 구획을 값 변화로 다시 열면 (나)를 어긴다.
빈 값을 못 보고 넘어가는 문제는 **닫힌 줄에 `· 0개` 를 적어** 해결했다 —
접힌 상태에서도 아직 안 넣었다는 게 보인다.

**(나) 사람이 손으로 조작한 건 코드가 되돌리지 않는다** → 넣었다.
`shared.tsx:65-68` 과 `BodyDiagram.tsx:37-40` 이 둘 다 "없던 것이 생기는
순간"에만 열고, 닫는 코드는 없다. e2e `"사람이 접은 구획을 코드가 다시
펼치지 않는다"` 로 잠갔다.

**측정에서 겪은 함정 (다음 사람에게)**: `git stash` 로 before 를 재면
**같은 값이 나온다.** `npm run build` 가 `tsc --noEmit` 을 먼저 돌리는데,
stash 되지 않은 새 테스트가 stash 된 옛 `shared.tsx` 의 없는 prop 을
참조해 실패하고, `dist/` 가 갱신되지 않아 Playwright 가 새 번들을 그대로
서빙한다. `git worktree add /tmp/before-ux1 HEAD` 로 따로 빌드해야 한다.

---

## 7. §4-5 리뷰 체크리스트 — grep 결과

```
$ grep -c "cubic-bezier" app/src/styles/app.css
1                     # 기대 1 (56번 줄 정의 하나)

$ grep -cE '#[0-9a-fA-F]{3,6}' app/src/styles/app.css
3                     # 기대 3 (708·723·724 인쇄용)

$ grep -c "transition: all" app/src/styles/app.css
0                     # 기대 0

$ grep -rcE "높음|낮음|좋음|나쁨|양호|준비도|위험" app/src/screens/log-entry | grep -v ':0'
EveningCheckin.tsx:2
RaceSelfChecks.tsx:1
FormSec.contract.test.tsx:1   # 금지어를 막는 테스트 자신
                      # 기대 3 = 작업 전과 같음 (D4 로 0 → 3 정정)

$ grep -rn "지도자·보호자" app/src/screens app/src/components | wc -l
8                     # 작업 전과 같음

$ git diff --numstat app/src/components/Motion.contract.test.tsx
39      0             # 추가 39, 삭제 0 — 기존 확인 줄을 지운 게 없다
```

| 확인 | 결과 |
|---|---|
| §4-1·§4-4 각 줄이 실제 파일·줄번호를 가리키는가 | §4 표에 적었다 |
| §4-2 6줄이 테스트 파일에 그대로 들어갔는가 | `FormSec.contract.test.tsx` |
| §4-3 (가)(나)가 코드 주석과 테스트 양쪽에 있는가 | `shared.tsx:20-33`, e2e 1건 |
| `Motion.contract.test.tsx` 삭제 줄 0 | **39 / 0** |
| 새 색·새 가속 곡선 없음 | hex 3, cubic-bezier 1 |
| `transition: all` 없음 | 0건 |
| 접힌 줄이 `<button>` | `expect(toggle.tagName).toBe("BUTTON")` |
| 안전·저장 실패·동의 문구 그대로 | 8건 그대로 |
| 접었다 펼쳤을 때 값이 남는가 | 유닛 1 + e2e 1 |

---

## 8. 시험 결과

```
app  유닛/계약   324 통과 / 36 파일   (기준선 308 → +16: FormSec 12, Motion 4)
app  tsc         exit 0
app  build       성공
app  e2e         155 통과 / 33 건너뜀 / 0 실패   (4개 프로젝트 전부)
impl 유닛        98 통과 / 8 파일     (안 건드렸다. 그대로)
```

e2e 는 기존 147 + 새로 만든 스크롤 검사 → **155 통과, 회귀 0건.**
`touch-targets.spec.ts` · `touch-surfaces.spec.ts` 하나도 깨지지 않았다.
`scrollIntoViewIfNeeded` 같은 우회는 넣지 않았다 (§5-4 금지).

접기 때문에 15개 테스트 질의가 접힌 구획 안을 들여다보고 있었다.
**코딩 전에 grep 으로 먼저 찾아** 뒀고, 기능을 약화시키는 대신 테스트가
실제 사용자와 같은 탭을 한 번 더 하도록 고쳤다.

---

## 9. 목표를 못 맞춘 항목

**없다 — 단, 목표 자체를 두 개 폐기했다.**

| 원본 목표 | 결과 |
|---|---|
| 훈련 후 빈 상태 1.6 화면 | **달성** (오너 자 787px 기준 1.59) |
| 하루 마무리 빈 상태 1.6 화면 | **달성** (1.60) |
| 다 채운 뒤 1.3 / 1.4 화면 | **폐기** — 산술적으로 불가능 (D2) |
| 한 화면 45줄 | **폐기** — 재는 방법 미정의 (D7) |
| 입력칸 21개 테두리 반응 | 달성 |
| 접힘 120ms / 2px / 움직임 줄이기 | 달성 |

폐기한 두 항목은 **"못 했다"가 아니라 "그 형태로는 검사할 수 없다"** 다.
근거는 §0 과 지시서 §0-A 에 있다.

---

## 10. 판단이 필요했으나 하지 않고 남긴 것

1. **§2-1 자동 접기 전체.** D3 충돌 때문에 폐기했지만, "RPE 를 고른 뒤
   버튼 10개를 접는다"는 발상 자체는 −305px 짜리 카드다. 다만 접는 시점을
   사람이 납득할 수 있게 정하는 건 오너 결정이 필요하다.
   → 바꿀 때 고칠 곳: `shared.tsx` `FormSec` + `Motion` 계약 1건 + e2e 상한.

2. **여러 구획이 동시에 접힐 때 애니메이션을 겹칠지 순서대로 할지.**
   지금은 각자 즉시 접힌다. 동시에 접히는 경로가 없으니 문제가 드러나지
   않았을 뿐이다. 오너 확인 필요.

3. **`touch-narrow` 상한을 mobile 과 다르게 둔 것.** 스크롤 영역이
   670px vs 511px 로 달라 같은 화면이 더 길다. 1350 / 1300 의 50px 차이는
   실측 후 여유값으로 정한 것이고 이론적 근거는 없다.

혼자 정하고 넘어가지 않았다. 그게 근거 없는 임계값을 만들어 넣은
오판(`PRODUCT_NORTH_STAR.md` §5 사례 6)이 생긴 방식이다.
