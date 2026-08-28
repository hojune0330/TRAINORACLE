# Missing Or Reconstructed SPEC Area

This directory is reserved for required TrainOracle contracts that were missing, source-not-verified, or reconstructed during SPEC inventory and continuation passes.

Current reconstructed drafts:

- `RULE_VALIDATION_ENGINE_CONTRACT.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)
- `PLAN_SAFETY_GATE_SPEC.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)
- `DAILY_LOG_AND_CHECKIN_SPEC.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)

Current productization drafts:

- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` (`DRAFT_FOR_REVIEW`; new productization draft, not original restored, not canonical, not runtime evidence)
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` (`DRAFT_FOR_REVIEW`; new productization draft, not original restored, not canonical, not runtime evidence)
- `CUMULATIVE_DISTANCE_ANALYSIS_CONTRACT.md` (`DRAFT_FOR_REVIEW`; cumulative-distance v1 implementation binding, exact 9.5-day attribution and whole-entry privacy remain open, not canonical, not runtime evidence)
- `PLAN_JOURNAL_LINKAGE_CONTRACT.md` (`DRAFT_FOR_REVIEW`; explicit immutable planned-session to post-session journal binding, exact occurrence and historical ledger remain open, not canonical, not runtime evidence)
- `PERIODIZATION_LINEAGE_CONTRACT.md` (`DRAFT_FOR_REVIEW`; 9.5-day frame, three-frame display group, and 18-frame direction lineage, not an automatic load rule, not canonical, not runtime evidence)
- `PLAN_EVENT_BREADTH_CONTRACT.md` (`DRAFT_FOR_REVIEW`; seven initial events from 800m through marathon, RPE-time generation only where no detailed template is active, not canonical, not detailed-template activation authority)
- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` (`DRAFT_FOR_REVIEW`; new productization draft, not original restored, not canonical, not runtime evidence)
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` (`DRAFT_FOR_REVIEW`; new productization draft, not original restored, not canonical, not runtime evidence)
- `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` (`DRAFT_FOR_REVIEW`; decision-provenanced first-pilot formation/adaptation policy with ten canonical blockers and an athlete-visible non-executing shadow-pilot boundary, audited in root `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`, not canonical, not runtime evidence)
- `EXTERNAL_RECORD_INTEGRATION_SPEC.md` (`DRAFT_FOR_REVIEW`; Work Order 005 Task A draft, merged to main, not canonical, not runtime evidence)
- `COMPOSITION_BALANCE_BASELINE_CONTRACT.md` (`DRAFT_FOR_REVIEW`; Work Order 005 Task B draft, merged to main, not canonical, not runtime evidence)
- `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` (`DRAFT_FOR_REVIEW`; Work Order 006 Task A draft, merged to main, not canonical, not runtime evidence)
- `LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` (`DRAFT_FOR_REVIEW`; Work Order 006 Task B draft, merged to main, not canonical, not runtime evidence)
- `FEDERATED_ACCOUNT_SSO_CONTRACT.md` (`DRAFT_FOR_REVIEW`; Work Order 006 Task C draft, merged to main, not canonical, not runtime evidence)

Related root decision and planning documents:

- `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md` records the nine-persona findings, Mermaid blueprint, and review-recommended order of the canonical blockers.
- `ACCOUNT_FEDERATION_DECISION.md` records the owner-level account direction for TrainOracle and AthleteTime federation.
- `ATHLETETIME_INTEGRATION_REVIEW.md` records integration review context for AthleteTime boundaries.
- `LAUNCH_BACKEND_AND_ACCOUNT_PLAN.md` records launch/backend/account planning context.
- These root documents are planning/decision context. They are not runtime evidence, canonical promotion, or issue closure.

Known missing or source-not-verified targets:

- `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001`

If a local original is later found, add it with evidence. If not found, reconstruct only as `RECONSTRUCTED_DRAFT_FOR_REVIEW` and do not claim prior approval, issue closure, or runtime execution evidence.

Before applying any reconstructed draft to an active target document, read [`../../SPEC_TARGET_PATCH_MATRIX.md`](../../SPEC_TARGET_PATCH_MATRIX.md). The matrix records the next source-to-target patch order and the conditions that still prevent issue closure.

## Continuation Checklist

Use this order before creating any reconstructed file:

0. Always search first; do not reconstruct from memory.
1. Search the repository and any explicitly provided local source package for the target filename.
2. If an original is found, record where it was found and add it with provenance.
3. If no original is found, reconstruct the file only as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
4. Preserve `executed_tests_total: 0` unless actual runtime logs exist.
5. Keep the required draft-complete final marker as the final line of any reconstructed SPEC.
6. Recount target open-issue tables from the target file before changing counts.
7. Do not close RVE, Safety Gate, Plan Generator, Physio Source, App Bridge, or Athlete Profile issues from reconstruction alone.
8. Do not treat an H1, chapter title, table row, status label, or conversation summary as file-existence evidence. Use `SPEC_FILE_TRUTH_GUARD.md`.
9. Use `SPEC_TARGET_PATCH_MATRIX.md` to choose the next target patch wave; do not treat the matrix itself as runtime evidence.

## Reconstruction Targets

`RULE_VALIDATION_ENGINE_CONTRACT.md`:

- Exact search was captured in `.omo/evidence/spec-continuation-phantom-doc-guard-20260626/c001-red-filesystem-truth.md`.
- `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md` now exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
- Do not claim it is the original restored file.
- Do not use `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` as a replacement contract.
- Do not close `OI-RVE-RULE-EVALUATOR-BINDING-001` without actual runtime evidence and accepted target patches.

`PLAN_SAFETY_GATE_SPEC.md`:

- Exact search was captured in `.omo/evidence/spec-continuation-plan-safety-gate-20260626/c001-red-filesystem-truth.md`.
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` now exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
- It was reconstructed from `specs/active/PLAN_GENERATOR_SPEC.md`, `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`, `specs/active/RULE_SPEC_D1_D9.md`, `specs/active/APP_IMPLEMENTATION_BRIDGE.md`, and `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`.
- Define only the pre-generation safety gate boundary.
- Do not claim it is the original restored file.
- Do not close `OI-PG-RULE-SAFETY-GATE-BINDING-001` without actual runtime evidence and accepted target patches.

