# Todo 8 Accepted-Successor Activation Evidence

```yaml
status: CONFIRMED_AFTER_RUNTIME_FIX
verified_on: 2026-08-24
commit_created: false
push_performed: false
deployment_claimed: false
```

## Verified behavior

- 7, 9, and 10 day projections keep next-plan selection unavailable until every visible non-REST session has terminal progress.
- An accepted successor is activated under the shared Web Lock exactly once.
- The predecessor is archived once, the pending envelope is consumed once, and reload preserves the successor and one history entry.
- Progress changes invalidate the old pending match; a newly accepted replacement can activate without mutating the predecessor early.
- Fresh D9/hold, candidate, pair, transform, detailed-template, and storage checks remain fail-closed.

## Defect found and fixed

The proposal safety check and the later acceptance safety recheck used different timestamps. The acceptance request hash retained both, but the persisted envelope kept only the proposal timestamps. Real button clicks therefore reconstructed a different request hash and failed with `PENDING_ENVELOPE_MISMATCH`.

The pending envelope now preserves proposal safety timestamps and acceptance safety timestamps separately. Proposal verification reuses the former; acceptance-request verification reuses the latter. No safety recheck was removed or weakened.

## Executed evidence

- Adaptation storage, parser parity, UI adapter, activation, and UI flow: `132/132 PASS`.
- Focused active-plan/adaptation/activation run before the envelope fix: `19/19 PASS`.
- Production build: `PASS`.
- Isolated browser E2E: `4/4 PASS`.
- Browser cases: 7 days at 320x568, 9 days at 375x667, 10 days at 768x1024, and 9 days at 1440x900.
- Screenshots: `ui-lifecycle/`.

[DRAFT_COMPLETE]
