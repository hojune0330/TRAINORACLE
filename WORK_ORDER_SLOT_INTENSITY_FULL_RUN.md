# WORK_ORDER_SLOT_INTENSITY_FULL_RUN.md

```yaml
doc_id: TRAINORACLE_WORK_ORDER_SLOT_INTENSITY_FULL_RUN
title: "슬롯·강도 결정 전체 반영 — 중간 리뷰 없이 S-1~S-6 연속 수행"
issued_by: 오너 지시 2026-08-06 ("불필요한 중간 리뷰 없이 최대한 다 진행하게 하는 방안")
issued_date: "2026-08-06"
status: ISSUED
base_commit: "main 최신 (착수 시 `git log -1` 로 확인)"
implementation_branch: codex/slot-intensity-full-run
review_mode: SINGLE_REVIEW_AT_END
required_report: reports/review/WORK_ORDER_SLOT_INTENSITY_FULL_RUN_REPORT.md
supersedes:
  - WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md   # S-1로 흡수
  - WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md      # S-2로 흡수
```

> **먼저 읽을 것 (순서대로, 전부).**
> 1. [`OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`](OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md)
> 2. [`AGENTS.md`](AGENTS.md) §5(비공허성·`npx tsc` 금지), §7(판단 보류)
> 3. [`WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md`](WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md) — **S-1의 상세 명세. 좌표까지 그대로 쓴다**
> 4. [`WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md`](WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md) — **S-2의 상세 명세**
>
> 이 문서는 그 두 지시서를 **대체하지 않고 감싼다.** 세부 좌표·코드 예시는 그쪽에
> 있다. 이 문서는 **순서·경계·정지 조건·검증**을 정한다. 충돌하면 **이 문서가 이긴다.**

---

## 0. 이 지시서의 운영 방식 — 읽고 시작해라

오너 지시: **중간 리뷰 없이 끝까지 진행하고, 마지막에 한 번 리뷰한다.**

| | 방식 |
|---|---|
| 브랜치 | `codex/slot-intensity-full-run` 하나. 단계마다 브랜치를 새로 파지 마라 |
| 커밋 | **단계(S-n)마다 1커밋 이상.** 단계를 한 커밋에 뭉치지 마라 |
| 푸시 | **커밋마다 즉시 푸시.** 샌드박스가 리셋되면 잃는다 |
| PR | **S-6까지 끝난 뒤 한 번만** 생성. 중간에 만들지 마라 |
| 리뷰 요청 | **하지 마라.** §9 정지 조건에 걸릴 때만 멈추고 물어라 |
| 보고 | 단계마다 보고서에 누적 기록. 마지막에 한 번 제출 |

**"이거 맞나요?" 라고 묻지 말고 §9를 봐라.** §9에 없으면 지시서대로 진행한다.
§9에 있으면 **그 단계에서 멈추고** 그때까지의 커밋을 푸시한 뒤 보고한다.

### 0.1 착수 전 준비 — S-1을 시작하기 전에 이걸 먼저 해라

중간 리뷰가 없으므로 **환경 문제로 중간에 막히면 시간을 그대로 잃는다.**
순서대로 한 번에 끝내라.

```bash
# 1. 최신 main 확인 및 브랜치
git checkout main && git pull && git log -1
git checkout -b codex/slot-intensity-full-run

# 2. 두 패키지 의존성을 지금 설치한다 (S-2에서 impl 없으면 §8.2 함정에 빠진다)
cd app  && npm ci
cd ../impl && npm ci

# 3. 🔴 테스트 기준선을 지금 떠 둔다 (나중에 뜨면 내가 만든 실패가 섞인다)
#    app 은 UTC 패스와 KST 패스가 따로 있다. 둘 다 떠라 (§8.3)
cd ../app && npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL" | sed 's/^ FAIL  //' | sort -u > /tmp/base-utc.txt
cd ../app && npx vitest run -c vitest.config.kst.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL" | sed 's/^ FAIL  //' | sort -u > /tmp/base-kst.txt
wc -l /tmp/base-utc.txt /tmp/base-kst.txt    # 이 숫자들을 보고서에 적어라
cd ../impl && npx vitest run  # 착수 시점에 전부 통과해야 정상

# 4. 실체 컴파일러 확인 (npx tsc 아님)
cd ../impl && ./node_modules/.bin/tsc --noEmit
```

**`/tmp/base-*.txt`는 샌드박스가 리셋되면 사라진다.**
그러니 **줄 수와 내용을 보고서에 바로 붙여 놓아라.**

**먼저 읽을 문서 (순서대로, 전부):**
1. `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` — 특히 **§4.9**
2. `AGENTS.md` — 특히 **§5**(`npx tsc` 금지)
3. `WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md` — S-1 상세 좌표
4. `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` — S-2 상세 좌표
5. `INCOMPLETE_WORK_BACKLOG.md` — B-11 · B-13 · B-15

---

## 1. 전체 순서 — 이 순서를 바꾸지 마라

| 단계 | 내용 | 사용자에게 보이는 변화 | 근거 |
|---|---|---|---|
| **S-1** | 훈련 시간대 질문 추가 (6→7문항) | 질문이 하나 늘어난다. 계획 내용은 그대로 | 오너 승인 |
| **S-2** | 생성기 오전 고정 해제 | (아직 없음 — S-3과 함께 나타난다) | OD-SLOT-1·2 |
| **S-3** | 저장 관문 개정 | **저녁 훈련자가 오후 고강도 계획을 받는다** | OD-SLOT-2·3·7 |
| **S-4** | 화면 문구 정정 | 약속과 실제가 일치한다 | C-6 |
| **S-5** | 기록 상세 접근성 | 스크린리더 사용자가 버튼을 구분한다 | B-11 |
| **S-6** | leaf 스키마 좌표 유일성 | (내부 방어) | B-13 |

### 🔴 S-2와 S-3은 같은 PR에 있어야 한다 — 실측 근거

**나는 앞선 지시서에서 "생성기와 저장 관문을 따로 하라"고 썼다. 그건 틀렸다.**
실측했더니 S-2만 병합하면 **앱이 깨진 상태로 배포된다.**

`app/src/domain/plan-beta-schema.ts`의 저장 관문에 실제 계획 데이터를 넣어 측정한 결과
(fixture 유효성은 대조군 통과로 확인했다):

| 계획 패턴 | 현재 저장 관문 |
|---|---|
| 오전 가벼운 + 오후 회복(RPE1-2) | 통과 ← **지금 유일하게 되는 조합** |
| **오전 고강도 + 오후 가벼운** (OD-SLOT-2 주 패턴) | **거부** |
| **오후 고강도 + 오전 가벼운** (EVENING 사용자) | **거부** |
| **오후 고강도 단독** (EVENING + 하루 한 번) | **거부** |
| **오후 가벼운훈련 단독** (EVENING + 가벼운 날) | **거부** |
| 오후 회복 + CONSERVATIVE 후보 (통증 있는 사용자) | **거부** |

