# Connected record storage: G1 execution evidence

- Execution: `dot-r3-execution-20261030T121900Z`
- Base: `e959d7bb34e460d7f957f58bda87aba5af02ffde`
- Branch: `feat/connected-record-flow-20261030`
- Scope: selected file import; ordinary account autosync preserved.
- G1/G2 use no production account data, provider OAuth or DB mutation. The separate
  public status deployment receipt is recorded below.

## G0 and G1 direction review

The user outcome is to save only the chosen B record, read the same journal back,
and retain unrelated pending A. G1 changes directly address that outcome.

The original import review and confirmation called general hydration, which could
send every pending local record. `refreshAccountJournalRecordsForImport` now reads
fresh authenticated list data without replaying the outbox. Pending ciphertext and
operation receipts remain intact; tombstones still take precedence. Ordinary
`hydrateAccountJournalRecords` keeps its existing automatic synchronization.

After an ACK is lost, selecting the same file can replay only its existing
`FILE_OBSERVATION` save. It must have the identical immutable pending body and
sequence, exact observation identity and facts, and no correction/comparison
mutation. Null and empty observation confirmations are normalized only for
comparison. Ambiguous multiple source matches do not replay one arbitrarily.

`confirmedEntries` contains exact journal IDs and dates only after a successful
account receipt or verified reuse. Pending, failed and conflicted rows do not
produce journal links.

## Focused evidence

Commands use the bundled Node runtime with working directory `app`.

1. `node node_modules/vitest/vitest.mjs run src/domain/import/account-import.contract.test.ts --reporter=dot`
   - Final focused rerun: 42/42 passed, including ambiguous-source no-replay.
2. `node node_modules/@playwright/test/cli.js test --config playwright.account-record-service.config.ts --grep 'explicit file import preserves unrelated pending work' --timeout=90000`
   - 2/2 passed after correcting null confirmation equivalence.
   - Real parser, import, service and encrypted IndexedDB are used.
   - HTTP, authentication and feature configuration are synthetic fixtures.
   - Tests: same-batch retry and reload/reselection after ACK loss.
   - A raw ciphertext and view unchanged; B request/operation identical on retry;
     B server revision remains 1; fresh list returns the exact B ID and date.
   - Generic A and a changed time interpretation cannot use selected-file replay.
   - Positive control: ordinary hydrate subsequently synchronizes A normally.
3. `node --test supabase/tests/device-integration-status.test.mjs`
   - 2/2 passed for public release metadata and read-only HTTP behavior.

The first browser run found a cold-start timeout and a real reload/reselection
conflict. The latter was the confirmation representation mismatch described above;
it was repaired, not ignored. The focused rerun passed.

## Counterpart review and remaining evidence

- Independent storage reviewer `/root/app_coaching` inspected the diff and ran
  the browser tests. It identified and verified additional owner epoch checks
  after asynchronous reads and before publishing remote confirmations.
- Final owner thread `01a113ce-bc4f-70c2-b30c-13511de93497` read the G1 diff,
  agreed on selected-only refresh/immutable replay/epoch guards, and reported
  its UI-focused 62/62 tests plus TypeScript success separately.
- No unrelated provider expansion or new global activation is needed for G1.
- G2 must verify exact journal navigation and permitted analysis. Browser fixtures
  do not prove real-account persistence, actual provider access or AI permission.
- The user's later explicit scope reduction removes personal TCX/account runtime
  testing. No further file/account/consent request, health data transmission or
  personal-test-only fence setup is required. Real account/device round trips are
  an unverified limitation, not an implementation/merge blocker.
- Production compatibility preflight is separate: existing V3 SQL needs no replay;
  deployed Edge lacks storage revision forwarding and the new lineage schema.
  Exact compatible bundle and recovery evidence must precede deployment.

## G2 storage and permitted analysis review

The same focused browser group now contains three passing cases (59.1 seconds,
including a 45.7-second cold Vite load). In addition to G1:

- B retains `SOURCE_DEFINED`, 1,500 raw seconds, 5,000 meters and empty average pace.
- Exact journal lookup preserves B's ID, date and original observation values.
- Immediately after the lost ACK, current analysis has no confirmed record.
  A fresh authenticated list then yields exactly one RUNNING record on its actual
  date, reference-only duration and null pace. A different date includes none.
