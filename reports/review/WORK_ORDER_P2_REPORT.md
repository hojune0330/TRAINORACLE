# WORK_ORDER_P2_REPORT.md

## Scope and baseline

- Base main SHA: `7d9958aad66859de2125ade4023436a09cb0da00`
- Corrected instruction source: PR #139, `WORK_ORDER_P2_MACHINE_NOTATION.md`
- Working branch: `codex/work-order-p2-machine-notation`
- Runtime source changes: none
- `app/` changes: none
- `impl/src/` changes: none

## Catalog recount

The catalog still contains 30 DRAFT, REVIEW_REQUIRED entries with empty event and
experience eligibility arrays. Machine notation is a documentation/parser boundary;
it does not activate a template or bind a plan.

| Machine notation status | Count |
|---|---:|
| `PARSER_READY` | 1 |
| `PENDING_OWNER_RANGE_DECISION` | 1 |
| `NOT_APPLICABLE_INTENSITY_ZONE` | 13 |
| `NOT_APPLICABLE_NO_PACE_TARGET` | 13 |
| `PENDING_CONVERSION_MODEL` | 2 |
| **Total** | **30** |

## Parser-ready meaning check

`V2-SEED-05` is the only parser-ready entry.

| Field | Expected parsed value |
|---|---:|
| Set count | 1 |
| Repetitions per set | 5 |
| Repetition distance | 1000 m |
| Pace target | 5000 m race pace |
| Repetition recovery | 150 seconds |
| Set recovery | `null` |

The canonical source notation remains `5×1000m @5K RP · r2′30″`. Its parser
representation is `5×1000m @5000m RP · r150″`; the basis records only unit spelling
changes, not a training-dose change.

## Fail-closed checks

The catalog validator and its hostile tests reject all of the following:

- 5 repetitions changed to 4
- 1000 m changed to 100 m
- 5000 m race pace changed to 1500 m race pace
- 150-second recovery changed to 1 second
- parser-ready notation removed or replaced with a pending-state string
- parser-ready status or basis changed
- a pending range record given a machine notation
- the original canonical notation pattern changed

`GL-SEED-01` remains `PENDING_OWNER_RANGE_DECISION`. It requires three owner-level
decisions before it can become parser-ready: select 3 or 4 repetitions, select 2 or
3 minutes recovery, and define a path that displays GOAL RP without treating it as
current capability.

## Verification

| Check | Result |
|---|---|
| Catalog validator | PASS: 30/30 inert DRAFT entries |
| Catalog Node tests | PASS: 28/28 |
| Parser semantic contract | PASS: 1/1 |
| Full impl tests | PASS: 99/99 |
| Impl typecheck | PASS |

## Authority boundary

No entry became ACTIVE. No eligibility array changed. No minor eligibility was
granted. No template is connected to a user plan. Numeric notation remains a
review-only catalog detail until the independent human review and activation records
required by the catalog exist.
