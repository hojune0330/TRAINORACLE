# SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md

doc_id: TRAINORACLE_SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN
spec_id: TRAINORACLE.SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN
title: "TrainOracle SPEC-Legacy Alignment And Daily Log Continuity Plan"
version: 0.1
round: RT1
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false

---

## 1. Purpose

This document records how the current TrainOracle SPEC layer, legacy reference layer, design handoff, and planned daily-log service should connect.

It is a planning and continuity document. It is not a product rule definition, not runtime evidence, not canonical promotion, and not issue closure.

For a simple document-by-document status report, read [`SPEC_DOCUMENTATION_REPORT.md`](./SPEC_DOCUMENTATION_REPORT.md).
For the next count-safe source-to-target patch sequence, read [`SPEC_TARGET_PATCH_MATRIX.md`](./SPEC_TARGET_PATCH_MATRIX.md).

The source-of-truth rule remains:

- local repository files are truth
- conversation summaries and recovered ledgers are reference only
- file existence must be verified locally before use
- issue counts must be read from the target file before being applied
- runtime issues must not be closed without actual execution logs

---

## 2. Local Inventory Snapshot

This snapshot started from the repository file inventory checked on 2026-06-25 Asia/Seoul and was updated with reconstructed-file state on 2026-06-26 Asia/Seoul.

### Active SPEC Candidates

| File | Local path | Continuity role |
|---|---|---|
| `RULE_SPEC_D1_D9.md` | `specs/active/RULE_SPEC_D1_D9.md` | Current rule semantics and safety hard-stop baseline |
| `SESSION_CLASSIFIER_SPEC.md` | `specs/active/SESSION_CLASSIFIER_SPEC.md` | Session classification output baseline |
| `ATHLETE_PROFILE_SPEC.md` | `specs/active/ATHLETE_PROFILE_SPEC.md` | Athlete-scoped profile, consent, constraint, and snapshot baseline |
| `APP_IMPLEMENTATION_BRIDGE.md` | `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | Storage, capability, consent, audit, and API bridge baseline |
| `PLAN_GENERATOR_SPEC.md` | `specs/active/PLAN_GENERATOR_SPEC.md` | Plan candidate generation contract |
| `TEMPLATE_LIBRARY_SPEC.md` | `specs/active/TEMPLATE_LIBRARY_SPEC.md` | Template ownership, lifecycle, eligibility, and privacy boundary |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md` | Physiological source trust and Plan Generator consumption boundary |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` | D9 evaluator to RVE, Safety Gate, and Plan Generator binding |

### Test Package

| File | Local path | Treatment |
|---|---|---|
| `D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | Candidate local test package only; not runtime evidence by itself |

### Legacy Reference Files

| File | Local path | Treatment |
|---|---|---|
| `02_AI_STRATEGY.md` | `specs/legacy-reference/02_AI_STRATEGY.md` | Legacy Coach Jang Phase A-F workflow reference |
| `06_VALIDATION_AND_SAFEGUARDS.md` | `specs/legacy-reference/06_VALIDATION_AND_SAFEGUARDS.md` | Legacy validation and safeguard model reference |
| `11_API_AND_ENGINE_CONTRACTS.md` | `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` | Legacy Phase output contract; not `RULE_VALIDATION_ENGINE_CONTRACT.md` |
| `12_SCREEN_GUIDE.md` | `specs/legacy-reference/12_SCREEN_GUIDE.md` | Google Sheet and old output-screen reference |
| `GLOSSARY.md` | `specs/legacy-reference/GLOSSARY.md` | Terminology, namespace, and early data-entity reference |
| `SOURCE_MAP.md` | `specs/legacy-reference/SOURCE_MAP.md` | Source provenance reference |
| `_SOURCE_TO_DOC_MAP_v3.0.md` | `specs/legacy-reference/_SOURCE_TO_DOC_MAP_v3.0.md` | Source-to-doc mapping reference |

### Reconstructed Or Source-Not-Verified Contracts

The following rows reflect exact local file state. Chapter titles, table rows, and status labels do not count as file existence.