- Missing source lineage yields `MISSING_LINEAGE` for AI use; a file confirmation
  does not mint a provider grant.
- A synchronous A-to-B-to-A account switch during a read-only confirmation
  notification cannot publish the old generation into a new A context. Cached
  and current projections stay empty, pending ciphertext is unchanged, and no
  extra save request occurs.

Independent reviewers `/root/app_coaching` (runtime and code) and
`/root/data_rights` (source and purpose boundaries) found no remaining bypass in
this bounded change. The latter did not run tests or inspect production values.
It confirmed that current grants are specifically for self-hosted inference,
not blanket storage, analysis or provider approval. Actual origin verification
and a running company-hosted model remain separate unfinished work.

No change in product direction was needed: the tests establish the selected
record's identity and usable evidence without inventing measurements or permissions.
The final owner still performs the product UI comparison and G3 integration review.

## Scope and acceptance correction

The coordinator relayed the user's explicit instruction to omit personal-data
verification. It does not remove focused synthetic tests, required CI, provider
rights boundaries or G1/G2/G3 direction reviews. The approved r3 originals remain
unchanged; this execution record carries the narrower runtime scope.

The 90-second browser override above was diagnostic only. Repository timeout
remains 30 seconds. The standard run initially failed during the first fixture
module import, before the test body. The shared Vite cache was under the default
Playwright output directory, which another config can clear. The default cache
now lives in `node_modules/.vite/account-browser-tests`, with the existing
environment override preserved. Only the record-service fixture's static graph
is warmed before these tests; runtime execution still occurs in the tests.

Final acceptance command, with no timeout override:

```text
node node_modules/@playwright/test/cli.js test --config playwright.account-record-service.config.ts --grep "explicit file import preserves unrelated pending work"
```

**3/3 passed under the unchanged 30-second timeout, retries 0.** This was the first
run with the new cache directory: total 40.7 seconds including setup; individual
cases took 1.9, 1.9 and 1.6 seconds. Exit code 0; port 4381 was released.

## G3 provider-side review

The storage reviewer independently checked exact pending file replay, owner epoch
checks, ambiguous source rejection and missing-base overwrite refusal. No blocking
finding remains in this bounded storage change. The provider owner also read the
UI diff: exact confirmed journal IDs/dates are passed to the journal detail route,
time meaning is displayed separately, and provider approval is not inferred from
the file flow. The final integration owner received the results and retains the
required whole-candidate CI, independent UI review, PR/merge and Pages release.

The implementation still serves the agreed user outcome; cache preparation fixes
the test environment without changing the test timeout or product permissions.
Personal health-data testing remains intentionally excluded, not pending input.

Final provider-owned check: `node node_modules/typescript/bin/tsc --noEmit -p
tsconfig.e2e.json` completed with exit code 0. This includes the added browser
fixture types and the shared setup signature. `git diff --check` is clean.

## Public readiness endpoint compatibility release

Only `device-integration-status` was deployed at 2026-10-30 12:44 UTC in the
existing Seoul project `texspxlpjungyarkvtkc`. The source reports release
availability, not personal OAuth state or current vendor approval. The previous
public approval flags were not reliable current approval evidence.

- Previous: v8, bundle `2020e4073c6888bdbaa6b4f5899f2363cbc443afc219dce6214e4a6683ffeb53`.
- Recovery copy: workspace `tools/rea-aside/device-status-v8-recovery-20261030.json`.
- Deployed: v9 ACTIVE, bundle `4bc2c190d06f67da0c9b02a6855e5138cfd5618691d6d7cb053b9894d9c1cc6f`.
- Source file SHA256: `B1FAADD32E24A2FE4A0AC4BDDC86164C88BC712059342B156331A1718B3D0D07`.
- Immediately before deploy, v8 and its bundle hash were rechecked for concurrent change.
- Readback source matches the candidate after line-ending normalization.
- Public GET returned HTTP 200 and `cache-control: no-store`, schemaVersion 2,
  `CONNECTIONS_NOT_ENABLED`, `publicUserLinking: false`, `FAIL_CLOSED`.
- Existing `verify_jwt: false` is unchanged. No account gate, keys, security
  settings, data grants, provider activation or health data were changed.
- Focused public endpoint tests: 2/2 passed after limiting the contract to Garmin/COROS.

This endpoint receipt is not account storage or provider connection proof.
