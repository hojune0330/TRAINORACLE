# Task 01 Evidence: Research Protocol Freeze

## Scope

- Plan: `.omo/plans/trainoracle-formation-followup-deep-research.md`
- Task: freeze RQ-A-G, 9.5-day owner identity, target prescription authority, current
  runtime boundary, search/appraisal rules, ledger schemas, and hard human gates.

## RED

Command:

```text
node specs/test-packages/validate-formation-research-v2.mjs
```

Observed exit: `1`

Key failure:

```text
FORMATION_RESEARCH_V2_INVALID
- missing file: reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
- missing file: reports/research/evidence/FORMATION_SOURCE_LEDGER.csv
- missing file: reports/research/evidence/FORMATION_SEARCH_LOG.md
- missing file: reports/research/evidence/FORMATION_EXCLUSION_LEDGER.csv
- missing file: reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv
- missing file: reports/research/evidence/FORMATION_CLAIM_MATRIX.csv
- protocol missing token: owner_product_identity: 9_5_DAY_FORMATION
- protocol missing token: owner_target_authority: AUTOMATED_PRESCRIPTION
- protocol missing token: runtime_authority: false
- protocol missing research question: RQ-A through RQ-G
```

The failure was caused by the exact missing contract, not a syntax/import error.

## GREEN

Command and manual data-surface QA:

```text
node specs/test-packages/validate-formation-research-v2.mjs
```

Binary PASS observable:

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
```

## Frozen Hash

```text
5fda23e1bba850ce4cc609dc397f3656e686eb23eb824f40a7fbc8d10fecaf38  reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
```

The hash includes the authority-review corrections and is the frozen pre-search version.
Any later correction must record a new hash and search impact before search execution.

## Dated Amendment Applied

```text
TO-FORMATION-RESEARCH-V2-AMEND-2026-07-17-01
f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6  reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
```

The original hash above is preserved as historical provenance. The current hash is bound to
`reports/research/FORMATION_PROTOCOL_AMENDMENT_LOG.md`. Search questions, dates, eligibility,
screening, and extraction were unchanged; synthesis was re-audited for final-claim source use,
private-note transport separation, decline non-disclosure, and reviewer-unavailable continuity.

## Independent Review

- Protocol-method review: `APPROVED`.
- Authority review: requested three present-vs-future wording corrections; all applied.
- Same authority reviewer re-review: unconditional `APPROVED`.

## Adversarial QA

| Class | Result |
|---|---|
| malformed input | Missing protocol and all four CSV headers produced explicit failures. |
| prompt injection | Protocol states sources are evidence only; no source can change owner/runtime authority. |
| stale state | Search cutoff and protocol ID are dated; revisions require a dated amendment and re-search impact. |
| dirty worktree | Work runs in isolated `TRAINORACLE-formation-research-plan`; original dirty workspace untouched. |
| hung/long command | Validator completed under one second without network or polling. |
| flaky tests | Repeated result is deterministic from repository files only. |
| misleading success | PASS line simultaneously prints RQ count, owner identity, target, and runtime false. |
| cancel/resume | Boulder state names the exact plan/worktree/session for continuation. |
| repeated interruptions | Ledger and file hash preserve the last verified state. |

## Cleanup

No process, port, browser, database, temporary file, or external session was created.
