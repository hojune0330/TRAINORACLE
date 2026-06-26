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
| `SPEC_DOCUMENTATION_REPORT.md` | Handoff report | Human-readable document map | Product rule authority |

---

## 4. Target Patch Matrix

| Target document | Target issue | Current target evidence | Source to consume | Patch intent | Closure allowed now |
|---|---|---|---|---|---|
| `PLAN_GENERATOR_SPEC.md` | `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 / YES / OPEN in current target file | `PLAN_SAFETY_GATE_SPEC.md`, `RULE_VALIDATION_ENGINE_CONTRACT.md`, `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | Bind Plan Generator to consume D9/RVE only through Safety Gate; ACTIVE/UNKNOWN block; advisory non-blocking under CLEARED | No. Requires accepted target patch, recount, and actual D9 runtime evidence |
| `PLAN_GENERATOR_SPEC.md` | `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 / YES / OPEN; target binding patched in Section 6B | `PHYSIO_SOURCE_TRUST_SPEC.md` | Consume trusted physio source status without allowing good physio data to clear D9 risk | No. Target patch exists, but closure still requires source acceptance and target recount approval; do not copy expected deltas |
| `APP_IMPLEMENTATION_BRIDGE.md` | `OI-AIB-PHYSIO-SOURCE-001` | P1 / true / OPEN in current target file; issue addendum records patched-pending-source-acceptance | `PHYSIO_SOURCE_TRUST_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md` | Add storage/use boundary for physio source trust and daily check-in structured data | No. Target patch exists, but closure still requires source acceptance, target recount approval, and implementation/privacy review |
| `ATHLETE_PROFILE_SPEC.md` | `OI-AP-PHYSIO-SOURCE-001` | Canonical blocking issue remains OPEN with patched-pending-source-acceptance addendum | `PHYSIO_SOURCE_TRUST_SPEC.md`, `DAILY_LOG_AND_CHECKIN_SPEC.md` | Clarify profile physiological attributes source priority and conflict handling | No. Target patch exists, but closure still requires source acceptance, App Bridge binding acceptance, and target recount approval |
| `PLAN_SAFETY_GATE_SPEC.md` | `OI-PSG-DAILY-LOG-INPUT-BINDING-001` | P2 / NO / OPEN in current target file | `DAILY_LOG_AND_CHECKIN_SPEC.md` | Bind daily check-in structured signals as possible RVE/Safety Gate context without raw text storage | No. Reconstructed source must be accepted first |
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

### Wave 3 - Productization SPEC Drafts

Drafts:

- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`

Rules:

- Draft only after Daily Log storage boundary is stable.
- No external LLM with private athlete data in the current rule-engine phase.
- Every generated brief/inbox/rationale item must preserve source refs, confidence/uncertainty, and non-sensitive reason codes.

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

The next safe work is not issue closure. Wave 1 Physio Source Trust target patches now exist for Plan Generator/App Bridge/Athlete Profile, so the next work is review/acceptance and target-file recount approval for those patches, then Daily Log into App Bridge/Safety Gate with each target file opened and recounted at patch time.

[DRAFT_COMPLETE]
