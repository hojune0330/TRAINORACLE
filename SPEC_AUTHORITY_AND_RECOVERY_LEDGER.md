# SPEC Authority And Recovery Ledger

```yaml
ledger_status: CURRENT_STATE_AUDIT
evaluated_main: 31d764b69b65ca7122adc266911d8e36b86a93c6
evaluated_at: 2026-07-15
scope: PR_61_TO_PR_71_ORDER_008_ORDER_009_TASK_R_AND_FORMATION_BOUNDARY
formation_runtime_authority: false
```

This ledger records repository state, not product approval. A merged pull request may
put journal code or a review document on `main`; it does not grant Formation,
Plan Generator, shadow-operation, canonical, or safety-evidence authority.

## Evidence Rule

Each row below was checked against `origin/main@31d764b` and the GitHub Pull Request
REST response listed in the source column. `DONE` means only the stated repository
scope is complete. `OPEN`, `BLOCKED`, and `DEFERRED` never imply an incomplete item
is safe to run.

| Source path / PR | Evaluated SHA | Authority class | Current state | Next action | Blocking condition |
|---|---|---|---|---|---|
| `origin/main` | `31d764b` | Current repository baseline | DONE | Use as the only baseline for this recovery wave. | None. |
| [PR #61](https://github.com/hojune0330/TRAINORACLE/pull/61), `CODEX_WORK_ORDER_008.md` Task A | `ff27087` | Daily-log input contract | DONE | Keep as journal input work only. | It grants no Formation input or prescription authority. |
| [PR #62](https://github.com/hojune0330/TRAINORACLE/pull/62), `CODEX_WORK_ORDER_009.md` Task A | `681f7a0` | Purpose-scoped memo input/privacy contract | DONE | Preserve `PRIVATE_SELF_ONLY` as zero-signal and analyzable memo as non-plan input. | A later target-bound safety/privacy decision is required before any plan consumer. |
| [PR #63](https://github.com/hojune0330/TRAINORACLE/pull/63), `TRAINING_PLAN_METHOD_DECISION.md` | `bc96e17` | Formation review draft and owner method boundary | DONE | Preserve the review record; use it only to locate gates. | Ten canonical blockers and `production_authority: false`. |
| [PR #64](https://github.com/hojune0330/TRAINORACLE/pull/64), `RACE_SELFCHECK_FIELDS_DECISION.md` | `0588e68` | App-local journal/input implementation | DONE | Treat as current journal baseline and Task-R remediation evidence. | It closes no Formation blocker and authorizes no shadow operation. |
| [PR #66](https://github.com/hojune0330/TRAINORACLE/pull/66) draft | `ec4f312` | Mixed provenance, test-hook, and documentation proposal | SUPERSEDED / CLOSED | Use the consolidated implementation in PR #68; do not reopen or merge this draft independently. | None for closure; it grants no independent product authority. |
| [PR #67](https://github.com/hojune0330/TRAINORACLE/pull/67) draft | `7de4033` | Owner-selected local full-export proposal | SUPERSEDED / CLOSED | Use the confirmed local full-export path in PR #68. | None for closure; default-safe export and explicit local opt-in remain required. |
| [PR #68](https://github.com/hojune0330/TRAINORACLE/pull/68) | `e01b65b` | Consolidated provenance, export, recovery, and Formation-readiness implementation | DONE | Preserve the runtime provenance gate, explicit local full export, and non-executing Formation boundary. | It grants no Formation runtime, prescription, or shadow-operation authority. |
| [PR #69](https://github.com/hojune0330/TRAINORACLE/pull/69) | `d0d9868` | Strict analysis numeric boundary | DONE | Keep malformed stored numeric strings out of aggregates without deleting the journal record. | It does not approve metric formulas or Formation thresholds. |
| [PR #70](https://github.com/hojune0330/TRAINORACLE/pull/70) | `4f5104c` | Mobile journal touch-target implementation and QA | DONE | Preserve the measured 44 px minimum and narrow-screen regression coverage. | Broader zoom, contrast, and assistive-technology review remains separate. |
| [PR #71](https://github.com/hojune0330/TRAINORACLE/pull/71) | `31d764b` | Memo-export E2E reliability | DONE | Start the export network audit only after initial page traffic is idle. | Product behavior is unchanged. |
| `CODEX_WORK_ORDER_008.md` Task B | `e01b65b` | Tap-budget test package | DONE | Preserve it as a mechanical interaction contract only. | It must not prescribe training or claim runtime evidence. |
| `CODEX_WORK_ORDER_008.md` Task C | `ec4f312` proposal | Preset research | DEFERRED | Restart only with high-accuracy, primary-source research and an owner checkpoint. | Existing draft is not evidence-complete and must not prescribe training. |
| `CODEX_WORK_ORDER_009.md` Tasks B/C | `e01b65b` | SSO status alignment and marker audit | DONE | Keep the report-only alignment distinct from provider implementation. | No SSO/provider implementation or canonical claim. |
| `reports/review/ORDER_007_R_*.md` | `31d764b` | Review observations | OPEN / PARTIAL | Follow the itemized closure audit below. | Remaining findings still require their own evidence or owner decision. |
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
