# Multi-Event Pace Reference Contract

```yaml
doc_id: trainoracle-multi-event-pace-reference
status: OWNER_DIRECTED_BOUNDED_IMPLEMENTATION_CONTRACT
version: 0.1.0
decision_date: 2026-10-02
authority_source: explicit_user_instruction_in_this_task
canonical_promotion_allowed: false
new_cross_event_applied_pair_approvals: []
automatic_volume_or_recovery_change_authority: false
implementation_and_runtime_verification: parent_task_not_this_document
```

## 1. Authority And Ownership

This document records the user's approved multi-event reference direction. It is
not a new scientific adoption, a promotion of reconstructed specifications, or
proof that core, UI, storage, or production behavior has shipped. The sidecar owns
only this file and the [adoption review](../../reports/research/MULTI_EVENT_PACE_ADOPTION_REVIEW_2026-10-02.md).
The parent owns implementation and executable verification. No other document,
runtime registry, template, journal, or stored plan is changed by this sidecar.

Read [North Star](../../PRODUCT_NORTH_STAR.md) and [AGENTS](../../AGENTS.md) first.
The existing safety, privacy, template eligibility, exact identity, and failure
boundaries survive. The owner's explicit permission for Riegel 1.06 comparison
does not grant cross-event prescription authority. A paper, calculator, passing
test, user reference selection, or this document cannot supply missing adoption.

## 2. Seven Events And Reference Priority

| Event | Exact distance in meters |
|---|---:|
| 800 m | 800 |
| 1500 m | 1500 |
| 3000 m | 3000 |
| 5000 m | 5000 |
| 10 km | 10000 |
| Half marathon | 21097.5 |
| Marathon | 42195 |

These are reference/calculation coverage, not seven newly activated training
templates. Do not round half-marathon distance to 21000 or marathon to 42000.
Retain event identity and source context; equal distances do not authorize merging
different surfaces, courses, or verification claims. Existing records outside
this scope remain stored; they are not silently admitted to this feature.

Reference selection is per source event, not a race between all seven events:

1. Present recent actual performance first, selected by achievement date among
   eligible structured actual records, not by fastest time or latest edit time.
2. Offer rolling 12-month best as an independently labeled actual alternative.
3. Offer PB as a historical best alternative, with achievement date and age visible.
4. Offer goals as explicit aspirational alternatives, never achieved performances.

An actual PB/SB entry may participate in recent/rolling selection if its facts meet
the query; the legacy purpose label alone neither qualifies nor excludes it.
Do not duplicate one record merely because it belongs to several reference views.
PB means the stored/reported PB or best available eligible actual evidence, not
an independently verified lifetime record. State the available-data boundary.

Recent-first orders suggestions for a new preview; it does not replace a user's
explicit selection or an accepted plan. A faster old PB or goal must not silently
win. If recent evidence is absent, show the missing state and available alternatives;
do not silently substitute a goal, another event, or a population default. A recent
actual from a different event is still cross-event evidence for the target event.

## 3. Rolling Window, Not Season Or Freshness

`ROLLING_12_MONTH_BEST` is a derived view over eligible actual records. It is not
`SEASON_BEST`, a season ID, a new verified result, or a claim of current capability.
Retain legacy season labels and stored values without reclassifying them in place.

For deterministic implementation, use a versioned calendar-date query convention:

- Snapshot `asOfDate` and the calendar time zone used to determine that date.
- Window start is the same calendar date 12 months earlier; clamp February 29 to
  February 28 when the prior year lacks that date. Both endpoints are included.
- At `asOfDate=2026-10-02`, include `2025-10-02` through `2026-10-02`; exclude
  `2025-10-01` and future achievement dates. This is not a January-to-December season.
- Among valid actual records of the exact source event within the window, best
  means minimum unrounded performance seconds. Missing dates and goals are excluded.
- For equal best times, prefer the later achievement date; exact duplicate facts
  may use stable ID ordering for display. Different times on the same most-recent
  date are ambiguous: request a selection instead of using ID order to invent
  which performance happened last.
- Recompute a new selection view when its inputs/date change; never rewrite an old
  accepted snapshot merely because the clock advanced or another record was added.

The calendar convention is query semantics, not a biological validity threshold.
Do not relabel every record within 12 months `CURRENT`, turn the old 18-month
constant into 12 months globally, or invent another expiry for "recent." Keep
age, source verification, user selection, capability assessment, and query-window
membership separate. Old records remain inspectable with explicit age/caveats;
application eligibility remains separately gated. Unknown eligibility is not a pass.