| Required file | Expected location | Required treatment |
|---|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` | Exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `PLAN_SAFETY_GATE_SPEC.md` | `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | Exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence |
| `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001` | `specs/reconstruct/` or evidence area | Do not claim found unless local evidence exists |

---

## 3. Namespace Continuity Rule

New work must preserve three separate namespaces.

| Namespace | Example | Meaning |
|---|---|---|
| `RULE_SPEC_D1_D9` | `RULE_SPEC_D1_D9.D-9` | Current SPEC-layer validation rule |
| `LEGACY_PHASE_D` | `LEGACY_PHASE_D.D-9` | Old workflow Phase validation item |
| `CYCLE_DAY` | `CYCLE_DAY.D-5` | Cycle or race-day label, not a rule id |

`02_AI_STRATEGY.md`, `06_VALIDATION_AND_SAFEGUARDS.md`, `11_API_AND_ENGINE_CONTRACTS.md`, and `12_SCREEN_GUIDE.md` contain legacy workflow references. They are not allowed to redefine `RULE_SPEC_D1_D9.D-*` semantics.

---

## 4. SPEC To Legacy Alignment Matrix

| Current document | Legacy/design source to preserve | Alignment rule | Current gap |
|---|---|---|---|
| `RULE_SPEC_D1_D9.md` | `06_VALIDATION_AND_SAFEGUARDS.md`, `SOURCE_MAP.md`, `_SOURCE_TO_DOC_MAP_v3.0.md` | Current SPEC semantics win. Legacy validation text remains operational background only. | RVE and Safety Gate contracts now exist only as reconstructed drafts; neither is accepted or runtime-proven. |
| `SESSION_CLASSIFIER_SPEC.md` | `02_AI_STRATEGY.md` Phase C, `11_API_AND_ENGINE_CONTRACTS.md` Phase C output | Classifier emits normalized structured session records; it does not emit D-rule verdicts. | Daily Log now exists as reconstructed draft; classifier binding remains target work. |
| `ATHLETE_PROFILE_SPEC.md` | `GLOSSARY.md` Athlete/Profile concepts, design onboarding and settings flows | Profile owns athlete-scoped preferences, constraints, consent, and immutable snapshots. | `OI-AP-PHYSIO-SOURCE-001` remains open; Daily Log consent/profile binding remains target work. |
| `APP_IMPLEMENTATION_BRIDGE.md` | `11_API_AND_ENGINE_CONTRACTS.md`, `12_SCREEN_GUIDE.md`, design system data dependencies | Bridge owns storage, capability, consent, audit, and scoped access. | `OI-AIB-PHYSIO-SOURCE-001` plus storage/security blockers remain open; DailyCheckInRecord bridge binding remains target work. |
| `PLAN_GENERATOR_SPEC.md` | `02_AI_STRATEGY.md` Phase E, `06_VALIDATION_AND_SAFEGUARDS.md`, design Session Detail and AI Inbox | Generator is downstream only. It consumes Safety Gate, Template Library, Profile, Classifier, and Physio results without redefining them. | Local file declares `OI-PG-RULE-SAFETY-GATE-BINDING-001` and `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` as canonical blockers. |
| `TEMPLATE_LIBRARY_SPEC.md` | Legacy training-system concepts, design session patterns | Templates are selectable candidates only. Template eligibility cannot clear safety risk. | Product catalog expansion and feedback loop remain future non-canonical work. |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | `GLOSSARY.md` metrics, design primary-device safeguards, legacy data-import references | Good physiological data cannot clear `RULE_SPEC_D1_D9.D-9` risk. Bad or missing data can route to review or block generation when required. | Consumer patches in Plan Generator, App Bridge, and Athlete Profile now exist; source acceptance and target-file recount approval are still required before closure. |
| `RVE_RULE_EVALUATOR_BINDING_SPEC.md` | `RULE_SPEC_D1_D9.md`, D9 test package, App Bridge audit policy | Defines D9 evaluator signal binding, but does not itself provide final runtime evidence. | RVE and Safety Gate reconstructed drafts now exist; accepted contract status and runtime evidence are still needed. |

