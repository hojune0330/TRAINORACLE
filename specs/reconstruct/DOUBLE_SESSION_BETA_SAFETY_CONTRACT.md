# DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-035-double-session-beta-safety
  spec_id: DOUBLE_SESSION_BETA_SAFETY_CONTRACT
  title: TrainOracle Double Session Beta Safety Contract
  version: "0.4"
  round: RT1_OWNER_APPROVED_LOCAL_BETA_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 4
  canonical_blocking_count: 3
  executed_tests_total: 0
  executed_tests_passed: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  self_check_is_runtime_evidence: false
  final_marker_required: "[DRAFT_COMPLETE]"
  machine_validated: false
  machine_validation_note: "Full DSB vector coverage is not established here; targeted generation, storage and detailed-prescription tests exist. See the 2026-09-02 audit."
  governing_owner_decision: OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md
  prior_owner_decision: OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md
  governing_owner_decision_date: "2026-08-12"
  change_history_section: "10"
```

---

## 0. 최신 소유자 결정 · 검증 상태 (읽는 순서 공지)

> **이 문서의 규칙을 인용하거나 구현하기 전에 이 절을 먼저 읽으세요.**

- **이 문서 전체의 검증 완료를 주장하지 않습니다.** 생성·저장·상세 처방의
  개별 테스트는 존재합니다. 과거의 "테스트가 하나도 없다"는 문장은 현재
  구현의 증거가 아닙니다. 이 문서의 전체 벡터 실행 증거는 별도입니다
  (`executed_tests_total: 0`, `machine_validated: false`). 코드와 문서는 **어긋날 수
  있습니다.** 실제 코드 동작을 확인해야 할 때는 이 문서만 믿지 말고 저장 관문
  구현(`app/src/domain/plan-beta-schema.ts`의 `planBetaStateSchema`
  `superRefine`)과 생성기(`impl/src/plan-generator/session-builder.ts`)를 함께
  읽으세요.
- **이 문서보다 나중 날짜의 소유자 결정이 항상 우선합니다**
  (`FORMATION_LATEST_OWNER_DECISION_BASELINE.md` 10항).
- 현재 반영된 최신 소유자 결정:
  `OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md`. 이 결정은 사용자가 직접
  하루 두 번을 고른 경우, 고른 모든 훈련일에 오전·오후 슬롯을 만드는 현재
  공개 베타 동작을 기록한다. 이전의 슬롯·강도 결정
  `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md`는 이 범위에서
  계속 보조 근거로 남는다.
- v0.1에서 **은퇴한 규칙의 원문**은 §10 변경 이력에 그대로 남겨 두었습니다.
  과거 보고서·작업지시서가 옛 규칙을 인용한 부분을 해석할 때 §10을 참고하세요.
  옛 규칙을 "지금도 유효한 지침"으로 읽으면 안 됩니다.
- §4 불변식 표의 `근거` 열은 각 규칙이 어느 결정에서 왔는지 가리킵니다. 규칙을
  또 바꿔야 할 때는 그 근거 문서를 먼저 확인하세요.

---

## 1. Purpose

This draft defines the narrow local-beta meaning of a user-selected second
session in a TrainOracle plan candidate. It makes an AM/PM display and local
progress record possible without treating that display as an accepted calendar
projection, a medical recovery decision, or an individualized numeric
prescription.

A second session on a beta day exists only when the athlete explicitly selects
`RECOVERY_PM_ALLOWED`. The default is `SINGLE_SESSION_ONLY`. When explicitly
selected, every available training day receives two distinct slots. The stored
value name is retained for backwards compatibility; it does not mean that the
PM slot is the only recovery slot or that it is a hidden catch-up session.

## 2. Scope And Non-Purpose

This draft owns:

- local ordinal `DAY n` AM/PM session slots in the public RPE-and-duration beta
- explicit athlete choice between one session and optional PM recovery support
- same-day caps, session-shape constraints, local progress identity, and
  backwards-compatible local storage

This draft does not:

- resolve `DOUBLE` or `FLEX` in `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- map a local beta day to a civil date or a coach calendar
- create a catch-up session or an automatic adjustment after a missed session
  (see `DSB-INV-007`)
