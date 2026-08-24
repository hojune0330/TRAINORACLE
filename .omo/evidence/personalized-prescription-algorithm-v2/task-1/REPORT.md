# Todo 1 Authority Packet Report

## Verdict

PASS. Todo 1 is prepared as non-runtime authority documentation and an executable
validator. No product code, owning specification, issue table, deployment, commit, or
external system was changed.

## Provenance

- Authoritative main: `5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa`
- Execution branch: `codex/personalized-prescription-algorithm-v2-20260823`
- Reviewed plan SHA-256: `3f081ebbd8d8fa456ff33f01a037942e618cf13f9e549ff3feb83789df590d6b`
- Pre-existing dirty path: `.omo/plans/personalized-prescription-algorithm-v2.md`
- Deployment proof: local `origin/gh-pages` receipt bytes bind source SHA
  `5ea2eed9...`; receipt SHA-256
  `ec46f39288608973448e7be6380003d274f29d5088a2c5385365d9002c9840df`.
  No live fetch was performed.

## TDD

RED command:

`node --test specs/test-packages/validate-personalized-prescription-v2-authority.test.mjs`

Result: exit 1, 7 passed and 1 failed. The sole failure was the repository contract
reporting the absent owner-decision JSON. See `red.log`.

GREEN command:

`node --test specs/test-packages/validate-personalized-prescription-v2-authority.test.mjs`

Result: exit 0, 8 passed, 0 failed. See `final-node-test.log`.

Independent-gate fix RED:

`node --test specs/test-packages/validate-personalized-prescription-v2-authority.test.mjs`

Result: exit 1, 8 passed and 2 failed. Both failures were diagnostic missing-exception
failures: a valid-but-unrelated `README.md` evidence path and changed deployment
provenance were accepted. See `fix-red.log`.

Independent-gate fix GREEN:

The same command exited 0 with 10 passed and 0 failed. Every audit family is now
bound to its exact evidence path and line span. Deployment validation binds
`receiptPath`, `pagesCommit`, and `proofBoundary`, and independently compares the
pinned Pages commit/tree and receipt bytes to local `origin/gh-pages`. See
`fix-green-focused.log`.

Second independent-gate RED:

The focused command exited 1 with 10 passed and 2 diagnostic grouped failures. The
validator still accepted wrong/missing workflow provenance, an extra deployment claim,
a substituted Todo 1 ownership path, and a false active-template count. See
`fix2-red.log`.

Second independent-gate GREEN:

The same command exited 0 with 12 passed and 0 failed. The deployment object now has
an exact key/value contract; `workflowRunId` and `deployedAt` must equal the parsed
pinned Pages receipt. The complete nine-entry plan ownership ledger is exact, including
the Todo 1 retention-authority path, and `activeDetailedTemplateCount` is bound to the
observed baseline value 4. See `fix2-green-focused.log`.

Final semantic-matrix RED:

The focused command exited 1 with 12 passed and 3 diagnostic failures. A same-date
arbitrary recording timestamp, contradictory human authority wording, and promotion
of the reverse runtime edge were accepted. See `fix3-red.log`.

Final semantic-matrix GREEN:

The same command exited 0 with 15 passed and 0 failed. `recordedAt` is now bound to
`2026-08-23T03:32:21+09:00`; the exact human-facing noncanonical/no-closure/no-runtime-
authority disclaimer is required and contradictory appended wording is rejected; and
the complete handoff runtime object is exact, including reverse edge state
`APPROVED_FOR_IMPLEMENTATION_NOT_ACTIVE`. See `fix3-green-focused.log`.

Closure status-line RED and GREEN:

The focused command first exited 1 with 15 passed and 2 diagnostic failures because
the two visible `Status:` substitutions were accepted. After two inline exact-line
checks, the same command exited 0 with 17 passed and 0 failed. The audit now requires
`Status: NON_CANONICAL_AUDIT`; the handoff requires `Status: TODO_1_PREPARED`. See
`fix4-red.log` and `fix4-green-focused.log`.

Standalone command:

`node specs/test-packages/validate-personalized-prescription-v2-authority.mjs`

Result: exit 0. Parsed summary: 4 owner tokens, 10 audit rows, classifications
4/3/1/2, retention `NOT_AUTHORIZED`, race persistence false, 4 active templates,
plan write version 2, and 1 active adaptation edge. See `final-validator.log`.

## Manual Data QA

`node .omo/evidence/personalized-prescription-algorithm-v2/task-1/manual-mutation-qa.mjs`
exited 0 after proving all negative controls exited 1:

- exact `1A` target changed to `1B`;
- text appended after the final marker;
- one captured audit classification changed;
- youth audit evidence changed to the valid but unrelated `README.md`;
- retention JSON malformed and then absent;
- captured main SHA made stale;
- deployment receipt path changed to `README.md`;
- Pages commit changed to an all-zero SHA;
- proof boundary changed to `LIVE_PUBLIC_SITE_FETCH_VERIFIED`;
- workflow run ID and deployment timestamp changed independently;
- workflow run ID removed and `publicSiteFetchVerified` added;
- Todo 1 retention-authority ownership changed to `README.md`;
- active detailed-template count changed from 4 to 5;
- owner recording time changed to another timestamp on the same date;
- the human authority disclaimer replaced and a contradictory authority claim appended;
- reverse adaptation edge state changed to `ACTIVE_BASELINE`;
- audit status changed to `CANONICAL_PROMOTION_APPROVED`;
- handoff status changed to `PRODUCTION_RUNTIME_ACTIVE_AND_DEPLOYED`;
- mutation target absent caused the guard to stop before validator invocation;
- a printed `PASS_BEFORE_VALIDATION` did not mask the validator's nonzero exit.

Temporary files were created only under the OS temp directory and removed in
`finally`. See `manual-mutation-qa.log`.

## Adversarial Classes

| Class | Result |
| --- | --- |
| Missing source | Rejected before a success summary. |
| Malformed input | Rejected with exit 1. |
| Stale state | Stale main SHA rejected. |
| Dirty worktree | Pre-existing plan path attributed and its hash remained exact. |
| Misleading success output | Process exit remained authoritative. |
| Mutation target absent | Guard reported zero targets and did not invoke validator. |
| Secrets/PII | None used or written. |
| Browser/server/port | N/A for a CLI/data-only documentation task; none started. |
| Network/credentials | N/A; no network or credentials used. |
| Long-running resources | N/A; all commands were bounded and exited. |

## Residual Risks

- `PUBLIC_MAIN_DEPLOYMENT_VERIFIED` is intentionally bounded to a local remote-tracking
  ref and exact receipt digest; it is not a fresh public-site probe.
- The race-date authority is deliberately `NOT_AUTHORIZED`; no retention duration or
  privacy permission exists.
- The reverse VOLUME edge is owner-approved for later implementation but remains
  inactive until Todo 7.
- Working-spec amendments and issue-table reconciliation remain Todo 9. This packet
  performs no canonical promotion or issue closure.
