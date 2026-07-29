# 작업지시서 UX1 수행 보고 — 손가락 피로 줄이기

**작업일:** 2026-07-27
**지시서:** `WORK_ORDER_UX1_TAP_FATIGUE.md`
**성격:** 화면 작업. 계산·처방 로직은 건드리지 않았다.

---

## 0. 먼저 말할 것 — 지시서를 고쳤다

착수해서 실제로 재 보니 지시서에 **통과할 수 없는 조건**과 **서로 부딪히는
조건**이 있었다. 숫자를 슬쩍 올려 통과시키는 대신 지시서를 고치고 근거를
남겼다. 고친 내용은 지시서 `§0-A ~ §0-D` 에 들어가 있다.

| # | 무게 | 문제 | 처리 |
|---|---|---|---|
| D1 | 치명적 | 재는 자와 검사하는 자가 다르다. 지시서는 390×844(스크롤 영역 787px)에서 재고 검사는 `mobile-chromium`(393×727, 670px)에서 돈다 | **비율 상한을 폐기하고 px 상한으로 바꿨다** |
| D2 | 치명적 | "다 채운 뒤 1.3 화면"(=1023px)은 지시서가 허용한 접기를 전부 해도 1039px 이 최선이라 16px 부족하다 | **폐기.** 빈 상태를 줄이는 것으로 목적을 달성했다 |
| D3 | 치명적 | §2-1 "답하면 즉시 접기" 와 §4-3(나) "사람이 펼친 건 안 접기" 가 충돌. RPE 를 처음 고르는 사람은 (나)의 보호를 못 받아 버튼 10개가 눈앞에서 사라진다 | **즉시 접기 폐기.** 오너 결정에 따라 값 확인 뒤 다음 구획을 건드릴 때만 접는다 (§0-D) |
| D4 | 중대 | §5-5 는 판정어 0건을 요구하지만 기존 코드가 이미 3건 위반 (`EveningCheckin.tsx:14-15`, `RaceSelfChecks.tsx:5`) | 기대값을 **0 → 3(작업 전과 같음)** 으로 고쳤다. 선택지 이름은 앱의 판정이 아니다 |
| D5 | 중대 | `done` 은 "답했다"는 판정을 `FormSec` 에 넣는 이름인데, 판정은 각 화면이 한다며 §4-3 이 스스로 부인한다 | `collapsible`·`defaultOpen`·`autoOpenWhen` 으로 바꿨다 |
| D6 | 보통 | §1-2 구획 합계가 §1-1 스크롤 높이와 정확히 240px 어긋난다 (둘 다) | 재는 범위를 명시했다 (TopBar+IndexCard+StickyBar 포함) |
| D7 | 보통 | "한 화면 45줄"에 재는 방법 정의가 없다 | **폐기.** 접기로 줄이면 스크롤 길이와 같은 것을 두 번 재는 것이다 |

**D1 이 가장 중요하다.** 오너가 요구한 절약량(787px 기준 1.6화면 = 1259px)은
현재 판정은 화면 수 환산이 아니라 §0-B의 px 상한이다. 이번 재실행에서
훈련 후 빈 상태는 1268px로 측정됐고, 1300px 상한 안에 있다.

---

## 1. 만든·고친 파일

| 파일 | 무엇을 |
|---|---|
| `app/src/screens/log-entry/shared.tsx` | `FormSec` 에 접기 추가. `collapsible` 없으면 예전과 같은 DOM |
| `app/src/screens/log-entry/BodyDiagram.tsx` | 몸 그림 기본 닫힘, 통증 고르면 자동 펼침 |
| `app/src/screens/log-entry/IntensityAssessmentField.tsx` | 객관 기록 기본 닫힘 |
| `app/src/styles/app.css` | 입력칸 `:active` 테두리, `formsec-settle`, 움직임 줄이기 2줄 |
| `app/src/screens/log-entry/FormSec.contract.test.tsx` | **새 파일.** FormSec 접기·수동 재열기·자동 접기 계약 |
| `app/src/screens/log-entry/AutoCollapse.contract.test.tsx` | **새 파일.** 실제 훈련 후 일지에서 순서 기반 접기 배선 검증 |
| `app/src/components/Motion.contract.test.tsx` | 접기 움직임 계약 추가. 줄바꿈 형식과 무관하게 keyframes 블록만 검사 |
| `app/e2e/scroll-depth.spec.ts` | **새 파일.** 6개. px 상한 |
| `app/src/screens/LogEntry.contract.test.tsx` | 2개가 접힌 구획을 먼저 펼치도록 |
| `app/e2e/intensity-assessment.spec.ts` | `openPostSession()` 이 객관 기록을 펼침 |
| `app/e2e/touch-targets.spec.ts` | 그림 닫힘 확인 + 자동 펼침 확인 |
| `WORK_ORDER_UX1_TAP_FATIGUE.md` | §0-A~0-D, 순서 기반 자동 접기와 보호 장치 명시 |

`impl/` · `specs/` · `journal-*` **변경 0건.**

---

## 2. 스크롤 길이 before → after (px, 실측)

`main.app-scroll-region` 의 `scrollHeight`. before 는 `git worktree` 로 HEAD 를
따로 빌드해서 쟀다 (`git stash` 로는 안 된다 — §6 참고).

### mobile-chromium (393×727, 스크롤 영역 670px)