---

## 5. Key Consistency Findings

### 5.1 Strong Existing Alignment

- The repository already has a clear starting path: `README.md` points to `TRAINORACLE_SPEC_INDEX.md`, and `SPEC_WORK_STATUS.md` records the incomplete contract-layer phase.
- The eight active SPEC candidates are present under `specs/active/`.
- Legacy references are separated under `specs/legacy-reference/`.
- The reconstruct area now contains reconstructed drafts for `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md`.
- The D-rule namespace separation is repeated in the index, glossary, legacy references, and active bridge/spec files.
- RVE binding already records that `ADVISORY` is not a fourth disposition and remains under `D9_CLEARED`.

### 5.2 Important Gaps

- `RULE_VALIDATION_ENGINE_CONTRACT.md` now exists only as a reconstructed draft at `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`; it is not an original, not canonical, and not runtime evidence.
- `PLAN_SAFETY_GATE_SPEC.md` now exists only as a reconstructed draft at `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`; it is not an original, not canonical, and not runtime evidence.
- `DAILY_LOG_AND_CHECKIN_SPEC.md` now exists only as a reconstructed draft at `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`; it is not an original, not canonical, and not runtime evidence.
- D9 evaluator runtime output is still absent; the local markdown test package is not runtime evidence.
- Plan Generator still has unresolved safety-gate and physio-source consumption blockers in the local file.
- Daily Check-in and diary-like usage now have a reconstructed storage/ingestion contract, but App Bridge/Profile/Physio/RVE/Safety Gate target bindings are still open.
- Daily Check-in still implies memo/pain input in design docs, while the safety/spec layer forbids raw athlete free-text and raw symptom clause storage in audit contracts. `DAILY_LOG_AND_CHECKIN_SPEC.md` resolves this at the contract level by treating memo text as transient and storing only structured fields, reason codes, references, and policy-allowed redacted summaries.

### 5.3 Format QA To Handle Before Canonical Promotion

Some active candidates are older carried-forward baselines and do not fully match the newer SPEC document shape.

- `RULE_SPEC_D1_D9.md` starts with a source comment before the H1 and does not currently end with `[DRAFT_COMPLETE]`.
- `SESSION_CLASSIFIER_SPEC.md` does not currently end with `[DRAFT_COMPLETE]`.
- `ATHLETE_PROFILE_SPEC.md` now ends with `[DRAFT_COMPLETE]` after the Wave 1 physio-source target patch.
- Newer active documents such as App Bridge, Plan Generator, Template Library, Physio Source Trust, and RVE Binding have `[DRAFT_COMPLETE]` as the final line.

This is a document-format issue, not a reason to reinterpret rule semantics.

---

## 6. Daily Log Service Flow

TrainOracle should feel like a daily training journal, but its core value remains training analysis, plan design, and evidence-based coaching.

The service flow should be:

1. Athlete context is established through onboarding, athlete profile, primary device selection, consent, and historical import.
2. Dashboard opens the day with today's planned session, cycle context, unread AI Inbox items, and today's check-in state.
3. Daily Check-in captures structured fields first: energy, soreness, sleep, mood, RPE, body-area signal, readiness, and optional constrained notes.
4. Any free-text note is treated as transient input for risk extraction or user-facing display policy. Production audit contracts must store reason codes, structured fields, references, and non-sensitive summaries instead of raw symptom clauses.
5. Session data and check-in data flow into App Bridge source snapshots with tenant/group/athlete scope.
6. Session Classifier produces classified session records from structured session sources.
7. Athlete Profile produces immutable athlete-scoped snapshots and constraints.
8. Physio Source Trust evaluates wearable, load, recovery, and manual physiological signals without clearing safety risk.
9. D9 evaluator and RVE produce a safety signal.
10. Plan Safety Gate consumes RVE before Plan Generator runs.
11. Plan Generator creates plan candidates only when Safety Gate allows generation.
12. Template Library may be queried only after the safety gate allows generation.
13. Session Detail, Analysis, Calendar, and AI Inbox show outcomes with verdict, confidence, citation, and visible uncertainty.
14. Completed sessions and daily check-ins return to the archive and become structured context for the next decision.

