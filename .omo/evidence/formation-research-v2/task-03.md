# Task 03 Evidence: Independent Screening Preparation

## Boundary

- Two AI lanes may prepare screening decisions and disagreements.
- Decision-critical inclusion/exclusion still requires a human-trained reviewer.
- Prepared screening does not activate runtime, establish efficacy/safety, or reopen the
  fixed 9.5-day automated-prescription identity.

## RED

```text
node specs/test-packages/validate-formation-screening.mjs
```

```text
FORMATION_SCREENING_INVALID missing screening lane 1
FORMATION_SCREENING_INVALID missing screening lane 2
FORMATION_SCREENING_INVALID final coverage 0/167
```

## PREPARED

```text
FORMATION_SCREENING_LEDGERS_BUILT sources=167 include=163 exclude=2 defer=2 pending_human=167
FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
```

- Lane 1: 167/167, independently prepared, SHA-256
  `b9d192df483252d2a929298d51047a26ca559075619b143567cf5e83bfe7bd72`.
- Lane 2: 167/167, independently prepared, SHA-256
  `9f7e86505a74df7f5a425c3ab7181b75eeea451c4ace661c0dbbccb7829b2e7e`.
- Canonical prepared ledger: 167/167, SHA-256
  `f3e687fdd1caedceaf3bd4daa808dd1692062d0e3435b00e28535be4f5724884`.
- Consensus exclusion: two wrong-scope or wrong-identity records.
- Deferred: two lane disagreements or correction-history conflicts.
- All 167 rows remain `PENDING_HUMAN`; AI agreement is preparation, not acceptance.

## ACCEPTED

```text
FORMATION_SCREENING_INVALID acceptance blocked pending_human=167 deferred=2
```

`PENDING_HUMAN_TRAINED_REVIEW`
