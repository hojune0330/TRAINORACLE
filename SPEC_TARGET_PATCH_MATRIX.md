# SPEC_TARGET_PATCH_MATRIX.md

```yaml
doc_id: TRAINORACLE_SPEC_TARGET_PATCH_MATRIX
spec_id: TRAINORACLE.SPEC_TARGET_PATCH_MATRIX
title: "TrainOracle SPEC Target Patch Matrix"
version: "0.1"
round: RT1
status: DRAFT_HANDOFF_MATRIX
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. Purpose

This matrix records which TrainOracle SPEC documents should be patched next, which source contract supplies the patch, and which evidence is still missing before any issue can be closed.

It is not a product rule definition, not runtime evidence, not canonical promotion, and not issue closure.

This document exists to prevent three recurring errors:

- treating a reconstructed draft as accepted source
- applying downstream issue-count deltas from memory
- closing target issues before target files are opened, patched, and recounted

---

## 2. Patch Rules

```yaml
patch_rules:
  local_files_are_truth: true
  exact_target_file_must_be_opened_before_patch: true
  target_issue_row_must_exist_before_patch: true
  target_issue_status_must_be_rechecked_before_patch: true
  target_open_issue_table_must_be_recounted_after_patch: true
  absolute_downstream_counts_from_memory_forbidden: true
  reconstruction_alone_cannot_close_target_issue: true
  markdown_self_check_is_not_runtime_evidence: true
  runtime_issue_closure_requires_actual_terminal_or_CI_log: true
```

---

## 3. Current Source Documents

| Source document | Current state | What it can safely provide now | What it cannot provide yet |
|---|---|---|---|
| `PHYSIO_SOURCE_TRUST_SPEC.md` | Active SPEC candidate | Physio source trust, recency, conflict, structured readiness/soreness/RPE policy | Automatic closure of PG/AIB/AP issues |
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `RECONSTRUCTED_DRAFT_FOR_REVIEW` | RVE signal shape, D9 status storage, privacy-safe reason-code boundary | Original/canonical RVE contract or runtime proof |
| `PLAN_SAFETY_GATE_SPEC.md` | `RECONSTRUCTED_DRAFT_FOR_REVIEW` | Pre-generation RVE-to-Plan Generator gate contract | Original/canonical Safety Gate contract or runtime proof |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `RECONSTRUCTED_DRAFT_FOR_REVIEW` | Structured daily check-in ingestion and transient memo boundary | App storage implementation, canonical source, runtime proof |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | `DRAFT_FOR_REVIEW` | Source-backed visualization data shapes, uncertainty/source coverage, analysis privacy boundary | Metric algorithm authority, App Bridge implementation, runtime proof |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | `DRAFT_FOR_REVIEW` | Privacy-safe plan rationale refs, rationale codes, audience tiers, redaction state | Plan Generator target closure, App Bridge implementation, runtime/privacy proof |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `DRAFT_FOR_REVIEW` | Namespace-safe 9.5-cycle, `CYCLE_DAY`, planned-date/session-slot, and Calendar projection mapping | Plan Generator target closure, App Bridge/UI implementation, runtime proof |
| `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | `DRAFT_FOR_REVIEW` | Decision-provenanced local-civil frame, MAIN exposure accounting, typed load components, deterministic candidate and immutable adaptation contracts | Execution before six blockers, source acceptance, target patches, and runtime proof |
| `SPEC_DOCUMENTATION_REPORT.md` | Handoff report | Human-readable document map | Product rule authority |

---

## 4. Target Patch Matrix