거부되면 `savePlanBetaState()`가 `PLAN_STORAGE_WRITE_FAILED`를 돌려주고,
화면에는 **"계획을 이 기기에 저장하지 못했어요"** 가 뜬다
(`app/src/screens/PlanBeta.tsx:212`).

그리고 `main`에 푸시되면 `ci.yml`의 `deploy-pages`가 **자동 배포한다.**
즉 S-2만 병합하면 **저녁 훈련을 고른 사용자는 계획을 아예 못 만든다.**

**해결:** S-2와 S-3을 **별개 커밋으로, 같은 PR에** 담는다.
- 커밋이 분리돼 있으므로 원인 추적(bisect)은 그대로 가능하다
- `main`이 깨진 상태를 **한 순간도** 거치지 않는다

> **"S-2 끝났으니 PR 올려서 확인받을까요" 하지 마라.** 그게 정확히 사용자를
> 망가진 화면에 노출시키는 경로다.

---

## 2. S-1 — 훈련 시간대 질문 (6문항 → 7문항)

**명세:** `WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md` **전체를 그대로 수행한다.**
§3(질문 설계) · §4.1~4.7(좌표) · §6(T-A~T-G) 전부 유효하다.

요약만 다시 적는다. 상세는 그 문서를 봐라.

- 질문 위치: `days` 다음, `two-a-day` 앞 (5번째)
- 값: `MORNING` / `EVENING` / `VARIES`, 기본 `VARIES`
- 경로 6단: 엔진 타입 → 저장 스키마 → (앱 타입은 자동) → 화면 → 단계 진행 → `completeIntake`
- 🔴 `.optional().default("VARIES")` 누락 시 **기존 사용자 계획 전부 소실**
- 🔴 `completeIntake()`는 필수 검사 유지 (조용한 기본값 금지)
- `/6` 하드코딩 3곳 (`PlanIntake.tsx:118,119,120`) 전부 `/7`로
- 🔴 필수 필드로 넣으면 **기존 호출 3곳이 타입 에러로 깨진다.**
  실측 좌표와 처리 방법은 **§4.6의 "S-1이 깨뜨릴 기존 테스트"** 표를 봐라

**S-1 완료 시점의 불변식:** 계획 생성 결과가 S-1 이전과 **완전히 같다.**
값을 받아 엔진까지 전달하되 아직 아무도 읽지 않는다. (C3A0 §6 T-F)

**커밋:** `feat(plan-intake): 훈련 시간대 질문 추가 (S-1)`

---

## 3. S-2 — 생성기 오전 고정 해제

**명세:** `WORK_ORDER_PM_QUALITY_GENERATOR_C3A.md` **전체.** 개정판(2026-08-06)을 봐라.

요약:

- `qualitySlotFor(input, day)` 분리. `trainingTimePreference`를 읽는다
  - `EVENING` → `"PM"` / `MORNING`·`VARIES` → `"AM"`
  - **`default:` 절 금지** (값이 늘면 타입체커가 잡아야 한다)
  - **`day`로 슬롯을 흔들지 마라**
- `counterpartSessions()` — 고강도 날의 **반대 슬롯**에 가벼운 훈련
  - `secondSessionMode !== "RECOVERY_PM_ALLOWED"`면 만들지 않는다
  - **`"PM"`을 리터럴로 쓰지 마라.** `qualitySlot === "AM" ? "PM" : "AM"`
  - RPE는 `rpeForIntent("RECOVERY_INTENT")`를 거친다. 숫자 직접 금지 (OD-SLOT-5)
- 🔴 `recoverySecondSessionDays()`의 `limit = 2`는 **프레임 전체 상한으로 바뀐다.**
  고강도 날의 짝을 먼저 채우고 **남은 몫만** 회복 PM에 쓴다 — **반드시 §3.1을 읽어라.**
  (C3A `:217`의 *"고강도 날에 적용하지 않는다"* 는 **철회됐다**)
- 새 role 추가 금지 (OD-SLOT-4). `REST`/`EASY`/`QUALITY` 3종 유지
- 하루 2회 고강도 생성 금지 (OD-SLOT-3 기본값)

### 3.1 🔴 프레임 훈련량 상한 — S-2가 조용히 훈련량을 늘린다

위 `counterpartSessions()`는 **고강도 날마다 세션 한 건을 더 만든다.**
그런데 고강도 날은 **이미 `recoverySecondSessionDays()`의 `limit = 2`와 별개로**
존재한다. 즉 두 장치가 더해진다. **실측했다** (`generatePlanFromDraft`,
`RECOVERY_PM_ALLOWED`, BALANCED, 420개 조합 전수):

| 현재 하루 2회 날 | S-2 후 | 조합 수 | 비중 |
|---|---|---|---|
| 0일 | 0일 | 60 | 고강도가 없는 조합 (`RECOVERY_INTENT`·`BASE_INTENT`) |
| 2일 | 2일 | 60 | 같음 |
| 2일 | **3일** | 140 | 고강도 1일 |
| 2일 | **4일** | 160 | 고강도 2일 |

**420조합 중 300건(71%)이 하루 2회 날 3일 이상이 된다.**

최악 사례 (`MIDDLE_DISTANCE`/`DEVELOPING`/가능 4일/`LT_INTENT`):

```
DAY1  AM EASY BASE(RPE3-4)   / DAY1  PM EASY RECOVERY(RPE1-2)
DAY4  AM QUALITY LT(RPE5-6)                    ← S-2가 여기에 PM 추가
DAY7  AM EASY BASE(RPE3-4)   / DAY7  PM EASY RECOVERY(RPE1-2)
DAY10 AM QUALITY LT(RPE5-6)                    ← S-2가 여기에 PM 추가
→ 훈련 6건 → 8건, 하루 2회 날 2일 → 4일
```

**사용자가 "운동 가능한 날 4일"이라고 답했는데 그 4일 전부가 하루 두 번이 된다.**
(질문은 *"이번 계획에서 운동할 수 있는 날은 며칠인가요?"* 이고 프레임은 9.5일이다.
9.5일 중 4일이며 **"일주일에 4일"이 아니다** — 이전 판 문장이 과장이었다.
`spreadTrainingDays(4) = [1,4,7,10]`.)

#### 이건 사양 상한을 넘는다

`DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` `DSB-INV-005`:
*"Balanced는 7일 프레임에 PM 최대 1건, 9·10일 프레임에 최대 2건."*
실측 프레임은 전부 `9.5`일 → **상한 2건인데 4건이 된다.**

`DSB-INV-002`/`003`은 오너 결정(OD-SLOT-1·2)이 폐기했다(§4.6b).
**하지만 `DSB-INV-005`는 폐기 대상이 아니다.** 어떤 오너 결정도
"하루 두 번 빈도를 늘려라"라고 말하지 않았다. OD-SLOT-2는 정반대다 —
*"고강도 오전오후 가능하긴 한데, 사용자가 직접 지정하지 않는 한
하루에는 되도록 한번 유지."* 이건 **하루 안의 강도 얘기**이고, 여기서 늘어나는 건
**하루 두 번인 날의 수**다. 오너 결정이 다룬 적 없는 축이다.

#### 그래서 S-2에서 이렇게 해라 — 총량을 보존한다

```
고강도 날에 반대 슬롯 세션을 추가할 때,
"기존 회복 PM 날 + 고강도 날"의 합이 프레임 상한을 넘으면
→ 기존 회복 PM 날을 먼저 줄여서 총량을 유지한다.
```

- 상한: **7일 프레임 1일 / 9·10일(9.5 포함) 프레임 2일** (`DSB-INV-005` 숫자 그대로)
- 세는 단위는 **하루 두 번인 "날"의 수**다. 세션 건수가 아니다
- **고강도 날의 반대 슬롯 세션이 우선이다.** 줄이는 쪽은
  `recoverySecondSessionDays()`가 만든 순수 회복 PM 날이다
  (고강도 날의 짝은 고강도 자체를 지우지 않고는 못 줄인다)
- 결과적으로 `limit = 2`는 **"고강도 날에 적용하지 않는다"가 아니라
  "고강도 날을 먼저 채우고 남은 몫만 회복 PM에 쓴다"** 가 된다.
  **C3A `:217`의 원문은 철회됐다** (그 문서에도 철회 표시를 넣어 뒀다)

**최악 사례가 이렇게 바뀐다:** 고강도 날 2일(DAY4·DAY10)이 상한 2를 다 쓰므로
DAY1·DAY7의 회복 PM은 만들지 않는다 → 하루 2회 날 **2일 유지**, 훈련 6건 유지.

#### 고정해야 하는 테스트 (impl, S-2 커밋에 포함)

| ID | 무엇을 고정 |
|---|---|
| G-20 | 9.5일 프레임 BALANCED에서 **하루 2회 날 ≤ 2일** — 위 최악 조합으로 |
| G-21 | 고강도 날이 2일이면 **순수 회복 PM 날은 0일** (고강도 짝이 상한을 다 씀) |
| G-22 | 고강도 날이 0일이면 회복 PM 날은 **종전과 동일** (회귀 없음) |
| G-23 | `SINGLE_SESSION_ONLY`면 **PM 세션 0건** (`DSB-INV-001`) |

**G-22가 비공허성 대조군이다.** G-20·G-21만 쓰면 "다 0으로 만들기"로도
통과한다. §4.7과 같은 함정이다.

> **🛑 상한 규칙을 넣었는데도 하루 2회 날이 상한을 넘으면 §9-14로 멈춰라.**
> 훈련량은 안전 문제다. "일단 통과시키고 나중에" 하지 마라.

**S-2 완료 시점:** impl 테스트는 초록. **app 저장 경로는 아직 거부한다.**
그게 정상이다. S-3에서 연다. **S-2에서 저장 관문을 고치지 마라.**

**커밋:** `feat(plan-generator): 고강도 슬롯을 훈련 시간대로 결정 (S-2)`

---

## 4. S-3 — 저장 관문 개정 🔴 이 단계가 가장 위험하다

### 4.1 무엇을 바꾸는가

`app/src/domain/plan-beta-schema.ts` `planBetaStateSchema.superRefine`.

**검사를 없애는 게 아니다. 대상을 바꾸는 것이다.**

| 현재 (실측) | 개정 후 |
|---|---|
| `:83-91` PM은 `EASY`+`RECOVERY_INTENT`+RPE1-2 아니면 거부 (C-4) | **슬롯으로 역할을 제한하지 않는다** |
| `:108-113` 같은 날 PM+QUALITY 공존 거부 (C-5) | **하루 `QUALITY` 2개 이상이면 거부** |
| `:92-94` PM인데 `secondSessionMode`가 동의 안 했으면 거부 | **하루 2세션인데 동의 없으면 거부** ← 조건 주체 변경 |
| `:95-100` PM인데 `CONSERVATIVE`거나 회복의도면 거부 | **삭제** (§4.3) |
| `:104-107` 하루 3세션 이상 거부 | **그대로 유지** |
| `:76-79` (day,slot) 중복 거부 | **그대로 유지** |
| `:116-123` 진행 기록 좌표 대응 | **그대로 유지** |

### 4.2 왜 `secondSessionMode` 검사의 주체를 바꾸는가

현재는 **"PM 세션이 있으면 동의 필요"** 다. 이건 "PM = 두 번째 세션"이라는
가정에 서 있다. **그 가정이 OD-SLOT-1로 깨졌다.**

저녁에 훈련하는 사람이 **하루 한 번** 운동하면 그건 PM 1세션이다. 두 번째 세션이
아니다. 동의를 물을 이유가 없다. 실측에서 이 패턴이 거부됐다(§1 표 4·5행).

→ **동의 검사는 "그 날 세션이 2개인가"에 걸어라.** 슬롯 이름에 걸지 마라.

### 4.3 왜 `PM plan authority` 검사를 삭제하는가

`:95-100`은 PM 세션이 있을 때 `candidateKind`가 `BALANCED`이고 선택 의도가
`RECOVERY_INTENT`가 아니어야 한다고 요구한다.

이것도 "PM = 회복 2부"라는 폐기된 가정이다. 통증이 있어 `CONSERVATIVE` 후보를
받은 저녁 훈련자는 **오후 세션 자체를 가질 수 없게 된다**(§1 표 6행). 부당하다.

**하루 2회를 통제하는 규칙은 §4.1의 다른 세 줄(세션 수·고강도 수·동의)로
충분하다.** 슬롯 이름에 건 검사는 지운다.

> **삭제 전에 이 검사를 근거로 삼는 기존 테스트가 있는지 grep해라.**
> 있으면 **끄지 말고 개정해라** — 무엇을 고정하려던 테스트인지 보고서에 적어라.

### 4.4 하루 2회 고강도는 여전히 막는다 (OD-SLOT-3)