`DAILY_LOG_AND_CHECKIN_SPEC.md`:

- Exact search was captured in `.omo/evidence/spec-continuation-daily-log-and-doc-report-20260626/c001-red-daily-log-file-truth.md`.
- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` now exists as `RECONSTRUCTED_DRAFT_FOR_REVIEW`.
- It was reconstructed from `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`, design Daily Check-in references, `APP_IMPLEMENTATION_BRIDGE.md`, `ATHLETE_PROFILE_SPEC.md`, `SESSION_CLASSIFIER_SPEC.md`, `PHYSIO_SOURCE_TRUST_SPEC.md`, `RULE_VALIDATION_ENGINE_CONTRACT.md`, and `PLAN_SAFETY_GATE_SPEC.md`.
- Do not claim it is the original restored file.
- Do not persist raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, or guardian private notes.
- Do not close Safety Gate, RVE, Plan Generator, App Bridge, Athlete Profile, or Physio issues from reconstruction alone.

`DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`:

- Exact search before creation was captured in `.omo/evidence/spec-productization-daily-brief-red-20260627.txt`.
- `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a new productization draft, not an original restored file.
- It defines daily brief, dashboard prompt, and AI Inbox signal records from structured facts.
- It requires source refs, confidence/uncertainty, and non-sensitive reason codes.
- It forbids raw memo text, raw free text, raw symptom clauses, private medical/guardian notes, and external LLM prompts with private athlete data.
- It cannot create plan options, clear D9 risk, clear Safety Gate blocks, or close downstream issues.

`ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`:

- Exact search before creation was captured in `.omo/evidence/spec-productization-analysis-red-20260707.txt`.
- `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a new productization draft, not an original restored file.
- It defines source-backed Analysis, Dashboard, Session Detail, Calendar, coach review, Daily Brief, and AI Inbox visualization data shapes.
- It requires source refs, confidence/uncertainty, non-sensitive reason codes, and visible missing/stale/conflicting source states.
- It forbids raw memo text, raw free text, raw symptom clauses, private medical/guardian notes, and external LLM prompts with private athlete data.
- It cannot define final CTL/ATL/TSB formulas, create plan options, clear D9 risk, clear Safety Gate blocks, or close downstream issues.

`CUMULATIVE_DISTANCE_ANALYSIS_CONTRACT.md`:

- It narrows the first analysis implementation to descriptive cumulative distance only.
- It gives Home and Analysis one source of truth for week/month/year-to-date, recent week/month buckets, current-month days, and a date-based current-plan-period total.
- Missing distance remains missing, imported/unverified and legacy-no-provenance distance is excluded, and duplicate source identities cannot double-count mileage.
- Private memo text and memo-presence signals are absent from the engine; the missing whole-entry privacy scope is disclosed as an open issue.
- It forbids an exact 9.5-day metric label until timezone, frame instants, occurrence time, and plan-session attribution exist.

`ENERGY_SYSTEM_ACCUMULATION_CONTRACT.md`:

- It defines the first descriptive energy-system ledger across explicit journal selections and the current selected plan.
- It keeps planned sessions, completion marks, and journal metrics separate; legacy defaults never become BASE evidence.
- It keeps mixed sessions visible as `MIXED_UNALLOCATED` and extends duplicate signatures to duration, distance, and RPE.
- It does not authorize physiological measurement claims, automatic adaptation, exact 9.5-day attribution, or historical plan linkage.
- It creates no distance-goal, reward, training-plan mutation, safety, or medical authority.

`PLAN_JOURNAL_LINKAGE_CONTRACT.md`:

- It creates an immutable opaque link only after the athlete selects one exact non-rest session and chooses to write its journal.
- It keeps the plan, progress mark, and performed journal result as separate facts.
- It does not infer execution from date, title, RPE, memo text, or planned energy intent.
- It leaves exact 9.5-day occurrence attribution, historical plan ledger, and cross-device conflict resolution open.

`PERIODIZATION_LINEAGE_CONTRACT.md`:

- It stores the current macrocycle, frame, three-frame display group, and owner-directed phase as an opaque plan lineage.
- It advances only when an accepted successor plan is actually activated; journal and progress actions do not advance it.
- It preserves the existing rule that calendar or phase position cannot automatically raise intensity, volume, or frequency.
- It leaves timezone occurrence, full archived session snapshots, server lifecycle, variable 3-6 frame mesocycles, and race-anchor adjustment open.

`PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`:

- Exact search before creation was captured in `.omo/evidence/spec-productization-rationale-red-20260707.txt`.
- `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a new productization draft, not an original restored file.
- It defines privacy-safe plan rationale bundles and items using source refs, rationale codes, privacy tiers, redaction states, and confidence/uncertainty.
- It forbids raw memo text, raw free text, raw symptom clauses, private medical/guardian notes, hidden chain-of-thought, and external LLM prompts with private athlete data.
- It cannot create or select plan options, clear D9 risk, clear Safety Gate blocks, resolve `OI-PG-OPTION-RATIONALE-PRIVACY-001`, or close downstream issues.

`MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`:

