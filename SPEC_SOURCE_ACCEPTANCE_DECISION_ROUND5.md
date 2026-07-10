# SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND5.md

```yaml
document_metadata:
  doc_id: trainoracle-decision-round5
  title: TrainOracle Round 5 Acceptance Decision — Work Order 004 Outputs
  decision_authority: TOTAL_RESPONSIBILITY_HOLDER (Project Lead AI)
  owner: COACH_HOJUNE
  decided_at: "2026-07-10 Asia/Seoul"
  scope: CODEX_WORK_ORDER_004 Task 1-4 outputs (PR #28, #30, #31, #32)
  decision_type: PATCH_ACCEPTANCE_AND_OWNER_DISPOSITION_DECISION
  canonical_promotion: false
  issue_closure_granted_by_this_document: false
  runtime_evidence_claimed: false
```

---

## 1. What This Decision Covers

Work Order 004 assigned four tasks to Codex. All four were delivered on
`codex/work-order-004-task{1..4}` branches as PRs #28, #30, #31, #32.
I reviewed each with three-dot diffs (`origin/main...branch`) to exclude
fork-point artifacts, verified file scopes, recounted declared numbers
independently, and merged all four with `[ACCEPTED]` squash commits.

Two-dot vs three-dot note: the ORDER_004 branches fork from a pre-#33 main,
so two-dot diffs falsely showed deletions of the glossary/TermHelp work.
Three-dot diffs confirmed every PR touches only its intended documents.
`app/` and design files were untouched in all four PRs (rule 9 PASS).

---

## 2. Per-Task Verdicts

### Task 1 — MEDIA transcript→D9 precheck patch (PR #28) — ACCEPTED

- File scope: `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` only (+29/-1). PASS.
- `voice_transcript_d9_precheck_patch` block carries
  `patched_from: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md (N1/T1)` (rule 10 PASS).
- D9 evaluation ordered BEFORE structured extraction; transcript discard policy present.
- Fail-safe verified: `D9_evaluation_unavailable_or_invalid: D9_UNKNOWN` and
  `D9_UNKNOWN_blocks_or_requires_human_review: true` — consistent with the
  BLOCK_OR_HUMAN_REVIEW invariant. PASS.
- `OI-MTC-VOICE-TRANSIENT-REDACTION-001` row annotation updated without closure. PASS.

### Task 2 — Downstream bindings (PR #30) — ACCEPTED

- File scope: `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` (+25/-1),
  `DAILY_LOG_AND_CHECKIN_SPEC.md` (+21/-0). PASS.
- `metric_envelope_binding`: `binding_type: envelope_and_boundary_reference_only`;
  `explicitly_excluded_scope` names METRIC §6 draft formulas and all numeric
  formula authority; explicit rule that formulas must not be implemented while
  `OI-MAC-FORMULA-ACCEPTANCE-001` is OPEN. Rule 11 (no formula propagation) PASS —
  no formula text was copied.
- `race_day_quick_check_binding`: `binding_type: reference_only`,
  `local_field_duplication_allowed: false` — no field duplication (order requirement PASS);
  namespace requirement (`CYCLE_DAY`, bare `D-*` forbidden in storage/audit) and
  safety boundary (`can_clear_D9_or_Safety_Gate: false`) present. PASS.
- `patched_from` citations present in both blocks (rule 10 PASS).
- `OI-AVD-METRIC-SOURCE-OWNERSHIP-001` stays OPEN with envelope-only annotation. PASS.

### Task 3 — Legacy v1 kit disposition PROPOSAL (PR #31) — ACCEPTED AS PROPOSAL

- File scope: `reports/LEGACY_V1_KIT_DISPOSITION_PROPOSAL.md` new file only (+121).
  Diff confirms zero changes to any `ui_kits/trainoracle-app/*` file. PASS.
- Contains 3 options (A archive / B keep-as-is / C selective redesign) with cost/risk,
  a recommendation (C, with A as interim), and explicit
  `status: PROPOSAL_FOR_OWNER_DECISION` + "This is not a decision." PASS.
