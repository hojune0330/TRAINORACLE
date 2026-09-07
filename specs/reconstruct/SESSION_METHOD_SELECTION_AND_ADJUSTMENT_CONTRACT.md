# SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md

```yaml
doc_id: trainoracle-session-method-selection-and-adjustment
spec_id: SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT
title: TrainOracle Session Method Selection And Adjustment Contract
version: "0.45"
round: RT1_OWNER_APPROVED_IMPLEMENTATION_DIRECTION
status: ACTIVE_IMPLEMENTATION_CONTRACT
product_direction: OWNER_APPROVED_IMPLEMENTATION_DIRECTION
decision_basis: USER_TASK_BRIEF_2026_09_05
accepted_amendment: USER_TASK_BRIEF_2026_09_06
reconciled_on: 2026-09-06
inspected_baseline_sha: 985669328dbcc7738afc9f390c9c325769b8251c
owner: COACH_HOJUNE
open_issues_total: 4
canonical_blocking_count: 0
engineering_implementation_authority: OWNER_APPROVED
new_exact_dose_activation_authority: false
template_activation_authority: false
scientific_approval_granted_by_this_document: false
canonical_promotion_allowed: false
verification_evidence: SEPARATE_IMPLEMENTATION_REPORTS
final_marker_required: "[DRAFT_COMPLETE]"
```

## 0. 한국어 개요

오너는 여러 훈련 방법의 선택·추천·조정 기능에 대한 전체 엔지니어링 구현 방향을
승인했다. 이 문서는 UI·코어·저장 연결이 따라야 할 구현 계약이다. 다만 기능 구현
승인은 새로운 반복 수·회복값·조정 범위나 과학적 타당성의 일괄 승인이 아니다.

현재는 계획 후보마다 상세 세션 한 개를 어느 적격 MAIN에 배치할지 선택한다.
동시에 여러 MAIN에 상세 처방을 넣는 기능은 정확한 슬롯별 정책이 필요한 후속
범위다. 최종 목표는 MAIN별로 독립된 방법군·구성을 선택하는 것이며, 고정 A/B
짝이나 첫 번째 MAIN만을 제품 모델로 고착하지 않는다.

구조는 유한한 검토 프리셋에서 고르고, 수치 조정은 근거가 연결된 규칙 안에서만
허용한다. 추천은 선택을 대신하지 않는다. 초안·적용·취소를 구분하고 기존 계획,
청소년·자율 사용 범위, 실제 수행과 계획값의 구분을 보존한다. 자동 증량과 원문
메모 사용은 금지하며, 30개 출처 항목의 미확인 근거는 통합 준비표로 관리한다.

## 1. Durable Approved Plan And Authority

The owner approved the full multi-method session prescription engineering direction
on 2026-09-05, including UI/core implementation and downstream integration. This is
a binding engineering contract within that approved direction, not merely permission
to write a SPEC. Exact new doses, scalar domains, source/population applicability
and scientific approvals are not granted en bloc by the engineering decision.

Do not repeatedly ask whether to prepare another method or whether the multi-method
feature is wanted. Prepare all existing catalogue entries, their exact-source gaps
and their configuration/adjustment requirements together. Missing exact protocols,
coefficients, applicability or review evidence are grouped work items, not a request
to reapprove the whole feature and not an implicit runtime approval.

The approved direction is:

- Every planned MAIN has its own stable slot and independent method selection.
- Methods belong to independently reviewed families and configurations. They are
  not hard-coded A/B pairs, one global method for the whole plan, or two mandatory
  workouts. A/B schedule candidates are a separate concept.
- Recommendations are deterministic, explainable and non-binding. The actor can
  select another eligible configuration and inspect its actual work/recovery.
- Neutral recommendation is the default; variety/repeat are optional explicit
  preferences. Display-candidate diversity is separate from repeat placement:
  the same method may occupy distinct slots only under an exact reviewed policy.
- Structure comes from finite reviewed presets. Scalar adjustments are constrained
  by versioned, field-specific rules; there is no free-form workout constructor.
- Selection and adjustment use draft/apply/cancel, exact arithmetic, content-bound
  snapshots and explicit confirmation. Existing accepted plans remain unchanged.
- Planned prescription, actual execution and observed response remain separate.
  No completion, low RPE, new record or method switch automatically increases dose.
- Existing youth and self-use scope remains. No raw memo or invented scientific
  approval enters this contract, its evidence or implementation.

Engineering implementation must preserve existing numeric authority, machine-policy
and schema compatibility unless an exact scoped extension is accepted. Product
approval of the design does not certify implementation completion, deployment,
scientific efficacy or activation of every source entry.

## 2. Source Of Truth And Current Baseline

Read [PRODUCT_NORTH_STAR.md](../../PRODUCT_NORTH_STAR.md) and
[AGENTS.md](../../AGENTS.md) before applying this contract. Ownership stays with:

| Concern | Owning contract / local evidence |
|---|---|
| Generation, selection authority and adaptation limits | [PLAN_GENERATOR_SPEC](../active/PLAN_GENERATOR_SPEC.md), including its unchanged machine policies |
| Template ownership, lifecycle, eligibility and exact allowlist | [TEMPLATE_LIBRARY_SPEC](../active/TEMPLATE_LIBRARY_SPEC.md), especially section 16A |
| Work, anchors, recovery, sequence versions and explanation/storage binding | [TRAINING_SESSION_PRESCRIPTION_CONTRACT](TRAINING_SESSION_PRESCRIPTION_CONTRACT.md) |
| Frame/exposure placement and immutable successor rules | [TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC](TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md) |
| Structured actual evidence and next-candidate boundaries | [PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT](PLAN_CYCLE_RESPONSE_AND_ADAPTATION_CONTRACT.md) |
| Calendar projection, not prescription authority | [MICROCYCLE_AND_CALENDAR_MAPPING_SPEC](MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md) |
| D9 and authorization | [PLAN_SAFETY_GATE_SPEC](PLAN_SAFETY_GATE_SPEC.md), [RULE_SPEC_D1_D9](../active/RULE_SPEC_D1_D9.md) |
| Exact inventory, source states and evidence work groups | [30-entry readiness matrix](../../reports/review/SESSION_METHOD_CATALOG_READINESS_2026-09-05.md) |

The current static baseline is four detailed refs: `V2-SEED-05@1.0.0`,
`MD-800-01@1.0.0`, `MD-1500-01@1.0.0`, `MD-3000-01@1.0.0`. Only V2-SEED-05 is
inside the 30-entry energy-system catalogue. The three MD refs are separately adopted
identities, not three extra rows in that catalogue. Exact fingerprint, record,
event/purpose/experience, authority and safety checks still determine actual use.

At the inspected PR #318 baseline, end-user runtime supports one detailed session
per candidate with selectable placement on an eligible MAIN occurrence.
The core and app transaction boundary can
represent and atomically validate multiple structurally distinct detailed sessions,
but the end-user multi-slot selector remains pending exact per-slot applicability,
exposure, cross-slot interaction and independently adopted method evidence.
The prior first-QUALITY-only placement is historical, not the current limit. One
detailed method per accepted event-purpose scope remains the numeric baseline.
The baseline's cross-slot distinct-method rejection is an implementation limitation,
not the accepted scheduling rule: section 4 and the dated section 17 decision govern
policy-bound repeat placement. This documentation pass does not claim that code
already implements that amendment.
Sequence V2 representation and structural comparison do not imply arbitrary method
activation. Current status reports are historical snapshots; they do not cap the
approved direction at a fixed pair.

## 3. Vocabulary And Independent Identity

The following are conceptual documentation fields, not a new serialized runtime
schema. Implementation must bind them to owning types and version them.

| Object | Required content and boundary |
|---|---|
| Method family | Stable `methodFamilyId`, version, purpose/context applicability, source refs and structural rationale. It groups a training approach, not a physiological efficacy claim. |
| Configuration | `configurationId`, version, family ref, exact template ref/fingerprint, preset ref, target/model refs, component refs and applicability. It is independently reviewable; it needs no mandatory paired partner. |
| Structure preset | `structurePresetId`, version, ordered work/recovery topology, units, target kinds, valid counts and exact recovery boundaries; review/evidence refs bind its full content. |
| Adjustment rule set | ID/version, permitted scalar fields, units, exact allowed values or reviewed bounds/steps, coupled constraints, comparison dimensions, evidence refs and failure behavior. Missing rule means locked field. |
| MAIN slot | Immutable `mainSlotId` scoped to a draft lineage/frame, mapping to a planned occurrence with local day, AM/PM and MAIN role. It is neither a method ID nor an array index. |
| Slot choice | Slot ref, selected family/configuration/preset/version, draft revision, selected anchor ref/confirmation and adjustment values/rule refs. |
| Recommendation receipt | Slot/context revision, eligible configuration refs, policy version, deterministic ordering reason codes, exclusions and input refs actually used; not an approval receipt. |
| Applied prescription snapshot | Exact selected content, resolved allowed scalars, source/review/model/rule versions, unrounded targets, sequence/totals, reason codes and lineage. |

Energy-intent labels and existing Template Library families are not automatically
method-family IDs. Names, IDs, anchor changes, equivalent display units, repetition
count alone, or warmup/cooldown alone do not prove a distinct MAIN method. Structural
difference uses the existing normalized work structure/unit, target, recovery and
terminal-recovery comparison. It proves a difference only, not equivalent burden.

Same-family configurations may differ only in reviewed dose and remain the same
method. Structurally different configurations may share a family. Do not generate
new families to inflate counts. No source entry acquires an executable family,
configuration or preset identity merely by appearing in the readiness matrix.

Family and configuration IDs are independent identities with an explicit versioned
relationship, not aliases derived by splitting a template ID or a mandatory 1:1
mapping. A family stays stable when a reviewed configuration is added or revised;
a configuration retains its own exact content/version and applicability. The PR #318
adapter currently uses `templateId` for both `familyId` and `configurationId`.
That compatibility convention is not the future registry contract. Expansion needs
an explicit versioned legacy-template-to-family/configuration mapping. Do not
rewrite stored original refs, reset apparent experience when a configuration ID
changes, merge unrelated families, or guess mappings for unresolved legacy refs.

Independent review replaces a mandatory pair-approval data dependency for future
choice. A claim that two options are same-purpose substitutes, or have equivalent
effects/burden, still needs its own support. Compatibility with the slot's reviewed
purpose is required independently for every offered configuration. Earlier pair
review language remains historical context, not a requirement to approve every
Cartesian pair of the catalogue.

## 4. Stable Per-MAIN Slot Selection

Allocate slot identities from the accepted schedule skeleton before resolving
methods in the eventual multi-slot implementation. Preserve them across candidate
sorting, rendering, method/preset edits,
record return navigation and duration-only support changes. Keep separate maps for
separate candidate lineages; do not accidentally share a mutable global map.

A method edit targets exactly one `mainSlotId`. It must not change another MAIN,
add an exposure, copy the first QUALITY's method to later slots, move a session,
replace support work, or duplicate warmup strides. All MAIN slots can be prepared;
per-slot detail is not restricted to the first QUALITY in the approved design.
Until the exact multi-slot policy is supplied, implement selection of the one
detailed session's placement without duplicating its dose across multiple MAINs.

Initial candidate acceptance may preserve separate single-detail target choices
for BALANCED and CONSERVATIVE. Each candidate must independently pass current
template, anchor, placement, content-identity and safety checks. Their MAIN
prescription multiset must remain equal for this bounded placement-only path;
only the selected placement may differ. Existing support duration differences
remain exact. This does not authorize new methods, doses or multiple detailed
sessions in one candidate. Automatic support-only adaptation keeps its stricter
same-MAIN-position/content rule; initial manual selection must not relax that
adaptation rule. Applying a candidate's target must not modify the other
candidate's sessions. Reconfirm the record before final plan acceptance.