| Target document | Target issue | Current target evidence | Source to consume | Patch intent | Closure allowed now |
|---|---|---|---|---|---|
| `PLAN_GENERATOR_SPEC.md` | `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 / YES / OPEN; target-local Safety Gate/RVE binding patched, issue still open | `PLAN_SAFETY_GATE_SPEC.md`, `RULE_VALIDATION_ENGINE_CONTRACT.md`, `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | Bind Plan Generator to consume D9/RVE only through Safety Gate; ACTIVE/UNKNOWN block; advisory non-blocking under CLEARED | No. Requires source acceptance, target recount approval, and actual D9 runtime evidence |
| `PLAN_GENERATOR_SPEC.md` | `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 / YES / OPEN; target binding patched in Section 6B | `PHYSIO_SOURCE_TRUST_SPEC.md` | Consume trusted physio source status without allowing good physio data to clear D9 risk | No. Target patch exists, but closure still requires source acceptance and target recount approval; do not copy expected deltas |
| `PLAN_GENERATOR_SPEC.md` | New Formation/Version binding issue after approved recount | Target lacks frame, block, component, difference, hold, version, CAS, and adaptation records | `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | Bind accepted formation source without redefining Safety Gate, classifier, or coach authority | No. Six source blockers and source acceptance remain open; target issue must be added only after recount approval |
| `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` | `OI-FA-CALENDAR-SCHEMA-BINDING-001` source-side blocker | `CalendarSessionProjection` lacks `frameId` and `blockId` | `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | Make 7-day projection identity representable while keeping mapping projection-only | No. Requires source acceptance, target-local issue/recount, schema patch, DST tests, and runtime evidence |
| `APP_IMPLEMENTATION_BRIDGE.md` | `OI-AIB-PHYSIO-SOURCE-001` | P1 / true / OPEN in current target file; issue addendum records patched-pending-source-acceptance | `PHYSIO_SOURCE_TRUST_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md` | Add storage/use boundary for physio source trust and daily check-in structured data | No. Target patch exists, but closure still requires source acceptance, target recount approval, and implementation/privacy review |
| `ATHLETE_PROFILE_SPEC.md` | `OI-AP-PHYSIO-SOURCE-001` | Canonical blocking issue remains OPEN with patched-pending-source-acceptance addendum | `PHYSIO_SOURCE_TRUST_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md` | Clarify profile physiological attributes source priority and conflict handling | No. Target patch exists, but closure still requires source acceptance, App Bridge binding acceptance, and target recount approval |
| `PLAN_SAFETY_GATE_SPEC.md` | `OI-PSG-DAILY-LOG-INPUT-BINDING-001` | P2 / NO / OPEN in current target file; target-local input boundary patched in Section 9A | `DAILY_LOG_AND_CHECKIN_SPEC.md` | Bind daily check-in structured signals as possible RVE/Safety Gate context without raw text storage | No. Requires Daily Log source acceptance, target recount approval, and implementation/runtime evidence before closure |
| `PLAN_SAFETY_GATE_SPEC.md` | `OI-PSG-PHYSIO-SOURCE-CONSUMPTION-001` | P2 / NO / OPEN in current target file | `PHYSIO_SOURCE_TRUST_SPEC.md` | Clarify how poor/missing/conflicting physio data may raise review/block while good data cannot clear D9 risk | No. Requires target patch and recount |
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `OI-RVEC-PLAN-SAFETY-GATE-001` | P1 / YES / OPEN in current target file | `PLAN_SAFETY_GATE_SPEC.md` | Update RVE contract after Safety Gate acceptance; preserve no-runtime-claim boundary | No. Reconstructed Safety Gate is not acceptance |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `OI-DLC-APP-BRIDGE-BINDING-001` | P1 / YES / OPEN in current target file | `APP_IMPLEMENTATION_BRIDGE.md` target patch | Add DailyCheckInRecord storage/audit endpoint to App Bridge | No. Requires target patch and recount |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `OI-DLC-RVE-SAFETY-BINDING-001` | P1 / YES / OPEN in current target file | RVE/Safety Gate implementation evidence | Bind structured/transient daily signals to RVE/Safety Gate runtime path | No. Requires implementation/runtime evidence |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `OI-DLC-RAW-NOTE-REDACTION-001` | P1 / YES / OPEN in current target file | App Bridge implementation/privacy review | Define and verify raw note redaction/transient deletion lifecycle | No. Requires implementation/privacy proof |

---

## 5. Recommended Work Waves

### Wave 1 - Count-Safe Physio Consumption Patches

Targets:

- `PLAN_GENERATOR_SPEC.md`
- `APP_IMPLEMENTATION_BRIDGE.md`
- `ATHLETE_PROFILE_SPEC.md`

Source:

- `PHYSIO_SOURCE_TRUST_SPEC.md`

Rules:

- Open each target file immediately before editing.
- Verify the target issue row exists and remains open.
- Apply only target-local changes.
- Recount target open issue tables from the actual file after patch.
- Do not use absolute issue counts from this matrix.

Current Wave 1 state:

- Target-local patches have been applied to Plan Generator, App Bridge, and Athlete Profile.
- The three target issues remain open as `PATCHED_PENDING_SOURCE_ACCEPTANCE` or equivalent addendum state.
- No absolute downstream count was copied from `PHYSIO_SOURCE_TRUST_SPEC.md`.
- No runtime evidence, canonical promotion, or issue closure is claimed by this matrix.

### Wave 2 - Daily Log Binding Patches

Targets:

- `APP_IMPLEMENTATION_BRIDGE.md`
- `PLAN_SAFETY_GATE_SPEC.md`
- later `RULE_VALIDATION_ENGINE_CONTRACT.md`

Source:

- `DAILY_LOG_AND_CHECKIN_SPEC.md`

Rules:

- Raw memo/free-text remains transient only.
- Persist structured fields, non-sensitive reason codes, source refs, audit refs, and policy-allowed redacted summaries only.
- Daily Log may raise risk but cannot clear `D9_ACTIVE`, `D9_UNKNOWN`, or Safety Gate block states.

Current Wave 2 state:

- App Bridge has a target-local Daily Check-in storage/API/type patch for structured fields only.
- Plan Safety Gate has a target-local Daily Log input boundary patch in Section 9A.
- Related issues remain open; no runtime evidence, canonical promotion, or issue closure is claimed.

### Wave 3 - Productization SPEC Drafts

Drafts:

- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` - created as `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` - created as `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` - created as `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` - created as `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` - created as `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`, with root owner-decision record `TRAINING_PLAN_METHOD_DECISION.md`

