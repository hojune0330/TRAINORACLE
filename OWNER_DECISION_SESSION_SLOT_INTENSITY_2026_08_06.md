# OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md

```yaml
decision_metadata:
  decision_id: TO-OWNER-SLOT-INTENSITY-2026-08-06-01
  title: 슬롯별 강도 배치 — 오전 고정 해제와 하루 1회 고강도 기본값
  status: OWNER_CONFIRMED_IN_CONVERSATION
  owner: COACH_HOJUNE
  recorded_at: 2026-08-06
  recorder: OPUS
  decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
  supersedes_draft: specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md (DSB-INV-002, DSB-INV-003)
  runtime_authority: true
  runtime_applied: false
  open_questions_remaining: 0
  detail_answers_recorded_at: 2026-08-06
```

> **왜 이 문서가 있는가.** 이 결정은 대화로만 존재했다. 샌드박스가 초기화되면
> 사라진다. 코드보다 먼저 여기에 적는다. 런타임은 아직 이 결정을 따르지 않는다
> (`runtime_applied: false`). 아래 §3의 충돌 목록이 전부 닫히면 `true`로 바꾼다.

---

## 1. 오너 원문 (그대로 보존)

발화 1 (2026-08-06):

> 오후애 고강도 매우자주해. 따라서 오전에만 두는 것 금지.
> 오전(새벽, 오전) 오후(오후,저녁) 어느때든 열려있어.

발화 2 (2026-08-06, 위 발화에 이어 후속 질문에 대한 답):

> 1, 오전고정해제. 고강도가 오전이나 오후 중에 배치일 경우 일반적으로 가벼운 훈련이나
> 능동적 휴식 배치. 고강도 오전오후 가능하긴 한데, 사용자가 직접 지정하지 않는 한
> 하루에는 되도록 한번 유지.

---

## 2. 확정 규칙

| ID | 규칙 | 강제 수준 |
|---|---|---|
| **OD-SLOT-1** | **오전 고정 해제.** 고강도(QUALITY) 세션은 오전·오후 어느 슬롯에도 배치할 수 있다. 오전에만 두도록 강제하는 것은 **금지**한다. | 하드 — 오전 강제는 결함이다 |
| **OD-SLOT-2** | 고강도가 하루의 한 슬롯에 배치되면, **반대쪽 슬롯은 가벼운 훈련 또는 능동적 휴식**을 배치한다. 반대쪽 슬롯이 반드시 비어야 하는 것은 아니다. | 기본 배치 경향 |
| **OD-SLOT-3** | 고강도를 오전·오후 **둘 다** 두는 것은 가능하다. 다만 **사용자가 직접 지정하지 않는 한** 하루 고강도는 **1회**를 유지한다. | 기본값 1회, 사용자 명시 시 2회 허용 |

### 2.1 용어 고정

- **오전 슬롯 (`AM`)** = 새벽 + 오전
- **오후 슬롯 (`PM`)** = 오후 + 저녁
- **고강도** = `role: "QUALITY"`
- **가벼운 훈련** = `role: "EASY"` (회복 전용 RPE 1-2로 한정되지 않는다)
- **능동적 휴식** = 별도 종류를 만들지 않고 **가벼운 훈련(`EASY`)으로 표현한다** (§4 OD-SLOT-4)

### 2.2 이 결정이 **말하지 않은** 것

아래는 오너가 정하지 않았다. 임의로 채우지 말 것.

- 이 규칙이 9.5일 프레임의 MAIN 배치 경향(약 3일 1회)과 어떻게 겹치는지
- 하루 2회 고강도를 지정했을 때 경고를 띄울지, 띄운다면 문구
- OD-SLOT-6 플로우의 화면 위치와 진입 경로

> 나머지 미결 4건(능동적 휴식 표현·가벼운 훈련 범위·2회 지정 경로·선택지 개명)은
> §4의 2차 답변으로 닫혔다.

---

## 3. 현재 런타임과의 충돌 목록 (실측)

기준 커밋 `fc44f97` (main). 각 항목은 실제 파일·행을 확인한 것이다.