## 4. Three Calculation Lanes

### 4.1 Same-Event Direct Arithmetic

For a structured reference with finite positive seconds and exact distance:

```text
paceSecondsPerKm = performanceSeconds * 1000 / sourceEventDistanceM
referenceSplitSeconds = performanceSeconds * splitDistanceM / sourceEventDistanceM
```

This is constant-average-speed arithmetic. It is not prediction of an all-out race
at the split distance. A 400 m split at 1500 m RP is still a 1500 m reference, not a
predicted 400 m race. For a prescription RP binding, the template's target race
event must equal the reference event; repetition distance need not equal it.
Preserve unrounded values and a display-rounding policy version.

An actual-based result is labeled actual-record reference; a goal-based result is
labeled goal reference. Neither average race pace nor a goal is automatically LT,
vVO2max, recovery pace, medical clearance, or a training dose. Same-event arithmetic
needs no cross-event prediction model, but training application still needs the
exact existing template/purpose/population eligibility and a valid reference lane.
The under-60 m sprint conversion prohibition remains in force.

### 4.2 Cross-Event Comparison

The approved comparison baseline is explicitly versioned Riegel with exponent 1.06:

```text
predictedTargetSeconds = sourceSeconds * (targetDistanceM / sourceDistanceM)^1.06
```

Require different, supported source/target race events and finite positive inputs
and result. Use an actual source record only. Show source event, record date, record version, target
event, formula/exponent, and "comparison estimate, not applied training pace."
Do not call it a verified result, PB, current ability, guaranteed performance, or
recommended race strategy. Goal-derived cross-event predictions are not enabled.

Predictions cannot re-enter the actual-record pool, rolling best, PB calculations,
or another prediction chain. Do not silently replace missing direct evidence with
a prediction. Missing evidence stays unavailable. No arbitrary confidence interval,
population multiplier, physiological diagnosis, or fitted exponent is introduced.
In particular, do not replace 1.06 with 1.07 based on the Vickers paper.

### 4.3 Cross-Event Applied Pace Gate

A comparison result is not an eligible applied reference unless an independently
verifiable owner adoption exactly matches all of the following:

| Required adoption evidence | Required match |
|---|---|
| Source and target | Directed race-event pair; reverse direction is separate |
| Model | Identity, version, formula, coefficients, and input requirements |
| Target use | Exact template/configuration ID, version, content fingerprint, and purpose |
| Population | Explicit experience/population scope and applicable exclusions |
| Source evidence | Allowed actual/PB/goal lane, record provenance, date/currentness policy |
| Owner decision | Real decision reference, scope, effective version, and lifecycle state |
| Operational safeguards | Uncertainty/failure behavior, safety, preview, explicit application, storage validation |

The tuple must be matched at preview and revalidated at apply, not inferred from
matching numbers, a citation, an event list, or a UI checkbox. A source->target
adoption does not approve intermediate conversions or other templates/populations.
Missing, ambiguous, stale, revoked, or mismatched evidence leaves the result
comparison-only and preserves the existing plan. User consent cannot replace owner
adoption. This sidecar adds **zero applied pair approvals** and no registry entries.

Existing independently adopted training models, including the narrow 5000 m LT
reference path, keep their own scope. They do not authorize seven-event substitution
or feeding a predicted 5000 m result into that path.

## 5. Immutable Record-Version Evidence

Each preview and accepted binding must carry an immutable evidence snapshot rather
than resolve its numbers later from a mutable record ID. Field names below describe
required semantics; the parent may map them to existing schemas without parallel stores.

| Snapshot group | Required content |
|---|---|
| Identity | Snapshot/schema version; record ID and immutable record revision/version |
| Structured source | Event/distance, unrounded seconds, actual achievement date or explicit unknown-date null; goal dates remain null; sourceRef, enteredBy, verification state |
| Reference meaning | Recent actual / rolling best / PB / goal; original record purpose; explicit selected-reference kind |
| Evaluation | As-of date/time zone, window bounds and query policy when applicable; age/currentness caveat without invented verification |
| Calculation | Direct arithmetic or prediction kind; target race event, model/version/parameters, unrounded output, rounding version |
| Training binding | Exact target configuration/version/fingerprint, population eligibility, owner adoption reference if cross-event |
| Application | Base plan/revision, affected occurrence IDs, preview fingerprint, explicit acceptance and resulting plan revision |

