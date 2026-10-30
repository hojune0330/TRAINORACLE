# Connected record flow integration

Execution: `dot-r3-execution-20261030T121900Z`.
Baseline: `e959d7bb34e460d7f957f58bda87aba5af02ffde`.
Branch: `feat/connected-record-flow-20261030`.

## User outcome and scope

The user can find file import inside the app, review the meaning of each value,
save only selected records, and open the exact acknowledged journal. Unrelated
pending records remain intact. Normal account synchronization is unchanged.

The user explicitly removed personal TCX/account round-trip testing from this
delivery. No personal data was requested or transmitted. Synthetic checks do
not establish real-device or real-account success; that is a limitation, not a
pending consent or delivery blocker. Public Pages continues with account OFF.

## Implementation

- More now opens an internal device-status view with a file-import action,
  explicit automatic-linking unavailability, original navigation and return focus.
  It does not infer vendor approval or a person's permission state.
- Import review labels TIMER, MOVING, ELAPSED and unknown durations separately.
  Missing values remain missing; an offset does not auto-select a region timezone.
- Same-day same-name rows have distinct accessible selection/save labels using
  row number, actual distance and duration meaning. Internal IDs are not exposed.
- Import-specific refresh reads remote records without replaying the whole outbox.
  Lost ACK recovery can retry only the matching immutable FILE_OBSERVATION operation.
- Exact journal links come only from confirmed ID/date pairs. Counts alone do not
  create links. Pending/failed/conflicted records do not become confirmed entries.
- Different lineage under the same source ID is a correction/conflict candidate,
  never silent reuse. Existing identifiers are not rekeyed. API/HealthKit/Health
  Connect provenance cannot be relabeled as a file upload.

Provider implementation and deployed minimal compatibility evidence are in
`DELIVERY_CONNECTED_DATA_STORAGE_REVIEW_2026-10-30.md` and
`DELIVERY_CONNECTED_DATA_SERVER_PREFLIGHT_2026-10-30.md`. No SQL migration,
account feature activation, credentials or permission expansion was needed.

## Focused evidence

- Initial five UI suites: 62 passed. Final affected import contracts: 68 passed.
- File observation, fact display/accessibility and More legal navigation suites:
  3 files passed in the final focused run. A new source-conflict test initially
  asserted an unrelated ATTACH-choice flag; its expectation was corrected to
  require CORRECTION and prohibit REUSE, with unchanged input retained.
- App TypeScript: `tsc --noEmit`, exit 0 after final UI changes.
- Provider account-import contracts: 42 passed.
- Provider encrypted IndexedDB browser cases: 3 passed with the original 30-second
  per-test limit, no retries, a fresh cache. HTTP and authentication are synthetic.
- Actual app with synthetic HTTP: TCX ACK → report → saved/reopened plan →
  comparison and pending-ACK exclusion, 2 passed. New exact journal among two
  same-day records, 1 passed (31.1 seconds).
- Stale home-navigation expectations updated in four existing test files;
  19 unit cases and 20 browser cases passed across desktop, mobile, narrow touch
  and reduced-motion projects. Assertions and time limits were retained.
- Public status contract: 2 passed. Exact deployed journal candidate: 11 passed
  with synthetic repository/auth/key data. These are not live account writes.

An initial Vitest attempt could not start workers and ran zero tests. A one-worker
rerun executed the tests. A local preview cache placed under Playwright's output
directory was deleted by another suite; moving caches outside that tree resolved
dynamic screen loading. The committed shared account fixture setup now protects
its cache and prepares the real record-service import graph before test execution.

## Peer direction review

G0: integration owner, provider and independent Aside agreed that selected-only
save and accurate confirmation directly serve the user goal. Whole provider API
activation, new personal test accounts and unrelated training changes are excluded.

G1: Aside directly observed account-OFF import and selected rows, narrow-screen
layout, enlarged text and return focus. It found duplicate accessible row names;
the implementation above addresses that specific finding. Final focused recheck
is recorded in the external execution ledger, not inferred from source edits.

G2: the provider reviewed owner/epoch/revision, missing lineage, permission and
analysis boundaries. The integration owner reviewed its diff and exact entry
navigation. Synthetic evidence is explicitly separated from live account proof.

G3 remains the final candidate/required-CI/peer-review/merge gate. This document
does not itself claim a successful PR, main merge or Pages release. Those receipts
are recorded after they occur. The excluded existing provider preparation draft
is preserved uncommitted.