- create a second session **on its own initiative**. A second session on a
  beta day exists only because the athlete selected `RECOVERY_PM_ALLOWED`
  (`DSB-INV-001`). Whether that second session may be quality-intensity is
  governed by `DSB-INV-003` and `DSB-INV-009`, not by this non-goal list.
- authorize a detailed template, a target pace, repetitions, distance, or
  recovery duration for an individual athlete
- reinterpret D9, RVE, Safety Gate, consent, or raw-note privacy rules
- close any upstream issue or promote a source to canonical status

## 3. Vocabulary And Storage Shape

```yaml
second_session_mode:
  SINGLE_SESSION_ONLY: "default; one session at most on each beta day"
  RECOVERY_PM_ALLOWED: >-
    explicit athlete selection; creates a morning and afternoon slot on every
    available training day. Name retained for stored-data backwards
    compatibility; it does not promise an individualized recovery prescription.

session_slot:
  AM: "first half of a beta day: a session, or complete rest"
  PM: >-
    second half of a beta day: a session, or complete rest. Not restricted to
    recovery support. The default recommendation for PM is rest or light work,
    but that is a recommendation, not a constraint (OD-SLOT-7).

local_progress_identity:
  key: "sessionDay + sessionSlot"
  examples: ["1:AM", "1:PM"]
```

`AM`/`PM` are **ordinal halves of a local beta day**, not civil clock times and
not intensity labels. A quality session may occupy either half
(`DSB-INV-002`).

Older stored beta plans without a slot or second-session mode must load as
`AM` and `SINGLE_SESSION_ONLY`. This migration must not synthesize a PM
session or infer athlete consent.

## 4. Generation Invariants

Every generated local-beta candidate must satisfy all of the following.

The `근거` column records where each rule came from. When a rule must change
again, read that source first. `v0.1` in the column means the rule is unchanged
from the original draft.

| ID | Invariant | Required behavior | 근거 |
|---|---|---|---|
| `DSB-INV-001` | Explicit choice | A second session on a beta day is absent unless `RECOVERY_PM_ALLOWED` was selected. A single-session profile never produces two sessions on one day. | v0.1 (unchanged) |
| `DSB-INV-002` | Second-session shape | The second session may be `REST`, `EASY`, or `QUALITY`. It is **not** restricted to `RECOVERY_INTENT` or `RPE 1-2`. The recommended default for the PM half is rest or light aerobic work, and the generator should prefer that, but recovery is a recommendation and not a constraint. | OD-SLOT-1, OD-SLOT-2, OD-SLOT-7 (2026-08-06) — replaces v0.1 `DSB-INV-002` |
| `DSB-INV-003` | Same-day quality count | **Default: at most one `QUALITY` session per beta day.** Two `QUALITY` sessions on one beta day are permitted only when the athlete explicitly designates that day, and only when `DSB-INV-009` is satisfied. The generator must never produce two same-day `QUALITY` sessions on its own. | OD-SLOT-2, OD-SLOT-3 (2026-08-06) — replaces v0.1 `DSB-INV-003` |
| `DSB-INV-004` | Daily cap | A beta day has at most one AM and one PM session, so at most two sessions per day. Each `(day, slot)` pair is unique. | v0.1 (unchanged) |
| `DSB-INV-005` | Full two-a-day selection | When an athlete explicitly selects `RECOVERY_PM_ALLOWED`, every available training day has two distinct slots. There is no separate PM `RECOVERY_INTENT` count cap for this user-selected full schedule. This does **not** create a numeric prescription, a second automatic `QUALITY` session, a catch-up session, or a medical clearance. | `OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md` — replaces v0.1 recovery-session frame cap for the explicit full two-a-day schedule |
| `DSB-INV-006` | Availability meaning | An available day includes recovery movement. `EVERY_DAY` does not create extra quality days; existing quality-day rules remain unchanged. | v0.1 (unchanged) |
| `DSB-INV-007` | No compensation | A skipped or incomplete AM/PM session is not moved, duplicated, or added to a later day. A second session is never created to make up for a missed one. | v0.1 (unchanged) |
| `DSB-INV-008` | Default RPE and separately adopted detail | The default AM/PM prescription is RPE and duration. A separately adopted detailed template may replace one eligible QUALITY prescription only after its exact template, components, event, experience, current same-event anchor and safety gates pass. An AM/PM slot is not additional template authority. | Default v0.1; exact four identities from Template Library §16A and 2026-08-17 activation decisions |
| `DSB-INV-009` | Special-day disclosure and edit flow | A day that carries an unusual load — two `QUALITY` sessions, or two competition exposures — is permitted **only if both hold**: (a) the screen states plainly, at that day, that the day is unusual; and (b) the athlete has a flow to review and modify or remove it before or after confirmation. If either is missing, the generator and the storage gate must not allow the day. | OD-SLOT-8 (2026-08-06), new in v0.2 |

