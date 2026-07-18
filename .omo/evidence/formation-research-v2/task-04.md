# Task 04 Evidence: Dual Extraction Preparation

## Boundary

- Four canonical RQ scopes (`A/B/C`, `D`, `E`, `F/G`) are independently extracted by two
  AI lanes. Scope membership follows the prepared screening ledger, including existing
  citations that were deduplicated to `SRC-*` identities.
- Exact agreement may be preserved; every differing field is suppressed to `NOT_VERIFIED`
  in the prepared canonical ledger and retained in the conflict ledger.
- Human-trained adjudication is required before accepted extraction or scientific claims.
- The fixed 9.5-day product identity does not convert extracted component evidence into
  scientific optimality, safety, recovery clearance, or current runtime authority.

## RED

```text
FORMATION_EXTRACTION_INVALID lane 1 duplicate SRC-PMID-28463642
FORMATION_EXTRACTION_INVALID lane 1 coverage 163/167
FORMATION_EXTRACTION_INVALID lane 2 coverage 163/167
FORMATION_EXTRACTION_INVALID canonical coverage 0/167
```

## PREPARED

```text
FORMATION_EXTRACTION_REPAIRED root_gap_fill=6 lane_1=167
FORMATION_EXTRACTION_BUILT sources=167 conflicts=2824 pending_rows=167
FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2824 pending_rows=167
```

- Both prepared lanes now cover the canonical 167-source screening assignment exactly once.
- Six rows interrupted between independent agents were conservatively gap-filled and labeled
  `AI_ROOT_GAP_FILL_NOT_INDEPENDENT` / `PENDING_HUMAN_REEXTRACTION`. Every evidence field in
  those rows is suppressed to `NOT_VERIFIED`, even when the copied lane values match, so they
  cannot appear as independent agreement.
- Extraction produced 2,824 field-level conflicts. The canonical ledger suppresses
  each difference to `NOT_VERIFIED` and preserves both values in
  `FORMATION_EXTRACTION_CONFLICTS.csv`.
- Prepared coverage enables bounded narrative synthesis from the lane evidence, but it cannot
  support accepted effect claims or a runtime rule.

## ACCEPTED

```text
FORMATION_EXTRACTION_INVALID acceptance blocked pending_rows=167 pending_conflicts=2824
```

`PENDING_HUMAN_TRAINED_REEXTRACTION_AND_ADJUDICATION`