The daily-log surface is therefore not a separate lightweight feature. It is the daily ingestion layer for the coaching engine.

---

## 7. Required New Or Reconstructed Documents

### Phase 1 - Safety Core Contracts

1. `RULE_VALIDATION_ENGINE_CONTRACT.md`
   - Current status: `RECONSTRUCTED_DRAFT_FOR_REVIEW`
   - Must define RVE input, output, audit, failure, and D9 signal handling.
   - Must not replace `11_API_AND_ENGINE_CONTRACTS.md`.
   - Must not close `OI-RVE-RULE-EVALUATOR-BINDING-001` without runtime evidence.

2. `PLAN_SAFETY_GATE_SPEC.md`
   - Current status: `RECONSTRUCTED_DRAFT_FOR_REVIEW`
   - Must define the pre-generation gate between RVE and Plan Generator.
   - Must block generation for `D9_ACTIVE`.
   - Must block or require review for `D9_UNKNOWN`.
   - Must treat `D9_CLEARED` as no detected D9 signal at that time only, not medical clearance.
   - Non-note structured advisory may remain non-blocking under `D9_CLEARED`; analyzable-note CLEARED/advisory must emit no Formation authorization signal, and private-only input must never be evaluated.

### Phase 2 - Daily Ingestion And Diary Contract

3. `DAILY_LOG_AND_CHECKIN_SPEC.md`
   - Recommended location: `specs/reconstruct/` until accepted into an active SPEC area.
   - Current status: `RECONSTRUCTED_DRAFT_FOR_REVIEW`
   - Purpose: define daily check-in, diary, structured wellness input, note handling, and storage boundaries.
   - Must bind to `APP_IMPLEMENTATION_BRIDGE.md`, `ATHLETE_PROFILE_SPEC.md`, `SESSION_CLASSIFIER_SPEC.md`, `PHYSIO_SOURCE_TRUST_SPEC.md`, and `RVE_RULE_EVALUATOR_BINDING_SPEC.md`.
   - Must reconcile design `Daily Check-in` memo UX with raw free-text storage prohibitions.
   - Must specify which fields may be stored as structured values, which may become reason codes, and which must remain transient or redacted.

4. `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
   - Purpose: define how daily brief, dashboard prompts, and AI Inbox items are generated from structured facts.
   - Must require verdict, confidence, citation, source references, and uncertainty state.
   - Must not allow an LLM to create new coaching decisions from private athlete data in the current rule-engine phase.

### Phase 3 - Productization Contracts

5. `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
   - Current status: created at `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` as `DRAFT_FOR_REVIEW`.
   - Purpose: ensure Plan Generator rationale and UI copy do not leak sensitive athlete data.
   - Should address the local Plan Generator privacy issue around option rationale.
   - Must not create or select plan options, clear D9/Safety Gate states, claim runtime evidence, or close `OI-PG-OPTION-RATIONALE-PRIVACY-001`.

6. `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
   - Current status: created at `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` as `DRAFT_FOR_REVIEW`.
   - Purpose: connect `CYCLE_DAY` labels, 9.5-cycle display, Calendar, Dashboard, and Plan Generator output.
   - Must keep `CYCLE_DAY.D-*` separate from rule namespaces.
   - Must not create or select plan options, clear D9/Safety Gate states, redefine D-rule semantics, claim runtime evidence, or close `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`.

7. `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
   - Current status: created at `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` as `DRAFT_FOR_REVIEW`.
   - Purpose: bind Analysis, Session Detail, Calendar, and Dashboard visualizations to structured data sources.
   - Must preserve the design-system requirement that visualizations reveal evidence quickly without becoming decoration.
   - Must not define final metric formulas, clear D9/Safety Gate states, create plan options, claim runtime evidence, or close downstream issues.