`DSB-INV-009` is **not satisfied by the current implementation.** As of
2026-08-06 there is no plan-edit screen and no session-move function in
`app/src/screens/plan-beta/` or `app/src/domain/plan-beta-store.ts`. Therefore
two same-day `QUALITY` sessions must remain unreachable until backlog item
`B-17` (the post-confirm edit/finalize flow, OD-SLOT-6) ships. Loosening
`DSB-INV-003` in the storage gate without `B-17` would violate `DSB-INV-009`.

A duration range is a local, experience-banded range only. It is not a claim
that a particular duration is medically restorative or appropriate for an
individual athlete.

## 5. Safety, Authority, And Privacy

```yaml
safety:
  D9_ACTIVE: "block plan generation"
  D9_UNKNOWN: "block plan generation or require human review"
  D9_CLEARED: "permits this beta flow only; is not medical clearance"
  good_physio_data_or_template: "cannot clear D9 risk"

selection_authority:
  self_service_beta: "allowed when policy permits"
  coach_required_configuration: "must remain fail-closed"
  coach_connection: "does not override a safety hard stop"

privacy:
  raw_free_text_in_plan_or_audit: forbidden
  raw_symptom_clause_in_plan_or_audit: forbidden
  structured_progress: [COMPLETED, RESTED, SKIPPED, PAIN_CHECKIN]
```

`PAIN_CHECKIN` is a structured progress record. It is not a clearance signal,
does not cause a PM session to appear, and does not alter later plan intensity.

## 6. Required Presentation

The candidate and active-plan screens must show `DAY n · 오전` or `DAY n · 오후`
beside every session.

Naming rules for a PM session:

- Its label and guidance must be **derived from the session's own role and
  intent**, never from the fact that it is in the PM half. A PM `QUALITY`
  session must not be described as a recovery session, and a PM
  `RECOVERY_INTENT` session must not be described as a workout.
- No screen or glossary text may promise that a PM session is always recovery,
  always `RPE 1-2`, or never high intensity. Such wording was true under v0.1
  and is **false** under v0.2.
- No PM session may be presented as making up missed training
  (`DSB-INV-007`), as a dated calendar entry, or as a medical recovery
  judgement.
- When a day carries two `QUALITY` sessions, the screen must say so plainly at
  that day and offer the review/modify path required by `DSB-INV-009`.

The RPE `?` explanation must state both of these distinctions:

- `RPE 1-2`: recovery movement with comfortable breathing
- `RPE 3-4`: basic aerobic work where conversation or a phone call remains
  possible

## 7. Verification Vectors

Before this draft can support broader execution claims, the implementation must
retain these regression vectors:

