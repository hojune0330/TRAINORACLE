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
- **능동적 휴식** = 완전 휴식이 아닌 저강도 활동. 현재 타입에는 대응 개념이 없다 → §4 미결

### 2.2 이 결정이 **말하지 않은** 것

아래는 오너가 정하지 않았다. 임의로 채우지 말 것.

- "가벼운 훈련"의 구체 RPE·시간 범위
- "능동적 휴식"을 `EASY`의 하위 종류로 볼지, 새 role로 볼지
- 사용자가 하루 2회 고강도를 "직접 지정"하는 UI 경로의 형태
- 이 규칙이 9.5일 프레임의 MAIN 배치 경향(약 3일 1회)과 어떻게 겹치는지

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
| C-6 | `app/src/screens/plan-beta/PlanIntake.tsx:201` | 사용자에게 `"오전 기본 훈련과 오후 RPE 1~2 회복 운동만 나눠 보여줘요"`라고 **약속**하는 문구 | OD-SLOT-1, OD-SLOT-2 |
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

## 4. 미결 — 오너 확인이 더 필요한 지점

이 결정만으로는 코드를 끝까지 쓸 수 없다. 아래는 **추측하지 않고 물어야 하는** 것들이다.

1. **"능동적 휴식"의 자료 표현.** 현재 타입은 `REST` / `EASY` / `QUALITY` 셋뿐이다.
   능동적 휴식을 `EASY`의 낮은 RPE로 표현할지, 별도 role을 만들지 정해지지 않았다.
2. **"가벼운 훈련"의 범위.** 현재 `recoverySupport` 범위는 RPE 1-2로 하드코딩돼 있다
   (`session-builder.ts`). 오너가 말한 "가벼운 훈련"이 이 범위와 같은지 다른지 불명.
3. **하루 2회 고강도의 "직접 지정" 경로.** 사용자가 어디서 어떻게 지정하는지,
   그리고 지정 시 경고를 띄울지 정해지지 않았다.
4. **`secondSessionMode` 선택지 이름.** 현재 `RECOVERY_PM_ALLOWED`는 "오후=회복"을
   이름에 박아뒀다. OD-SLOT-2에서는 오후가 회복만은 아니다. 개명이 필요한지 불명.

**현재 판단:** 1·2·3이 정해지기 전에는 생성기(C-1~C-3)를 끝까지 바꿀 수 없다.
그러나 **C-7(스키마 영구 차단)은 지금 되돌려야 한다.** 차단을 남겨두면 나중에 무엇을
정하든 스키마가 먼저 거부한다.

---

## 5. 적용 순서 (합의된 진행 방식)

1. **C-7 철회** — PR #184에서 `refine` 제거. 병합 전.
2. **C-4·C-5 재설계** — 저장 관문을 "PM 금지"가 아니라 "하루 고강도 1회 기본"으로.
   §4 미결 1·2 확정 후.
3. **C-1~C-3** — 생성기가 실제로 오후 고강도를 만들도록. §4 미결 전부 확정 후.
4. **C-6** — 화면 문구는 **런타임이 실제로 바뀐 뒤에만** 고친다.
   문구를 먼저 고치면 거짓말이 방향만 바뀐다.

---

## 6. 이 문서를 읽는 사람에게

이 결정은 안전 규칙을 **푸는** 방향이다. 그래서 되돌리고 싶은 유혹이 있다.
되돌리려면 오너에게 다시 물어라. 초안 스펙이나 기존 코드를 근거로 되돌리지 마라.
오너는 "오후애 고강도 매우자주해"라고 말했다. 그것이 이 종목의 실제 훈련 관행이다.