8. `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`
   - Current status: created at `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` as `DRAFT_FOR_REVIEW`, grounded by root decision `TRAINING_PLAN_METHOD_DECISION.md`.
   - Purpose: turn the confirmed 9.5-day/MAIN boundary into deterministic candidate, composite-load, safety-hold, and immutable adaptation contracts.
   - Must preserve separate planning-role, classifier-label, energy-focus, component, completion, and experienced-response facts.
   - Must not execute before its ten canonical blockers, source acceptance, target schema patches, and runtime tests are complete. See `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`.

---

## 8. Next Work Order

1. Review `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` as reconstructed draft only; do not treat it as original or accepted.
2. Review `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` as reconstructed draft only; do not treat it as original or accepted.
3. Review `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` as reconstructed draft only; do not treat it as original or accepted.
4. Use `SPEC_TARGET_PATCH_MATRIX.md` to choose the next patch wave and confirm which issues cannot be closed yet.
5. Run or prepare actual D9 evaluator runtime execution. Do not close RVE/PG binding issues from markdown self-checks.
6. Review the Wave 1 physio consumption target patches in `PLAN_GENERATOR_SPEC.md`, `APP_IMPLEMENTATION_BRIDGE.md`, and `ATHLETE_PROFILE_SPEC.md`; keep their issues open until source acceptance and target recount approval exist.
7. Patch Daily Log consumption into App Bridge, Athlete Profile, Physio Source Trust, RVE, and Safety Gate only after opening each target file and recounting its open-issue table.
8. Review `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` before wiring daily summaries, push prompts, or AI Inbox generation.
9. Review `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` before implementing Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, or AI Inbox visualization data.
10. Review `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` before implementing Calendar, Dashboard cycle rail, Session Detail cycle context, Analysis cycle summaries, or plan calendar projection.
11. Review `TRAINING_PLAN_METHOD_DECISION.md` with `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`; keep option taxonomy, coach rule set, statistics, schema bindings, and pilot protocol visibly open.

Wave 1 note: Physio Source Trust target patches into Plan Generator, App Bridge, and Athlete Profile now exist. They remain open for review/acceptance and target-file recount approval; this note does not close any issue.

Wave 3 note: Daily Brief / AI Inbox, Analysis / Visualization, Plan Output Rationale Privacy, Microcycle / Calendar Mapping, and Training Plan Formation / Adaptation drafts now exist. They remain drafts for review and do not provide implementation, runtime evidence, canonical promotion, or downstream issue closure.

---

## 9. Non-Negotiable Safety Rules For Future Specs

- No global coach authority.
- No safety hard-stop override.
- No rule semantic redefinition outside `RULE_SPEC_D1_D9.md`.
- No external LLM with private athlete data in the current rule-engine phase.
- Raw athlete free-text, raw symptom clauses, injury narratives, medical notes, guardian private notes, and sensitive free-form comments must not be stored in audit contracts.
- Free-text can raise risk but cannot clear existing risk.
- Good physiological data cannot clear `RULE_SPEC_D1_D9.D-9` risk.
- Template selection cannot clear `RULE_SPEC_D1_D9.D-9` risk.
- `D9_ACTIVE` blocks Plan Generator.
- `D9_UNKNOWN` blocks Plan Generator or requires human review.
- `D9_CLEARED` is not medical clearance.
- Advisory is not a fourth D9 disposition. It remains a non-blocking subtype under `D9_CLEARED`.

---

## 10. Completion Criteria For This Planning Layer

This planning layer is useful only if a future GitHub-only worker can answer:

- Which active SPEC files exist locally?
- Which legacy files are reference-only?
- Which missing contracts must be reconstructed?
- Which namespace wins when legacy and current terms collide?
- How does daily check-in feed training analysis and plan generation?
- What cannot be stored from diary/check-in input?
- Which issues must remain open until actual execution evidence is captured?
- Which new SPEC should be written before app implementation touches daily diary storage?

[DRAFT_COMPLETE]