- Guardrail table self-declares no moves/edits/deletes/closures — verified true by diff.

### Task 4 — Traceability recount (PR #32) — ACCEPTED

- File scope: matrix (+18/-15), `SPEC_WORK_STATUS.md` (+16/-6),
  `TRAINORACLE_SPEC_INDEX.md` (+14/-5). PASS.
- All 5 former `GAP_SPEC_MISSING` rows now read `RESOLVED_BY_SOURCE(ROUND4)` —
  no row uses `CLOSED`, and a repo-wide grep of the patched matrix finds zero
  occurrences of `CLOSED`. PASS.
- Independent recount of the Section 5 audit table (status-column parse, audit rows only):
  ALIGNED 6 / GAP_UI_MISSING 8 / GAP_SPEC_MISSING 0 / RESOLVED_BY_SOURCE(ROUND4) 5 /
  CONFLICT 5 / OUT_OF_SCOPE 1 = 25 rows. Matches the declared Summary Counts exactly. PASS.
- Caveat text correctly states Round 4 acceptance is source availability only,
  not implementation completion, issue closure, canonical promotion, or runtime evidence. PASS.
- Index/status refresh reflects merged #22–#25 and open-at-update-time #28/#30/#31;
  those three are now merged, which is expected staleness (the document records
  state at its own update time — acceptable).

---

## 3. Owner Disposition Decision — Legacy v1 Kit (my decision, not Codex's)

The Task 3 proposal is Codex's input. The decision below is mine.

```yaml
legacy_v1_kit_disposition_decision:
  decided_by: TOTAL_RESPONSIBILITY_HOLDER
  decision: OPTION_C_PRODUCT_DIRECTION_WITH_DEFERRED_OPTION_A
  meaning:
    - The old `ui_kits/trainoracle-app/*` kit is IDEA SOURCE ONLY from now on.
    - No file in that kit may be imported, copied, or used as implementation
      source by anyone, including me, without a new explicit decision.
    - Inbox / Calendar / Dashboard / AIChat surfaces will be REDESIGNED against
      accepted specs when their Phase 2 scope is opened — never ported.
    - Option A (physical archive move) is DEFERRED: no file moves now. It may be
      executed later as a separate, single-purpose PR after I re-confirm, because
      path changes affect the traceability matrix rows C1-C4.
  phase_2_screen_scope: NOT_OPENED_BY_THIS_DECISION
  aichat_product_scope: UNDECIDED (blocked on raw-text and external-LLM boundary redesign)
  matrix_impact: none now; C1-C4 rows stay CONFLICT until archive or redesign lands
```

---

## 4. Acceptance Statement

All four ORDER_004 outputs are `ACCEPTED_AS_WORKING_SOURCE` amendments to the
already-accepted Round 3/4 sources. This grants downstream patch-source status only.

Explicitly NOT granted:

- No canonical promotion.
- No issue closure (all `OI-*` issues keep their prior states).
- No implementation completion claim; no runtime evidence claim.
- METRIC §6 formulas remain UNACCEPTED (Round 4 N2 continues in force;
  `OI-MAC-FORMULA-ACCEPTANCE-001` remains OPEN).

## 5. Notes And Triggers Carried Forward

- N5-1: Task 4 index/status show PRs #28/#30/#31 as open-at-update-time; they merged
  minutes later. Next index refresh (ORDER_005 or later) should mark them MERGED.
- T5-1: If Phase 2 opens Inbox/Calendar/Dashboard scope, a redesign contract per
  surface must exist BEFORE any UI work, per the Option C decision above.
- T5-2: If Option A archive is executed later, the same PR must update matrix
  rows C1-C4 path references, and nothing else.
- T5-3: External record integration (AthleteTime) and composition balance baselines
  are ordered in `CODEX_WORK_ORDER_005.md`; app UI displaying demo balance values
  must carry a `기준: 데모` badge until Task B of that order is accepted.

[DECISION_COMPLETE]