| # | 위치 | 현재 동작 | 위반 규칙 |
|---|---|---|---|
| C-1 | `impl/src/plan-generator/session-builder.ts:203-207` | `qualityTrainingSession(day, ranges.quality, qualityIntentFor(...))` — slot 인자 없음 → 고강도가 **항상 AM** | OD-SLOT-1 |
| C-2 | `impl/src/plan-generator/session-builder.ts:214-219` | `easyTrainingSession(day, "PM", ranges.recoverySupport, "RECOVERY_INTENT")` — PM은 **회복 전용으로 고정** | OD-SLOT-1, OD-SLOT-2 |
| C-3 | `impl/src/plan-generator/session-builder.ts:150-171` | `recoverySecondSessionDays()`가 `qualityDays`를 **제외** → 고강도 있는 날엔 반대 슬롯이 아예 생기지 않음 | OD-SLOT-2 |
| C-4 | `app/src/domain/plan-beta-schema.ts:83-91` | 저장 관문: PM 세션은 `EASY` + `RECOVERY_INTENT` + `RPE 1-2`가 **아니면 거부** (`Invalid PM recovery support.`) | OD-SLOT-1, OD-SLOT-2 |
| C-5 | `app/src/domain/plan-beta-schema.ts:108-113` | 저장 관문: 같은 날에 PM 세션과 QUALITY 세션이 **동시에 있으면 거부** (`PM recovery cannot follow quality.`) → OD-SLOT-2의 **주 패턴(오전 고강도 + 오후 가벼운 훈련)을 정면으로 막는다** | OD-SLOT-2 |
| C-6 | `app/src/screens/plan-beta/PlanIntake.tsx:201` | 사용자에게 `"오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"`라고 **약속**하는 문구 | OD-SLOT-1, OD-SLOT-2, OD-SLOT-7 |
| C-7 | PR #184 `app/src/domain/plan-session-schema.ts` QUALITY 변형 | `.refine((session) => session.slot !== "PM")` — 고강도 PM 배치를 **스키마 차원에서 영구 차단** | **OD-SLOT-1 정면 위반** |

### 3.1 C-7에 대한 기록

C-7은 딥시크의 잘못이 아니다. 2026-08-05에 **내(OPUS)가 낸 권고**를 딥시크가 성실히
구현한 것이다. 그 권고는 오너 발화 1이 나온 뒤 **철회**됐으나, 철회 사실이 딥시크에게
전달되기 전에 구현이 끝났다. 병합 전에 되돌린다.

### 3.2 내(OPUS)가 2026-08-05에 낸 잘못된 판정 2건 — 철회 기록

**철회 1 — "저장 관문이 열렸다."**
틀렸다. `plan-beta-schema.ts:83-101`의 `superRefine`은 원래부터 PM을 검사하고 있었다.
내 탐침이 `activePlanSchema.safeParse()`를 직접 호출해 바깥 관문을 건너뛴 것이 원인이다.
열린 것은 leaf 스키마뿐이었다. 딥시크의 정정이 맞다.

**철회 2 — "impl 테스트 9건은 헛돈다."**
과했다. 런타임에서 헛도는 것은 사실이나, 그 좌표를 지키는 것은 타입체크이고
CI(`.github/workflows/ci.yml:61-63`)가 impl `npm run typecheck`를 실제로 돈다.
타입 확장을 되돌리면 진짜 `tsc`가 `session-builder.ts:65,139`에서 TS2322로 잡는다.

**철회 2가 생긴 원인 — 가짜 tsc.** `impl/node_modules`가 없는 상태에서 `npx tsc --noEmit`을
돌리면 npm이 무관한 `tsc@2.0.4` 패키지를 받아 실행하고 **exit 0을 준다.** 이것을 타입체크
통과로 읽었다. 앞으로 impl 타입체크는 반드시 `impl/node_modules/.bin/tsc`를 직접 호출하거나
`npm ci` 후 `npm run typecheck`로 돌린다. `npx tsc`는 이 저장소에서 신뢰할 수 없다.

### 3.3 초안 스펙의 지위 변경

`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md`는
`status: DRAFT_FOR_REVIEW`, `canonical_promotion_allowed: false`인 초안이다.
그 §4 Generation Invariants 중 아래 둘은 **오너 결정과 충돌**한다.

- `DSB-INV-002` "PM은 EASY + RECOVERY_INTENT, RPE 1-2 전용" → **OD-SLOT-1·2가 우선한다**
- `DSB-INV-003` "같은 날 quality 짝 금지" → **OD-SLOT-2가 우선한다**

`DSB-INV-004`(같은 `(day, slot)` 쌍 유일성)는 충돌하지 않는다. 유지한다.