오너 결정: *"고강도 오전오후 가능하긴 한데, 사용자가 직접 지정하지 않는 한
하루에는 되도록 한번 유지."*

**지정하는 입구(수정·확정 플로우)는 아직 없다.** 입구가 없으므로 지정도 없다.
→ 하루 `QUALITY` 2개는 **거부한다.** 나중에 입구가 생기면 그때 조건을 완화한다.

**"미리 열어두자" 하지 마라.** 지정 경로 없이 열면 사용자가 요청하지 않은
고강도 2회가 통과할 수 있다.

### 4.5 OD-SLOT-7 — 권장은 강제가 아니다

*"회복만 들어가지 않도록. 다만 권장은 휴식 또는 회복운동 허용 이런 느낌으로 하자."*

저장 관문은 **거부 여부만** 판단한다. 권장은 **생성기(S-2)가 기본값으로 표현**하고,
**문구(S-4)가 설명**한다. **저장 관문에서 권장을 강제로 바꾸지 마라.**
"권장이 아닌 조합"을 거부하면 그건 권장이 아니라 강제다.

### 4.6 검증 — S-3에서 반드시 고정할 것

| ID | 고정할 것 |
|---|---|
| **G-1** 🔴 | 오전 고강도 + 오후 가벼운 훈련이 **통과**한다 (OD-SLOT-2 주 패턴) |
| **G-2** 🔴 | 오후 고강도 + 오전 가벼운 훈련이 **통과**한다 (EVENING) |
| **G-3** 🔴 | 오후 고강도 **단독** + 하루한번선택이 **통과**한다 |
| **G-4** | 오후 가벼운훈련 단독 + 하루한번선택이 **통과**한다 |
| **G-5** | 오후 세션 + `CONSERVATIVE` 후보가 **통과**한다 |
| **G-6** 🔴 | 하루 `QUALITY` 2개는 **거부**된다 (OD-SLOT-3) |
| **G-7** 🔴 | 하루 2세션인데 `SINGLE_SESSION_ONLY`면 **거부**된다 (동의 없는 추가 금지) |
| **G-8** | 하루 3세션 이상은 **거부**된다 (기존 유지) |
| **G-9** | 같은 `(day,slot)` 중복은 **거부**된다 (기존 유지) |
| **G-10** 🔴 | **S-2 생성기의 실제 출력이 저장 관문을 통과한다** — 생성기를 직접 호출해 그 결과를 그대로 넣어라. 손으로 만든 fixture로 대신하지 마라 |

> **G-10이 이 작업 전체의 핵심 검증이다.** 나머지가 다 초록이어도 G-10이
> 실패하면 사용자는 계획을 만들 수 없다.

#### 🔴 G-10을 어떻게 쓰는가 — 정확한 진입점

**엔진(`generatePlanCandidates`) 요청을 손으로 조립하지 마라.**
내가 그렇게 해 봤고 `{"kind":"rejected","code":"INVALID_JOURNAL_CONTEXT"}`를 받았다.
`journalSource`·`safetyGate`·`continuity`를 앱이 채워 주는데 그걸 빼먹었기 때문이다.
**그 상태로 "관문이 거부하네"라고 결론 내면 완전히 틀린 진단이 된다.**

**올바른 진입점은 앱 계층 함수다:**

```ts
// app/src/domain/plan-beta-flow.ts
import { generatePlanFromDraft } from "./plan-beta-flow"

const result = generatePlanFromDraft(
  {
    eventGroup: "MIDDLE_DISTANCE",
    experienceBand: "DEVELOPING",
    availableDayCount: 4,
    requestedFrameLength: 9,
    trainingFocus: "LT_INTENT",
    secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "EVENING",     // ← S-1이 추가한 필드
  },
  "NO_KNOWN_RISK",
)
expect(result.kind).toBe("generated")      // 여기서 먼저 막히면 §4.7 문제다
```

- **`beforeEach`에서 `localStorage`·`sessionStorage`를 비워라.**
  `loadPreviousContinuity()`가 읽는다. 안 비우면 테스트 순서에 따라 결과가 달라진다
- 그 다음 `selectPlanForActivation(...)` → `savePlanBetaState(...)` 까지 태워야
  **저장 관문을 실제로 통과한 것**이다. `parsePlanBetaState`만 부르면 leaf만 본다
- 베낄 수 있는 최소 템플릿: `app/src/domain/plan-beta-flow.contract.test.ts:9-38`

#### 🔴 S-1이 깨뜨릴 기존 테스트 — 미리 알고 있어라

`trainingTimePreference`를 **필수 필드**로 넣으면 `generatePlanFromDraft`를
부르는 기존 테스트가 타입 에러로 전부 깨진다. **실측한 호출 지점:**

| 파일 | 줄 | 비고 |
|---|---|---|
| `app/src/domain/plan-beta-flow.contract.test.ts` | `:22` | draft는 `:12-19` |
| `app/src/domain/restore/decoration-backup.contract.test.ts` | `:281`, `:290` | draft는 `:268-277` |
| `app/src/screens/PlanBeta.tsx` | `:183` | 실제 화면 경로 |

**`decoration-backup.contract.test.ts`는 특히 조심해라.** 이 테스트는
`:295`에서 **`payloadsBefore`와 `payloadsAfter`가 완전히 같아야 한다**고
단정한다(꾸미기 상태가 계획 출력에 새지 않는지 확인). 즉 같은 draft로 두 번
호출해 **JSON이 바이트 단위로 같기**를 요구한다. S-2가 슬롯 결정에 무작위성이나
시각 의존성을 넣으면 **여기서 터진다.** §3의 *"`day`로 슬롯을 흔들지 마라"* 가
왜 있는지가 이것이다.

**세 곳 모두 draft에 필드를 추가해서 고쳐라. 테스트를 삭제하거나
`as never`로 타입을 뭉개지 마라.**

### 4.6b 🔴 사양 문서(`DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`)와의 관계

S-3이 지우는 검사들은 **아무 근거 없이 만들어진 게 아니다.**
`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`의 불변식을
그대로 구현한 것이다. 대응은 이렇다:

| 사양 불변식 | 현재 코드 | S-3 후 |
|---|---|---|
| `DSB-INV-002` PM은 `EASY`+`RECOVERY_INTENT`+RPE1-2 전용 | `:83-91` | **폐기** — OD-SLOT-1·2가 우선 |
| `DSB-INV-003` 같은 날 quality 짝 금지 | `:108-113` | **폐기** — OD-SLOT-2가 우선 |
| `DSB-INV-001` `RECOVERY_PM_ALLOWED` 없으면 PM 없음 | `:92-94` | **주체 변경** — "PM 있으면"→"하루 2세션이면" |
| `DSB-INV-004` `(day,slot)` 유일 | `:76-79` | **유지** (S-6이 leaf에도 추가) |

