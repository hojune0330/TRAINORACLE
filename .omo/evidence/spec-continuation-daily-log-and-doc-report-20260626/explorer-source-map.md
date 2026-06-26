# Explorer Source Map

Source: `Explorer the 13th`

Key findings used:

- `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` is the primary continuity source for Daily Log flow and the missing-contract gap.
- `SPEC_FILE_TRUTH_GUARD.md` and `SPEC_WORK_STATUS.md` previously recorded `DAILY_LOG_AND_CHECKIN_SPEC.md` as missing after exact search.
- `RULE_VALIDATION_ENGINE_CONTRACT.md`, `PLAN_SAFETY_GATE_SPEC.md`, `RVE_RULE_EVALUATOR_BINDING_SPEC.md`, and `PHYSIO_SOURCE_TRUST_SPEC.md` require raw free text, raw symptom clauses, evidence clauses, injury narratives, medical notes, rehab notes, and guardian private notes not to persist in audit/storage.
- Design references (`design-system/SCREENS.md`, `HANDOFF.md`, `DESIGN_DECISIONS.md`, `designs/README.md`) preserve Daily Check-in UI intent: RPE, sleep, condition, pain/body area, optional memo, Daily Check-in, Dashboard, Session Detail, AI Inbox.
- The key contract resolution is to allow memo UX only as transient input while persisting structured values, reason codes, references, and policy-allowed redacted/non-sensitive summaries.

Applied outcome:

- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` was drafted as structured-first, transient-free-text-only, reason-code-first ingestion contract.
- `SPEC_DOCUMENTATION_REPORT.md` was drafted to distinguish active specs, test packages, reconstructed docs, legacy references, design docs, and planned docs.
