# QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md

```yaml
package_id: TO-QUICK-LOG-TAP-BUDGET-001
status: DRAFT_FOR_REVIEW
viewport: 375x667
applies_to: quick mode and detail mode
```

## Happy Paths

| Flow | Tap sequence | Limit | Pass |
|---|---|---:|---|
| post-session | entry -> distance -> duration -> RPE -> save | 5 | tap count <= 5 |
| post-session, previous session | entry -> previous-session card -> RPE | 3 | tap count <= 3 |
| evening | entry -> sleep -> quality -> mood -> pain -> weight -> HR -> save | 7 | tap count <= 7 |
| evening, no pain | entry -> sleep -> quality -> no-pain -> save | 4 | tap count <= 4 |
| race pre | entry -> tension -> condition -> pace -> save | 4 | tap count <= 4 |

Automatic transitions after an answered choice do not add to the tap count. Every transition must retain the ink-stack of answered values and let the athlete tap a paper-line value to edit it in place.

## Manual Checks

1. At 375x667, run each happy path and record `[QUICKLOG] step=<id> taps=<n>` and the existing `[JSAVE]` marker. Pass only when both the count and save outcome match the table.
2. On every transition, confirm prior answers remain visible. Confirm M1 through M6 interaction feedback, then repeat with `prefers-reduced-motion: reduce`; no essential state change may rely on motion.
3. Check quick and detail modes separately: the same `JournalEntry` schema and save path are used, PrivacyNote stays free input, and pain REVIEW is visible in both modes.
4. Review completion, preset order, and empty states for forbidden copy: `더 뛰`, `늘려`, `채워야`, `연속 N일`, `스트릭`, `내일도 꼭`. Also reject a preset order that puts the maximum training value ahead of the athlete's recent value.
5. Confirm detail-mode fields are unchanged and no JournalEntry field is added, removed, or type-changed for quick mode.