**폐기 근거는 `AGENTS.md:206-207`과 결정 문서 §3에 이미 적혀 있다.**
오너 결정이 초안 사양보다 우선한다(`FORMATION_LATEST_OWNER_DECISION_BASELINE.md` 10항).
**네가 새로 판단할 사항이 아니다. 이미 결정됐다.**

**단, 사양 문서를 지우거나 고치지 마라.** 지금 범위가 아니다.
대신 **보고서에 위 표를 그대로 옮겨 적어라** — 나중에 이 코드를 보는 사람이
"사양과 다른데?" 하고 되돌리는 것을 막는 유일한 장치다.

#### 🔴 DSB-INV-008은 폐기되지 않았다 — 오후 고강도에도 적용된다

`DSB-INV-008`: *"PM output may show only duration range, RPE range, intent,
and plain-language guidance. It must not show derived pace, repetitions,
distance, or recovery intervals."*

이건 오너 결정과 **충돌하지 않는다.** 그리고 현재 코드는 자동으로 만족한다 —
`qualityTrainingSession()`이 `RPE_TIME_RANGE`만 만들고 페이스·거리·반복은
아예 넣지 않는다(`session-builder.ts:131-149`).

**즉 S-2에서 처방 모양을 바꾸지 않는 한 저절로 지켜진다.
처방에 새 필드를 넣지 마라.** 넣어야 할 것 같으면 §9-13에 걸린다.

#### 🔴 사양 §6 표기 요구 — "오후 세션은 회복 세션이라 불러야 한다"

`DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` §6: *"A PM session must be called an
afternoon recovery session, not a second workout."*

**오후에 고강도가 갈 수 있게 되면 이 표기 요구는 성립하지 않는다.**
다행히 화면 구현은 이미 안전하다 — `labels.ts:170-179` `sessionSlotLabel()`은
`"오전"`/`"오후"`만 돌려주고 역할 설명은 `sessionIntentLabel()`·
`sessionGuidance()`가 **세션의 실제 의도로부터** 만든다. 슬롯 이름에
"회복"을 박아 넣은 곳은 없다.

**따라서 S-4에서 `sessionSlotLabel()`을 건드릴 필요가 없다.**
`"오후"`를 `"오후 회복"` 같은 걸로 바꾸지 마라 — 그게 정확히 거짓말이 된다.

### 4.7 🔴 fixture 유효성을 먼저 증명해라 — 내가 실제로 틀렸던 부분

저장 관문 테스트를 쓸 때 **fixture가 엉뚱한 이유로 거부되고 있는데
"규칙이 막았다"고 착각하기 쉽다.**

나는 이번에 실제로 이 함정에 빠졌다. `activePlan`에 `kind: "ACTIVE_PLAN"`을
넣었는데 실제 스키마는 `"BETA_ACTIVE_PLAN_SNAPSHOT"`을 요구했고
(`plan-session-schema.ts:147-157`), `candidateId`·`selectionActor`·`sourceMode`·
`frame`도 빠져 있었다. 6개 패턴이 전부 "거부"로 나왔고 나는 하마터면
그걸 결론으로 보고할 뻔했다.

**막아준 것은 대조군이었다.** "지금 통과해야 정상인 조합"을 같이 넣었더니
그것도 거부됐다 → fixture가 잘못됐다는 게 드러났다.

**규칙:** 저장 관문 테스트에는 **반드시 통과 기대 케이스를 1건 이상 넣어라.**
전부 거부 기대인 테스트 파일은 아무것도 증명하지 못한다.

**커밋:** `feat(plan-storage): 저장 관문을 슬롯 기준에서 세션 수 기준으로 개정 (S-3)`

---

## 5. S-4 — 화면 문구 정정 (C-6)

**🔴 고칠 곳은 한 곳이 아니라 세 곳이다.** 전부 실측해서 확인했다.

**(1) `PlanIntake.tsx:200-203`** — 선택지 카드:
```
title="일부 날은 하루 두 번 운동"
detail="오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"   ← 거짓이 된다
```

**(2) `PlanIntake.tsx:84`** — 같은 질문의 `STEP_META` 본문. **여기가 더 길고 더 단정적이다:**
```
copy: "선택하면 일부 날에 오전 기본 훈련과 오후 회복 운동을 나눠 보여줘요.
       오후 운동은 RPE 1~2이고, 고강도 두 번이나 놓친 운동 보충은 만들지 않아요."
```

**(3) `app/src/domain/glossary.ts:141-145`** — `two-a-day` 용어 설명.
`:84`의 `helpTerm="two-a-day"`가 여기를 가리킨다. **확인했다, 실제로 있다:**
```
label:  "하루 두 번 운동"
short:  "한 날의 운동을 오전과 오후로 나누는 방식이에요."          ← 이건 사실. 유지
detail: "이 베타에서는 직접 선택했을 때만 일부 날에 오전 기본 훈련과
         오후 RPE 1~2 회복 운동을 보여줘요. 오후 운동은 고강도 훈련,
         놓친 운동 보충, 의료적 회복 판단이 아니며 날짜별 캘린더
         배정도 하지 않습니다."                                  ← 거짓이 된다
```
**`detail`에서 거짓이 되는 것은 두 조각뿐이다:**
*"오전 기본 훈련과 오후 RPE 1~2 회복 운동"* / *"오후 운동은 고강도 훈련 (…) 아니며"*.
**나머지는 전부 여전히 사실이니 지우지 마라:**
- *"직접 선택했을 때만"* = `DSB-INV-001` (동의 필요) — **사실**
- *"놓친 운동 보충 (…) 아니며"* = `DSB-INV-007` (보충 금지) — **사실**
- *"의료적 회복 판단이 아니며"* = 의료 주장 금지 — **사실**
- *"날짜별 캘린더 배정도 하지 않습니다"* = 프레임은 DAY 번호 기반 — **사실**

`:84`와 `glossary.ts:144`를 놓치기 쉽다. `:201`만 고치면
**같은 화면에서 세 문장이 서로 다른 말을 한다.** 그러니 전수 확인부터 해라:
```bash
grep -n "오후" app/src/screens/plan-beta/PlanIntake.tsx
grep -rn "RPE 1~2\|오후 회복\|회복 운동" app/src app/e2e
```

**`:84`에서 살려야 하는 부분이 있다.** *"놓친 운동 보충은 만들지 않아요"* 는
`DSB-INV-007`(보충 금지)이고 **여전히 사실이다.** 지우지 마라.
거짓이 된 것은 *"오전 기본 + 오후 회복"* 과 *"오후 운동은 RPE 1~2"* 뿐이다.

