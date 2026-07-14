# SPEC Authority And Recovery Ledger

```yaml
ledger_status: CURRENT_STATE_AUDIT
evaluated_main: 0588e68df79832884e367da9de0593cb7499688b
evaluated_at: 2026-07-14
scope: PR_61_to_PR_67_ORDER_008_ORDER_009_TASK_R_AND_FORMATION_BOUNDARY
formation_runtime_authority: false
```

This ledger records repository state, not product approval. A merged pull request may
put journal code or a review document on `main`; it does not grant Formation,
Plan Generator, shadow-operation, canonical, or safety-evidence authority.

## Evidence Rule

Each row below was checked against `origin/main@0588e68` and the GitHub Pull Request
REST response listed in the source column. `DONE` means only the stated repository
scope is complete. `OPEN`, `BLOCKED`, and `DEFERRED` never imply an incomplete item
is safe to run.

| Source path / PR | Evaluated SHA | Authority class | Current state | Next action | Blocking condition |
|---|---|---|---|---|---|
| `origin/main` | `0588e68` | Current repository baseline | DONE | Use as the only baseline for this recovery wave. | None. |
| [PR #61](https://github.com/hojune0330/TRAINORACLE/pull/61), `CODEX_WORK_ORDER_008.md` Task A | `ff27087` | Daily-log input contract | DONE | Keep as journal input work only. | It grants no Formation input or prescription authority. |
| [PR #62](https://github.com/hojune0330/TRAINORACLE/pull/62), `CODEX_WORK_ORDER_009.md` Task A | `681f7a0` | Purpose-scoped memo input/privacy contract | DONE | Preserve `PRIVATE_SELF_ONLY` as zero-signal and analyzable memo as non-plan input. | A later target-bound safety/privacy decision is required before any plan consumer. |
| [PR #63](https://github.com/hojune0330/TRAINORACLE/pull/63), `TRAINING_PLAN_METHOD_DECISION.md` | `bc96e17` | Formation review draft and owner method boundary | DONE | Preserve the review record; use it only to locate gates. | Ten canonical blockers and `production_authority: false`. |
| [PR #64](https://github.com/hojune0330/TRAINORACLE/pull/64), `RACE_SELFCHECK_FIELDS_DECISION.md` | `0588e68` | App-local journal/input implementation | DONE | Treat as current journal baseline and Task-R remediation evidence. | It closes no Formation blocker and authorizes no shadow operation. |
| [PR #66](https://github.com/hojune0330/TRAINORACLE/pull/66) draft | `ec4f312` | Mixed provenance, test-hook, and documentation proposal | OPEN | Split C0 test-hook removal from provenance and report-only artifacts; rebase each reviewable unit. | Draft is mixed; G0 implementation proof is not complete. |
| [PR #67](https://github.com/hojune0330/TRAINORACLE/pull/67) draft | `7de4033` | Owner-selected local full-export proposal | OPEN | Rebase after the provenance boundary and retain default-safe export. | Export contract must prove opt-in, local-only behavior and no downstream use. |
| `CODEX_WORK_ORDER_008.md` Task B | `ec4f312` proposal | Tap-budget test package | OPEN | Recover as a separate mechanical test-package artifact. | It must not prescribe training or claim runtime evidence. |
| `CODEX_WORK_ORDER_008.md` Task C | `ec4f312` proposal | Preset research | DEFERRED | Restart only with high-accuracy, primary-source research and an owner checkpoint. | Existing draft is not evidence-complete and must not prescribe training. |
| `CODEX_WORK_ORDER_009.md` Tasks B/C | `ec4f312` proposal | SSO status alignment and marker audit | OPEN | Recover as report-only documents. | No SSO/provider implementation or canonical claim. |
| `reports/review/ORDER_007_R_*.md` | `0588e68` | Review observations | OPEN / PARTIAL | Follow the itemized closure audit below. | A review finding is not a self-authorizing implementation decision. |
| `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md` | `bc96e17` content on current main | Formation/Adaptation draft | BLOCKED | Use `FORMATION_READ_NOW_DECIDE_LATER.md` before any future runtime work. | Source gates, target bindings, pilot protocol, and runtime evidence remain unaccepted. |

## Status-Surface Reconciliation

- `SPEC_WORK_STATUS.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_TARGET_PATCH_MATRIX.md`, and
  `SPEC_TARGET_PATCH_READINESS.md` were checked against this ledger.
- Their existing Formation statements remain directionally correct: Formation is a
  review draft, the ten blockers remain, and no runtime authority exists.
- The only required index/status repair in this wave is to link this current-state
  ledger and the Task-R closure audit. No old document is reclassified as canonical,
  runtime evidence, or closed merely because a PR merged.

## Related Audit

Every Task-R finding is individually classified in
[`reports/review/ORDER_007_TASK_R_CLOSURE_AUDIT.md`](./reports/review/ORDER_007_TASK_R_CLOSURE_AUDIT.md).
That audit records the specific implementation or document evidence, rather than
turning the review summary into a blanket completion claim.
