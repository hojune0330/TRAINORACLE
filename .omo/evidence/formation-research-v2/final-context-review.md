# Final Context Review

```yaml
review_id: TO-FRV2-FINAL-CONTEXT-2026-07-17
verdict: FAIL
scope: OWNER_BASELINE_VS_ACTIVE_RECONSTRUCT_RESEARCH_AND_USER_WORKFLOWS
canonical_specs_changed: false
runtime_code_changed: false
conflict_register_rows_reviewed: 9/9
conflict_register_exhaustive: false
runtime_authority: false
```

## Verdict

The research synthesis correctly preserves the four governing owner decisions:

1. the fixed product identity is a 9.5-day Formation;
2. the target is one deterministic primary automated prescription, not a mandatory
   two-or-three-plan chooser;
3. `PRIVATE_SELF_ONLY` is zero-signal outside the private local journal, while an explicit
   user-directed `OWNER_FULL_LOCAL_BACKUP`/share operation remains allowed; and
4. Formation runtime remains off until the named scientific, statistical, safeguarding,
   privacy, owner, accessibility, contract, and evidence gates pass.

The context audit nevertheless **fails** because the nine-row conflict register is not
repository-complete. It catches the headline Formation, Plan Generator, Template Library,
Daily Log, historical acceptance/read-now/deferred, recipient-share, and accessibility
problems, but omits active downstream consumption clauses, earlier owner records, a race-note
export clause, and the product projection/calendar/rationale consequences of one primary
default. The register can remain exactly nine rows by expanding existing row scopes; no tenth
row is required.

The latest-owner baseline is accepted as the governing task input for this review. For durable
repository provenance it still needs `owner`, `decision_id`, `recorded_at`, and an auditable
source reference; its current YAML has authority/status but not those fields.

## Governing Decisions

| Decision | Current research result | Context result |
|---|---|---|
| Fixed 9.5-day product identity | Protocol, owner brief, technical annex, counterevidence review all preserve it without claiming superiority | PASS |
| One deterministic primary automated plan | Latest baseline, protocol, owner brief, technical annex state it | FAIL downstream: old coach-only selection remains in active/reconstruct/history/projection documents |
| Private note zero-signal | Daily Log analysis boundary, Note Safety, Record Governance, Shadow, Projection, coach rules, and research reviews agree | PASS for analysis; export wording still conflicts in two older/current targets |
| Explicit full backup and user-selected share | Governance, Note Safety, privacy decision, youth review, owner brief agree | PARTIAL: Daily Log and race decision conflict; in-app recipient contract is absent by design |
| Runtime stays off | Protocol, all decision packets, shadow, privacy, projection, formal gate status consistently say false/blocked | PASS |

## Nine-Row Register Audit

| Register row | Coverage | Result | Required register correction |
|---|---|---|---|
| `FRV2-CONF-001` Formation authority | Direct Formation contradiction is captured | PARTIAL | Expand affected targets to Product Projection, Calendar Mapping, and Plan Rationale so the primary-default/execution-state model reaches the user surface |
| `FRV2-CONF-002` Plan Generator | Core active target is captured | PASS | Patch option/set/selection state, API, records, tests, and handoff, not only prose |
| `FRV2-CONF-003` Template consumption | Template Library is captured | FAIL incomplete | Add `PHYSIO_SOURCE_TRUST_SPEC.md`, which still says `still_requires_coach_selection: true` and tests that coach selection remains required |
| `FRV2-CONF-004` historical research boundary | Acceptance decision is captured | FAIL incomplete | Add Training Method Decision, joint brief, multiperspective blueprint review, and the older sports-science recommendation to the superseded-product-direction scope |
| `FRV2-CONF-005` Read Now | Coach-final/no-automatic copy is captured | PASS | Preserve the runtime-off warning while replacing target-authority copy |
| `FRV2-CONF-006` Deferred Goals | Identity-versus-activation drift is captured | PASS | Keep actual activation/rules/human gates deferred; do not defer the fixed identity |
| `FRV2-CONF-007` Daily Log export | Daily Log absolute prohibition is captured | FAIL incomplete | Add `RACE_SELFCHECK_FIELDS_DECISION.md` section 2, which also forbids owner export |
| `FRV2-CONF-008` recipient share | Missing canonical target is captured | PASS | Create a separate recipient-specific contract; do not turn local file sending into service-controlled sharing |
| `FRV2-CONF-009` accessibility/human review | Missing named human/AT acceptance is captured | PARTIAL | Also bind middle-school default explanation, authority comprehension, 400%-equivalent reflow, and long-Korean-label stress cases |