S-3까지 끝나면 이 문장들은 **사실이 아니다.** 오후에 고강도가 갈 수 있고,
반대 슬롯이 오전일 수도 있다.

### 문구 방향 (확정 문구는 실제 동작을 보고 정한다)

- "오전/오후"를 **고정으로 말하지 마라.** 시간대는 사용자가 고른다
- 두 번째 세션은 **권장이 가벼운 훈련·휴식**이라고 말하되, **"만"** 이라고 하지 마라 (OD-SLOT-7)
- `RPE 1~2` 같은 내부 수치를 약속으로 박지 마라. 강도 범위는 계획에서 보여준다
- **`RECOVERY_PM_ALLOWED` 내부 값은 개명하지 마라.** 저장된 사용자 데이터다
- **`labels.ts`의 `sessionSlotLabel()`은 건드리지 마라.** 이미 `"오전"`/`"오후"`만
  돌려주므로 정확하다. 여기에 "회복"을 붙이면 새 거짓말이 된다 (§4.6b)
- **`glossary.ts:141-145`도 고쳐라. 확인했다 — 세 번째 거짓 약속이 여기 있다**
  (아래 (3) 참조). **새 용어 추가는 금지(§9-7), 기존 설명 정정은 범위 안이다**

**S-3 이후에만 해라.** 런타임보다 문구를 먼저 고치면 거짓말의 방향만 바뀐다.

**검증:** 기존 e2e `launch-ready.spec.ts:97`이 `/오후 회복/`을 기대한다.
문구가 바뀌면 **깨진다. 끄지 말고 개정해라.**

**커밋:** `fix(plan-intake): 하루 두 번 운동 문구를 실제 동작에 맞춤 (S-4)`

---

## 6. S-5 — 기록 상세 접근성 (B-11)

앞 단계와 **독립**이다. 슬롯 작업과 섞지 마라.

**실측 (main 최신):** `app/src/screens/LogDetail.tsx` 262줄,
`grep -c "aria-label"` = **1** (`:116-128` 되돌리기 버튼뿐).
`<button>`은 그 1개가 전부다.

**즉 `WORK_ORDER_UX2` §4-1이 지목한 "수정·삭제·뒤로·메모 열기" 버튼들이
이 파일에 아예 없다.**

### 그래서 할 일

1. **먼저 실제 인터랙티브 요소를 전수 조사해라.** `LogDetail.tsx`와 그것이
   렌더하는 하위 컴포넌트까지. 버튼이 다른 파일에 있을 수 있다
2. 접근 이름이 없거나 모호한 요소에 부여한다
3. **접근 이름의 개수를 세는 테스트를 쓰지 마라.** 이름이 **그 버튼을 실제로
   가리키는지** 확인해라 — `getByRole("button", { name: ... })`으로 찾아서
   **눌러서 동작까지** 확인한다

> **왜 이렇게 까다롭게 쓰나.** B-01이 이 항목을 "완료"로 보고했지만 실측은
> 1건이었다. 그리고 그때 만든 e2e 단정 2건이 **0건 매칭으로 헛돌았다**
> (`INCOMPLETE_WORK_BACKLOG.md` B-01 참조). 같은 실패를 반복하지 마라.

4. 대상 요소가 정말 없으면 **만들지 마라.** 없다는 사실을 보고서에 적고
   백로그 B-11을 정정하는 것으로 끝낸다. **UX2 문서를 근거로 새 버튼을
   발명하지 마라** — 그건 별도 결정이다

**커밋:** `fix(a11y): 기록 상세 인터랙티브 요소에 접근 이름 부여 (S-5)`

---

## 7. S-6 — leaf 스키마 (day,slot) 유일성 (B-13)

**실측:** `app/src/domain/plan-session-schema.ts:156`
`sessions: z.array(planSessionSchema).readonly()` — 배열 refine **0건**.

(day,slot) 유일성은 저장 관문 superRefine에만 있다. leaf 스키마를 직접 쓰는
경로가 생기면 중복 좌표가 통과한다.

### 할 일

- `sessions` 배열에 (day,slot) 중복 거부 refine 추가
- **저장 관문 검사는 그대로 둔다** (이중 방어)
- leaf 단독으로 중복 좌표를 거부하는 계약 테스트
- 결함 주입: refine 제거 → 그 테스트만 이름으로 실패 → 복원

**주의:** 이 refine이 S-2 생성기 출력을 막지 않는지 확인해라.
고강도 날 반대 슬롯 세션은 `(day, AM)`과 `(day, PM)`으로 **좌표가 다르다.**
막히면 refine이 잘못 짜인 것이다.

**커밋:** `fix(plan-schema): leaf sessions 배열에 좌표 유일성 검사 추가 (S-6)`

---

## 8. 검증 — 각 단계마다, 그리고 마지막에 전체

### 8.1 단계별

각 단계 커밋 전에:

```bash
# impl 쪽을 건드린 단계 (S-2)
cd impl && ./node_modules/.bin/tsc --noEmit     # src/ 오류 0건
cd impl && npx vitest run                        # 전부 통과

# app 쪽을 건드린 단계 (S-1, S-3, S-4, S-5, S-6)
cd app && npm run typecheck && npm run typecheck:e2e
cd app && npx vitest run                         # 기준선 대비 신규 실패 0건
```

#### 🔴 app 테스트는 **두 번** 돈다 — `npx vitest run` 한 번으로 끝내지 마라

`app/package.json`의 `npm test`는 이렇게 정의돼 있다:

```
"test": "npm run test:unit && npm run test:unit:kst"
```

두 번째는 `vitest.config.kst.ts`로 **`TZ=Asia/Seoul`에서 다시 돈다.**
`vitest.config.kst.ts`의 주석이 이유를 적어 놨다 — 날짜 계산 회귀 중에는
**UTC에서 원리적으로 안 잡히는 것**이 있다. CI(`app-quality` 잡)는 `npm test`를
돌리므로 **KST 패스도 돈다.**

```bash
# ✗ 이것만 하면 KST 패스를 건너뛴다. CI에서 처음 터진다.
cd app && npx vitest run

# ✓ 각 단계 커밋 전에 이걸 해라
cd app && npm test        # UTC 패스 + KST 패스 둘 다
```

**S-1은 날짜와 무관해 보이지만 그렇지 않다.** `generatePlanFromDraft`가
`todayISO()`로 프레임을 만든다(`plan-beta-flow.ts`). 시간대 패스를 건너뛰면
계획 생성 회귀를 놓칠 수 있다.

**§8.3의 기준선도 두 패스 각각 떠라** (아래 §8.3 참조).

