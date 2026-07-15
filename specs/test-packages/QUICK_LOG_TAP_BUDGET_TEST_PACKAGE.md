# Quick Log Tap Budget Test Package

```yaml
package_id: TO-QUICK-LOG-TAP-BUDGET-001
status: DRAFT_FOR_REVIEW
runtime_implementation: NOT_CLAIMED
viewport: 375x667
applies_to: proposed quick mode and current detail mode
```

This is a manual verification package for a future quick-log implementation. It does not claim that quick mode, the `[QUICKLOG]` marker, or any preset is currently in the app.

## Happy Paths

| Flow | Tap sequence | Limit | Pass condition |
|---|---|---:|---|
| post-session | entry -> distance -> duration -> RPE -> save | 5 | `taps <= 5` |
| post-session, prior session | entry -> prior-session card -> RPE | 3 | `taps <= 3` |
| evening | entry -> sleep -> quality -> mood -> pain -> weight -> HR -> save | 7 | `taps <= 7` |
| evening, no pain | entry -> sleep -> quality -> no-pain -> save | 4 | `taps <= 4` |
| race pre | entry -> tension -> condition -> pace -> save | 4 | `taps <= 4` |

An automatic transition after an answer does not add a tap. Every answered value must remain visible and editable in place after a transition.

## Manual Verification

1. At 375x667, run every happy path. If the future implementation adds `[QUICKLOG] step=<id> taps=<n>`, compare its count with the table and also verify the existing `[JSAVE]` save result.
2. Repeat each path with `prefers-reduced-motion: reduce`. Motion must not be required to understand a saved value or a safety state.
3. Check quick and detail modes separately. They must use the same `JournalEntry` schema and save boundary; quick mode may not add, remove, or change an entry field.
4. Check that private free writing remains freely editable, that a skipped numeric field is recorded as `MISSING`, and that the same pain REVIEW banner is visible for identical pain values in either mode.
5. Reject completion or preset copy containing `더 뛰`, `늘려`, `채워야`, `연속 N일`, `스트릭`, or `내일도 꼭`. Reject an ordering that promotes the largest training value ahead of the athlete's most recent value.

## Not Evidence Of

- a training prescription or a reason to increase training volume;
- a reward, adherence, plan-generation, or safety signal;
- a validated preset distribution for any age, event, or athlete group.
