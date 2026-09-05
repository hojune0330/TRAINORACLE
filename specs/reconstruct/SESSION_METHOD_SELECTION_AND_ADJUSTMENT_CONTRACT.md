# SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md

```yaml
doc_id: trainoracle-session-method-selection-and-adjustment
spec_id: SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT
title: TrainOracle Session Method Selection And Adjustment Contract
version: "0.1"
round: RT1_OWNER_APPROVED_IMPLEMENTATION_DIRECTION
status: ACTIVE_IMPLEMENTATION_CONTRACT
product_direction: OWNER_APPROVED_IMPLEMENTATION_DIRECTION
decision_basis: USER_TASK_BRIEF_2026_09_05
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

Current end-user runtime supports one detailed session per candidate with selectable
placement on an eligible MAIN occurrence. The core and app transaction boundary can
represent and atomically validate multiple structurally distinct detailed sessions,
but the end-user multi-slot selector remains pending exact per-slot applicability,
exposure, cross-slot interaction and independently adopted method evidence.
The prior first-QUALITY-only placement is historical, not the current limit. One
detailed method per accepted event-purpose scope remains the numeric baseline.
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

Current live recommendation wiring first checks exact template eligibility and
then uses neutral history: `history: []`, `repeatPreference: NEUTRAL`, with equal
caller priorities after filtering. It must not claim that journal history selected
the recommendation. The core prepares history-aware repeat/variety ranking as a
separate capability, not a live history integration: eligibility, purpose and
context precedence come first, optional explicit repeat/variety preference then
uses eligible observed performed counts, and stable catalogue order breaks ties.
Selected counts remain distinct from performed counts. Missing/not-performed
history is not evidence of zero exposure. Any later live history wiring needs
scoped, deduplicated exact-occurrence evidence and the owning privacy/safety gates;
no invented recent-N penalty or time window is introduced.

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

## 11. Planned, Actual, Youth And Privacy

The planned occurrence carries its immutable prescription/version. A later actual
record links to that exact occurrence, not today's active plan or only its date.
Completion marks do not create actual distance, duration, split, recovery or proof
that the prescription was followed. Modified/partial/skipped/rested results and
duplicate/conflicting links retain explicit relations and exclusions.

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
| Multi-slot/storage integration | Atomic multi-placement transaction, aggregate candidate identity, versioned history snapshots, restore/execution and actual linkage | Core/app boundary prepared; exact multi-slot policy and at least two independently adopted same-scope methods remain required before live enablement |
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
| Multiple MAINs, AM/PM, candidate reorder | Independent choices remain on stable slots; no first-QUALITY-only or index binding |
| Change one method/preset | Only target slot draft changes; other MAINs, support, frame and exposure count remain intact |
| Delete/insert/move/ambiguous slot | No automatic ordinal remap; invalidate/review exact crosswalk and confirmations |
| More than a fixed pair; count-only variants | Independently eligible configurations work without pair IDs; method diversity is not inflated |
| Same versioned catalogue/order, context and assessments | Same eligible results/recommendations/reasons; stable catalogue-order tie-break, never lexical IDs |
| Equal-priority entries with deliberately different ID order | Catalogue order wins; an intentional catalogue reorder is a changed input, not nondeterminism |
| Live archived history versus repeat/variety capability | Live path reads only structured archived plan-method outcomes; selected/performed/not-performed/missing remain distinct, and variety preference changes ranking only |
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
| `OI-SMSA-INTEGRATION-EVIDENCE-001` | OPEN | NO | Artifact-bound UI/core/storage/reload/cancel-race/actual-linkage evidence for each enabled scope, including separate evidence before live history-aware ranking; partial checks do not close full integration. |

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

## 16. 2026-09-05 Implementation Observation

The following implementation state was observed after the contract was written. It
does not change the four OPEN issue rows or grant new dose/template authority.

- Archived plan history now writes version 4 method rows for each PACE_TARGET slot.
  `COMPLETED` is observed performance; `RESTED`, `SKIPPED` and `PAIN_CHECKIN` are
  not-performed; no answer remains missing. Legacy selection is never backfilled as
  performed.
- The live method option resolver consumes this structured history. The default
  variety preference affects deterministic ordering only and cannot add, select or
  alter a session.
- Candidate identity and storage validation can represent more than one detailed
  session using an aggregate fingerprint. Every placement is re-authorized, must
  target an exact existing MAIN slot, and must use a unique structurally different
  method. Any failed placement rejects the whole transaction.
- The live product still exposes one exact detailed method per currently accepted
  event-purpose scope. Therefore the multi-placement API is an evidence-gated
  integration foundation, not proof that users can choose two methods today.
- The adjustment engine and editor remain capability-gated. No reviewed scalar
  values, `+/-` step, coupled recovery rule or new configuration was invented, and
  the editor is not exposed as an inert control when no executable policy exists.
- Local verification observed 818 core tests, 2,298 app tests, four targeted browser
  journeys, TypeScript checks, production build and the existing 43 document
  mutation tests passing. Independent review and remote CI remain separate gates.

[DRAFT_COMPLETE]