### 8.2 `npx tsc` 절대 금지

```bash
# ✗ impl/node_modules 없이 이걸 하면 무관한 tsc@2.0.4가 받아져 exit 0을 준다
cd impl && npx tsc --noEmit

# ✓ 둘 중 하나
cd impl && npm ci && npm run typecheck
cd impl && ./node_modules/.bin/tsc --noEmit
```

**통과를 받았을 때, 그 도구가 진짜인지 먼저 의심해라.** (`AGENTS.md` §5)

### 8.3 app 테스트는 개수가 아니라 이름으로 비교

샌드박스는 Node 20, CI는 Node 24다. 샌드박스에서 원래 실패하는 게 24건 있다.

**두 패스(UTC·KST) 각각 따로 떠라.** 실패 집합이 다를 수 있다.

```bash
# UTC 패스
cd app && npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL" | sed 's/^ FAIL  //' | sort -u > /tmp/mine-utc.txt
# KST 패스
cd app && npx vitest run -c vitest.config.kst.ts 2>&1 | sed 's/\x1b\[[0-9;]*m//g' \
  | grep -E "^ FAIL" | sed 's/^ FAIL  //' | sort -u > /tmp/mine-kst.txt

comm -13 /tmp/base-utc.txt /tmp/mine-utc.txt     # 둘 다 비어 있어야 한다
comm -13 /tmp/base-kst.txt /tmp/mine-kst.txt
```

**착수 전에 기준선을 반드시 떠라.** 나중에 만들면 내가 만든 실패가 기준선에 섞인다.

### 8.4 비공허성 — 전 단계 공통

각 테스트마다 대응 결함을 넣고 **이름으로** 실패하는지 확인한다.

```bash
# 결함 주입 → 해당 테스트만 이름으로 실패 확인 → 되돌리기
git status --porcelain      # 비어 있어야 한다
```

**결함을 넣어도 통과하는 테스트는 "통과"로 세지 마라.** 그 테스트는 아무것도
증명하지 않는다. **실패하게 다시 짜라.** 다시 짤 수 없으면 그 테스트를 지우고
**무엇을 증명하려 했는지 보고서에 적어라.** 헛도는 테스트를 남겨 두면 다음
사람이 그걸 보호막으로 착각한다 (B-01의 `post.energy`가 그 사례다).

### 8.5 마지막 전체 회귀 (S-6 후, PR 전)

```bash
cd impl && ./node_modules/.bin/tsc --noEmit && npx vitest run
cd app && npm run typecheck && npm run typecheck:e2e && npx vitest run
cd app && npm run build && npx playwright test
```

> **e2e 함정:** Playwright `webServer`가 `dist/`를 서빙한다.
> `npm run build`를 먼저 하지 않으면 **옛 화면으로 테스트한다.** 새 질문이
> 안 보이는데 통과해서 "왜 되지?" 하게 된다.

### 8.6 손으로 한 번 돌려봐라

```bash
cd app && npm run dev
```

**저녁 훈련(`주로 오후`)을 골라 계획을 끝까지 만들어라.**
- 계획이 실제로 만들어지는가
- 고강도가 오후에 있는가
- "저장하지 못했어요"가 뜨지 않는가

**이 수동 확인 결과를 보고서에 적어라.** 테스트가 전부 초록이어도
이게 안 되면 아무 의미 없다.

---

## 9. 🛑 정지 조건 — 여기 걸리면 멈추고 물어라

중간 리뷰를 없앤 대신, **아래에 걸리면 반드시 멈춘다.**
그때까지의 커밋을 **푸시한 뒤** 보고한다. 추측으로 넘어가지 마라.

| # | 상황 | 왜 멈추나 |
|---|---|---|
| 1 | 저장 관문에서 **어떤 검사를 지워야 할지 판단이 안 선다** | 방어벽을 잘못 지우면 사용자 데이터가 깨진다 |
| 2 | S-3 개정이 **§4.1 표에 없는 검사**까지 건드려야 할 것 같다 | 범위 밖. 표에 없는 건 오너 결정 대상 |
| 3 | 기존 테스트가 깨졌는데 **무엇을 고정하려던 테스트인지 모르겠다** | 모르고 고치면 보호를 지우는 것이다 |
| 4 | `rpeForIntent()`의 숫자를 바꿔야 할 것 같다 | **OD-SLOT-5 정면 위반.** 절대 금지 |
| 5 | 새 role(능동적 휴식 등)이 필요해 보인다 | **OD-SLOT-4 정면 위반.** 절대 금지 |
| 6 | `RECOVERY_PM_ALLOWED` 등 **저장된 내부 값을 개명**해야 할 것 같다 | 사용자 데이터 마이그레이션. 별도 결정 |
| 7 | 새 용어를 `glossary.ts`에 넣어야 할 것 같다 | 용어는 제품 언어다. 임의 추가 금지 |
| 8 * | S-5에서 **접근성 대상 버튼이 존재하지 않는다** | 없는 버튼을 발명하지 마라. **전체 정지는 아니다** — 아래 참조 |
| 9 | 하루 2회 고강도를 **지금 열어야 할 것 같다** | 지정 입구가 없다. OD-SLOT-3 §4.4 |
| 10 | `.github/workflows/` 를 고쳐야 할 것 같다 | **쓰기 차단됨.** 토큰 권한 없음 |
| 11 | 앱과 엔진이 **공용 모듈을 필요로 한다**고 판단된다 | 별도 패키지다. 구조 변경은 별도 결정 |
| 12 | 어떤 단계든 **되돌릴 수 없는 데이터 변형**이 필요해 보인다 | 멈춰라. 예외 없다 |
| 13 | 세션 **처방(prescription)에 새 필드**를 넣어야 할 것 같다 | `DSB-INV-008` 위반. §4.6b |
| 14 | S-2 결과로 **한 프레임의 훈련량이 §3.1 상한을 넘는다** | 훈련 안전 문제. §3.1 |

**8번만 예외다 (부분 정지).** (1~7·9~14번은 **전체 정지**다.) 대상 버튼이 정말 없으면 **전체 작업을 멈추지 마라.**
`LogDetail.tsx`에 실제로 있는 요소만 처리하고, 없는 요소는 **만들지 않고**
보고서에 "UX2 §4-1이 지목한 X·Y는 코드에 존재하지 않는다"로 적은 뒤
**S-6으로 넘어간다.** 백로그 B-11 정정은 리뷰에서 처리한다.
(§6-4와 같은 뜻이다.)

**정지가 실패가 아니다.** 추측으로 밀고 나간 결과를 되돌리는 것이 훨씬 비싸다.

---