초안은 초안이므로 여기서 고쳐 쓰지 않는다. 다만 **이 초안을 근거로 런타임을 되돌리는
일은 금지**한다. 최신 오너 결정이 초안을 이긴다
(`FORMATION_LATEST_OWNER_DECISION_BASELINE.md` 10항).

---

## 4. 세부 확정 (2026-08-06 2차 오너 답변)

§4의 미결 4건은 아래 답변으로 **전부 닫혔다.**

### 오너 원문

> 1. 가벼운훈련으로 두자. 2. 지금범위 3. 나중에 수정하거나 최종 결정하는 플로우를
> 한개 더 만들자. 4. 회복만 들어가지 않도록. 다만 권장은 휴식 또는 회복운동 허용
> 이런 느낌으로 하자.

### 확정 내용

| ID | 규칙 | 근거 |
|---|---|---|
| **OD-SLOT-4** | **"능동적 휴식"에 새 role을 만들지 않는다.** 기존 `EASY`(가벼운 훈련)로 표현한다. `REST` / `EASY` / `QUALITY` 3종 유지. | 답변 1 |
| **OD-SLOT-5** | **강도 범위는 현행 유지.** `rpeForIntent()`의 매핑을 바꾸지 않는다. 가벼운 훈련은 의도(intent)에 따라 `RECOVERY_INTENT` RPE 1-2 또는 `BASE_INTENT` RPE 3-4가 된다. | 답변 2 |
| **OD-SLOT-6** | **계획 확정 후 수정·최종결정 플로우를 새로 만든다.** 하루 2회 고강도의 "사용자 직접 지정"은 생성 시점이 아니라 이 플로우에서 이뤄진다. | 답변 3 |
| **OD-SLOT-7** | **오후 슬롯에 회복만 들어가게 하지 않는다.** 다만 **권장**은 휴식 또는 회복운동이다. 권장은 기본값·안내 문구이지 강제가 아니다. | 답변 4 |

### 4.1 OD-SLOT-5의 중요한 귀결 — 범위는 그대로, 선택지가 늘어난다

`impl/src/plan-generator/session-builder.ts:73-91`의 `rpeForIntent()`는 손대지 않는다.

```
RECOVERY_INTENT → RPE 1-2
BASE_INTENT     → RPE 3-4
LT_INTENT       → RPE 5-6
VO2/GLY_INTENT  → RPE 7-8
ATP_PC_INTENT   → RPE 8-9
MIXED_INTENT    → RPE 6-7
```

바뀌는 것은 **오후 슬롯이 `RECOVERY_INTENT` 하나로 고정돼 있던 것**이다.
오후 `EASY`가 `BASE_INTENT`(RPE 3-4)도 될 수 있어야 한다. 이것이 OD-SLOT-7의
"회복만 들어가지 않도록"의 코드상 의미다. **새 RPE 숫자를 만드는 것이 아니다.**

`session-builder.ts:34-48`의 duration 범위(`easy` / `recoverySupport` / `quality`)도
현행 유지한다. 오후 가벼운 훈련이 `recoverySupport`(10-30분)를 쓸지 `easy`(20-60분)를
쓸지는 의도에 따라 갈린다 — `RECOVERY_INTENT`면 `recoverySupport`, `BASE_INTENT`면
`easy`가 자연스럽다. 이는 새 숫자가 아니라 기존 두 범위의 선택이다.

### 4.2 OD-SLOT-6은 별도 작업이다 — 범위 경고

"나중에 수정하거나 최종 결정하는 플로우"는 **새 화면 + 새 도메인 동작**이다.
`WORK_ORDER_SLOT_TYPE_EXTENSION_B.md` §6이 비목표로 명시한 `movePlanSession`,
`plan-beta-store.ts` upsert, 캘린더 그리드 UI가 전부 여기에 들어온다.

**㉢(생성기 수정)과 같은 작업으로 묶지 않는다.** 묶으면 둘 다 늦어지고 검증이 흐려진다.
순서는 §5에 적었다.

### 4.3 OD-SLOT-7의 "권장"은 강제가 아니다 — 구현 시 주의

| 하면 되는 것 | 하면 안 되는 것 |
|---|---|
| 오후 기본값을 휴식/회복운동으로 둔다 | 오후에 다른 것을 **스키마·생성기에서 거부**한다 |
| 안내 문구로 휴식/회복을 권한다 | 사용자가 바꾸려 할 때 막는다 |
| 하루 2회 고강도 시 확인을 한 번 받는다 | 확인 없이 자동으로 되돌린다 |

