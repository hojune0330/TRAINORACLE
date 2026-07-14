# Task 3 Legacy Provenance Evidence

## Browser Result

Command:

```text
cd app && npm.cmd run build && npx.cmd playwright test e2e/journal-provenance.spec.ts --workers=1 --reporter=list
```

Result: 6 passed across desktop Chromium, mobile Chromium, and reduced-motion Chromium.

The browser test seeds one metadata-absent post-session entry before app startup. It confirms that Home still shows `legacy tempo` in the device journal while the summary reads `0건 · 0일의 기록`; Trends shows its no-analysis-data state.

## Rollback Result

`app/src/domain/journal-provenance.contract.test.ts` stores a legacy snapshot, writes a new provenance-bearing record, restores the snapshot, then confirms that the original record is still visible and still has zero analysis rows. The full unit run passed this scenario.

## Runtime Scope

This evidence only verifies local journal display, local analysis projections, and local browser storage. It does not enable Formation, coach sharing, syncing, or automatic training changes.
