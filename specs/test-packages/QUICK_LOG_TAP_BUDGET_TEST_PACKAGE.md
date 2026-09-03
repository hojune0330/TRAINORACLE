# QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md

```yaml
package_id: TO-QUICK-LOG-TAP-BUDGET-002
status: LOCAL_TEST_PACKAGE_UPDATED_PENDING_MERGE_AND_RELEASE_EVIDENCE
runtime_implementation: QUICK_PROGRESSIVE_V2_LOCAL_BRANCH_ONLY
viewport: 375x667
applies_to: post_session_quick_v2_and_existing_detail_mode
executed_tests_total: 0
markdown_self_check_is_runtime_evidence: false
```

This package verifies the post-session quick path. Evening and race quick paths remain
outside the implemented V2 scope. A `[QUICKLOG]` line is runtime evidence only when it
comes from an actual browser execution against the matching build.

## Happy Paths

| Flow | Tap sequence | Limit | Pass condition |
|---|---|---:|---|
| Performed, no pain | entry -> outcome -> slot -> exact RPE or missing -> no pain | 5 | same entry is saved and exact RPE is `EXPLICIT` or missing is `MISSING` |
| Rest or skip | entry -> rest/skip | 2 | no slot, RPE, RPE band, or waiting objective data is stored |
| Positive pain | entry -> outcome -> slot -> RPE -> pain -> body area -> explicit save | safety exception | structured body area exists and review routing is preserved |
| Correction | saved -> correct -> answers -> save | no ordinary budget claim | the original entry ID is updated and no duplicate is created |
| Detail continuation | saved -> write more | no ordinary budget claim | the same entry ID opens in detailed editing |

An automatic transition, animation, derived value, or focus movement does not add a
tap. Every answered value must remain visible and editable after a transition.

## Required Boundaries

1. New quick entries write one exact RPE from 1 to 10 or `MISSING`; they do not write a new RPE band.
2. Exact RPE and an RPE band cannot coexist on the same new entry.
3. New performed quick entries write `UNSPECIFIED`, `AM`, or `PM`; `SINGLE` is read-only legacy compatibility.
4. A performed activity requires an explicit no-signal or signal-reported body check.
5. Signal-reported requires at least one structured body-area level.
6. A generic quick entry has no plan link. Only an explicit plan-session action may carry the exact immutable link into quick capture.
7. Rest and skip cannot become device reconciliation candidates.
8. Historical backfill may be stored but cannot award a spendable current-day point.

## Mutation Checks

- counting an automatic transition or animation as a tap must fail;
- hiding a selected value after transition must fail;
- showing completion before storage success must fail;
- changing exact RPE to an RPE band must fail;
- storing exact RPE and an RPE band together must fail;
- writing `SINGLE` on a new performed quick entry must fail;
- accepting rest/skip as a device merge candidate must fail;
- creating a plan link from date, title, energy label, or RPE similarity must fail;
- reporting pain without a structured body area must fail;
- creating a second ID during correction or detail continuation must fail.

## Manual Verification

1. Run the happy paths at 375x667 and verify no choice is hidden behind the tab bar.
2. Verify focus moves to the newly revealed choice area without trapping the user.
3. Repeat with `prefers-reduced-motion: reduce`; state changes must remain clear.
4. Confirm the ordinary workout form highlights the `일지` tab while the race form continues to highlight `경기기록`.
5. Confirm private writing remains omitted from safe export by default.

## Not Evidence Of

- a training prescription or reason to increase training volume;
- a reward for distance, intensity, or training completion;
- provider trust, device-link availability, or imported-data analysis eligibility;
- safety clearance, medical judgment, canonical promotion, or issue closure.

[DRAFT_COMPLETE]