Editing a record creates a new revision; `schemaVersion` alone is not a record
revision. A legacy record without revision must be captured losslessly as a
versioned snapshot at selection; do not invent an earlier revision history.
An ID, saved timestamp, or hash alone is insufficient to reconstruct omitted facts.
Correction/deletion of a source invalidates an unaccepted preview; it does not
silently recalculate old prescriptions or resurrect deleted records. Retention and
erasure follow existing account policies; this is not a new permanent-history mandate.

Do not copy journal prose, symptoms, private notes, or identifying text into this
evidence. Do not infer a structured performance by parsing a journal title or memo.
Self-reported input stays self-reported, and goal achievement dates remain null.

## 6. Preview Then Explicit Remaining-Plan Apply

Reference save, record edit, selection, preview creation, and accepted application
are distinct actions. Saving a record or changing a selector must not write a plan.

1. Read the current plan, reference revision, account context, date/time zone,
   exact template/model eligibility, and existing protected-slot/journal evidence.
2. Build a side-effect-free preview showing old/new reference and pace, changed
   eligible occurrences, unchanged/excluded occurrences with reasons, and any change
   to calculated duration. Bind the preview to those exact inputs and versions.
3. Keep all past/journal-linked/progressed slots protected under the existing
   [remaining-plan rules](ALL_WORKOUT_CALCULATION_AND_BINDING_CONTRACT.md#8-저장한-계획에서-앞으로-할-훈련의-명시적-교체-2026-09-30).
   Past dates are excluded. Today's occurrence remains eligible only with explicit
   unstarted confirmation and no protected progress or journal evidence. A log with
   unknown slot protects its day; a moved log also protects its original linked occurrence.
4. Apply only after a separate explicit remaining-plan apply action. Revalidate
   current plan/source revisions, safety, owner adoption, all journal/progress
   protections, account, and calendar date. A stale preview requires a fresh preview;
   it must not silently recompute and apply different numbers under old consent.
5. Use the existing atomic revision/receipt path for the displayed change set.
   Preserve the previous plan and its original evidence; write only supported future
   unrecorded occurrences. Cancel, failure, or zero eligible occurrences writes nothing.
   Unknown save outcome stays unresolved until the existing receipt path resolves it.

Pace-only application must retain template identity, sets, repetitions, prescribed
work distance/duration, recovery mode/duration, preparation/cooldown, dates, AM/PM,
session count, and cycle lineage. No automatic volume or recovery change is allowed.
At fixed work distance, derived time may change with pace; at fixed work duration,
derived distance is reference-only, not a new required distance. Show those numerical
consequences without using them to rebalance dose or invent extra training. Existing
longer/stronger-change confirmation rules still apply; incompatible slots stay unchanged.

For an existing catalog session with explicit longer-duration consent, the exact
accepted source duration is its current budget. Do not fall back to the smaller
pre-consent envelope and reject a shorter replacement. This is not permission to
increase that budget: a slower replacement beyond it remains excluded. A derived
`availableSeconds` value must be recomputed by the canonical binder, not accepted
as a client-controlled budget increase. Explain exclusions after record saving;
never silently navigate away or imply that the plan was updated.

Changing from actual to goal (or goal to actual) is a meaningful basis change even
when rounded target times agree. Preserve the explicit selection and display the
basis change, rather than treating it as a numeric no-op.

Accepted historical snapshots, performed results, and journal-original-plan links
continue to describe what was prescribed then, not today's reference. Do not backfill
new reasons, goals, model outputs, or records into old plans. New plan drafts may
use the selected reference within their gates but still require explicit acceptance.

## 7. Scoped Supersession And Unchanged Rules

| Existing location | Conflict or distinction | Scoped resolution |
|---|---|---|
| `WORK_ORDER_P3_PACE_WIRING.md` section 5.3, `goalReference.displayOnly: true`; prescription contract section 9 `race_goal_anchor: FORBIDDEN` | Previous goal-display-only lane cannot represent an explicitly selected aspirational basis | New multi-event lane permits an explicit goal alternative and gated preview/apply while preserving `ASPIRATIONAL_TARGET`. Never relabel goal as current capability or weaken the legacy current-capability validator globally. |
| `WORK_ORDER_P1_ATHLETE_RECORDS.md` section 4.2 goal mapping | Old wording forbids using goal as today's prescription | Superseded only for the new explicitly chosen, labeled goal-reference workflow and its unchanged eligibility/safety gates. Historical records and old plan interpretation remain intact. |
| P1 section 5 and `athlete-record-display.ts` `SEASON_WINDOW_MONTHS=18` | Historical season display policy is not rolling-year selection | New rolling best uses the independent 12-calendar-month query; old season metadata is retained. Neither display window supplies physiological validity. |
| `app/src/domain/pace-target-evidence.ts` `deriveRecordCurrentness` | Observed code maps elapsed months against the season-display constant to CURRENT/STALE | Do not reuse this coupling for the new reference lane. Preserve old evidence; separate query membership from currentness and application eligibility in new code. |
| North Star section 3 cross-event model boundary | Comparison permission could be mistaken for applied model approval | Only the explicitly approved Riegel 1.06 comparison is added here; exact applied-pair adoption is still mandatory. |
| `TEMPLATE_LIBRARY_SPEC.md` section 16A and later exact calculation contracts | Seven-event references could be mistaken for blanket template activation | Keep each existing lane's exact adoption and eligibility. This document activates no new template or cross-event applied pair. |

These are bounded supersessions recorded from the user's current instruction, not
edits to old sources, whole-document canonical promotion, or closure of open issues.
No global replacement of legacy season/goal enums is authorized by this sidecar.
In an unsupported legacy plan format, report unsupported application and preserve
the plan rather than forcing a new reference through the old validator.

## 8. Parent Acceptance Cases

These are required test cases, **not executed-test receipts** from this sidecar.

| ID | Case | Expected boundary |
|---|---|---|
| MEP-01 | Each of seven exact event distances, including 21097.5 | Correct direct arithmetic; no rounding of source distance |
| MEP-02 | Newer slower actual plus older faster PB and fastest goal | Recent actual suggested first; explicit alternative selection retained |
| MEP-03 | 2026-10-02 rolling query with dates at/before lower bound | 2025-10-02 included, 2025-10-01 excluded; seasonId irrelevant |
| MEP-04 | Leap day, year boundary, UTC/KST date boundary | Versioned calendar convention reproducible; no month-floor shortcut |
| MEP-05 | Missing/future achievement date, goal, NaN/nonpositive input | Unknown-date actuals can be stored but cannot become recent/rolling evidence; explicit use follows template currentness conditions. Future actual dates and invalid numeric inputs are rejected. Goals stay separate and can calculate a labeled goal pace only within allowed configurations. |
| MEP-06 | No recent actual, old PB available, goal available | Missing evidence shown; no automatic fastest/goal application |
| MEP-07 | 1500 m in 240 s with 400 m split | 64 s at 1500 m RP; not a predicted 400 m performance |
| MEP-08 | Same-event goal vs actual with identical seconds | Numeric equality does not erase goal provenance/purpose |
| MEP-09 | All 42 directed cross-event pairs | Riegel comparison labeled; no applied authority created |
| MEP-10 | Exact adoption absent or one tuple field mismatched | Comparison only; old plan unchanged; reverse pair not implied |
| MEP-11 | Explicitly adopted test fixture and matching/mismatching tuple | Gate positive and negative controls; fixture not production adoption |
| MEP-12 | Source revision changes/deletes after preview, or rolling date advances | Stale preview rejected; accepted old snapshot unchanged |
| MEP-13 | Past/progressed slot; today with explicit unstarted confirmation; moved or unknown-slot journal | Past and protected occurrences retained, including original linked slots; today is not excluded solely by its date |
| MEP-14 | Record save, reference selection, preview, cancel | No active-plan or journal write |
| MEP-15 | Explicit apply to eligible future occurrences | Only displayed pace-related outputs change; volume/recovery/layout preserved |
| MEP-16 | Journal, account, model adoption, safety, plan revision, or date changes before apply | Revalidation rejects stale action; no partial update or local bypass |
| MEP-17 | Historical/legacy plan reopened after record correction | Original snapshot and journal link retained; no invented historical version |
| MEP-18 | Prediction offered as an actual record or as input to another model | Rejected; no chained prediction or LT/VO2 authority laundering |

The parent should separately report core tests, UI behavior, persistence round-trip,
account concurrency, build, deployment, and live-user verification. Documentation
completion proves none of those. No commits or external writes belong to this sidecar.

[DRAFT_COMPLETE]