## Missed Conflicts And Exact Corrections

### C1. Active Physio consumer restores mandatory coach selection

`specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` lines 545-556 permits several option biases and
sets `still_requires_coach_selection: true`; lines 875-880 declare that behavior satisfied.
This is an active downstream authority conflict, not merely historical prose.

**Exact correction:** expand `FRV2-CONF-003` from Template-only to
`ACTIVE_PLAN_INPUT_CONSUMERS` with both Template Library and Physio Source Trust. Replace the
physio output with a constraint on the single primary plan:

```yaml
physio_consumption:
  eligible_use: CONSTRAIN_OR_SUPPRESS_PRIMARY_DEFAULT
  may_clear_safety: false
  may_auto_increase_from_favorable_value: false
  review_required_result: NO_AUTOMATED_PLAN_OR_LINKED_COACH_REVIEW
  mandatory_plan_chooser: false
```

Only `ELIGIBLE` template/physio inputs may participate in deterministic primary selection.
`REVIEW_REQUIRED` remains non-auto-selectable and cannot be weakened by this patch.

### C2. Earlier owner records and reports still present the old product direction

The following remain readable as current direction without a supersession header:

- `TRAINING_PLAN_METHOD_DECISION.md`: 2-3 candidates and linked-coach final selection;
- `FABLE_CODEX_JOINT_PLANNING_BRIEF.md`: no auto-selection and coach-selection guardrail;
- `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`: coach-only selection lifecycle,
  coach-selected projection, and verified coach selection for every execution;
- `reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md` lines 158-163: retain a
  non-executing coach-pilot rule and do not begin with automated prescription.

The shadow amendment, evidence limits, safety rules, and historical runtime-off facts in these
documents remain valuable. Only their product-authority clauses are superseded.

**Exact correction:** expand `FRV2-CONF-004` to a grouped historical-authority row. Add this
header to each affected document and link the latest baseline:

```yaml
product_direction_status: SUPERSEDED_PRODUCT_DIRECTION
historical_runtime_state: PRESERVED
superseded_by: FORMATION_LATEST_OWNER_DECISION_BASELINE
current_target: ONE_DETERMINISTIC_9_5_PRIMARY_DEFAULT
current_runtime_authority: false
```

Do not rewrite the July 14/15 events as if they never occurred. Mark the selection-only state
machine and coach-final wording historical; preserve the disclosed non-executing shadow workflow.

### C3. Race note decision still forbids an owner full backup

`RACE_SELFCHECK_FIELDS_DECISION.md` section 2 says `PRIVATE_SELF_ONLY` cannot be exported and
also forbids analyzable-note raw text in export. That conflicts with the newer owner-directed
full local backup decision just as directly as Daily Log does.

**Exact correction:** expand `FRV2-CONF-007` to include both files and apply the same operation
split:

```yaml
default_export: MEMOS_EXCLUDED
owner_full_local_backup:
  memo_include: EXPLICIT_AFTER_PREVIEW_AND_CONFIRMATION
  local_file_only: true
  network_request: forbidden
  analytics_event: forbidden
  reward_event: forbidden
  formation_event: forbidden
  changes_note_purpose_or_share_consent: false
```

The exception is only `USER_DIRECTED_FILE_OPERATION`; analysis, sync, coach access, guardian
access, telemetry, reward, and note-safety zero-signal remain unchanged.

### C4. Projection has no state for the new primary default

`FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md` currently recognizes a
non-executing `SHADOW_CANDIDATE` and a `linked_coach_accepted_plan_fact`, but no
system-selected primary default awaiting a separate youth execution confirmation. The old model
can therefore reappear even after Formation and Plan Generator are patched.

**Exact correction:** expand `FRV2-CONF-001` to the projection/rationale/calendar chain and
add orthogonal authority and execution fields:

```yaml
plan_authority:
  - SHADOW_COMPARISON
  - SYSTEM_PRIMARY_DEFAULT
  - COACH_AUTHORED_EXCEPTION
execution_state:
  - PREVIEW_ONLY
  - LINKED_COACH_CONFIRMATION_REQUIRED
  - VALIDATION_REQUIRED
  - EXECUTABLE
  - HELD
  - NO_AUTOMATED_PLAN_KEEP_CURRENT_COACH_PLAN
selection_origin: SYSTEM_DETERMINISTIC_DEFAULT | COACH_EDIT | COACH_EXCEPTION
alternatives_visibility: COLLAPSED_COMPARE_OR_EDIT
```

For the first youth scope, `SYSTEM_PRIMARY_DEFAULT` does not become executable without the
separately accepted linked-coach confirmation, safety, consent, Rule validation, and runtime
gates. The coach reviews/edits/confirms one primary plan; the product does not force a chooser.

`PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` must bind rationale to the primary plan version and
selection origin, not only to an option. It must explain why the primary was selected, what is
missing/unknown, what blocks execution, and whether a coach changed it, without claiming
scientific superiority.

### C5. Calendar preserves 9.5 identity internally but not sufficiently for the user

Calendar Mapping has a 10-slot rail and `halfDayPhase`, but it lacks the Formation-required
`frameId`, `blockId`, `planVersionId`, immutable session identity, frame content hash, projection
watermark, and accepted `AM | PM | DOUBLE | FLEX` crosswalk. Its display policy does not require
the exact local start/end or make the last half-day visibly and accessibly distinct. It also
speaks only in `planOptionId`/accepted coach-plan terms.

**Exact correction:** under expanded `FRV2-CONF-001`, add those lineage fields plus
`selectionOrigin` and `executionState`; project the system primary separately from an executing
plan. Require the user surface to show exact local start/end, timezone, `9일 + 반나절`, and a
text/screen-reader half-day label. A 7-day view must clip/reflow without changing frame, block,
session, provenance, or primary-plan identity. DST fold/gap and re-anchor remain fail-closed.

### C6. Technical annex has a candidate-count ambiguity

`FORMATION_RESEARCH_TECHNICAL_ANNEX.md` says both “one deterministic primary plan” and
“2-3 MAIN candidates.” The latter can be read as 2-3 plan candidates, recreating the rejected
chooser model.

**Exact correction:** replace it with:

> The one deterministic primary plan contains 2-3 planned MAIN exposure events; a race counts
> once and a missed MAIN creates no debt or catch-up.

Use `plan candidate` only for the non-executing shadow artifact; use `MAIN exposure` for sessions
inside the plan.

### C7. Latest baseline needs durable owner provenance

`FORMATION_LATEST_OWNER_DECISION_BASELINE.md` states authoritative status but does not record
the deciding owner, a decision ID, timestamp, or source reference. The current task instruction
is sufficient for this review, but a later reader cannot independently establish why it
supersedes owner-confirmed July 14/15 documents.

**Exact correction:** add:

```yaml
owner: COACH_HOJUNE
decision_id: required_stable_id
recorded_at: required_iso_datetime_with_timezone
source_ref: required_auditable_owner_instruction
supersedes:
  - named_product_direction_clauses_only
preserves:
  - historical_runtime_state
  - shadow_non_execution_boundary
  - privacy_and_safety_nonclaims
```

### C8. Middle-school comprehension is not yet decision-complete

The projection contract has five levels and good invariant facts, but does not set `쉽게` as the
middle-school default. Level 2 still exposes `RPE`, and the accessibility review asks only who
decides today's training, which is ambiguous under the new split between system default
selection and current youth execution confirmation. Named athlete/coach/AT evidence is absent.

**Exact correction:** expand `FRV2-CONF-009` requirements:

- middle-school default is `쉽게`; role suggests but never locks the presentation level;
- levels 1-3 prohibit internal enums, hashes, contract codes, and unexplained `RPE`;
- teach-back separately asks: “Which plan did the system choose?”, “Does it control today?”,
  “Who must confirm execution now?”, “What happens when no automatic plan can be made?”, and
  “Can I stop shadow participation without losing my journal?”;
- wrong answers return to a simpler explanation without a failure label or penalty;
- add 400%-equivalent/320-CSS-pixel reflow, dynamic text, long Korean labels, screen reader,
  keyboard, grayscale/high contrast, reduced motion, and 44x44 control checks;
- require named middle-school athlete, linked coach, privacy reviewer, and assistive-technology
  evidence. AI or automated renders cannot fill those fields.

