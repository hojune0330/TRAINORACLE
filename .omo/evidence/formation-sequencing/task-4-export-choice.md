# Task 4 Export Choice Evidence

## Default Export

`journal-full-export.contract.test.ts` freezes the clock, writes the same entry with two different private memo values, and compares the two default JSON exports byte for byte. The exports are identical and contain neither memo value.

## Explicit Full Backup

The same contract test calls `exportEntriesJSON({ includeRawMemos: true })`. Only that explicit mode contains the raw memo and `memoPurpose`; it carries `exportMode: OWNER_FULL_BACKUP` and a distinct full-backup format name.

## Browser Result

Command:

```text
cd app && npm.cmd run build && npx.cmd playwright test e2e/memo-full-export.spec.ts --workers=1 --reporter=list
```

Result: 3 passed across desktop Chromium, mobile Chromium, and reduced-motion Chromium.

The browser scenario opens the memo-inclusive dialog, cancels once with no download, then confirms a full-backup download. It records no network request after the app has loaded.

## Mechanical Documentation

- `QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md` is a manual package only; it does not claim quick mode exists.
- `QUICK_LOG_PRESET_RESEARCH.md` from PR #66 was not adopted because it lacks the required primary-source research.
- The three SSO documents now carry the same goal-versus-runtime status block.
- `DRAFT_MARKER_AUDIT.md` is report-only and changes no document authority or dashboard status.