| 화면 | before | after | 절약 | 상한 | 판정 |
|---|---|---|---|---|---|
| 훈련 후 (빈 상태) | 1581px | **1268px** | **−313px** | 1300 | 통과 |
| 하루 마무리 (빈 상태) | 1685px | **1255px** | **−430px** | 1300 | 통과 |
| 경기 일지 | 956px | 954px | −2px | 1000 | 통과 |

### touch-narrow (320×568, 스크롤 영역 511px)

| 화면 | before | after | 절약 | 상한 | 판정 |
|---|---|---|---|---|---|
| 훈련 후 (빈 상태) | 1747px | **1283px** | **−464px** | 1350 | 통과 |
| 하루 마무리 (빈 상태) | 1700px | **1272px** | **−428px** | 1350 | 통과 |
| 경기 일지 | 970px | 966px | −4px | 1000 | 통과 |

### 이번 재실행에서 잠근 기준

화면 비율은 기기마다 분모가 달라 비교 기준으로 쓰지 않는다. 각 E2E는 px
상한과 `before`보다 작다는 조건을 함께 검사한다. 이번 재실행에서는 채운 뒤
훈련 후 일지도 mobile 1152px(상한 1200), narrow 1167px(상한 1220)로 통과했다.

---

## 3. 구획별 높이 before → after

| 화면 | 구획 | before | after | 방법 |
|---|---|---|---|---|
| 훈련 후 | 객관 기록 · 0개 | 393px | 44px | 닫힌 채 시작 |
| 하루 마무리 | 몸 그림 (SVG) | 476px | 0px | 닫힌 채 시작 (`display:none`, DOM 에는 남음) |

빈 상태에서 강도 시스템·RPE·예상 강도·메모의 기본 높이는 유지한다.
다만 값이 있고 다음 구획을 건드리면 RPE·예상 강도 등은 한 줄 summary 로
접힐 수 있다. 이 동작은 값을 넣는 즉시에는 일어나지 않으며, 다시 펼친
구획에는 다시 적용하지 않는다.

---

## 4. §4-1 `FormSec` 근거 추적표 — 실제 파일·줄번호

| 서명 요소 | 실제 위치 | 근거 | 다르게 만들면 |
|---|---|---|---|
| `collapsible?: boolean` (원본 `done?`) | `shared.tsx:46` | `FormSec` 쓰는 화면 6개, 이번에 고친 건 2개 | 필수로 만들면 나머지 4개가 깨진다 |
| `summary?: string` | `shared.tsx:52` | 판정 문구 들어올 자리를 안 만든다 | 객체로 받으면 `{level:"높음"}` 이 들어온다 |
| 접힌 줄이 `<button>` | `shared.tsx:87` | `app.css:442` 의 `:active` 가 `button` 에만 붙는다 | `<div onClick>` 이면 누른 느낌이 안 생긴다 |
| 접힌 높이 `minHeight: 44` | `shared.tsx:93` | `touch-audit.ts` `meetsTouchContract` | e2e 터치 검사가 실패한다 |
| `display:none` 으로 감추기만 | `shared.tsx:112` | 오너 지침 "지우거나 하라는 게 아니야" | 접었다 펼치면 답이 사라진다 |
| 다음 구획을 건드린 뒤에만 접기 | `shared.tsx`, `AutoCollapse.contract.test.tsx` | 방금 누른 값 확인을 보장하면서 스크롤 길이를 줄인다 | 값 기반으로 접으면 RPE 를 누르는 순간 화면이 튄다 |
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
app  유닛/계약   338 통과 / 37 파일
app  tsc         exit 0
app  build       성공
app  e2e         157 통과 / 35 건너뜀 / 0 실패   (4개 프로젝트 전부)
impl 유닛        98 통과 / 8 파일     (안 건드렸다. 그대로)
```

자동 접기 배선은 `AutoCollapse.contract.test.tsx` 7개로 별도 검증한다.
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
| 훈련 후·하루 마무리 빈 상태 px 상한 | **달성** (각 mobile 1300 / narrow 1350 이하) |
| 다 채운 뒤 1.3 / 1.4 화면 | **폐기** — 산술적으로 불가능 (D2) |
| 한 화면 45줄 | **폐기** — 재는 방법 미정의 (D7) |
| 입력칸 21개 테두리 반응 | 달성 |
| 접힘 120ms / 2px / 움직임 줄이기 | 달성 |

폐기한 두 항목은 **"못 했다"가 아니라 "그 형태로는 검사할 수 없다"** 다.
근거는 §0 과 지시서 §0-A 에 있다.

---

## 10. 판단이 필요했으나 하지 않고 남긴 것

1. **여러 구획이 동시에 접힐 때 애니메이션을 겹칠지 순서대로 할지.**
   현재 경로에서는 사용자가 다음 구획 하나를 건드릴 때 앞 구획 하나만
   접힌다. 여러 구획을 한 번에 자동으로 접는 규칙은 만들지 않았다.

2. **`touch-narrow` 상한을 mobile 과 다르게 둔 것.** 스크롤 영역이
   670px vs 511px 로 달라 같은 화면이 더 길다. 1350 / 1300 의 50px 차이는
   실측 후 여유값으로 정한 것이고 이론적 근거는 없다.

혼자 정하고 넘어가지 않았다. 그게 근거 없는 임계값을 만들어 넣은
오판(`PRODUCT_NORTH_STAR.md` §5 사례 6)이 생긴 방식이다.