## 10. 보고서 — `reports/review/WORK_ORDER_SLOT_INTENSITY_FULL_RUN_REPORT.md`

단계마다 누적해서 쓰고, 마지막에 제출한다. **단계별로 다음을 적어라:**

1. **커밋 해시**와 그 단계에서 바꾼 파일 목록
2. 추가한 테스트 이름 **전부**
3. **결함 주입 내용과 실패한 테스트 이름** — 주입 없는 테스트는 증명된 게 아니다
4. `./node_modules/.bin/tsc` 출력 (`npx tsc` 결과는 인정하지 않는다)
5. app 테스트 기준선 대비 `comm -13` 결과 — **UTC 패스·KST 패스 각각** (§8.3)
6. **수리한 기존 테스트 목록**과 각각 "원래 무엇을 고정하려던 테스트였는지"
7. 판단 보류 / 정지 조건 해당 항목

**마지막에 추가로:**

8. **S-1 하위호환 증명** — 시간대 필드 없는 기존 데이터가 살아나는 로그
9. **S-1 생성결과 불변 증명** — S-1만으로는 계획이 달라지지 않았다는 근거
10. **G-10 증명** — S-2 생성기 출력이 저장 관문을 통과하는 로그
11. **§8.6 수동 확인 결과** — 저녁 훈련 선택 후 계획이 실제로 만들어졌는지
12. 삭제한 저장 관문 검사 목록과 **각각을 삭제해도 안전한 이유**
13. **§4.6b의 사양 불변식 표를 그대로 옮겨 적어라** — 나중에 이 코드를 보는 사람이
    "사양과 다른데?" 하고 되돌리는 것을 막는 유일한 장치다
14. **프레임 훈련량 실측표** (§3.1) — 상한 규칙 적용 **전/후** 하루 2회 날 수를
    같은 조합으로 비교해서 적어라. "넘지 않는다"는 말만 쓰지 마라
15. **S-4 문구 3개소 전/후 대조** — `PlanIntake.tsx:84`·`:201`·`glossary.ts:144`.
    **각 문장에서 남긴 부분과 그 근거(`DSB-INV-001`/`007` 등)를 적어라**

---

## 11. 이 작업에서 하기 쉬운 실수

| 실수 | 결과 |
|---|---|
| 🔴 S-2만 병합해서 배포 | **저녁 훈련자가 계획을 못 만든다.** §1 |
| 🔴 S-1에서 `.optional().default("VARIES")` 누락 | **기존 사용자 계획 전부 소실** |
| 🔴 저장 관문 테스트에 통과 기대 케이스가 없음 | fixture가 틀려도 모른다. §4.7 |
| 🔴 S-2에서 **프레임 훈련량 상한을 안 넣음** | 하루 2회 날이 2일→4일. 71% 조합이 사양 상한 초과. §3.1 |
| 🔴 `app`에서 `npx vitest run`만 돌림 | KST 패스를 건너뛴다. **CI에서 처음 터진다.** §8.1 |
| 🔴 S-4에서 `:201`만 고침 | `:84`·`glossary.ts:144`가 반대 말을 계속한다. §5 |
| 🔴 `:84`·`glossary.ts:144`를 통째로 지움 | `DSB-INV-001/007`(사실인 문장)까지 날린다. §5 |
| 🔴 G-10을 엔진 요청 직접 조립으로 씀 | `INVALID_JOURNAL_CONTEXT`. 관문 문제로 오진한다. §4.6 |
| `labels.ts`의 `"오후"`를 `"오후 회복"`으로 바꿈 | 새 거짓말을 만든다. §4.6b |
| 세션 처방에 페이스·거리·반복 추가 | `DSB-INV-008` 위반. §4.6b |
| 🔴 `rpeForIntent()` 숫자 변경 | OD-SLOT-5 위반 |
| 🔴 새 role 추가 | OD-SLOT-4 위반 |
| S-3에서 하루 2회 고강도를 열어줌 | 지정 입구가 없다. 요청하지 않은 고강도 |
| `counterpartSessions()`에 `"PM"` 리터럴 | 저녁 훈련자는 오후에 고강도+회복이 겹친다 |
| `qualitySlotFor()`에 `default:` 절 | 값이 늘어도 타입체커가 못 잡는다 |
| `VARIES`를 `PM`으로 처리 | "정보 없음"을 "오후 원함"으로 바꿔 읽은 것 |
| S-4를 S-3보다 먼저 | 거짓말의 방향만 바뀐다 |
| 깨진 기존 테스트를 `skip` | 고치거나 물어라. 끄지 마라 |
| 접근 이름 **개수**를 세는 테스트 | B-01이 그렇게 헛통과했다. §6 |
| `npx tsc` 통과로 판단 | 그건 TypeScript가 아니다. §8.2 |
| e2e 전에 `npm run build` 안 함 | 옛 화면으로 테스트해서 헛통과 |
| 단계를 한 커밋에 뭉침 | 원인 추적이 불가능해진다 |
| 중간에 PR 올려서 리뷰 요청 | 이 지시서의 운영 방식 위반. §0 |

---

## 12. 이번 범위에서 **제외**한 것 — 손대지 마라

| 제외 항목 | 이유 |
|---|---|
| **OD-SLOT-6 계획 수정·확정 플로우** (B-17) | 신규 화면. 화면 설계가 오너 결정 사항이다. `movePlanSession`·캘린더 그리드·store upsert가 전부 여기 들어온다. 별도 지시서 |
| **Q4 계정 잠금 해제 화면** (B-12) | 신규 사용자 흐름. 백업 권유 순서·문구가 결정 사항 |
| **하루 2회 고강도 지정** | 위 플로우가 입구다. 그게 없으면 지정도 없다 |
| `.github/workflows/` | 쓰기 차단 |
| safety-gate / memo-safety | 이번 결정과 무관 |

**"어차피 하는 김에" 하지 마라.** 위 두 화면은 각각 설계 결정이 필요하다.

---

## 13. 마지막에 할 일

1. §8.5 전체 회귀 + §8.6 수동 확인
2. 보고서 완성
3. PR 1개 생성 (`codex/slot-intensity-full-run` → `main`)
   - 본문에 **S-1~S-6 각 단계의 커밋 해시**와 보고서 요약
   - **§9 정지 조건에 걸린 항목이 있으면 PR 본문 맨 위에** 적어라
4. `main` 직접 푸시 금지

---

**이 제품은 사람의 훈련과 몸을 다룬다. 판단이 서지 않으면 멈추고 물어라.**
**중간 리뷰를 없앤 것은 "확인 없이 밀어붙여라"가 아니라
"§9에 걸리지 않는 한 스스로 판단해서 진행하라"는 뜻이다.**
