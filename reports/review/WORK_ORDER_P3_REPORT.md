# WORK_ORDER_P3 Pace Wiring Report

## Execution receipt

- Model: `gpt-5.6-sol`
- Reasoning effort: `ultra`
- Base main SHA / P1 merge: `aea3d356fbc7f25d3ddb905c1f2cf2aa69e52eb6`
- P2 seed merge: `405b61943eaa78a6f75040e90e234e6acc2bc8c9`
- P2 latest-main receipt: `.omo/evidence/task-6-p2-reverification.txt`
- Branch: `codex/p3-current-same-event-pace`
- Publication state: `PENDING_PR`
- Runtime authority added: `false`
- Catalog activation added: `false`
- Cross-event conversion added: `false`

The governing work order is
[`WORK_ORDER_P3_PACE_WIRING.md`](../../WORK_ORDER_P3_PACE_WIRING.md).
This report records a bounded development fixture and does not authorize a
production numeric template.

## Result

P3 now has a same-event pace evidence contract with a development-only
interaction harness.

- A number is produced only after an athlete explicitly selects a record and
  explicitly confirms it as `CURRENT`.
- The selected record must match the notation event.
- D9 and Safety Gate must be clear.
- The template must be `ACTIVE` and `ELIGIBLE`. That state exists only in the
  development fixture; all 30 real catalog entries remain inert.
- `STALE`, `UNKNOWN`, cross-event, incomplete provenance, blocked safety, and
  draft templates return numeric-free guidance.
- A goal can produce a weaker display-only reference. It never becomes the
  current capability anchor.
- Production plan storage continues to accept only existing REST/RPE items.
  `PACE_TARGET` is rejected at the storage boundary.

## Hand calculation

| Role | Source | Calculation | Result | Authority |
|---|---|---|---|---|
| Current target | 5000m in 1110 seconds | `1110 / 5000 * 1000` | 222 seconds, `3:42/1000m` | Development fixture only |
| Goal reference | 5000m in 1050 seconds | `1050 / 5000 * 1000` | 210 seconds, `3:30/1000m` | Display-only |
| Comparison sign | selected 930, comparison 945 | `(945 - 930) / 5` | `+3 seconds/1000m` | Descriptive only |

The comparison direction is always `comparison - selected`. No 800m-to-1500m,
VDOT, threshold, interval-pace, or sprint conversion is implemented.

## Provenance trace

The selected snapshot preserves the source record without reconstructing it
from display text:

| Field | Fixture value |
|---|---|
| `anchorId` | `pb-5000-1110` |
| `enteredBy` | `ATHLETE` |
| `verificationState` | `SELF_REPORTED` |
| `freshnessState` | `CURRENT` after explicit confirmation |
| `sourceRef` | `athlete-record:pb-5000-1110` |

Blank or invalid runtime provenance is rejected. Record dates do not create
`CURRENT`; even an old PB is usable only after explicit currentness
confirmation.

## Privacy and safety boundary

- P3 does not import or read journal entries, private memo text, training-note
  text, symptom free text, memo purpose, memo presence, or memo length.
- `D9_ACTIVE` and `D9_UNKNOWN` remain blocking.
- Safety Gate output is consumed before pace arithmetic.
- `GOAL` cannot enter the current-anchor calculation.
- The development harness is loaded only when `import.meta.env.DEV` and
  `?p3-pace-fixture=1` are both true.
- React diagnostics are disabled for the harness so QA screenshots represent
  the product surface rather than developer overlays.
- Production assets contain none of `p3-pace-fixture`, `3분 42초`,
  `pb-5000-1110`, or `P3PaceHarness`.

## Storage compatibility

The production plan parser remains numeric-inert:

- historical REST/RPE plan state opens without migration;
- valid REST/RPE state saves and reloads unchanged;
- stored `PACE_TARGET` is rejected;
- a forged fixture-authority field does not make `PACE_TARGET` persistable;
- no catalog, journal schema, or journal store file changed.

## User evidence

- Current same-event flow:
  [task-7-p3-pace-393x852.png](../../.omo/evidence/task-7-p3-pace-393x852.png)
- Numeric-free stale flow:
  [task-7-p3-pace-error.png](../../.omo/evidence/task-7-p3-pace-error.png)

The current target is visually primary. The goal reference is subordinate and
paired with “목표 기록은 오늘 지시가 아니에요.” The stale/unknown screen
contains no target number.

## Verification

| Check | Direct result |
|---|---|
| impl typecheck and full tests | PASS, `107/107` |
| app typecheck and E2E typecheck | PASS |
| app full unit tests | PASS, `424/424` |
| app production build | PASS |
| P3 development browser matrix | PASS, `8/8` across desktop, 393x852, 320x568, reduced motion |
| full production Playwright | PASS, `173` passed, `35` viewport-conditional skipped |
| D9 evaluator | PASS, `11/11` |
| catalog validator | PASS, `30/30 inert draft entries` |
| catalog hostile suite | PASS, `30/30` |
| reasoning harness | PASS, `16/16` |
| advisory hostile suite | PASS, `42/42` |
| dependency audit validator | PASS, `7/7`, production high `0` |
| production bundle fixture grep | PASS, marker count `0` |
| `git diff --check` | PASS |

During final verification on 2026-07-31, an existing trash-ordering contract
fixture crossed its absolute 30-day retention boundary and failed with only the
newer item remaining. The fixture now derives two recent deletion timestamps
from one captured clock value. The trash runtime is unchanged; the focused
contract passed twice and the full app suite then passed `424/424`.

The local completion gate does not replace exact-head independent review,
GitHub CI, merge, Pages deployment, or public-site verification. Those receipts
must be appended to the PR conversation before Task 7 is marked complete.

## Changed surfaces

- `impl/src/prescription/race-pace.ts`
- `impl/src/prescription/runtime.ts`
- `impl/src/prescription/types.ts`
- `app/src/domain/pace-target-plan.ts`
- `app/src/domain/pace-target-evidence.ts`
- `app/src/domain/plan-session-schema.ts`
- `app/src/domain/plan-beta-schema.ts`
- `app/src/domain/plan-beta-store.ts`
- `app/src/screens/plan-beta/PaceEvidenceFlow.tsx`
- `app/src/testing/P3PaceHarness.tsx`
- bounded contract and browser tests for those surfaces

No real catalog lifecycle, eligibility, event group, experience band, minor
permission, plan candidate, or public route was activated.
