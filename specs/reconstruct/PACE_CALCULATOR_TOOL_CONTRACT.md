# Pace Calculator Tool Contract

Status: OWNER_APPROVED_IMPLEMENTATION_BOUNDARY (2026-10-05)

This additive contract implements the approved pace-tool work order. It does not
promote draft physiological models or replace MULTI_EVENT_PACE_REFERENCE_CONTRACT.

## Calculation

- Seven source events: 800, 1500, 3000, 5000, 10000, 21097.5, 42195 metres.
  Read the legacy 21097 alias as 21097.5.
- Separate hours, minutes and decimal seconds; each component must be valid.
  Reject negative components, seconds/minutes >=60, zero and totals >86400 seconds.
- A direct conversion uses source seconds * target metres / source metres.
  It is a race-average comparison, not a repetition prescription or a prediction.
- All outputs derive from the same current source. Empty/invalid input clears results.
  Round at display boundaries with carry; preserve decimal input internally.
- Weighted splits normalize remaining time over unfixed rows. Fixed rows remain
  fixed. Impossible fixed totals are rejected, never silently rescaled.
  Display each split as the difference between rounded cumulative times.
- Bound tools at 2000 split rows, 50 rows per page and five nearby pace-table rows
  spaced five seconds/km apart. These are UI limits, not exercise recommendations.
- Track/steeplechase numbers require a verified facility reference. Until verified,
  do not display invented lane constants or enable application of those numbers.

## Navigation and Application

- Oracle, saved records and eligible catalog segments open the same tool.
  Source content and callbacks stay in memory, not browser history or new storage.
- Semantic stages enter the existing shell back stack; typing does not.
  Return to the origin with scroll/focus preserved. Account changes invalidate
  requests and callbacks. A stale record must be selected again.
- Read-only manual calculations never create PB/SB records or mutate a plan.
- A catalog reference selection only stages an eligible existing record. The
  existing catalog editor calculates the prescription and owns confirmation/save.
  Show its exact calculation model; a race-average comparison is not an LT target.
- Remaining-plan application stays in active-plan-edit-store. Protect past,
  started, recorded and manually fixed slots; no volume/recovery changes.
- Numeric no-op automatic notices remain no-op. Explicit basis selection is a
  separate intent and must not lose source provenance just because numbers match.
- Unknown save outcomes must not trigger another write. Read existing save state.

## Verification

Focused arithmetic, source-change, split-total, navigation and eligible selection
tests must pass. A build, browser review and real-account save are distinct proof
levels. Do not describe an unrun production round trip as verified.
