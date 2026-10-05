# Oracle V2 Release Checkpoint, 2026-10-05

Status: IMPLEMENTED_AND_PUSHED_CANDIDATE, PRODUCTION_ACTIVATION_PENDING.
This is not a successful deployment receipt or a real-user validation claim.

## Delivered Source

- Oracle V2 implementation and the four owner-requested Mari originals are
  preserved in source commit f8d6b074. Main authentication changes were integrated
  in 35b353f1 without restoring the previous unverified account-scope path.
- Hosting and operational preparation were pushed in 98e3834d.
- Friendly Mari guides the first visit and completion; the clipboard version
  accompanies results. Images do not determine scores, ability or training load.
- The release package was built using the Node 24.19.0 runtime and configuration
  already published on gh-pages. No private environment or journal keys were read.
- The built package includes the four Mari PNGs and Pretendard font. On a 375px
  production-preview viewport, the three-question guest journey completed via
  keyboard, produced the expected self-response score and returned to the result.
  Browser screenshot/mouse commands timed out; do not claim new captured-pixel QA.

## Security Findings and Repairs

The original local Oracle DB fixtures skipped current authentication migrations.
The complete real 0001-0060 chain revealed that comparison accepted unsupported
password AMR despite ordinary account storage denying it. The regression failed
before repair and is retained.

- Non-withdrawal comparison actions now use the current supported-method gate.
- A peer with a password hash, removed session or inactive account is denied.
- Invitation and consent channels are server-derived and pinned. Closing either
  channel denies reads through a different still-open channel.
- Withdrawal does not require an open feature/channel and remains terminal.
- The operational rollback-only RLS smoke uses confirmed synthetic identities,
  live sessions and OAuth AMR, and rolls all identity/flag/document changes back.

Focused current local results: 18/18 Oracle PostgreSQL integration tests and 1/1
rollback-only operator smoke. Earlier in this turn the merged frontend account
and Oracle entry checks passed 73/73, and the production bundle built successfully.
These are separate from GitHub CI and authenticated production tests.

## CI Boundary

GitHub run 37262007455 on 98e3834d did not pass. Contract tests stopped on the
outdated operator auth fixture. App unit tests reported 7056 passed, 3 failed,
33 skipped. Failures concern drawer geometry, branded email operations and guest
resolution. They require focused repair; browser and deployment jobs were skipped,
not passed. The current repair candidate must not inherit a green CI claim.

All three stale assertions/fixtures have now been repaired without modifying
runtime authentication or editor geometry. The branded email contract verifies
the current token-hash app callback instead of the retired confirmation URL.
Guest resolution now supplies a server-verified getUser fixture and explicitly
denies local-cache fallback after server failures. The drawer contract retains
the currently approved 40dvh bound. Focused checks passed 10/10 for the two auth
files and 4/4 for the drawer (including the Asia/Seoul run). The failing operator
fixture was also repaired and passed 1/1 as described above. A new remote run on
the committed repair candidate is still required; focused results are not a
substitute for that run.

## Production Boundary

Read-only dashboard inventory: versions 0001-0038, 0040, 0045-0050; current auth
and new Oracle capabilities are absent. ACCOUNT and ACCOUNT_JOURNAL_V2 are ON,
SHARING is OFF. No SQL, key or function changes were made in production.

Required next operations:

1. Resolve the explicit action-time operating-change approval.
2. Review deferred-baseline differences; do not invent migration ledger entries.
3. Apply approved missing auth/profile SQL and deploy the exact integrated
   account-journal validator/handler without changing encryption keys.
4. Provision comparison separately and resolve the general SHARING prerequisite
   without silently enabling unrelated publication.
5. Verify real account save/reopen/edit and bilateral compare/export/withdrawal.
6. Publish and activate only after the approved release conditions are met.

The local release package is not a live deployment. New Oracle public activation
remains OFF under the implementation contract until both server journeys finish.