C-4(`plan-beta-schema.ts:83-91`)를 "PM은 EASY+RECOVERY+RPE1-2만"에서
"PM은 무엇이든 되지만 하루 고강도 2회는 명시 지정이 있어야 함"으로 바꾼다는 뜻이다.
**검사를 없애는 것이 아니라 검사 대상을 바꾸는 것이다.**

---

## 5. 적용 순서 (합의된 진행 방식)

| 단계 | 내용 | 선행 조건 | 상태 |
|---|---|---|---|
| **1** | **C-7 철회** — PR #184에서 `refine` 1개 + 테스트 1건 제거 | 없음 | ✅ 완료 (`38b446a`) |
| **2** | **㉢-a0 훈련 시간대 질문** — 계획 질문 6→7문항. 생성기가 오후를 고를 **근거**를 만든다 | 1 완료 | 작업지시서 발행 |
| **3** | **㉢-a 생성기** — C-1·C-2·C-3. 고강도가 오후에도 배치되고, 반대 슬롯에 가벼운 훈련이 붙는다 | 2 완료 | 작업지시서 개정됨 |
| **4** | **㉢-b 저장 관문** — C-4·C-5를 "PM 금지"에서 "하루 고강도 1회 기본, 2회는 명시 지정 필요"로 | 3 완료 | 대기 |
| **5** | **㉢-c 문구** — C-6. `PlanIntake.tsx:201`을 실제 동작에 맞춘다 | 4 완료 | 대기 |
| **6** | **OD-SLOT-6 수정·확정 플로우** — 새 화면. 하루 2회 고강도 명시 지정의 실제 입구 | 5 완료 | 별도 작업지시서 |

> **2번(㉢-a0)은 2026-08-06에 추가됐다.** ㉢-a 작업지시서를 쓰다가,
> 입력 어디에도 "이 선수가 언제 훈련하는지"를 묻지 않는다는 것을 발견했다.
> 근거 없이 오후를 고르면 그건 추측이다. 오너에게 물었고
> **"주로 언제 훈련하세요 넣자"**로 승인됐다.
> → [`WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md`](WORK_ORDER_TRAINING_TIME_QUESTION_C3A0.md)

**5번(문구)을 4번보다 먼저 하지 않는다.** 문구를 먼저 고치면 거짓말의 방향만 바뀐다.

**6번 전까지 하루 2회 고강도는 "지정할 입구가 없으므로 생성되지 않는다".**
이는 OD-SLOT-3의 기본값(하루 1회)과 일치하므로 중간 상태로 안전하다.

---

## 6. C-6 문구의 목표 방향 (단계 5에서 적용)

지금 문구는 "오후 = RPE 1~2 회복만"이라고 **단정**한다. OD-SLOT-7은 오후를 회복으로
한정하지 말되 **권장은 휴식 또는 회복운동**이라 했다. 즉 문구는 *단정*에서 *권장*으로
바뀌어야 한다.

```
현재 (거짓 단정)
  "오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"

방향 (권장 표현) — 확정 문구 아님, 단계 4에서 실제 동작 보고 정한다
  "하루를 오전·오후로 나눠 보여줘요. 두 번째는 휴식이나 가벼운 회복 운동을 권해요"
```

**문구를 여기서 확정하지 않는다.** 단계 3까지 끝나 런타임이 실제로 무엇을 만드는지
본 뒤에 쓴다. 지금 문구를 정해두면 또 코드보다 앞서게 된다.

`secondSessionMode`의 값 이름 `RECOVERY_PM_ALLOWED`는 저장된 사용자 데이터에 들어가는
문자열이다. 개명하면 마이그레이션이 필요하다. **화면 문구만 고치고 내부 값 이름은
그대로 둔다** — 오너 답변 4는 사용자가 보는 표현에 대한 것이다.

---

## 7. 이 문서를 읽는 사람에게

이 결정은 안전 규칙을 **푸는** 방향이다. 그래서 되돌리고 싶은 유혹이 있다.
되돌리려면 오너에게 다시 물어라. 초안 스펙이나 기존 코드를 근거로 되돌리지 마라.
오너는 "오후애 고강도 매우자주해"라고 말했다. 그것이 이 종목의 실제 훈련 관행이다.