- Exact search before creation was captured in `.omo/evidence/spec-productization-microcycle-red-20260707.txt`.
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a new productization draft, not an original restored file.
- It defines namespace-safe microcycle/calendar mapping for 9.5-day cycle display, `CYCLE_DAY.*` labels, planned dates, session slots, race anchors, and Calendar projections.
- It keeps `CYCLE_DAY.*`, `RULE_SPEC_D1_D9.*`, and `LEGACY_PHASE_D.*` separate.
- It cannot create or select plan options, clear D9 risk, clear Safety Gate blocks, resolve `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001`, or close downstream issues.

`TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`:

- `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` exists as `DRAFT_FOR_REVIEW`.
- It is grounded by root decision record `TRAINING_PLAN_METHOD_DECISION.md` and separates confirmed method boundaries from proposed option taxonomy and unresolved coach rules.
- It defines a local-civil 9.5-day frame, 2-3 MAIN exposure events, planning/classifier namespace crosswalk, typed composite load/measure records, deterministic candidate arbitration, planned/completion/experienced separation, immediate safety holds, and append-only adaptation versions.
- It classifies every policy as automated invariant, coach decision support, or held for insufficient evidence.
- Calendar identity is explicitly blocked until `CalendarSessionProjection` gains `frameId` and `blockId`; it does not claim a universal 72-hour rule, one fatigue/readiness score, runtime implementation, canonical promotion, or downstream issue closure.

`EXTERNAL_RECORD_INTEGRATION_SPEC.md`:

- `specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a Work Order 005 Task A productization draft, not an original restored file.
- It defines one-way inbound external PB/SB record boundaries, consent, freshness display, conflict handling, and non-safety authority.
- It cannot implement AthleteTime integration, clear D9 risk, clear Safety Gate blocks, close downstream issues, or claim runtime evidence.

`COMPOSITION_BALANCE_BASELINE_CONTRACT.md`:

- `specs/reconstruct/COMPOSITION_BALANCE_BASELINE_CONTRACT.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a Work Order 005 Task B productization draft, not an original restored file.
- It defines composition-balance baseline placeholders, athlete-level axis, visible demo states, and non-safety authority.
- It cannot define accepted final coaching ranges, clear D9 risk, clear Safety Gate blocks, close downstream issues, or claim runtime evidence.

`JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`:

- `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a Work Order 006 Task A productization draft, not an original restored file.
- It defines journal-only mode, safe decoration items, non-volume unlock constraints, and streak handling that includes rest/injury days.
- It cannot reward training load, clear D9 risk, clear Safety Gate blocks, close downstream issues, or claim runtime evidence.

`LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`:

- `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a Work Order 006 Task B productization draft, not an original restored file.
- It defines local-first journal persistence, later account-linked promotion, conflict handling, and memo/privacy boundaries.
- It cannot authorize raw memo server persistence, clear D9 risk, clear Safety Gate blocks, close downstream issues, or claim runtime evidence.

`FEDERATED_ACCOUNT_SSO_CONTRACT.md`:

- `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md` now exists as `DRAFT_FOR_REVIEW`.
- It is a Work Order 006 Task C productization draft, not an original restored file.
- It defines "Continue with AthleteTime" identity federation boundaries while keeping TrainOracle storage, consent, and safety authority separate.
- It cannot edit AthleteTime code, export TrainOracle private data, clear D9 risk, clear Safety Gate blocks, close downstream issues, or claim runtime evidence.

## Required Safety Semantics

- `D9_ACTIVE` blocks Plan Generator.
- `D9_UNKNOWN` blocks Plan Generator or requires human review.
- `D9_CLEARED` permits generation only as "no D9 signal detected by evaluator at this time"; it is not medical clearance.
- ADVISORY is not a fourth disposition. For non-note structured origin it may remain under `D9_CLEARED`; analyzable-note CLEARED/advisory emits no Formation authorization signal, and private-only input is never evaluated.
- Good physiological data and template selection cannot clear D9 risk.
- Raw athlete free-text, symptom clauses, injury narratives, medical notes, and guardian private notes must not be stored in audit contracts.
