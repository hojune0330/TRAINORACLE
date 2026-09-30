# B03 Independent Source-Chain Execution Evidence

status: INDEPENDENT_EXECUTION_CAPTURED_PARENT_SUMMARY
scope: PURE_SOURCE_CHAIN_AND_EXECUTION_REPLAN
production_verified: false

## Origin And Result

The parent configured a separate reviewer as `gpt-6.1-sol` / `ultra`. The reviewer
read the pure source resolver and execution preparation, constructed its own synthetic
fixtures, and executed five distinct boundaries. This is not five real users or a
repeat of the original 100-persona browser matrix.

`run-recheck.json` is the final captured run, from 2026-09-30T18:19:29.894Z through
18:19:32.067Z (2026-10-01 KST). It records:

| Boundary | Result |
|---|---|
| Multiple manual changes interleaved with execution replan | PASS |
| Missing or tampered intermediate, including reverse chronology | PASS |
| Same date/slot and candidate ID in a different cycle | PASS |
| Changed-then-restored performed slot with an old link; genuine new-link control | PASS |
| Overlapping journals across three retained versions | PASS |

Two in-memory mutation probes fail by name in this final run:

- `reject-all-sources` makes `B01-mixed-multiple-manual-and-execution` fail.
- `ignore-overlap` makes `B05-overlapping-journals-across-three-versions` fail.

The target hashes before and after the run are identical:

- `execution-replan-source.ts`: `025906206e1634aa80b99a5df8ed2c701532eb8f506cd66d0316c8b171d66a9f`
- `execution-replan.ts`: `6edd4de659268cca08de0b3dc04c5543b74e3265a64b6f2af794c5ead76acbf7`

## Evidence Limits

- The reviewer found the content-ID A-to-B-to-A bypass before the parent fixed it.
  The initial failing output was observed in the task's tool record, but the review
  harness reused `run-initial.json` and overwrote it. That file is deliberately not
  presented here as preserved pre-fix evidence.
- An earlier reject-all mutation did not actually alter the source. Its PASS is
  not sensitivity proof. Only the final `run-recheck.json` probe is counted.
- After the bounded execution was complete, the parent stopped further review work.
  A final prose approval from the reviewer was not received. This README is the
  parent's evidence summary, not an independently signed release approval.
- The final runner records shutdown of its own esbuild child with no residual
  tracked children. System-wide process inspection was unavailable. This is not
  evidence about unrelated processes.
- No server, SQL, account, production, browser/UI, B06 or B07 approval is implied.
  The parent separately ran the related app and server checks recorded in the
  [progress report](../../../PERSONA_REMEDIATION_PROGRESS_2026-10-01.md).
- The source snapshot includes a client-only edit of `linkedAt`. That demonstrates
  the limit of consistency timestamps, not an authenticated stored-journal exploit.
  Original stored links remain immutable through existing journal editing rules.

## Reproduction

The two scripts are byte-for-byte copies from the reviewer's scratch directory.
They expect to be two directories below the repository root. Copy them into a new
`.scratch/<review-run-name>/` directory in this repository, then run from its root:

```powershell
node .scratch/<review-run-name>/run-review.cjs --label=fresh-recheck
```

Use an installed Node 24 runtime and the existing `app` dependencies. This writes
`run-fresh-recheck.json` and a source snapshot in that scratch directory, not product
source files. Do not overwrite the captured `run-recheck.json` here. Re-run against
the exact source revision and compare hashes rather than assuming newer code matches.

[DRAFT_COMPLETE]
