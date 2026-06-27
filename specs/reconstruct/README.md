# Missing Or Reconstructed SPEC Area

This directory is reserved for required TrainOracle contracts that were missing, source-not-verified, or reconstructed during SPEC inventory and continuation passes.

Current reconstructed drafts:

- `RULE_VALIDATION_ENGINE_CONTRACT.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)
- `PLAN_SAFETY_GATE_SPEC.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)
- `DAILY_LOG_AND_CHECKIN_SPEC.md` (`RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored, not canonical, not runtime evidence)

Current productization drafts:

- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` (`DRAFT_FOR_REVIEW`; new productization draft, not original restored, not canonical, not runtime evidence)

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

## Required Safety Semantics

- `D9_ACTIVE` blocks Plan Generator.
- `D9_UNKNOWN` blocks Plan Generator or requires human review.
- `D9_CLEARED` permits generation only as "no D9 signal detected by evaluator at this time"; it is not medical clearance.
- ADVISORY is not a fourth disposition. It remains under `D9_CLEARED`, stores status as `CLEARED`, and does not block generation.
- Good physiological data and template selection cannot clear D9 risk.
- Raw athlete free-text, symptom clauses, injury narratives, medical notes, and guardian private notes must not be stored in audit contracts.
