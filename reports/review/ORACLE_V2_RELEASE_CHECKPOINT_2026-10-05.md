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

Migration identity update after main d7f719f6: main 0057 is purpose-scoped storage
consent. The four Oracle migrations are now 0058-0061, and the current local test
chain is 0001-0061. The earlier 0001-0060 result above is historical evidence,
not verification of the newly integrated consent policy or its production state.

- Non-withdrawal comparison actions now use the current supported-method gate.
- A peer with a password hash, removed session or inactive account is denied.
- Invitation and consent channels are server-derived and pinned. Closing either
  channel denies reads through a different still-open channel.
- Withdrawal does not require an open feature/channel and remains terminal.
- The operational rollback-only RLS smoke uses confirmed synthetic identities,
  live sessions and OAuth AMR, and rolls all identity/flag/document changes back.

After integration of main 0057, the pre-adjustment fixtures failed all 19 tests
on the obsolete legal version. Current fixtures use 2026-10-05 admission and
explicit per-user purpose consent through the real RPCs; only disposable PGlite
contains synthetic operations-review evidence. The operator smoke refuses absent
review and never fabricates review evidence itself.

Focused local results with the parent's 0061 policy update: 21/21 Oracle PostgreSQL
integration tests, 1/1 rollback-only operator smoke and 7/7 release-tool unit/mock
tests (29/29 total, Node 24.19.0, test concurrency 1). Stale legal acknowledgement,
either withdrawn storage purpose and closed operations deny comparison while
explicit withdrawal remains available. These results are not production evidence.
Earlier in this turn the merged frontend account
and Oracle entry checks passed 73/73, and the production bundle built successfully.
These are separate from GitHub CI and authenticated production tests.

Independent read-only review identified missing feature/channel checks after the
single-source owner-lock wait. Those checks are now present before source return.
The review also retained a separate in-flight-processing limit: a final refusal
does not prove immediate abort of decryption/calculation after a ciphertext has
already reached Edge. The operations document records that boundary and keeps
actual parallel PostgreSQL races and the in-flight policy open for release review.

The frontend comparison endpoint was missing from the consent-checked transport.
It now checks current storage consent and immediate withdrawal holds before new
comparison requests. Only identifier-only revoke commands use a separately
server-proven data-rights identity; they cannot release storage holds or carry
profile fields. The API also verifies the exact server user/session before and
after a request. V1/V2 profile saves remain on the already protected journal route.
Six focused frontend files passed 104 tests with Node 24.19.0 and one threads
worker. Reintroducing the missing comparison gate failed eight named tests;
restoring it passed 53 changed tests. TypeScript passed. These are synthetic/local
checks, not authenticated production or a replacement for the full release gate.

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

Run 37264341033 on c544c383 passed contract-tests, but was deliberately cancelled
after a newer main commit added purpose-scoped storage consent and data rights.
The app-quality/browser gates of that cancelled run are not accepted as passes.
Main d7f719f6 was preserved by merge 0807daa0; the final consent-integrated candidate
requires its own remote run.

The hosted environment check now rejects the previous public configuration for
missing current legal documents and the explicit storage-privacy release review.
The preparation tool does not manufacture that review or silently reopen account
features. Its --preview-only mode explicitly closes account-backed transmission.
Build metadata now says NOT_PUBLISHED in a build manifest; an actual deployment
receipt must be created only by a successful publication operation.

## Production Boundary

Historical read-only dashboard inventory, before local integration of main d7f719f6:
versions 0001-0038, 0040, 0045-0050; current auth
and new Oracle capabilities are absent. ACCOUNT and ACCOUNT_JOURNAL_V2 are ON,
SHARING is OFF. No SQL, key or function changes were made in production.

Required next operations:

1. Resolve the explicit action-time operating-change approval.
2. Complete the current account release prerequisites, including dedicated origin,
   actual processing/retention notice and operations-review evidence. Owner approval
   alone is not vendor-fact evidence. Do not enable public providers or set the
   storage-privacy release acknowledgement before these conditions are met.
3. Review deferred-baseline differences; do not invent migration ledger entries.
4. Apply approved missing auth/profile SQL and deploy the exact integrated
   account-journal validator/handler without changing encryption keys.
5. Provision comparison separately and resolve the general SHARING prerequisite
   without silently enabling unrelated publication.
6. Verify real account save/reopen/edit and bilateral compare/export/withdrawal.
7. Publish and activate only after the approved release conditions are met.

The local release package is not a live deployment. New Oracle public activation
remains OFF under the implementation contract until both server journeys finish.