## Area Review

| Area | Result | Historical/user-workflow conclusion |
|---|---|---|
| Formation | FAIL | Core draft still prohibits auto-selection; row 001 catches the file but not all downstream surfaces |
| Plan Generator | FAIL | Direct conflict is registered; records, lifecycle, API, tests, and handoff all need replacement |
| Template Library | FAIL | Registered, but only eligible templates may constrain a primary default; review-required remains human-only |
| Daily Log | FAIL | Analysis zero-signal is good; absolute export prohibition conflicts with explicit owner backup |
| Record governance | PASS WITH GATE | Exact purpose/grant/expiry, no blanket coach/guardian access, full backup, and runtime blocking are preserved |
| Note safety | PASS WITH GATE | Private-note byte-identical zero-signal and note-derived block-only behavior are preserved; no positive clearance |
| Shadow pilot | PASS WITH COPY GAP | Visible, opt-in, withdrawable, non-executing, no real calendar write; needs explicit target-versus-current authority wording and gentler comprehension flow |
| Projection/explanation | FAIL | No primary-default pending-execution state; youth default and correction/blocked actions incomplete |
| Calendar mapping | PARTIAL | 9.5/7-day namespace boundary is sound; lineage, half-day user meaning, primary state, DOUBLE/FLEX, and DST/re-anchor binding remain open |
| Coach rules | PASS AS CURRENT GATE | Race anchor, no catch-up, composite preservation, precedence, and runtime-off are sound; “no generated plan now” must be labeled activation state, not product identity |
| Accessibility | FAIL BEFORE UI ACCEPTANCE | Static rules exist; named athlete/coach/AT evidence is absent and several contrast tokens already fail |
| Privacy/guardian | PASS WITH QUALIFIED-REVIEW BLOCK | Zero-signal, unbundled purposes, athlete refusal, no blanket guardian access, and local backup are preserved; in-app recipient sharing and jurisdiction policy remain blocked |

## Required User Flows

### Athlete

On eligible input, show one `다음 9.5일 기본 계획`, then today's action, race anchor, unknowns,
and execution state. Alternatives stay behind compare/edit. If ineligible, show
`자동 계획을 만들지 않았어요`, keep the current coach-authored plan, and identify what the
athlete can correct, what requires a coach/source owner, and what remains unchanged.

### Coach

Open on one system-selected primary plan with changed sessions, race anchor, missed-MAIN
no-debt behavior, composite components, missing/conflicting facts, and rationale. Editing creates
a new version. Initial youth execution confirmation is a gate; it is not a mandatory
two-or-three-plan selection wizard.

### Guardian-Permitted

Guardian access is never role-wide. The athlete sees who can view which exact fields until when.
Optional shadow/share requires separate athlete choice and any applicable verified guardian
grant. Private-note content and existence remain invisible. Dispute, withdrawal, expiry, and age
transition block the next read without removing the base local journal.

### Backup And Share

Default export excludes memos. An owner full local backup may include them only after preview and
explicit confirmation, with zero network/analytics/reward/Formation effects. A future in-app
share separately selects one real recipient, exact fields, purpose, duration, memo inclusion off
by default, confirmation, expiry/revocation, and limitations after download/re-share.

### Shadow

Every state says `비교용 · 실제 계획에 반영되지 않음`, shows next checkpoint and available
actions, and keeps pause/withdraw visible. No hidden operation, no real plan/calendar mutation,
no automatic recipient notification, no coercive reward, and no efficacy/safety claim is allowed.

## Exit Criteria

This context review becomes PASS only when:

1. the existing nine register rows are expanded as specified without changing the row count;
2. all listed superseded documents have explicit target-versus-historical-runtime markers;
3. active Plan Generator, Template, Physio, Formation, Daily Log, race-note, Projection,
   Rationale, and Calendar clauses agree with one primary default and explicit full backup;
4. the technical-annex MAIN wording is unambiguous;
5. the latest-owner baseline has durable decision provenance; and
6. named human/AT/privacy/coach reviews remain visibly pending rather than fabricated.

Until then, keep `runtime_authority=false`. The current runtime-off gate is correct and must not
be weakened while these product-direction and user-workflow corrections are made.

[FINAL_CONTEXT_REVIEW_COMPLETE]
