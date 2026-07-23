# ACCOUNT_PLAN_MEMO_BETA_OWNER_DECISION.md

```yaml
document_metadata:
  doc_id: trainoracle-account-plan-memo-beta-owner-decision
  spec_id: ACCOUNT_PLAN_MEMO_BETA_OWNER_DECISION
  title: Account, Plan, Memo, And Beta Owner Decision
  version: 1.0
  round: OWNER_DECISION
  status: OWNER_DECIDED_WORKING_BASELINE
  owner: COACH_HOJUNE
  decided_at: 2026-07-23
  open_issues_total: 0
  canonical_blocking_count: 0
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Decisions

| Area | Owner decision | Working meaning |
|---|---|---|
| Plan access | Self-service and coach-managed plans | An athlete may request a plan without a coach. A linked coach may also manage a plan within accepted scope. |
| Candidate presentation | One primary recommendation plus one or two alternatives | The product explains the differences and lets the authorized decision maker choose through a short tap flow. |
| Cycle length | 9.5-day Formation baseline with a contextual 7-day view | A requested 7-day plan is a slice of the continuing cycle, not an isolated weekly reset. The next request incorporates the prior slice and surrounding cycle. |
| Coach approval | Mandatory only in scoped situations | Team policy, youth/guardian policy, safety review, or another accepted rule may require coach approval. There is no global coach authority. |
| Beta pricing | All features free during beta | No paywall or billing authority is active in beta. Later packaging is a separate owner decision. |
| Memo handling | Private and local by default | Per-entry local analysis requires explicit user choice. Only structured fields may sync. End-to-end encrypted memo backup is a later option, not current authority. |
| Journal decoration | Core decoration is free; optional paid visual packs may come later | Training volume, pain, or unsafe behavior must never unlock rewards. Beta remains fully free under the beta pricing decision. |
| Delivery order | Account/backend foundation may proceed in parallel | Backend work must remain separate from the active onboarding worktree and may not claim deployed SSO, Formation runtime, or production readiness. |

---

## 2. Binding Boundaries

These decisions refine product direction without redefining safety rules.

```yaml
invariants:
  D9_or_Safety_Gate_override_created: false
  global_coach_authority_created: false
  raw_memo_server_storage_allowed: false
  race_selfcheck_analysis_or_plan_authority_created: false
  Formation_runtime_enabled: false
  paid_feature_runtime_enabled: false
  canonical_spec_promotion_claimed: false
```

The backend foundation may implement only a fail-closed account boundary and
structured sync projection. Authentication, guardian handling, deletion,
retention, encrypted memo recovery, billing, and Formation execution remain
subject to their accepted contracts and implementation evidence.

---

## 3. Non-Claims

- This decision does not claim that account login or social SSO is deployed.
- It does not claim that journal server sync is available in the user app.
- It does not close any existing spec issue.
- It does not make `D9_CLEARED` medical clearance.
- It does not authorize raw memo, symptom clause, evidence clause, or injury
  narrative persistence in server storage or audit.

[DRAFT_COMPLETE]