Display-candidate diversity is not a cross-slot uniqueness requirement. A reviewed
method may be explicitly selected again at a distinct existing slot, but only when
a versioned placement policy authorizes that exact configuration, slot/frame scope,
exposure accounting, cross-slot interactions and applicable safety constraints.
The placement receipt must bind the policy identity/version, review evidence and
the explicit choices. Missing, expired, revoked, out-of-scope or failed policy
validation rejects the entire multi-placement transaction. No arbitrary spacing
threshold or unrestricted repeat permission is created here.

The policy gate requires a caller-supplied evaluation timestamp, a nonempty
valid-from/valid-until interval and a null revocation marker for new multi-placement.
Missing lifecycle fields do not mean unlimited approval. Time is not inferred from
the device clock inside the pure core. Bind the policy to the exact canonical frame,
session layout and non-detailed prescription context. The scope projection excludes
private anchors, labels and resolved individual target pace; those remain subject
to the separate prescription authority and content checks. Detailed configuration
references are evaluated against the policy's independent allowed set, not a fixed
A/B pairing. Explicit exposure/interaction/safety review references are required.
The existing single-detail and historical-read paths do not acquire new prerequisites.

Duplicate slots always reject, including repeated references to the same occurrence.
Distinct slots with the same method are a policy decision, not fake display
diversity; distinct methods also still require the placement policy. Revalidate
this distinction at candidate binding, save/reload/restore and execution/adaptation
boundaries. Neither optional `PREFER_REPEAT` nor a recommendation grants placement
authority. The PR #318 blanket same-method/same-structure rejection remains a
known baseline gap addressed by the main code author's policy-bound foundation.

The parent's 2026-09-06 implementation direction is one central detailed-MAIN
placement-policy gate shared by binder, schema and adaptation. The reviewed runtime
multi-placement registry must remain empty without accepted frame-combination
evidence. Keep the existing approved single-method path and supported old-plan
compatibility. Generic core test policies may permit repeated exact configurations
to verify this contract; they are synthetic fixtures, not runtime approvals and
must not populate that registry. A shared gate is integration foundation, not live
multi-MAIN selection or completed adjustment persistence. This paragraph records
the parent's direction, not independently executed evidence of the new code.

Display day and AM/PM as human context, not the sole identity. A planned occurrence
content fingerprint changes when its prescription changes; the editing slot ID
does not. This distinction prevents both lost selection and stale journal links.
AM and PM on the same date are different slots; two unresolved MAINs at the same
address are ambiguous, not silently merged. Existing double-session/QUALITY gates
remain unchanged, including [DOUBLE_SESSION_BETA_SAFETY_CONTRACT](DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md).

Changing start date, availability, frame, event or purpose invalidates confirmation
and pending saves. Preserve choices only through an explicit one-to-one lineage
crosswalk when the schedule skeleton still represents the same occurrence and each
configuration remains eligible. Removed, inserted, moved or ambiguous slots require
fresh mapping/review. Never remap choices by ordinal position. Explicit rescheduling
is owned elsewhere; this contract adds no silent relocation permission.

## 5. Deterministic Recommendations

1. Capture an immutable structured context revision and evaluation time. Check
   scope, processing authorization, holds and Safety Gate before recommendation.
2. Filter by exact accepted configuration identity, lifecycle, current authority,
   event, slot purpose/cycle context, experience and required record/inputs. Unknown,
   rejected or research-only sources do not enter candidate ranking or counts.
3. Apply only a versioned recommendation policy whose predicates and precedence are
   explicit. Preserve a still-eligible explicit slot choice. When no choice exists,
   a reviewed slot-default configuration may be highlighted as a recommendation,
   not applied. An explicitly requested different method uses only eligible distinct
   structures; no candidate is manufactured to satisfy a count.
4. Within a policy's equal-priority eligible results, preserve stable catalogue
   order: family order followed by configuration order in the supplied versioned
   catalogue, represented by `catalogOrder`. Do not sort IDs lexically. This order
   is a technical tie-break, not a quality or scientific ranking; catalogue order
   and version are part of the deterministic input.
5. Bind the recommendation to context, candidate set and policy versions and show
   reason codes and missing inputs. Identical inputs/versions/evaluation time yield
   identical output. Incidental file discovery order, randomization, wall-clock drift, labels,
   popularity, streaks or LLM prose cannot choose the method.

No new physiological scoring weights, universal family rankings, optimality claims,
readiness cutoffs or rotation frequency are specified here. An absent reviewed
default/ranking policy yields an explicitly unranked eligible list and a reason,
not a fabricated recommendation. Missing exact inputs suppress only the unsupported
numeric output/choice; maintain existing authorized RPE access without relabelling
it a second detailed method. Do not silently save RPE in place of requested detail.