Rules:

- Draft only after Daily Log storage boundary is stable.
- No external LLM with private athlete data in the current rule-engine phase.
- Every generated brief/inbox/rationale item must preserve source refs, confidence/uncertainty, and non-sensitive reason codes.

Current Wave 3 state:

- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` now exists as a new productization draft.
- It is not an original restored file, not canonical promotion, not runtime evidence, and not issue closure.
- It defines daily brief and AI Inbox signal records from structured facts only; raw memo/free-text/symptom clauses remain forbidden.
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` now exists as a new productization draft.
- It defines source-backed visualization data for Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, and AI Inbox surfaces.
- It preserves source refs, confidence/uncertainty, non-sensitive reason codes, and visible missing/stale/conflicting states.
- It cannot define final metric formulas, clear D9/Safety Gate states, create plan options, claim runtime evidence, or close downstream issues.
- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` now exists as a new productization draft.
- It defines privacy-safe plan rationale bundles and items using source refs, rationale codes, privacy tiers, redaction states, and confidence/uncertainty.
- It cannot create or select plan options, clear D9/Safety Gate states, claim runtime evidence, resolve `OI-PG-OPTION-RATIONALE-PRIVACY-001`, or close downstream issues.
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` now exists as a new productization draft.
- It defines namespace-safe 9.5-day cycle display, `CYCLE_DAY.*` labels, planned dates, session slots, race anchors, and Calendar projections.
- It cannot create or select plan options, redefine D-rule semantics, clear D9/Safety Gate states, claim runtime evidence, resolve `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`, or close downstream issues.
- `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` now exists as a decision-provenanced draft with six canonical blockers. It cannot execute, patch downstream targets, or claim runtime evidence.
- Productization draft creation is complete; Formation acceptance and target binding remain open.

### Wave 4 - Runtime Evidence

Targets:

- D9 evaluator
- RVE signal mapping
- Safety Gate routing
- Plan Generator block behavior

Rules:

- Candidate test package is not runtime evidence.
- Actual terminal or CI output is required.
- Advisory must map to `CLEARED`, preserve non-sensitive advisory reason codes, and not block.

### Wave 3.5 - Review And Target Patch Readiness

Documents:

- `SPEC_REVIEW_PACKET.md`
- `SPEC_TARGET_PATCH_READINESS.md`

Rules:

- Use the review packet to give external reviewers a read order, lens, known non-claims, and exact questions.
- Use the readiness document before editing target SPEC files.
- Do not treat either document as source acceptance, canonical promotion, runtime evidence, or issue closure.
- Do not close downstream issues from reviewer comments alone; target files must still be opened, patched, recounted, and verified.

### Wave B Progress - Plan Generator Safety Gate Target Patch

Document:

- `SPEC_WAVEB_SAFETY_GATE_PATCH_REPORT.md`

Target:

- `specs/active/PLAN_GENERATOR_SPEC.md`

Rules:

- Treat the Wave B patch as target-local binding guidance only.
- Keep `OI-PG-RULE-SAFETY-GATE-BINDING-001` open.
- Do not treat reconstructed Safety Gate or RVE contracts as accepted canonical sources.
- Do not close the issue before source acceptance, target recount approval, and actual D9 runtime evidence.

---

## 6. Closure Blockers Still Active

```yaml
runtime_evidence_missing:
  - D9_SAFETY_EVALUATOR_actual_execution_log
  - RVE_signal_shape_runtime_verification
  - Safety_Gate_ACTIVE_UNKNOWN_CLEARED_routing_runtime_verification

acceptance_missing:
  - RULE_VALIDATION_ENGINE_CONTRACT_acceptance
  - PLAN_SAFETY_GATE_SPEC_acceptance
  - DAILY_LOG_AND_CHECKIN_SPEC_acceptance

implementation_missing:
  - DailyCheckInRecord_storage
  - raw_note_redaction_or_transient_deletion
  - RVE_signal_storage
  - Safety_Gate_application_binding
```

---

## 7. One-Line Summary

The next safe work is not issue closure. Review the Formation/Adaptation draft against its owner decision, resolve its six canonical blockers, then perform count-safe Plan Generator and Calendar schema patches before implementation or runtime claims.

[DRAFT_COMPLETE]
