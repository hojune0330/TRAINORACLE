# F3 real browser and storage QA result

```yaml
evidence_id: PERSONALIZED_PRESCRIPTION_ALGORITHM_V2_FINAL_3
verified_at_kst: 2026-08-24
status: PASS
qa_mode: EXECUTOR_BROWSER_AND_VISUAL_INSPECTION
commit_created: false
push_performed: false
deployment_claimed: false
```

## Full browser matrix

The final production build was exercised by the repository's complete Playwright runner:

| Project | Result |
|---|---:|
| desktop-chromium | PASS |
| mobile-chromium | PASS |
| touch-narrow, 320px | PASS |
| reduced-motion | PASS |
| Server cleanup | PASS |

Raw log: `full-e2e-final.log`.

The adaptive next-frame runner separately passed all four required projections and viewports:

- 7 days at 320x568;
- 9 days at 375x667;
- 10 days at 768x1024;
- 9 days at 1440x900.

Raw log: `adaptive-next-frame-final.log`.

## Persisted-state comparison

The 375x667 journey wrote `storage-snapshot-375x667.json` after successor activation. Direct comparison confirmed:

- stored plan version `3`;
- one active `CONSERVATIVE` successor with a nonempty canonical candidate ID;
- adaptation-context active candidate equals the stored active candidate;
- pending successor is `null` after consumption;
- predecessor history count is `1`;
- forbidden raw-text keys `memo`, `note`, `symptomClause`, `evidenceClause`, and `freeText`: `0`.

## Visual inspection

The regenerated 320x568, 375x667, 768x1024, and 1440x900 lifecycle screenshots and the mobile/desktop race-date previews were inspected. No incoherent overlap or horizontal overflow was observed. The fixed bottom navigation remains separate from scrollable content, long Korean headings wrap, the question-mark help target remains visible, and preview-only race-date copy does not expose save or start actions.

F3 is a local browser QA result. It is not a production deployment receipt and does not authorize race-date retention or numeric tapering.

[DRAFT_COMPLETE]
