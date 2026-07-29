# Remaining Open PR Reconciliation

    reconciliation_id: TRAINORACLE-OPEN-PR-RECONCILIATION-2026-07-29
    base_main_sha: 07b8b9ef2301feb164f7e2256210f52407305cef
    execution_model: gpt-5.6-terra
    reasoning_effort: xhigh
    legacy_pr_count: 18
    terminal_disposition_count: 16
    pending_rebuild_count: 2
    backend_code_harvested: false
    historical_review_claims_harvested: false
    runtime_authority: false
    implementation_activation: PENDING_OWNER

## Purpose And Boundary

This document is a closure map for the legacy pull-request estate, not an approval,
release, or implementation record. It uses the current main snapshot above as its only
code baseline. Historic CI, dated status documents, and an AI review do not prove
compatibility or human approval today.

The source review found that historical APPT packets and all .omo/evidence files in PR
#98 contain dated source snapshots, person or status claims, or old review context. They
are intentionally not copied into this PR. The reusable routing method is re-authored
as a current generic skill; human-review packets will be rebuilt from a future,
explicitly frozen product snapshot.

## Reconciliation Table

| Legacy PR | Disposition | Successor Or Task | Current Action | Reason |
| --- | --- | --- | --- | --- |
| #93 | CLOSED_SUPERSEDED | successor: main@07b8b9e current product-fact questionnaire | Close after this PR merges. | The prior accepted launch-scope assertion conflicts with current explicit UNKNOWN product facts. |
| #98 | CLOSED_REPLACED | successor: this reconciliation PR Terra-Sol routing skill | Close after this PR merges. | Re-author generic routing only; do not carry dated evidence, status, or reviewer claims. |
| #99 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | WO017 planning track is historical relative to shipped onboarding. |
| #101 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | The first WO017 planning stack is superseded by shipped onboarding. |
| #102 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Fable UX proposal informed a historical stack; it is not current implementation authority. |
| #103 | CLOSED_SUPERSEDED | successor: PR #116 and PR #118 | Close after this PR merges. | Do not revive stale backend, migration, CI, or API code; the residual-gap audit records fresh owner-gated work. |
| #104 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Historical WO017 contract binding is superseded by current-main flow. |
| #105 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Historical Sol advisory is not an activation or release approval. |
| #107 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Replacement WO017 evidence track is historical after onboarding shipped. |
| #108 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Replacement UX-flow document does not supersede shipped implementation. |
| #110 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Replacement contract binding is historical and carries no runtime authority. |
| #111 | CLOSED_SUPERSEDED | successor: PR #109 | Close after this PR merges. | Replacement Sol delta is advisory history, not an active product gate. |
| #114 | PENDING_REBUILD_WITH_SUCCESSOR_TASK | successorTask: Task 4 | Keep open until Task 4 fresh-main replacement merges and deploys. | It conflicts with current account, import, trash, and restore behavior; direct merge is unsafe. |
| #115 | CLOSED_SUPERSEDED | successor: PR #123 and PR #127 | Close after this PR merges. | Proposal-only detailed-prescription material has been replaced by catalog and notation contracts. |
| #121 | CLOSED_SUPERSEDED | successor: PR #123, PR #139, PR #141, and PR #142 | Close after this PR merges. | Calibration guidance is represented by corrected work orders and advisory boundary. |
| #122 | CLOSED_SUPERSEDED | successor: PR #123, PR #139, PR #141, and PR #142 | Close after this PR merges. | Terra work order is historical once its detailed-prescription successor contracts exist. |
| #126 | PENDING_REBUILD_WITH_SUCCESSOR_TASK | successorTask: Task 9 | Keep open until Task 9 provenance-safe archive replacement merges and deploys. | Archive aggregation lacks a provenance gate and is based on a non-main branch. |
| #130 | CLOSED_SUPERSEDED | successor: PR #131 | Close after this PR merges. | Training-schedule research corpus and acceptance artifacts already landed through PR #131. |

## Execution Sequence

1. Merge this documentation-only reconciliation PR after its validator and current-main
   CI are green.
2. Close the 16 terminal rows using the exact successor text above.
3. Keep #114 and #126 visible as pending rebuilds. Do not close, rebase, cherry-pick,
   or merge either legacy branch.
4. Task 4 and Task 9 build fresh-main replacement PRs. Each replacement must cite its
   legacy PR only after it has tests, independent review, merged SHA, and public-deploy
   verification.

## Non-Authority Reminder

- This PR does not activate accounts, sync, coaching, subscriptions, payments, templates,
  automatic prescription, a pilot, or human review.
- PRIVATE_SELF_ONLY memo text and its metadata remain excluded from analysis,
  recommendation, and external handoff.
- D9 ACTIVE and D9 UNKNOWN retain their existing block semantics.

[DRAFT_COMPLETE]