Current baseline observation (PR #318, rechecked 2026-09-06):
`plan-template-options.ts` filters exact eligibility, calls `loadPlanMethodHistory`
for the selected event and passes structured archived history to the core. New
archives write v4 per-PACE_TARGET-slot rows; v3 selection-only refs map to a missing
outcome, never inferred completion. The earlier `history: []` / core-only-history
description was an initial 2026-09-05 snapshot and is superseded as current state.
The baseline caller defaults to `PREFER_VARIETY` and supplies equal zero eligibility,
purpose and context priorities after filtering. It is not an implemented model of
neighboring load, cycle goals or recovery, and one accepted same-scope method cannot
demonstrate visible multi-method ranking differences.

Accepted requirement (2026-09-06): default to `NEUTRAL`; offer `PREFER_VARIETY` and
`PREFER_REPEAT` only as optional explicit preferences, without an extra mandatory
intake step. Retain eligible structured history even in neutral mode; neutral means
no repeat/variety tie-break, not empty history. Eligibility, purpose and reviewed
context precedence come first, the optional preference then uses the permitted
self-reported completion counts, and stable `catalogOrder` breaks remaining ties.
Show the actual inputs/reasons and missing coverage without claiming unimplemented
context. Recommendation is neither automatic selection nor a scheduling policy.

Representative display candidates should expose genuine structural alternatives
(currently up to two, with all eligible options inspectable). Same-structure or
count-only configurations must not inflate that diversity. This presentation rule
must not force distinct methods across separately reviewed schedule slots.
Selected counts, self-reported completion and measured adherence remain separate
(section 11). Missing/not-performed history is not evidence of zero exposure.
History use requires scoped, deduplicated exact-occurrence evidence and the owning
privacy/safety gates; no invented recent-N penalty or time window is introduced.

Same-method reuse in later cycles is valid. Diversity is an option, not mandatory
rotation or exposure. Historical counts, planned intent or low observed RPE do not
automatically favor a harder method.

## 6. Finite Presets And Constrained Scalar Rules

The editor selects complete reviewed structures. Distance, duration, nested sets,
ordered mixed segments and distance recovery may be represented by the existing
sequence model, but generic representability never makes them selectable.

| Change surface | Rule |
|---|---|
| Order, work unit/kind, nested topology, target kind, recovery unit/mode, terminal placement | Select a different exact reviewed preset/configuration; no arbitrary node insertion or drag-built workout. |
| Counts, work distance/duration, target value or recovery amount | Editable only if that exact field is unlocked by a reviewed scalar rule with units, domain, increments and coupled constraints. Counts remain positive safe integers. |
| Same-event record-based target | Use the selected valid current same-event anchor and adopted model. Do not select the fastest record or turn a goal into current capability. |
| Recovery ratio | May calculate only after the exact ratio, work basis, mode, applicability, rounding and bounds are reviewed and versioned. This contract supplies no invented ratio. |
| Components | Retain exact warmup/cooldown/fallback/stop refs. Reuse across methods requires accepted applicability; they are not copied from another template by convenience. |
| Unsupported adjustment | Explain the locked field/missing evidence; reject atomically, do not clamp, extrapolate, substitute or create a numeric reduced-repeat variant. |

Every rule records source protocol versus operational adaptation, affected fields,
allowed domain, defaults (if any), conditions, dose dimension effects, required
inputs, missing-input behavior, source/review identity and contract examples.
A source range is not an authorized slider. Its midpoint, endpoints or step size
must not be invented or selected as a default. Named `downshiftOptions` without
exact adjustment evidence are labels, not executable transformations.

Review coupled changes across the complete configuration: fewer repetitions with
faster targets or shorter recovery is not automatically less demanding. Recovery
lengthening is not universally proven safe either. Do not infer interchangeability
from equal work distance/time. Evaluate all adopted component/cycle constraints;
unknown comparison dimensions stay unknown and block an unsupported transformation.

The current adopted four retain fixed exact doses and atomic RPE fallback, not new
scalar editing. A later reviewed editor must be wired through exact authority and
content checks. This contract does not weaken existing rejection of coordinated
source/sequence tampering or modify current machine policies prohibiting a free
numeric editor and percentages.

## 7. Exact Work And Recovery Arithmetic

Use unrounded internal units; presentation follows its versioned rounding policy.
Unknown is not zero. A recovery boundary with no prescribed occurrence contributes
zero occurrences; a real occurrence with missing time/distance makes that dimension
unknown. Preserve work, repetition, set, transition and terminal totals separately.

For uniform S sets of N repetitions:

```text
workOccurrences = S * N
workDistanceM = workOccurrences * exactWorkDistanceM       (when distance-defined)
repetitionRecoveryOccurrences = S * max(N - 1, 0)
setRecoveryOccurrences = max(S - 1, 0)
repetitionRecoverySeconds = repetitionRecoveryOccurrences * exactRepRecoverySeconds
setRecoverySeconds = setRecoveryOccurrences * exactSetRecoverySeconds
```

At set boundaries, set recovery replaces the final child's repetition recovery;
never add both. For unequal sets sum each set's own `max(N_i - 1, 0)` and exact
work units. For nested/ordered structures follow the existing sequence semantics:

- With parent multiplicity M and node repeat count N, work instances are M*N and
  between-repeat gaps are M*(N-1). A group repeats its ordered children M*N times.
- Segment repeat recovery is repetition recovery; group repeat recovery is set
  recovery. Between sibling nodes, `recoveryAfter` occurs M times at that level,
  not after the final child. The parent boundary owns the next recovery.
- A root V2 `terminalRecovery` contributes one occurrence only when explicitly
  applicable. Explicit NOT_APPLICABLE means none. V1 retains its no-terminal shape.
- The final child's unused `recoveryAfter` cannot stand in for terminal recovery.
  Terminal recovery is before cooldown and is counted once, never as MAIN work or
  again as cooldown. Warmup and cooldown stay outside MAIN quality totals.
- Time-defined recovery and distance-defined recovery are mutually exclusive
  prescribed units. Preserve mode, including ACTIVE_ROLL_ON. Do not convert distance
  recovery using work/race pace or silently label it JOG.
- MAIN elapsed time is available only when work and all applicable recovery times
  are available. Known subtotals can be shown as partial with missing-reason codes.
  Never add metres to seconds or report a partial sum as the whole session.

The adopted same-event calculation remains:

```text
targetRepSeconds = anchorPerformanceSeconds * repetitionDistanceM / anchorEventDistanceM
```

It needs exact same-event current-capability inputs and explicit confirmation.
It is not a threshold, vVO2max, sprint-under-60m, recovery-speed or race-equivalence
model. Work duration inferred by that reviewed model is still planned, not actual.

Existing-source arithmetic controls (not newly approved doses):

| Local fixture | Exact work | Exact recovery and boundary |
|---|---|---|
| Adopted V2-SEED-05 | 5 * 1000 m = 5000 m | 4 * 150 s = 600 s; no separate terminal recovery |
| OWNER-NOTATION-001, parser only | 2 * 10 * 400 m = 8000 m | 18 * 60 s + 1 * 180 s = 1260 s; no extra final repetition recovery |
| Unadopted 12 x 400 m roll-on example | 12 * 400 m = 4800 m | 11 * 100 m between repeats + 1 * 100 m terminal = 1200 m; recovery seconds unavailable |

The roll-on example is outside the 30-row catalogue. Its source's race rhythm is
not automatically the current-record calculation or VO2 intent. Its exact purpose,
population, preparation, configuration and adjustment evidence remain grouped gaps.
The separate 15-repeat example is not merged with it.

## 8. Draft, Apply And Cancel

| Stage/action | Required behavior |
|---|---|
| Open editor | Copy the candidate's current slot choice into an isolated draft with `draftRevision` and expected candidate/base revision. No active-plan write. |
| Choose family/configuration/preset or adjust scalar | Increment draft revision; recompute structure, totals, eligibility, differences and explanation. Invalidate numeric confirmation, old apply intents, pending saves and retries. Other slots remain unchanged. |
| Review | Show selected slot, proposed versus baseline work/target/recovery, known/unknown totals, dose dimensions, reason/source/model refs and limits. Recommendation is not selection. |
| Apply to candidate | Explicit actor action; recheck draft/base revision, slot crosswalk, scope, source/authority validity, anchor confirmation, rules, safety/holds and complete plan constraints under the mutation lock. Atomically replace only this slot's draft binding and create a new candidate content identity. |
| Invalid/conflicting apply | No partial numeric fields, slot writes, accepted plan, audit success or delayed retry. Keep the old candidate; retain an invalid draft only as visibly uncommitted editing state. |
| Cancel / leave without apply | Discard this editor draft; restore the prior candidate choice exactly. Cancel after a prior candidate apply does not silently undo that earlier applied candidate revision. Neither changes an accepted plan. |
| Select/save plan | Separate explicit action validates the entire candidate and all slots and binds fresh identities. Applying an editor is not plan acceptance or execution authorization. |

Event/record/start-date changes, return to intake, withdrawal, or a newer draft
invalidate any in-flight save. Recheck inside the mutation lock immediately before
persistence; do not let a queued stale request activate later. Exact replay is
idempotent; reuse of an idempotency key with changed content is rejected. Cancel
invalidates queued applies as well as the visible editor state.

For the existing initial-plan storage path, an identical retry may return the
already stored, untouched version-3 selection without another plan/context write.
Recheck current account, draft, safety, anchor and template authority first. Rebuild
the expected selection using its original capture time and compare the entire
snapshot, including dates, cycle lineage, evidence and explanation receipt. Any
progress, changed request or future capture time prevents this replay. If the
selection requires an adaptation context, that exact complete candidate context
must also exist; a missing, invalid or conflicting context is an uncertain save,
not permission to acknowledge success or silently repair it. This read-only retry
does not make the existing multi-key browser storage physically atomic.

The editor-to-candidate commit host must independently recompute submitted receipt
totals, differences and before/after content, checking the trusted policy both at
the explicit action timestamp and immediately before the write. Future action
timestamps, expired/revoked policy, missing or duplicate versioned explanation
bindings reject the transaction. Bind numbers, explanation references and receipt
in one immutable workspace revision; field-by-field writes are not this contract.
The owner-provided compare-and-swap adapter must revalidate under its actual lock.
An editor unmount or abandonment invalidates a queued apply. A saved-but-unconfirmed
response may replay only the exact prior intent and matching stored receipt without
a second write. This workspace transaction grants no new active-plan storage shape,
retention duration, template dose, policy or runtime activation authority.

Source configuration identity must not contain athlete anchor IDs, resolved pace
or session occurrence IDs. The recommendation catalogue and adjustment preparation
must read the same exact source configuration. A separately named local resolution
binding connects that source to the exact stored prescription, unrounded target,
anchor-content fingerprint and explanation version/evidence references. Resolution
identity changes when any of these changes; it is not a new method family or dose.
This binding is not a signature, new scientific approval or export permission.
Existing archived prescriptions without this projection remain readable; do not
rewrite their saved fingerprints or infer new explanations retrospectively.

The source-to-resolved adjustment offer must preserve an exact directed edge.
Resolve only explicit source RACE_PACE anchor placeholders for the same event;
this adapter does not calculate new pace, convert distance/time or change recovery.
Bind the caller's current candidate/slot revision and anchor to a separate resolved
context. Preserve source policy lifetime and evidence, and keep source and resolved
policy references separately named. Do not infer reverse or transitive permission.
Before consuming an applied resolved receipt, rebuild the offer from the current
trusted source authority and revalidate the exact source edge and resolved receipt.
An empty eligible edge set is unavailable, never a no-op editor or synthetic offer.

The resolved context must include the validated anchor content fingerprint, not
only its record ID. Updating a performance while keeping the ID invalidates an old
receipt even if a caller fails to change its separate candidate revision. A target
resolution consuming the source offer independently recomputes this fingerprint
from the exact original validated prescription's selected anchor.

For current same-event RACE_PACE only, a distance segment's unrounded target seconds
are current performance seconds multiplied by segment distance divided by event
distance. Time segments preserve their explicit work duration and do not acquire a
fabricated covered distance. EFFORT_GUIDANCE and SPRINT_REFERENCE do not inherit a
race-pace numeric target. Preserve nested work/recovery structure and keep structural
totals distinct from pace-based estimates or actual performance. Unknown values
remain null. Existing preparation/cooldown components are copied unchanged; source
MAIN adjustment authority does not authorize replacing these components.

This projection must use a separately named candidate-only kind, not rewrite the
legacy PACE_TARGET flat fields with incompatible mixed/time values. Its identity
binds the original resolution, new source configuration, exact sequence, segment
targets and anchor content. The adjusted source configuration needs its own matching
explanation; never fall back to the original explanation as though the work/recovery
were unchanged. This projection alone cannot be saved as an accepted active plan.

The commit adapter must obtain a fresh explicit account/safety/candidate eligibility
decision from its owner, not derive permission from source-policy validity alone.
Check it before exposing the environment and again inside the owner's mutation
lock. Resolve each explanation from one exact source configuration binding; missing,
duplicate or malformed bindings cannot be substituted by another configuration's
explanation. Source policy changes while waiting for the lock invalidate the apply.
The adapter supplies no persistence, new dose or operating policy by itself.

An explicitly opened editor may retain one version-1 pending workspace per account
in the current tab's sessionStorage. Its envelope contains the exact unmodified
candidate/slot baseline and the latest applied workspace state; it is neither an
active plan nor an archive. Restore only against the independently reconstructed
current candidate baseline and current authority, never a baseline or policy read
from the saved envelope alone. A stored apply must pass the existing exact replay
checks for numeric content, explanation, receipt and revision before restoration.

Opening a different candidate/slot or revision must not overwrite the pending
workspace. Explicit discard clears only the exact opened snapshot. After a pending
apply is consumed by a separately validated candidate update, discard it before
opening a new baseline; this envelope is not a growing action history. Account
switches invalidate an open handle; anonymous drafts are not transferred at login.
Read/write failures and malformed storage preserve unknown bytes and deny reuse.
Use the existing cooperating mutation lock and verify the single-key write. If a
write cannot be confirmed, do not acknowledge success or overwrite newer content
with rollback guesses. Include all account-scoped drafts in erase-all. No cloud,
backup, export, active-plan mutation or extra archive retention is added. Browser
session restoration may preserve sessionStorage; do not promise deletion at a
fixed time or treat it as a security/consent boundary.

Editing an already accepted plan opens a proposed successor, not an in-place
prescription edit. Current-frame safety holds and separately authorized recovery
actions keep their existing owning contracts; this editor does not enable new ones.
Local self-service and authenticated coach/account paths remain distinct.

## 9. No Automatic Dose Increase And Cycle Boundaries

PB/SB, completion, attendance, streaks, points, low RPE, repeated matches and method
availability cannot mutate an accepted plan, promote a preset or increase volume,
intensity or frequency. An explicit request is necessary but does not itself approve
a new quantity. Do not make up a lower-volume sibling by subtracting repetitions.

New initial-candidate selections must fit the already accepted frame/exposure
constraints. Next-frame adaptation still needs an existing versioned successor or
transform with approved values and at most one changed INTENSITY/VOLUME/FREQUENCY
dimension. This feature grants no more permissive transform. Structural variation
can affect several dimensions; it cannot be renamed a harmless single change.
Without exact compatible transformation evidence, retain comparison/preparation
only and preserve the active frame.

Methods replace a selected MAIN, never add one. No missed-MAIN catch-up, forced
rotation, new fixed recovery-hour threshold, automatic taper or long-cycle
progression is introduced. Calendar projection preserves slot/version lineage;
cycle position is context, not proof of readiness or adaptation.

## 10. Versioned Snapshots And Historical Preservation

Bind each newly accepted prescription to the exact slot,
family/configuration/preset refs and versions, template fingerprint, adjustment-rule
and model versions, structured selected inputs, source/authority refs, resolved
sequence, totals, unavailable reasons, recommendation/selection distinction and
explanation version. Use the owning identity/hash envelope; an ID alone is not
content verification. Recompute from authorized source content, not from two
equally tampered views that merely agree.

Snapshots are immutable once accepted. A changed anchor, method, rule or catalogue
revision creates a new candidate/prescription identity and explicit lineage. Reload,
backup restore, START/RESTART and successor acceptance must validate that content
and authority under their existing gates. Expiry/revocation can block future use
but does not authorize erasing or rewriting historical content.

Old V1 plans and old plans without sequence/family/configuration fields stay valid
in their original supported format. A read-only derived view must be labelled as
derived, not backfilled as a historical selection reason or newly stored snapshot.
Unknown schema/invalid data is preserved for recovery but cannot execute; do not
rewrite it into a guessed valid plan. Backup and restore preserve exact private
snapshots under existing scope. Public cards/export summaries do not acquire anchor
refs, private candidate fingerprints, sequence content or explanation evidence in
IDs or payloads. No new account/server sync is authorized.

Preserve the existing rolling archive semantics: the current store retains the
latest 18 archived plan/frame summaries, across events before event filtering.
This is not 18 method occurrences, a fixed 24-week/recent-N-day observation window,
or an immutable lifetime ledger of full original prescriptions. The core uses all
history supplied by that bounded archive; disclose actual coverage and missingness.
Do not enlarge its retention limit, erase old entries outside that limit, or backfill
old summaries. Section 10A defines the versioned original-content addition for new entries.
Coverage disclosure uses the same loaded archive snapshot as recommendation input.
Show total retained plans, same-event plans, legacy plans with unknown event,
unmapped template references and missing self-reported outcomes separately.
Archive timestamps describe archiving only, not training dates or a continuous
observation interval. If actual session dates are unavailable, state that limitation.
Injected history without coverage metadata must not borrow dates from local storage.
Retained original plans/backups keep their exact supported content and lineage;
new immutable prescription snapshots and any longer-term ledger need their own
versioned storage integration, not a claim that v4 summaries already contain them.

### 10A. Bounded V5 Original-Plan Integration

The approved immutable-snapshot work uses a new version-5 history entry for future
archives. Keep the existing account-scoped history key and latest-18-plan limit,
applied across events before filtering. This is not a longer retention period or a
new lifetime ledger. Do not upgrade, reconstruct or backfill legacy/v3/v4 summaries.

Each new entry includes the supported original version-3 plan, its content hash,
archive reason (manual archive or accepted successor) and the existing summary.
The hash is content integrity, not independent approval. Validate the original plan
with its owning schema and exact candidate/template identities; recompute the
summary from that original. Manual archives retain their existing progress summary;
successor archives retain their existing visible-projection progress summary while
preserving the complete original separately. Preserve original capture time, dates,
AM/PM, prescription sequence, anchors, lineage and explanation metadata as supported
by the owning plan schema. Never substitute the currently active plan for an older
linked occurrence. Unknown originals remain unavailable, not inferred from summary.

No memo, symptom text, new measurement, external LLM input, public-card field or
new server-sync payload is introduced. Existing account isolation, device-data
removal and local erasure apply to the same scoped key. Eviction remains the existing
18-plan rule. Invalid/unreadable history prevents archive replacement; it must not
be treated as an empty list and overwritten. A read-only history consumer reports
the number of retained original plans separately from summaries without originals.
Reading old originals grants no execution, recommendation or new adjustment authority.

### 10B. Adjusted Per-Session Snapshot Codec

The private version-1 adjusted-method DTO binds the original supported prescription,
candidate lineage and MAIN slot, source configuration/policy references, exact
anchor-content context, adjustment receipt, resolved sequence/targets/totals and
the independently supplied explanation version/content fingerprint. Keep the
original unrounded values. The snapshot is not a new active-plan schema variant,
storage key, plan selection receipt or new configuration approval.

Require the adjusted configuration's exact explanation, including purpose, energy
supply, work/recovery rationale, cycle role, expected adaptation, limitations,
observation and evidence references. Persist its references and content fingerprint,
not a second prose copy. A bound snapshot must not retain the projection's earlier
"explanation required" placeholder. A missing, changed or mismatched explanation
cannot be silently substituted with the original configuration's explanation.

Historical reading requires independently trusted retained source and explanation
versions. Recompute the original resolution, receipt, targets, structural totals and
the complete snapshot content at capture time. Reject mismatched slot/context,
future capture times, extra fields and coordinated payload/self-hash tampering.
Saved authority strings are not a trusted registry; do not store an authority
registry inside the snapshot and then trust it on reload.

Historical readability carries execution authority NONE. Current candidate use
requires a second check at the current time, so a historically valid expired policy
does not authorize reuse. The owning plan still must revalidate current account,
record, candidate lineage, complete placement and safety inside its selection lock.
Neither a historical read nor candidate-ready codec result bypasses those gates.

This codec performs no browser/server writes or public export. Full active-plan
type/schema and all display, archive, journal and execution consumers must support
the new representation before enabling it. Existing PACE_TARGET flat-schema
validation must not be weakened to pretend time/mixed work is a flat distance set.
Missing trusted old versions leave the raw stored content intact for recovery;
they do not authorize guessed historical explanations or replacement prescriptions.

### 10C. Staged Candidate Assembly

Bind an adjusted snapshot to the exact current original candidate, selected plan
start date and one existing detailed QUALITY day/AM/PM address. The candidate's
owning schema and identity must validate first. Match the snapshot's original
prescription to that exact session; a matching opaque slot ID alone is insufficient.
Changed candidate content or calendar start invalidates the previous binding.

Assemble a separate ADJUSTED_PLAN_CANDIDATE with NOT_ACCEPTED and selection
authority NONE. Replace exactly the addressed session prescription with its
ADJUSTED_METHOD snapshot while preserving role, purpose, all other sessions,
frame and continuity. Do not add sessions, distribute an adjustment over other
MAIN slots, edit a saved active plan, or reuse the original candidate ID as the
new content's identity. The staged payload has its own content fingerprint.

The staged representation is deliberately not accepted by the existing flat
PlanCandidate storage/activation parser. Its next gate is complete current plan
selection revalidation, including real applicability/placement/adjustment policy,
record/account/safety context and exposure accounting. Assembly is not that gate.
No UI control may claim the staged candidate was saved or started before its
owning schema, execution, explanation, archive and journal consumers are connected.

### 10D. Complete Adjusted-Frame Review Scope

The new adjusted representation must not pass the old PACE_TARGET-only placement
filter by disappearing from its detailed-session count. Its review scope includes
the event/purpose, actual experience matching the original source scope, source
population and selection actor, candidate kind, frame/continuity, exposure ledger,
unchanged operational-component refs and every session address/role/purpose.
Preserve surrounding RPE/time doses in the scope. Bind the source/target exact
configuration and source adjustment-policy reference of the changed MAIN.

Keep personal record IDs and resolved target seconds out of this configuration
review projection. They remain bound and revalidated in the individual candidate,
snapshot and current-record selection checks. Calendar start is independently
bound by section 10C; it is not permission to reuse an old snapshot on a new date.

Look up exactly one applicable entry from an independently trusted registry with
configuration, exposure, interaction and safety review references; exact scope;
valid-from/expiry and revocation. Reject duplicate policy ID/version identities,
including a conflicting revoked duplicate. Missing lifecycle/reference/scope data
does not mean a default permit. The runtime registry remains empty until actual
operating evidence is supplied. Synthetic TEST entries never populate it.

The result reviewed_scope carries execution authority NONE. This is a versioned
configuration-scope check, not verification that named humans signed the refs,
a D9 decision, current account/anchor check, final selection receipt or storage
transaction. The owning full-plan selection gate must still perform those checks
under its lock and must not treat this partial result as permission to save/start.

## 11. Planned, Actual, Youth And Privacy

The planned occurrence carries its immutable prescription/version. A later actual
record links to that exact occurrence, not today's active plan or only its date.
Completion marks do not create actual distance, duration, split, recovery or proof
that the prescription was followed. Modified/partial/skipped/rested results and
duplicate/conflicting links retain explicit relations and exclusions.

The active-plan and exact archived-original observation readers may project directly entered, explicitly
provenanced distance, duration, pace and RPE from exact linked structured journals.
Missing fields remain null; imported or derived values require their separate
eligibility path. Identical duplicate records count once; conflicting records
suppress numeric observations rather than selecting an arbitrary result.
No split, recovery measurement or adherence verdict is inferred. Original plan
snapshots are required; v4 archive summaries cannot reconstruct old prescriptions.
This projection does not read memo text or grant recommendation authority.
The reader must preserve journal storage read completeness before projection.
A storage exception, malformed JSON or rejected record is unavailable evidence,
not an empty journal. Do not show partial surviving rows as a complete observation
set, or rewrite the original data to make this read succeed. A genuinely complete
empty scoped read may report no linked journal.

In the PR #318 v4 adapter, `COMPLETED` maps to stored `PERFORMED`. This is
self-reported completion of a planned occurrence, not measured adherence to its
method, pace, repetitions or recovery. `RESTED`, `SKIPPED` and `PAIN_CHECKIN` map to
`NOT_PERFORMED`; no response maps to `MISSING`. These are recorded progress states,
not proof of all activity or non-exposure. Preserve the serialized enums for old
data compatibility and label their evidence meaning honestly. Measured adherence
requires separately eligible actual measurements, exact prescription/occurrence
linkage and a reviewed comparison; never fill actual metrics from planned values
or promote these counts into adaptation, efficacy or physiological evidence.

PACE_TARGET RPE is an observation unless an adopted planned RPE comparison exists.
Do not invent that range, classify measured physiology from intended energy labels,
or let comparisons rewrite plans. Each displayed number states whether it is
planned, explicitly observed, derived from eligible observations, or unavailable.

Existing 800 m through marathon product scope, approved experienced youth/adult
detail and self-use remain; this does not invent detailed templates for every event
or activate 100-400 m specialist plans. Short work for other accepted events needs
its exact applicability, and under-60m work never acquires race-pace conversion.
Age, sex and school division alone neither reject training nor change dose.
Training eligibility and processing authorization remain separate: approved SYSTEM
templates can be explicitly selected by the athlete after all gates; TENANT/COACH
templates retain scoped coach authority. Guardian, sensitive-processing, account,
sync and sharing guards are not removed, and base service is not made dependent on
unnecessary sensitive consent.

No raw diary/memo, symptom/medical/guardian-private clause, quote, embedding, text
hash, presence/length metadata or private-self-only signal is a method, adjustment,
ranking, explanation or audit input. Use only eligible structured fields, opaque
safety refs, bounded reason codes and minimal scoped lineage. D9 ACTIVE/UNKNOWN,
stale safety or active holds block actionable selection; CLEARED is not medical
clearance. No recommendation or user confirmation overrides these conditions.

## 12. Engineering Work Packages And Evidence Handoff

| Package | Deliverable / stop condition | Authority and dependency |
|---|---|---|
| SPEC | This durable contract plus owning SPEC/cycle cross-references before final markers; historical issues/counts preserved | Binding approved engineering direction; numerical activation is separate |
| Whole catalogue | Exactly 30 local IDs with source/version/lifecycle/parser states and per-entry gaps; separate four-ref baseline and outside-catalogue examples | All entries are in preparation scope, including unusable audit records |
| Source/configuration preparation | Group original protocol location, access state, exact structure, target, recovery, scope and operational deviations for every entry | Continue evidence preparation without repeated feature-approval prompts; absent evidence remains absent |
| Adjustment preparation | Per-family/configuration scalar domains, finite presets, coupling/rotation/transform evidence and explicit unsupported fields | Engine/editor implementation is approved; no invented numeric bounds or executable unreviewed rules |
| UI/core implementation | Selectable placement of one detailed session, live history-aware deterministic recommendations, bounded editor transactions and content validation | Implemented foundation; no concurrent detailed-dose duplication in the live UI |
| Multi-slot/storage integration | Atomic multi-placement transaction, aggregate candidate identity, versioned history snapshots, restore/execution and actual linkage | Core/app boundary prepared; exact policy and end-to-end evidence required for every placement, including explicit same-method repeats. A genuinely different alternative additionally requires independent same-scope adoption |
| Verification | Positive/negative and mutation evidence, storage/reload/restore, cancellation races, desktop/mobile reader/editor journeys | Required evidence tied to exact artifacts; implementation reports own observed results |

Source extraction, exact operational choices, scientific/population review,
runtime binding and end-user selection are different stages. No AI reviewer can
invent a scientist identity, signature, qualification or evidence digest. Existing
baseline adoption is not revoked by absence of a new independent review. New
evidence gaps should be delivered as consolidated exact work packets with named
fields and source locations, not recurring yes/no feature-approval prompts.

## 13. Required Verification Matrix

These are implementation acceptance requirements, not a substitute for observed
runtime results or additions to the historical issue/test counts in peer documents.

| Case | Expected result |
|---|---|
| Current single-detail placement | One eligible shared day/AM/PM target receives the exact adopted dose; a second concurrent detail, ambiguous target or mismatched scope rejects |
| Concurrent multi-slot detail without exact policy | Remains unavailable; eventual multi-slot cases below do not authorize enabling it early |
| Same method, distinct slots, exact reviewed repeat policy | Explicit choices may bind only within policy scope; atomic save/reload/restore/execution checks preserve both occurrences and original plans |
| Same method, distinct slots, absent/expired/revoked/out-of-scope policy | Atomic reject with no partial writes; repeat preference alone is insufficient |
| Shared binder/schema/adaptation gate with empty runtime registry | Generic core repeat-policy fixtures can pass their scoped tests; runtime multi-placement remains unavailable, and existing single-method/old-plan compatibility remains supported |
| Duplicate slot under any method or policy | Always reject; no duplicate occurrence or exposure |
| Display diversity versus scheduled repeats | Same-structure/count-only display options do not inflate diversity; that rule cannot blanket-reject independently authorized repeat placements |
| Multiple MAINs, AM/PM, candidate reorder | Independent choices remain on stable slots; no first-QUALITY-only or index binding |
| Change one method/preset | Only target slot draft changes; other MAINs, support, frame and exposure count remain intact |
| Delete/insert/move/ambiguous slot | No automatic ordinal remap; invalidate/review exact crosswalk and confirmations |
| More than a fixed pair; count-only variants | Independently eligible configurations work without pair IDs; method diversity is not inflated |
| Same versioned catalogue/order, context and assessments | Same eligible results/recommendations/reasons; stable catalogue-order tie-break, never lexical IDs |
| Equal-priority entries with deliberately different ID order | Catalogue order wins; an intentional catalogue reorder is a changed input, not nondeterminism |
| Neutral default and optional repeat/variety | Neutral retains structured history without a repeat/variety tie-break; explicit preference changes only eligible ordering, never selection, dose or placement authority |
| Live archived history and completion semantics | v4 rows and legacy selection-only/MISSING stay distinct; COMPLETED/PERFORMED is self-report, not measured adherence or zero-filled actual metrics |
| Independent family/configuration mapping | Reviewed configuration changes preserve stable family identity through explicit mapping; original refs remain intact and unknown mappings stay unresolved |
| Bounded archive and old original plans | Latest 18 plan/frame entries retain existing order/limit and legacy compatibility; new V5 originals validate against their exact summaries; no fixed-week claim, lifetime-ledger claim or reconstruction of missing originals |
| Missing source/rule/default, unusable protocol | No invented numeric recommendation, preset, coefficient or approval |
| Invalid scalar/coupled configuration | Atomic reject; no clamping, hidden higher dose or unsupported lower-repeat sibling |
| Uniform/nested/unequal work and terminal recovery | Exact occurrence arithmetic; parent boundary replaces child recovery; no double-count |
| Distance recovery or unknown work time | Separate metre/second totals and missing reasons; no work-pace conversion or zero-filled elapsed time |
| Cancel, record return, queued save, concurrent apply | Stale revision cannot apply/save later; exact replay once, changed replay rejects |
| Coordinated source/sequence/ID tampering | Reject after authoritative content validation, even when local fingerprints are recomputed |
| Old V1/no-sequence plan reload/backup/start | Original supported shape/identity/receipt preserved; no invented historic rationale |
| PB/SB, low RPE, completion, method switch | No automatic dose/frequency increase or accepted-plan mutation; successor constraints remain |
| Modified/partial/skipped actual; duplicate link | Preserve exact occurrence/version and exclusions; no invented actual metrics or target RPE |
| Youth/self-use and coach-owned template | Existing age-neutral scope and owner-specific selection/processing gates both remain |
| D9/hold changes during edit/apply | Block at atomic recheck; no fallback save that changes the requested method silently |
| Safety or authority changes while awaiting the storage lock | Re-read safety and re-authorize the exact selection inside the lock immediately before writes. No prior successful preview may substitute for this check. |
| Raw memo content and metadata, public projection | Zero method/ranking/dose signal; no private identity/sequence leak |

## 14. Open Implementation Issues

Counts below apply only to this contract's four explicit implementation/evidence
work items. They are not new canonical-promotion blockers: the engineering direction
is accepted with these enablement boundaries. `canonical_blocking_count: 0` does not
grant canonical promotion or authorize the pending behaviors. Peer issue tables
are independent and unchanged; grouped catalogue gap IDs remain work-packet labels.

| Issue ID | Status | Canonical blocking | Required evidence before the affected behavior is enabled |
|---|---|---|---|
| `OI-SMSA-MULTI-SLOT-POLICY-001` | OPEN | NO | Exact per-slot applicability, exposure, cross-slot interactions and schema/lineage policy before concurrent detailed sessions; current one-detail placement remains valid. |
| `OI-SMSA-CONFIGURATION-EVIDENCE-001` | OPEN | NO | Exact usable source, configuration/components, target and population/operational evidence for each new selectable method; unusable entries remain excluded. |
| `OI-SMSA-ADJUSTMENT-EVIDENCE-001` | OPEN | NO | Exact scalar/preset domains, coupled constraints and successor/rotation rules with real evidence and version binding; no inferred range or dose. |
| `OI-SMSA-INTEGRATION-EVIDENCE-001` | OPEN | NO | Artifact-bound UI/core/storage/reload/cancel-race/actual-linkage evidence for each enabled scope. v4 history wiring exists; neutral preference UX, policy-bound repeats, identity mapping and any measured-adherence extension still need their own evidence. Partial checks do not close full integration. |

Recount: four issue rows, all OPEN, zero YES in the canonical-blocking column.
Existing single-detail placement tests do not close concurrent multi-slot or
new-dose evidence requirements. Each issue can be resolved only for its stated
scope with exact evidence, not by changing the contract status label.

## 15. Change Ledger

ADD: per-MAIN stable slot choices, independent families/configurations, deterministic
recommendation contract, finite presets and constrained scalar-rule preparation,
draft/apply/cancel, exact arithmetic and implementation verification requirements.

MODIFY: future product target is all prepared eligible methods, not a fixed pair.
Earlier two-method/pair wording is historical and is superseded only as a fixed
cardinality/data-model requirement, not as a demand for honest structural distinction.

KEEP: current four exact adopted refs, source states, safety/privacy, youth/self-use,
existing numerical prescriptions, immutable old plans, adaptation constraints,
peer issue tables/counts/history and final markers.

IMPLEMENT: the approved UI/core and integration direction under the exact boundaries
above. PENDING EXACT EVIDENCE: concurrent multi-slot detail policy and new
exact-dose/scalar/model activation. Scientific approval where evidence is absent,
canonical promotion and issue closure are not implied. The catalogue readiness
report holds the grouped gaps; implementation reports own completion evidence.

## 16. 2026-09-05 Implementation Observation (Historical)

The following is the recorded post-contract, pre-merge implementation snapshot,
later delivered in PR #318. App/core/browser counts below are not rerun by this
documentation pass; fresh document checks are in the implementation report section 9.
It does not change the four OPEN issue rows or grant new dose/template authority.
Current requirements and remaining differences are in sections 3-5, 10-11 and 17.

- Archived plan history now writes version 4 method rows for each PACE_TARGET slot.
  `COMPLETED` maps to `PERFORMED` (self-reported completion, not measured adherence);
  `RESTED`, `SKIPPED` and `PAIN_CHECKIN` are
  not-performed; no answer remains missing. Legacy selection is never backfilled as
  performed.
- The live method option resolver consumes this structured history. The default
  variety preference affected deterministic ordering only and could not add, select
  or alter a session. Section 17 supersedes that default with neutral.
- Candidate identity and storage validation can represent more than one detailed
  session using an aggregate fingerprint. Every placement is re-authorized, must
  target an exact existing MAIN slot, and must use a unique structurally different
  method in that implementation. Any failed placement rejects the whole transaction.
  This blanket distinct-method guard is not the section 17 repeat-placement policy.
- The live product still exposes one exact detailed method per currently accepted
  event-purpose scope. Therefore the multi-placement API is an evidence-gated
  integration foundation, not proof that users can choose two methods today.
- The adjustment engine and editor remain capability-gated. No reviewed scalar
  values, `+/-` step, coupled recovery rule or new configuration was invented, and
  the editor is not exposed as an inert control when no executable policy exists.
- Local verification observed 818 core tests, 2,298 app tests, four targeted browser
  journeys, TypeScript checks, production build and the existing 43 document
  mutation tests passing. These are recorded local results, not full activation
  evidence. Subsequent merge/CI/deployment history is recorded below.

## 17. Accepted Engineering Decision (2026-09-06)

Decision ID: `TO-SMSA-ENGINEERING-2026-09-06-001`.
Status: `ACCEPTED_ENGINEERING_DECISION`.
Authority: the user's explicit approved implementation task in this conversation;
this is not a scientific review or a new exact-dose/placement-policy approval.

- ADD: neutral recommendation default and optional explicit variety/repeat; keep
  structured v4 history available and disclose only inputs actually used.
- MODIFY: separate representative display diversity from per-slot scheduling.
  Same-method reuse at distinct slots is permitted only under explicit reviewed,
  versioned placement policy and explicit selection; duplicate slots always reject.
- FOUNDATION: binder/schema/adaptation share a central
  detailed-MAIN placement-policy gate. Without accepted frame-combination evidence,
  the reviewed runtime multi-placement registry stays empty. Generic core repeat
  test policies are not runtime approval. Preserve the approved single-method path
  and existing-plan compatibility; do not claim live multi-MAIN/adjustment completion.
- CLARIFY: independent family/configuration identities and versioned legacy mapping;
  self-reported completion is not measured adherence. Preserve old original plans
  and the latest-18-plan/frame-summary archive semantics without fabricated history.
- KEEP: exact four-ref baseline, safety/privacy, youth/self-use, no automatic dose
  increase, no fabricated scientific approval, and all four OPEN implementation
  issues with zero canonical blockers. Grouped evidence preparation is still work
  to perform, not completed merely by listing gaps.
- EVIDENCE: the documentation reconciliation itself is not runtime evidence.
  The integrated work and its remaining gates are tracked in the
  [2026-09-06 workflow report](../../reports/implementation/SESSION_METHOD_WORKFLOW_PROGRESS_2026-09-06.md).

Read-only `gh` verification on 2026-09-06 confirmed
[PR #318](https://github.com/hojune0330/TRAINORACLE/pull/318) MERGED into main at
`985669328dbcc7738afc9f390c9c325769b8251c` on `2026-09-05T08:18:44Z`.
[CI 33954914850](https://github.com/hojune0330/TRAINORACLE/actions/runs/33954914850)
is completed/success on that exact SHA, including `deploy-pages`. This is verified
delivery history, not a claim that the SHA is still remote main or the currently
served public UI. See the
[implementation report](../../reports/implementation/SESSION_METHOD_SELECTION_IMPLEMENTATION_2026-09-05.md)
section 9 for job/timestamp boundaries. No new runtime tests, public-screen check,
source protocol review or issue closure is implied by this reconciliation.

## 18. Owner-Reviewed Adoption Route (2026-09-07)

Decision ID: `TO-OWNER-TRAINING-REVIEW-ROUTE-2026-09-07`.
Status: `OWNER_APPROVED_REVIEW_PROCESS`.
The owner explicitly chose evidence preparation followed by owner final approval.
See the [decision record](../../reports/review/OWNER_TRAINING_ADOPTION_REVIEW_ROUTE_2026-09-07.md).

For future exact configurations and adjustment policies, source and applicability
review by the implementer followed by recorded owner approval is an allowed
`OWNER_REVIEWED_OPERATIONAL_ADOPTION` route. Requirements elsewhere in this
contract for reviewed evidence do not require external experts as the only route.
Independent external review remains a distinct route when actually obtained.
Neither route may misrepresent reviewer identity, credentials or independence.

An owner adoption packet must identify its version and content fingerprint,
exact work/recovery structure, intensity model, applicable populations and events,
adjustment bounds, combined-placement constraints, explanations, sources and limits.
Approval of this process does not approve an unseen packet or its numerical values.
Existing four exact adopted configurations remain unchanged. Runtime wiring for
the new route is pending; test fixtures and reference strings are not approval.

KEEP: D9, privacy, current-record checks, explicit selection, storage compatibility,
no automatic dose escalation, and all four OPEN issues. This section changes the
review process only; it is neither canonical promotion nor implementation completion.

## 19. Adjusted Selection Integration Boundary

The adjusted selection path must revalidate the canonical original candidate,
current safety and original record, exact adjusted configuration, full-frame review
scope and explicit user choice in one call. A previously prepared snapshot is not
selection authority. Use current evaluation time, not the snapshot capture time.

The selected result owns a distinct content-bound plan identity and the actual
adjusted session sequence. Do not write the original flat PACE_TARGET prescription
while displaying adjusted values. Retain the original candidate and review references
as provenance, not as the selected session. Do not reuse the original pair's
adaptation authority or old explanation receipt for the adjusted plan.

Selection, persistence, execution and historical reading remain separate operations.
The selected result is NOT_SAVED until the owning versioned store validates and
confirms it under the current account/mutation lock. Historical reading must never
repeat the selection operation or turn expired approval into current permission.
Initial selection and next-frame continuation must not reset one another's lineage.
All prior requirements and OPEN issues remain; this boundary enables engineering
integration, not activation of unapproved numerical configurations.

## 20. Versioned Adjusted Active Storage And Journal Read

The adjusted active-plan envelope uses `version: 4`, independently of historical
archive format version numbers. It contains one immutable selected-plan snapshot,
separate session progress, update time and a content fingerprint. The snapshot
contains the actual adjusted sequence and exact original-candidate provenance.
Do not coerce adjusted content into the legacy flat `PACE_TARGET` write schema.

The owning save transaction uses the existing account-scoped active-plan key and
plan mutation lock. Recheck live review context after acquiring the lock. Cancellation,
changed draft/account, changed stored bytes and existing different plans reject;
an untouched identical selection may be replayed without resetting time or progress.
Failed-write rollback must not remove another writer's content. Legacy writes cannot
overwrite the newer envelope.

Historical reading reconstructs content with separately retained trusted source,
explanation and review versions at the original acceptance time. It does not load a
newer athlete record to recalculate old targets. Keep retained adopted versions even
after current-use expiry/revocation; current approval and historical evidence are
different registries. Saved hashes/references alone are not trusted evidence.
Missing retained evidence reports unreadable content without modifying stored bytes.

Journal lookup consumes the common exact session link. Show the selected adjusted
structure and retained explanation as planned values, never measured performance.
Memo text is not an input to this lookup or explanation. Scope changes clear the
display. Reading history grants no present execution or adaptation authority.

Engineering integration does not populate operating/retained registries with test
data. The initial adjusted storage path remains unavailable to users until its owner
adoption and UI flow are complete. Progress recording, adjusted archives/next-frame
continuity, cloud compatibility and complete browser journeys require separate
implementation evidence; the partial storage/journal path does not close these gates.

### 20.1 Explicit adjusted progress

Record completion/rest/skipping/pain as an explicit user outcome, not a measured
distance, duration, pace or inferred adherence. Preserve the immutable selected
prescription and its reasons. Validate the exact day/slot and current whole-envelope
fingerprint under the same account-scoped mutation lock. Do not mark a REST session
as completed exercise. A pain check-in cannot be erased through these outcome
buttons; separate reviewed safety handling remains required. Recording an outcome
does not grant execution or next-cycle adaptation authority.

Read back written bytes and roll back only the transaction's own bytes on failure.
Account change, stale content or absent lock rejects without a success display.
Progress updates must preserve the displayed date and must not create journal
measurements or send private notes. Full archive and next-cycle integration remain
separate gates; this outcome recorder does not imply their completion.

### 20.2 Retained adjusted originals

The account-scoped adjusted-original archive retains at most 18 verified v4
snapshots with canonical archive timestamps and whole-envelope fingerprints.
Retention is idempotent for the same saved state and never clears the active key.
Use the existing plan mutation lock, verify both active and archive bytes, and
roll back only owned archive bytes on failure. Unreadable archives are not replaced.

Journal lookup uses the immutable session link and revalidates retained versions;
it does not substitute a current plan or match explanations by a label/ID alone.
This retention API is not next-cycle selection, activation, cloud synchronization,
or completed account-data lifecycle support. Those integrations remain required
before operating activation. No memory of a review or copied hash grants authority.

### 20.3 Adjusted method history for later recommendations

After retained-evidence validation, historical adjusted sessions contribute the
exact selected source configuration (family, configuration, version), not the
pre-adjustment template. Keep COMPLETED as user-reported PERFORMED, unanswered as
MISSING, and rest/skipping/pain as NOT_PERFORMED. None is a measured execution
verification or a physiological diagnosis. Do not infer actual distance or pace.

The existing next-candidate method-history reader consumes these records alongside
legacy archives. Filter by account and event, exclude a retained copy of the active
plan and duplicate candidate identities, and report the combined retained coverage.
Unavailable retained evidence/corrupt archives make coverage unknown, not zero.
Historical exposure is a recommendation input only; it cannot activate a method,
increase workload, or replace current eligibility/safety review. This read path
does not itself archive/clear an active plan or advance periodization lineage.

### 20.4 Adjusted next-frame preparation

Validate the complete prior v4 envelope against retained evidence before deriving
continuity. Match the expected whole-envelope fingerprint, recheck current safety,
and retain any prior pain hold. Completion follows the displayed frame: every
non-rest slot has an explicit terminal outcome, or the displayed final date has
passed. Missing outcomes stay missing when time alone permits moving on. Do not
infer completion for the hidden part of a shorter projection or drop AM/PM slots.

The preview retains the program lineage and advances exactly one display frame
using the existing periodization rules. It is not proof that 9.5 elapsed days were
completed. Preserve the predecessor fingerprint, exact outcome counts, missing
slot count and completion basis. The next start date cannot precede the current
local date, and a future plan cannot be completed before its start date.

This preparation does not clear/archive/replace the active state or grant numeric
adjustment/selection/execution authority. The later owning transaction must recheck
the same predecessor, safety, target review and account under the mutation lock;
it cannot save a previously prepared context as an approval receipt.

### 20.5 Next-frame candidate generation

Generate successor previews from the currently stored, retained-evidence-validated
adjusted predecessor. Capture the account and whole-envelope fingerprint, prepare
continuity with current safety, and re-read both after generation. A changed account
or predecessor rejects the entire preview. A different event requires a new program
decision instead of silently carrying the same lineage into that event.

Use the existing candidate generator and prescription binding, replacing only its
legacy prior-frame input with the verified predecessor outcome context. Keep the
normal fresh-plan entry unchanged. Return a distinct next-frame draft result with
its context and required successor-transaction gate; do not return a saved/active
result or erase the old plan while comparing candidates. A successful preview is
not a reviewed adjusted configuration or a durable successor activation.

### 20.6 Successor selection and retained lineage

A successor selection must validate the actual predecessor v4 with retained source
evidence, its expected fingerprint, current safety, completion basis, same event,
and exact generated continuity counts. Re-run ordinary candidate/anchor/whole-frame
review checks as well. The initial selection path continues rejecting successors.

The selected successor retains a continuation record containing predecessor envelope
and selection fingerprints and the prior periodization context. Advance the existing
lineage exactly once instead of creating a new program. Historical reconstruction
validates this record and the next context deterministically without treating local
fingerprints as signatures or proof of independently verified training performance.
Periodization metadata does not grant dose/phase adaptation authority. The owning
write transaction must bind the continuation to the actual stored predecessor;
historical reading alone cannot authorize a replacement or attest a full archive chain.

Initial stored selections remain byte-compatible: absent continuation means initial
origin only. A prior-frame candidate with absent/malformed continuation, or an initial
candidate with continuation, is invalid. Archive and active writes must be confirmed
under one account/mutation lock with rollback limited to the transaction's own bytes.

### 20.7 Versioned reusable structural review

Legacy policies without a scope version retain the exact v1 fingerprint and
historical reading behavior. A new policy may explicitly opt into STRUCTURAL_V2;
never reinterpret an existing approval as approving that broader scope.

V2 retains event, population, experience, selection actor, source mode, frame,
candidate kind, every session's day/slot/role/energy, exact configuration versions,
support doses, unchanged components, and MAIN exposure count. It retains whether
this is an initial or successor frame and the previous candidate kind. It excludes
exposure identifiers and personal prior-outcome counts from the reusable
review fingerprint only. The complete candidate and snapshot still bind these
values, and successor selection must revalidate the actual predecessor and current
safety. Structural review is not adaptation authority or evidence of completion.

Each v2 scope requires its own exact owner adoption after evidence review. Unknown
versions and multiple matching policies fail closed. No operational policy is
activated by this schema extension. Historical v1 records remain reconstructible.

### 20.8 Mounted successor flow

The active adjusted schedule opens a separate next-frame draft view without clearing
the active plan. Require an explicit current-body check and explicit record selection
before using a record for pace; never silently reuse the old record selection.
Keep the original event and schedule preferences, with an explicit next start date.

Compare freshly generated candidates before opening their reviewed adjustment editor.
The provider seed must match the displayed generation, candidate, intake, athlete
evidence, safety gate, check and start date. Missing or mismatched provider entries
cannot fall through to legacy active-plan selection. Show the unavailable state.

Capture the account and complete predecessor fingerprint. Recheck on generation,
editor entry and save; account/storage events invalidate an open draft. Cancellation
returns to the existing schedule. Only the reviewed successor transaction may archive
and replace the active plan, after a separate final confirmation. The UI must not
describe a generated preview as an already saved next plan.

### 20.9 Personal plan-file export

An explicit owner download may export the validated active v4 and the retained
adjusted-original archive together in a separate personal file. Do not add these
private pace inputs and progress records to the existing share-safe journal format.
Warn that the file contains personal training/record data; exclude journal memo
access, account identifiers and trusted-registry contents. Keep both storage keys
and the account unchanged across the read or reject the export visibly.

The file has a versioned format, export time and complete-content fingerprint.
Reading requires independently retained application evidence for every plan, exact
archive validation and valid timestamps. File-provided review strings cannot grant
authority. Reading is historical only and writes nothing; it does not restore an
active plan or bypass current adoption/safety gates. Until the separate restore UI
and transaction are implemented, the download copy must state that limitation.

### 20.10 Explicit historical import

Personal-file import restores historical originals for journal linkage, not an active
plan. Require the user's explicit confirmation that the file belongs to the current
user; the file is not an identity credential. Revalidate against retained application
evidence under the plan mutation lock. Do not import registry authority from the file.

Keep existing originals and active state unchanged. Identical selection identities
retain the existing progress version, including conflicts; report those skips. Never
silently prune existing or incoming originals to fit the 18-entry archive limit: reject
an over-capacity import. A missing active plan remains missing after history import.
Check account, active bytes, archive bytes and current request before/after the write;
rollback only this operation's bytes. Cancelled or stale file reads cannot import.

## 21. Lossless source-to-sequence integration

Source-proposal arithmetic is not proof that the operating sequence can represent
the same workout. Validate the complete ordered structure, units, segment roles,
repetition meaning and terminal boundaries before creating a source configuration.
An accepted parse alone is insufficient when it changes those semantics.

### 21.1 Required representation additions

The successor representation must support ordered compound recovery, for example
100m active roll-on followed by 120 seconds easy recovery at a set boundary.
Both components occur, in that order. Do not combine distance and seconds into one
simultaneous target, drop one component, or label recovery as quality work.

Retain buildup/preparation within a repeated MAIN block separately from its target
work segment. Four repetitions of 20m buildup plus 10m fast work mean four blocks,
80m buildup and 40m fast work, not eight fast repetitions or 120m fast distance.
Provide separate aggregate fields instead of renaming legacy aggregate semantics.

Represent WALK_OR_STAND explicitly when that is the reviewed recovery instruction.
Do not silently replace it with STAND, WALK or an unspecified coach-defined mode.
Recovery instructions remain instructions, not a claim of measured recovery.

### 21.2 Version and activation boundaries

Preserve V1/V2 parsing, historical fingerprints and their documented meaning of
recoveryAfter. Add the new semantics through a versioned successor; do not change
old last-child recoveryAfter into an always-executed recovery retroactively.
Unsupported new sequences remain unactivated with a specific representation reason.
Do not downgrade them to a different numeric workout to pass an old schema.

The successor requires parser, totals, comparison, explanation binding, snapshot,
candidate, selection/storage, journal original, backup and history compatibility
checks before activation. New sequence engineering does not approve any dose.
An exact owner-approved protocol still needs its complete lossless operating mapping.

### 21.3 Verification obligations

- Three sets of two 300m with 100m after every rep and an additional 120s between
  sets retain 1800m work, 600m roll-on and 240s additional recovery, with unknown
  complete recovery duration and no invented roll-on pace.
- Four buildup/fast blocks retain block count and each role's distance separately.
- Source proposal -> stored sequence -> historical read -> explanation preserves
  every ordered component and target; mutation must invalidate its exact identity.
- Legacy V1/V2 examples and identities remain unchanged.
- A parser PASS or a test that demonstrates an old limitation is not a completed fix.

### 21.4 V3 representation contract

V3 is a separately parsed version, not a permissive change to V1/V2. Its root keeps
warmup/main/cooldown. Segment roles are WORK, BUILDUP and PREPARATION. Group
repeatUnit is SET, REPETITION or SEQUENCE. A REPETITION group owns its block count
and must contain target work; nested SET/REPETITION ownership inside it is invalid.
Keep work-segment count separate from repetition-block count.

recoveryBetweenRepeats and recoveryAfter are ordered lists of scalar recovery steps.
Empty lists mean no prescribed recovery. Each step retains its own mode and either
duration or distance; WALK_OR_STAND is explicit. For each node, between-repetition
recovery occurs count-1 times, then recoveryAfter occurs once after all repetitions,
including at phase/set end. A parent's repetitions multiply its children's complete
ordered structure. This does not redefine legacy recoveryAfter.

Aggregates separate WORK/BUILDUP/PREPARATION and each phase. Known recovery seconds
and distance may be shown as known components when complete totals are unavailable;
they must not be presented as complete recovery or used to pass source dose limits.
Unknown duration/distance never becomes zero. Enforce representation bounds even
when an earlier unknown component makes the total unavailable. No dose authority is
created by parsing or aggregate calculation.

The standalone V3 parser/totals are implemented; dispatch into operating candidates,
method comparison, explanation, snapshots, journal and persistence remains a separate
required integration. V3 cannot fall through to a V2 decoder or numeric alternative.

### 21.5 V3 method comparison and exact identity

V3 method comparison ignores IDs, labels, selected record/reference identifiers,
repeat counts and support phases. Compare MAIN roles, work units/values, target
semantics, group structure and every ordered recovery component, including final
recovery. An empty unary wrapper is not a new method. Return factual difference
codes and require review; a structural difference alone never proves eligibility,
equal effect, appropriate dose or a second independently accepted method.

Exact sequence identity uses the existing canonical-content identity helper under
the separate trainoracle.prescription-sequence.v3 namespace. Unlike method comparison,
it includes counts, selected references, labels and all phases. It is a content
identity, not an expert signature, authorization token or privacy-safe public string.
Validate before comparing or identifying. Keep historical V1/V2 namespaces unchanged.

### 21.6 Shared recommendation policy for V3

The V3 entry point shares the existing recommendation ordering/history algorithm,
with V3 parsing and MAIN comparison. Keep legacy entry-point types and behavior.
Do not mix versions in a catalog or implicitly translate V3 into a legacy receipt.

Eligibility, purpose and context priorities precede repeat/variety preference.
Only performed history changes performed counts; selected, missing and not-performed
remain distinct. Missing assessments do not grant eligibility. Default selection
still needs two distinct families with structurally different MAIN methods; a
count-only copy is not the second method. If fewer exist, report the actual result.

The caller must provide independently reviewed catalog/assessments and appropriately
scoped history. ReviewRef strings and a recommendation result are not adoption or
safety authority. The operating provider and versioned adjustment/storage path must
still be integrated before public use.

### 21.7 V3 explicit adjustment and receipt

V3 configuration references use trainoracle.method-configuration.v3. Drafts and
receipts carry schemaVersion 3, exact before/after sequences and the independently
supplied reviewed policy/context. No old receipt or policy edge is reinterpreted as
a V3 transition. Every allowed edge must match registered complete configurations.

Applying requires USER_EXPLICIT and rechecks the current original. Cancellation
discards only the draft. The receipt includes phase-separated totals and numeric
deltas; if either complete measure is unavailable, its delta remains null. Known
component deltas must not be described as complete totals.

Before consuming a receipt, reconstruct it at its original action time, compare
every field, then recheck the independent registry at the current time. Removed
policies, expiry, context changes, stale originals and forged totals reject.
Do not invent reverse edges. This operation returns a prepared adjusted prescription;
it does not write an active plan or replace plan-level safety/selection validation.

### 21.8 V3 explanation-bound historical snapshot

Snapshot schemaVersion 3 binds the complete V3 adjustment receipt, exact original,
context, candidate lineage/main slot, capture time and independently supplied
explanation version. The explanation covers all sequence node IDs, including
support/group nodes, and matches the full sequence identity and target configuration.
Missing/duplicate coverage or a stale explanation identity rejects creation.

Store explanation references and a content fingerprint, not a trusted registry or
user memo. Require the existing purpose, energy/work/recovery rationale, cycle role,
expectation, limitations, observation and evidence fields. This validates exact
binding and coverage, not scientific accuracy of text or a new source adoption.

Historical read reconstructs using independently retained policy/explanation versions
at capture time and compares the complete saved object. Capture cannot be in the
future; scope/context and all fields must match. Return historical/NONE, not current
execution permission. Current candidate save must separately revalidate live source,
anchor, safety and authority. The application caller owns binding the opaque context
to actual athlete/record/frame; arbitrary browser-provided context is not authority.

### 21.9 V3 source-to-record adjustment binding

The V3 source offer uses the shared legacy source-edge validation algorithm with
version-specific sequence binding, configuration identity and receipt validation.
Keep legacy namespaces/results unchanged. V3 uses distinct resolved-context and
source-authority fingerprint namespaces. Do not convert V1/V2 sources implicitly.

Only bind an empty RACE_PACE anchor placeholder for the exact same event. Reject
pre-bound private references, even when they equal the current record identifier.
Preserve all work roles, phase contents, repetitions and ordered recovery steps.
Binding a record must not calculate a new distance, intensity or recovery duration.

The derived context includes source context, candidate resolution revision and the
record's content fingerprint as well as its identifier/event. On application, rebuild
the offer from the current independent source registry and revalidate the complete
V3 receipt. Changed record contents, scope revision, removed edges and expired
policies cannot replay a previously derived authority. Offer every direct permitted
target; do not invent reverse/transitive edges or force a single paired alternative.

This is an application-domain adapter, not the trusted operating provider. The
provider must derive scope and record fingerprint from the actual current athlete,
record and frame. Arbitrary browser input cannot authorize that context. Active-plan
storage, journal version dispatch and public activation remain separate required
gates. Explanation snapshot historical read remains historical/NONE after expiry;
that read does not override fresh source application rejection.

### 21.10 V3 historical snapshot to current candidate gate

Current use must call the source-backed snapshot revalidation entry point, not the
historical reader alone. Rebuild the offer from independently supplied current
source context and authority, read the exact snapshot with that derived authority
and explanation, match its original to the current resolved source, then revalidate
the receipt against the current source again. Preserve the saved snapshot unchanged.

Return candidate_ready with executionAuthority NONE and requiredNextGate
FULL_PLAN_SELECTION_REVALIDATION. Include the exact source transition and resolution
context for downstream comparison. This is neither plan acceptance nor a store write.
Changed source record contents, candidate revision, explanation, scope, revoked or
expired authority must reject current use even when a separately retained historical
registry can still read the snapshot. Saved files cannot provide their own registry.

Existing PACE_TARGET source definitions and V3 configurations remain different
namespaces. The active-candidate integration must explicitly bind the approved source
versions; do not infer preparation roles or final recovery semantics through a silent
legacy-to-V3 conversion. Full-plan safety, support-component authority, explicit
selection and storage compatibility remain required after this snapshot gate.

### 21.11 Explicit existing pace-plan bridge and V3 numeric projection

LEGACY_PACE_TARGET_TO_V3@1 accepts only a schema-validated existing PACE_TARGET whose
template mapping and explanation resolve independently. It projects that exact source
definition into the separate V3 configuration namespace. A V3 adjustment policy must
explicitly reference that exact projected source; old policy edges are not reused.

The restricted bridge maps the known MAIN source to WORK/SET and known support phases
to PREPARATION/SEQUENCE while preserving IDs, labels, work, targets and repeat counts.
NOT_APPLICABLE repeat recovery becomes an empty list; a scalar repeat recovery becomes
a one-step list. Reject nonempty legacy recoveryAfter or terminalRecovery instead of
changing conditional/final recovery semantics. This is not a general V2 migration.

The V3 projection verifies the original's exact record identity/content against current
source context, revalidates the adjustment receipt, and combines adjusted MAIN with
the bridged original support phases. MAIN authority cannot replace support phases.
Reject duplicate combined node IDs or any invalid resulting sequence.

Only explicit same-event RACE_PACE segments receive record-derived targets. Preserve
unrounded performanceSeconds * distanceM / eventDistanceM and seconds-per-km arithmetic.
Retain the node role with each target. Duration work remains duration work without an
invented covered distance; effort/sprint-reference nodes get no implied numeric pace.
Ordered recovery remains unchanged. Structural phase totals remain distinct from pace
estimates, with unknown values preserved.

Return a version-3 CANDIDATE_PROJECTION_ONLY object with executionAuthority NONE, exact
original binding, source/context/anchor fingerprints and required explanation binding.
The combined support/MAIN explanation, candidate snapshot/storage and journal consumer
must explicitly consume this projection before current app use; projection alone is
not activation or final-plan selection.

### 21.12 V3 candidate slot assembly

The V3 candidate entry point uses the existing validated whole-candidate scope,
start date and exact day/AM-PM address. Revalidate the MAIN snapshot against current
source/explanation, then recompute the full V3 projection from the actual original
PACE_TARGET at that address. Never accept a caller-supplied numeric projection.

Replace only that QUALITY slot with ADJUSTED_METHOD_V3 containing the checked MAIN
snapshot and full projection/fingerprint. Preserve all other sessions, frame and
continuity context. Use candidate schemaVersion 3 and its separate content namespace.
Keep NOT_ACCEPTED / selectionAuthority NONE / FULL_PLAN_SELECTION_REVALIDATION.
Legacy candidate parsers must not accept this format by accident. This assembly
does not write storage or resolve the version-aware plan acceptance gate.

### 21.13 V3 whole-plan review scope

Before final selection, rebuild the V3 candidate and current source transition.
Bind the reviewed scope to event, experience, population, selection actor, frame,
continuity shape, MAIN exposure count, and every session's day/slot/role/intent and
configuration. The changed slot references the unbound source configuration edge;
do not publish athlete record IDs, personal target seconds, dates or memo in the
reviewable scope. Exact personal values remain checked by candidate preparation.

Use a separate STRUCTURAL_V3 scope and policy fingerprint namespace. Require one
independently supplied, current, non-revoked policy with configuration, exposure,
interaction and safety review references. Reject malformed or duplicate registry
entries. A V1/V2 review cannot authorize V3. The operating registry starts empty.
The result remains executionAuthority NONE and does not persist or start training.

### 21.14 V3 explicit selection and historical content

V3 selection uses the same current original-candidate, explicit action, safety,
record reconfirmation and base-selection validation as the existing adjustment
path. Refresh source time at selection, require the exact expected V3 candidate
fingerprint, and apply the independent V3 whole-plan review. First-frame selection
cannot silently accept a successor; successor use requires its continuity transaction.

Preserve the original candidate, exact source context, adjusted sessions including
numeric projection, review references and initial periodization in a version-3
selected-content envelope. This representation remains NOT_SAVED until the owning
version-aware persistence transaction completes.

Historical reconstruction uses independently retained source authority, explanation
and whole-plan reviews at the actual acceptance time. Recompute every adjusted
target and compare the complete reconstructed content, not only its checksum.
Reject future timestamps, changed targets, extra fields or missing retained evidence.
Historical read does not fetch current records, authorize execution, or activate an
imported plan. Storage, active UI and successor consumers remain separate obligations.

### 21.15 V3 persistence envelope and first selection transaction

V3 selected content uses storage envelope version 5, distinct from version 4's
legacy adjusted selection. Reconstruct selected content against one retained
evidence match; validate every progress address, duplicate outcomes, exact update
timestamp and full content fingerprint. Missing observations remain absent.

Write to the existing account-scoped active-plan key under the same plan mutation
lock. Re-read current authority inside the lock and run explicit selection again.
Recheck account, draft identity and previous bytes before writing and confirming.
Do not overwrite any existing plan; identical unprogressed replay is acknowledged
without a new write. On failed confirmation remove only this transaction's own
bytes, never another writer's replacement. Legacy mutation paths must recognize
version 5 as protected adjusted content rather than treat it as an empty plan.

Keep UI entry inactive until version-5 read/progress/journal consumers are wired.
Engineering tests exercise real storage with synthetic evidence, not an operating
template approval. Server sync and successor archive transactions remain required.

### 21.16 Version-aware progress mutation

Versions 4 and 5 share one progress transaction and outcome rules, with separate
content codecs. Validate plain data before parsing, then check account, mutation
lock, exact active fingerprint and day/AM-PM address. REST cannot become COMPLETED.
PAIN_CHECKIN cannot be replaced by another outcome through this pathway.

Only explicit outcome state changes. Preserve selected prescription bytes and do
not derive journal measurements from planned targets. Identical outcomes are
idempotent. Revalidate stored content before writing, verify ownership after writing,
and restore only this transaction's bytes on failure. A stale view cannot update
newer progress. UI and journal routing must consume this version-aware transaction.

### 21.17 V3 stored schedule route

The account-aware reader dispatches envelope version 5 to the retained V3 evidence
registry and returns adjusted_v3_loaded only after full reconstruction. Missing
evidence or invalid bytes remain invalid, not a blank intake. PlanBeta renders a
separate V3 schedule with both daily slots, actual ordered work/recovery nodes,
stored record-derived target times, and bound explanation. Final recoveryAfter is
shown once after the node's repetitions, including the last node in a phase.

Progress buttons call the version-aware transaction and preserve selected day on
refresh. Reopening restores persisted outcomes. Account change removes prior
athlete values. This read/progress surface does not itself supply catalog approval,
an editor entry, journal linkage, export or successor controls; these remain required.

### 21.18 V3 active-plan journal linkage

The V3 schedule creates the existing immutable planned-session identity from the
validated selected plan and exact day/slot. Before opening the journal, re-read
the account's active plan and require the same stored fingerprint. Pass only the
date and link, not planned distance/time/RPE as performed measurements. Returning
from the journal selects the matching planned day.

Journal original lookup accepts a V3 active plan only after retained-evidence
reconstruction and exact link resolution. Reuse the schedule's prescription view
so numbers, recovery order and explanation do not drift. Clear displayed data on
account/storage change. Do not read memo while resolving or displaying the original.
V3 archived-original lookup, backup and successor preservation remain separate work.

### 21.19 V3 journal original retention

Before opening a linked journal, retain the exact active version-5 plan in the
account-scoped V3 original archive under the plan mutation lock. Verify the active
fingerprint, account and both keys before/after writing. Failure leaves the active
plan unchanged and does not open a journal claiming a preserved original.

Archive entries require full independent reconstruction, unique selection identity
and valid archive timestamps. Repeated retention is idempotent. Keep the existing
18-entry bound but reject capacity overflow instead of silently removing an old
journal's original. Archive expansion/export policy remains follow-up work.

Journal lookup checks this archive after active-plan lookup and matches the exact
immutable link. Guest and account-scoped archive keys are included in explicit
device-data erasure without parsing private content. This does not implement the
successor transaction or backup import/export yet.

### 21.20 V3 personal backup and historical import

The V3 personal backup includes the verified version-5 active plan and V3 original
archive, using a separate format/fingerprint namespace. Export must recheck account
and both source bytes; the file includes personal pace evidence and progress but no
memo. Show the personal-file warning before download.

The shared import UI recognizes V1 and V3 through their independent readers, requires
explicit own-file confirmation, and dispatches to the matching history importer.
Revalidate evidence inside the mutation lock. Preserve existing local originals on
duplicate selection identity and never replace active-plan bytes. Reject over-capacity
imports without eviction. Verify writes and roll back only this transaction's content.
Imported originals support journal lookup but grant no execution or selection authority.

## 21.21 V3 후속 주기 준비

V3 저장 계획을 독립 보존 근거로 읽고, 현재 저장 지문·현재 안전 확인·시작일을
검사한 뒤 표시된 세션의 수행 상태만 다음 주기 문맥으로 전달한다. 기존 형식과
판정 로직은 공유하되 V3 문맥 지문은 별도 namespace를 사용한다.

표시 기간이 지나도 미기록을 완료로 바꾸지 않는다. 누락 수와 기간 경과 근거를
분리한다. 통증 확인은 현재 위험 없음 응답으로 해제하지 않는다. 계보는 한 단계만
전진하며 이 준비 결과는 NONE / NOT_SAVED다. 준비 성공은 추천 증가, 후속 계획
승인 또는 현재 계획 교체 권한이 아니다. 후속 선택·원본 보관·교체 transaction 및
화면 연결은 별도 완료 관문으로 유지한다.

### 21.22 V3 후속 선택·원본 보관·일정 전환

후속 생성은 검증된 version-5 이전 계획에서 읽은 수행 문맥을 동일 생성기에 전달한다.
결과는 adjusted_next_frame_v3_draft이며 선택/저장 완료가 아니다. 종목 변경이나
계정/이전 지문 변경은 거부한다. 최초 계획 저장 경로로 후속 계획을 저장할 수 없다.

명시적 최종 확인 후 같은 계획 mutation lock 안에서 실제 이전 계획과 근거를 다시
읽는다. 현재 기록, 안전 상태, 검토 정책, 전체 계획 문맥을 검사하고 이전 지문과
계보를 새 계획 identity에 포함한다. 과거 읽기는 보존 근거로 재구성하며 현재 활성화
권한으로 취급하지 않는다. 새 주기 진행 상태는 빈 배열이며 미기록을 완료로 채우지 않는다.

이전 원본을 V3 archive에 먼저 보관하고 active 값을 교체한다. 각 쓰기 전후 계정·
요청·저장값과 현재 기록·안전·검토 근거의 동일성/유효기간을 재확인한다. 실패 시 이번 작업이 쓴 값만 복구하며 다른 작성자의 값은
덮어쓰지 않는다. 18개 원본 한도에서는 자동 삭제 없이 중단한다. localStorage의 두
키 쓰기를 데이터베이스 수준의 원자적 transaction이나 서버 동기화로 설명하지 않는다.

화면은 현재 일정 → 시작일/몸 상태/기준 기록 → 후보 비교 → 정확한 구성과 전체 일정
확인 → 명시적 저장 → 새 일정으로 이어진다. 돌아가기는 저장하지 않으며, 검토된 구성
공급자가 없으면 비교까지만 제공하고 저장 가능으로 표시하지 않는다. source registry의
운영 활성화와 숫자 조정 편집기, 여러 MAIN 독립 선택은 별도 완료 관문이다.

### 21.23 여러 MAIN 변경안의 독립 조립

같은 원본 후보와 시작일에 연결된 여러 변경안을 각각 재검증한 뒤 한 후보로 조립한다.
각 날짜/AM/PM 주소는 한 번만 나타나야 한다. 원본이 다른 후보, 중복 주소, 잘못된
스냅샷 또는 하나라도 만료된 근거가 있으면 전체 조립을 거부한다. 입력 배열 순서는
의미를 바꾸지 않으며 날짜/슬롯 순으로 정규화한다. 변경하지 않은 세션은 그대로 유지한다.

각 구간의 설명·근거·projection은 해당 주소에 따로 연결한다. 한 구간의 설명을 다른
구간에 공유하지 않는다. 조립 결과는 MULTI_ADJUSTED_PLAN_CANDIDATE / NOT_ACCEPTED /
NONE이며 단일 변경 후보와 다른 식별 namespace를 사용한다. 개별 조정 승인들의 합을
전체 계획 승인으로 취급하지 않는다. 전체 노출·배치·상호작용 검토, 명시적 선택, 저장,
일지/후속 주기 소비는 이 다중 후보 형식을 지원해야 하며 단일 후보 저장기로 우회하지 않는다.

### 21.24 최초 V3 저장의 현재 근거 재검사

최초 저장과 동일 선택의 재요청도 후속 저장과 동일하게 현재 기록·안전·검토 근거를
재확인한다. 검토 자료의 현재시각 외 내용 동일성, 정책 만료/철회, 현재 기록 존재를
저장 직전/직후 및 재요청 성공 반환 전에 검사한다. 달라진 조건을 과거의 선택 성공으로
덮지 않는다. 실패하면 이번에 쓴 값만 제거하고 다른 작성자의 값은 보존한다.

### 21.25 시간/RPE 원본의 상세 구성 연결 설계 경계

RPE_TIME_RANGE는 기록 기반 페이스 처방이 아니므로 PACE_TARGET으로 위장해 입력하지
않는다. 원본의 시간 범위·RPE를 실제 운동 시간이나 반복 수로 단정하지 않는다.
검토된 상세 구성은 종목·목적·경험·주기/주소와 원본 내용에 연결하고 원본과 함께
보존한다. 구성별 회복·준비/정리·설명은 해당 구성의 검토 근거에서 읽으며 다른 MAIN의
준비/정리나 개인 페이스를 자동 복사하지 않는다.

개인 기록이 없는 구성도 지원할 수 있어야 한다. 이때 기준 기록을 발명하거나 가짜
anchor를 넣지 않고 명시적인 비기록 기반 경로로 제공한다. 개인 페이스가 필요한 구간은
별도 검증된 현재 기록을 사용하며 기록 없음과 검증 실패를 구분한다. 이 절은 연결 설계
기준이며 시간/RPE 상세 변환이나 운영 활성화가 구현됐다는 증거가 아니다.

[DRAFT_COMPLETE]
