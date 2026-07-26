# DETAILED_PRESCRIPTION_RUNTIME_IMPLEMENTATION_REPORT_2026-07-26.md

```yaml
document_metadata:
  doc_id: trainoracle-detailed-prescription-runtime-implementation-2026-07-26
  spec_id: WO019_DETAILED_PRESCRIPTION_RUNTIME
  title: Detailed Prescription Runtime Implementation Report
  version: "0.1"
  round: WO019_TERRA_RUNTIME_AND_READER
  status: READY_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: NOT_RECOUNTED_NOT_CLAIMED
  canonical_blocking_count: NOT_RECOUNTED_NOT_CLAIMED
```

## 1. Delivered Surface

The public app adds a **훈련표 표기 읽기** screen at the first Plan intake step.
It accepts a supported notation such as:

```text
2×(10×400m) @5000m RP · r60″ · R3′
```

and explains only the facts encoded by that notation:

- 2 sets of 10 repetitions, 20 repetitions total
- 8,000m quality-work distance
- 60-second repetition recovery, 18 occurrences
- 3-minute set recovery, 1 occurrence
- 1,260 seconds total planned recovery

The input is held only in the React screen state. It is not written to local
storage, a plan record, audit output, or a server request.

## 2. Runtime Boundary

`impl/src/prescription/` provides typed parsing, derived totals, same-event pace
calculation, and runtime preparation guards.

- A same-event, current, provenance-complete race result is required before a
  numeric race-pace calculation can succeed.
- Goal anchors, stale PBs, seasonless SBs, cross-event inputs, and sprint
  benchmarks below 60m are rejected.
- `D9_ACTIVE` and `D9_UNKNOWN` reject runtime preparation before notation or
  anchor values can produce a prescription.
- All 30 catalogue entries remain `DRAFT` and `REVIEW_REQUIRED`; no entry is
  active, eligible, selectable, or emitted by the public Plan Beta generator.
- Raw memo and private self-only signal fields are not retained in structured
  runtime output.

The public reader deliberately does **not** calculate a personal pace, create a
plan, activate a template, assign training, or make a safety or medical judgment.

## 3. User Clarity

The reader has a visible label, a contextual `?` explanation, a supported-format
example, a clear invalid-format message, and a native disclosure of what the
screen does not do. It uses the existing border-only plan surface and remains a
single, centered app experience on mobile, tablet, and desktop widths.

## 4. Verification Evidence

| Check | Result |
|---|---|
| App type check and production build | PASS |
| App unit contracts | 295 passed |
| Full Playwright suite | 160 scenarios, status `passed` |
| Notation reader browser path | PASS at 375×812, 768×900, 1280×900 |
| Browser console after reader interaction | 0 errors |
| Implementation runtime tests | 84 passed |
| Detailed catalogue validator | 30/30 inert draft entries; 18/18 mutation checks passed |
| Work-catalog reasoning harness | 16/16 passed |
| D9 evaluator runtime evidence | 11/11 passed |
| React Doctor changed-file audit | no issues found |

## 5. Non-Claims

- This implementation does not make the draft catalogue production-authoritative.
- It does not close source-spec open issues or promote any document to canonical.
- It does not turn `D9_CLEARED` into medical clearance.
- It does not claim individualized coaching prescription, coach approval, account
  linkage, or payment readiness.

## 6. Deployment Condition

The change becomes publicly available only after the reviewed branch is merged
to `main` and the existing GitHub Pages workflow completes successfully.

[DRAFT_COMPLETE]