| # | Vector | Expected result | Invariant |
|---:|---|---|---|
| V-1 | single-session profile | no second session on any day | `DSB-INV-001` |
| V-2 | **control (must pass):** explicit AM/PM profile, 9.5-day frame, Balanced, non-recovery intent | the snapshot is **accepted** by the storage loader | `DSB-INV-001` |
| V-3 | explicit AM/PM profile, 9.5-day LT candidate | every available training day has one AM and one PM slot; PM shape is not rejected merely for being PM | `DSB-INV-001`, `DSB-INV-005` |
| V-4 | explicit AM/PM profile | no unrequested second slot appears on a non-available or single-session day | `DSB-INV-001`, `DSB-INV-005` |
| V-5 | every-day availability, explicit AM/PM | up to 10 two-a-day days are accepted; never 3+ sessions on one day | `DSB-INV-004` |
| V-6 | every-day availability | quality-session count is unchanged by availability alone | `DSB-INV-006` |
| V-7 | persisted AM and PM progress | progress for `n:AM` and `n:PM` coexist and update independently | — |
| V-8 | stored snapshot with two same-day sessions but `SINGLE_SESSION_ONLY` | storage loader **rejects** the snapshot | `DSB-INV-001` |
| V-9 | stored snapshot with two same-day `QUALITY` sessions | storage loader **rejects** it while `B-17` is unshipped; after `B-17`, accepted only with the disclosure and edit flow | `DSB-INV-003`, `DSB-INV-009` |
| V-10 | stored snapshot with three sessions on one day, or a duplicate `(day, slot)` | storage loader **rejects** the snapshot | `DSB-INV-004` |
| V-11 | older slot-less snapshot | loader reads every legacy session as AM and the mode as single-session; **no PM is synthesized** | §3 migration |
| V-12 | PM detailed prescription | Accept only the separately adopted exact template after every detailed gate; otherwise retain the RPE fallback. Do not create a second QUALITY session or a new numerical variant. | `DSB-INV-008`, `DSB-INV-003` |

**Fixture-validity discipline.** A gate test suite in which *every* case expects
rejection proves nothing — an always-reject gate, or a fixture that is malformed
for an unrelated reason, would pass it. `V-2` is the mandatory control case:
at least one vector must assert **acceptance**, and it must be run in the same
suite as the rejection vectors.

Passing a local test does not create runtime evidence for an upstream contract,
canonical promotion, or issue closure. Full named-vector coverage must be checked
against actual test output; historical absence statements are not current evidence.

## 8. Open Issues

| Issue ID | Status | Canonical blocker | Required evidence before closure |
|---|---|---:|---|
| `OI-DSB-CALENDAR-CROSSWALK-001` | OPEN | yes | Accepted mapping of local AM/PM beta slots to `DOUBLE`/`FLEX`, calendar identity, and projection fixtures. |
| `OI-DSB-SAFETY-HOLD-INTEGRATION-001` | OPEN | yes | Accepted hold and recheck behavior for a real dated double-session calendar flow. |
| `OI-DSB-TEMPLATE-ELIGIBILITY-001` | OPEN | yes | Accepted template, event, experience, youth-policy, source, and anchor bindings before any numeric PM prescription. |
| `OI-DSB-FRAME-LOAD-CAP-001` | OPEN | no | An accepted total-training-load ceiling per frame. The previous PM recovery-session count calculation is historical only: the latest user decision deliberately creates two slots on every available training day when that mode is selected. This decision does not establish a total-minute ceiling or individualized load target. |

## 9. Source Relationships

- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `specs/active/PLAN_GENERATOR_SPEC.md`
- `reports/review/SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md`
- `PLAN_BETA_PRODUCT_DECISION_2026_07_24.md`

This document is a bounded beta implementation contract. It does not state that
the upstream documents are accepted, patched, or resolved.

