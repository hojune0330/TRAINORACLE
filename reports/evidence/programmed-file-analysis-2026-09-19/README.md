# README.md

## Programmed File Analysis Verification Evidence

Status: LOCAL_VERIFICATION_ONLY_NOT_DEPLOYED.
Baseline: `27cc6d5705a58f55eb3e07140a7f932d1118269c`.

This directory retains the independent review and selected synthetic browser evidence for the local implementation. It is not a production account test, provider integration, successful deployment or blanket release approval.

### Evidence files

- `independent-review.txt`: immutable copy of the final independent review. Its temporary absolute paths describe the reviewer's isolated execution environment.
- `deployed-v2-preservation-review.txt`: actual unchanged public V2 bundle tested against local synthetic HTTP 426, including warm/reload recovery and explicit limitations.
- `reviewed-patch-manifest.json`: exact source-file hashes captured by the independent reviewer before local commit. Hashes concern file bytes, not a claim that a particular deployment ran them.
- `deployed-v2-results.json`: the two passing deployed-bundle browser scenarios. Authentication and server responses were synthetic and all non-loopback traffic was mocked or aborted.
- `public-artifact-manifest.json` and `trainoracle-deploy-receipt.json`: retrieved public asset identities and published deployment metadata. The receipt is not a cryptographic source attestation.
- `old-server-compat-results.json`: nine passing assertions proving that the current client is incompatible with the baseline server. PASS here proves a release blocker, not compatibility.
- `confirmed-report-375.png`: account-confirmed synthetic file report.
- `segments-320-200pct-text-right.png`: right edge of the keyboard-scrollable table at 320px and 200% text size.
- `comparison-account-reloaded.png`: explicit original-plan comparison after a synthetic account reload.

### Local check summary

| Check | Result | Boundary |
|---|---|---|
| Full app unit suite, UTC | 4,086 pass / 0 fail / 35 existing skipped | Not 4,121 executed successes |
| Full app unit suite, Asia/Seoul | 4,086 pass / 0 fail / 35 existing skipped | Same tests under a second timezone |
| App and browser TypeScript | Pass | Not browser execution |
| Production build | Pass, existing warnings retained | Not deployment |
| Maintained local database/handler suite | 184/184 pass | Ephemeral local PostgreSQL-compatible test database |
| Generated account journal validator | Generation check plus 93/93 pass | Generated output matches source |
| Training implementation suite | 891/891 pass; typecheck pass | No new training-dose rules |
| D9 evaluator | 11/11 pass | No safety semantic changes |
| Existing workflow contract command groups | 28/28 exit 0 | Commands, not 28 test cases or a GitHub run |
| New file-analysis browser matrix | 9/9 pass | Synthetic account transport, real parsers/storage and UI |
| Existing device import | 20/20 pass | Four browser profiles, after exact expectation/navigation repairs |
| Existing explanation and original-plan flows | 24/24 pass | Separate preceding run on unchanged runtime code |
| Old source V2 preservation | 7/7 pass, mutation caught, restored 7/7 | Source baseline, not the deployed bundle |
| Actual deployed V2 preservation | 2/2 pass | Service workers blocked, no live server/auth |

### Unfinished release work

Compatible server deployment must precede publishing the new app. The new client sends a capability field that the baseline server rejects even with all new format flags off. Production migration, compatible server deployment, eight hosted build-variable mappings, full publication CI and actual account/public verification remain incomplete.

No `.github/workflows` edits, production writes, credentials, real athlete files, raw private memos or external AI calls are included. Selected screenshots use synthetic test records only. The full application browser suite was not rerun in this task.

The full progress report and exact next execution sequence are in [the progress report](../../implementation/PROGRAMMED_FILE_ANALYSIS_PROGRESS_2026-09-19.md) and [the release runbook](../../implementation/PROGRAMMED_FILE_ANALYSIS_RELEASE_RUNBOOK_2026-09-19.md).

[DRAFT_COMPLETE]