**Upstream direction check (2026-08-06).** The references above are
one-directional: no upstream spec reads back from this document. Both
`specs/active/PLAN_GENERATOR_SPEC.md` (`SessionSlot = "AM" | "PM" | "DOUBLE" |
"FLEX"`) and `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
(`CalendarSessionSlot = "AM" | "PM" | "FULL_DAY" | "UNSPECIFIED"`) already admit
a full-day / double slot, and neither declares PM to be recovery-only.
Loosening the v0.1 PM restriction therefore moves this beta contract **toward**
its upstream specs, not against them.

---

## 10. 변경 이력 (Change History)

각 판에서 무엇이 바뀌었는지와, **은퇴한 규칙의 v0.1 원문**을 남겨 둡니다.
과거 보고서·작업지시서가 옛 규칙을 인용한 부분을 해석할 때만 쓰세요. 아래
"은퇴 원문"은 **현재 유효한 지침이 아닙니다.**

### v0.4 — 2026-09-02

기존 상세 처방 승인과 충돌하던 모든 AM/PM의 절대 RPE-only 문구를 기본 경로와
별도 승인 경로로 나눴다. 근거는 `TEMPLATE_LIBRARY_SPEC.md` §16A와
`reports/review/MIDDLE_DISTANCE_RUNTIME_ACTIVATION_DECISION_2026-08-17.md`,
`reports/review/V2_SEED_05_OWNER_ADOPTION_DECISION_2026-08-17.md`다.
추가 템플릿·두 QUALITY 특별일·수치 증량은 승인하지 않는다. 이슈 4개와 차단
3개는 모두 그대로 OPEN이며, 문서의 정본 지위와 운영 증거도 변경하지 않는다.
과거 §0의 테스트 부재 단정은 전체 계약 검증 미완과 개별 테스트 존재로 구분했다.

### v0.3 — 2026-08-12

근거: `OWNER_DECISION_FULL_TWO_A_DAY_2026_08_12.md`. 사용자가 직접
하루 두 번을 고른 경우, 고른 모든 훈련일에 두 슬롯을 만들도록 현재
베타 동작과 계약을 맞췄다.

| 위치 | 변경 |
|---|---|
| metadata / §0 | 최신 결정 포인터를 추가했다. |
| §1 / §3 | 명시적 두 번 선택은 모든 가용일의 두 슬롯을 만든다고 명확히 했다. |
| `DSB-INV-005` | 예전 PM 회복 건수 상한을 전체 두 번 일정에 적용하지 않도록 교체했다. |
| §7 / §8 | 검증 벡터와 열린 총 부하 질문을 현재 경계에 맞췄다. |

**은퇴한 v0.2 `DSB-INV-005`의 범위:** "9.5일 프레임에서 PM
`RECOVERY_INTENT`를 최대 두 건"이라는 상한은 일부 회복 지원을 추가하던
이전 동작을 위한 것이었다. 사용자가 직접 고른 전체 두 번 일정에는 더 이상
적용하지 않는다. 과거 결과를 해석할 때만 참고한다.

### v0.2 — 2026-08-06

근거: `OWNER_DECISION_SESSION_SLOT_INTENSITY_2026_08_06.md` (OD-SLOT-1 ~ 8).
`status`, `executed_tests_total`, `production_execution_allowed`,
`canonical_promotion_allowed`는 **변경하지 않았습니다** (소유자 권한).

| 위치 | 변경 |
|---|---|
| metadata | `version` 0.1 → 0.2. `machine_validated: false`, 지배 결정 문서 포인터 추가. `open_issues_total` 3 → 4 |
| §0 (신설) | 최신 결정 포인터 + 기계 미검증 경고 |
| §2 non-goal | "creates a second high-intensity session" 금지를 삭제하고, 자발적 생성 금지 + `DSB-INV-003`/`009` 위임으로 교체 |
| §3 vocabulary | `PM: "optional recovery support only"` → 하루의 뒷 절반(휴식 권장이지만 강제 아님). `RECOVERY_PM_ALLOWED` 이름은 저장 호환을 위해 유지하되 의미를 재정의 |
| §4 표 | `근거` 열 신설. `DSB-INV-002`·`DSB-INV-003` 교체. `DSB-INV-005` 범위·단위 명확화. `DSB-INV-008` 주체 확대. `DSB-INV-009` 신설 |
| §6 | PM = 회복 세션이라는 호칭 강제를 삭제하고, 역할·의도 기반 호칭 규칙 + 거짓 약속 금지 + 특별한 날 고지 의무로 교체 |
| §7 | 벡터 7 → 12행, ID·불변식 매핑 부여. 통과 대조군 `V-2` 의무화 |
| §8 | `OI-DSB-FRAME-LOAD-CAP-001` 신설 (정식 차단 아님) |
| §9 | 상방 스펙 단방향성 확인 문단 추가 |
| §10 (신설) | 이 변경 이력 |

**은퇴 원문 (v0.1, 더 이상 유효하지 않음):**

- v0.1 `DSB-INV-002` (PM shape): *"PM is `EASY` plus `RECOVERY_INTENT`, with
  `RPE 1-2` only. It can be brisk walking, a very easy jog, easy cycling, or
  gentle uphill walking."*
  → 은퇴 이유: OD-SLOT-1 *"오후에 고강도 매우 자주 해. 따라서 오전에만 두는 것
  금지."* / OD-SLOT-7 *"PM은 회복 전용이 아니다."* PM을 회복으로 고정하면 오후
  고강도 배치가 불가능해집니다. 대체: 새 `DSB-INV-002`.
- v0.1 `DSB-INV-003` (No same-day quality pairing): *"A PM session cannot share
  its day with a `QUALITY` session. A beta day cannot contain two
  high-intensity sessions."*
  → 은퇴 이유: OD-SLOT-3 및 2026-08-06 소유자 판단 *"하루 2회 매일 하는 것도
  문제가 크게 되지 않아"*, 단 고지·수정 흐름 조건부(OD-SLOT-8). 대체: 새
  `DSB-INV-003` (기본 1회 유지 + 명시 지정 시 예외) 및 `DSB-INV-009`.
- v0.1 §2 non-goal 항목: *"create a second high-intensity session, a catch-up
  session, or an automatic adjustment after a missed session"*
  → catch-up / 자동 보정 금지 부분은 `DSB-INV-007`로 **그대로 살아 있습니다.**
  "second high-intensity session" 부분만 은퇴했습니다.
- v0.1 §3 `PM: "optional recovery support only"` → 은퇴. 위 `DSB-INV-002`와 같은 이유.
- v0.1 §6 문장: *"A PM session must be called an afternoon recovery session,
  not a second workout to make up missed training."*
  → 뒷부분("놓친 훈련 보충 아님")은 `DSB-INV-007`로 **유효**. 앞부분(회복 세션
  호칭 강제)만 은퇴.
- v0.1 §7 벡터: *"explicit AM/PM profile, 9-day LT candidate | two distinct PM
  recovery sessions at most; **no PM quality session**"* 및 *"malformed stored
  PM beside quality | storage loader rejects the snapshot"*
  → "no PM quality" 및 "PM beside quality는 거부" 부분 은퇴. `V-3`, `V-9`로 대체.

**v0.2에서 바뀌지 않은 것 (오해 방지):** `DSB-INV-001` 명시적 동의 원칙,
`DSB-INV-004` 하루 2세션 상한, `DSB-INV-006` 가용일 의미, `DSB-INV-007` 보충
금지, `DSB-INV-008` RPE 전용 경계, §3 레거시 마이그레이션 규칙, §5 안전·권한·개인정보
규칙, §8의 기존 3개 정식 차단 이슈. **PM 기본 권장은 여전히 휴식 또는 가벼운
훈련입니다** (OD-SLOT-2: *"사용자가 직접 지정하지 않는 한 하루에는 되도록 한번
유지"*).

### v0.1 — 2026-07-27

최초 초안. `RT1_OWNER_APPROVED_LOCAL_BETA_BOUNDARY`.

[DRAFT_COMPLETE]
