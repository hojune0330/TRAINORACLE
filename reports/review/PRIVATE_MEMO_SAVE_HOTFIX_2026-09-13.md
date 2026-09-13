# PRIVATE_MEMO_SAVE_HOTFIX_2026-09-13.md

## Scope

Status: LOCAL_VERIFIED_INDEPENDENT_REVIEW_COMPLETE_PENDING_CI_AND_DEPLOYMENT.
Base: origin/main 87e78be. The uncommitted navigation rewrite and PR #338 are
not included in this hotfix. No schema, encryption algorithm, account storage,
training prescription or D9 rule is changed.

The owner's screenshot showed a race entry with a private memo and a generic
storage-capacity error. The exact state of that phone was not accessed. Locally,
the no-recovery-code condition reproduces a private save rejection. The old form
did not offer recovery setup in place, and every unclassified save failure was
incorrectly presented as storage capacity or browser blocking.

## Changes

- Shared memo preflight detects missing local recovery material before saving.
- Inline recovery setup preserves the form and private purpose. It never silently
  downgrades privacy, writes plaintext, or saves the journal automatically.
- New codes require explicit confirmation of separate safekeeping before use.
- Existing vault records prevent creating an unrelated new key. Incomplete journal
  reads and hidden/orphan ciphertext reject setup rather than pretending the vault
  is empty. Another scope's ciphertext is not decrypted. Existing codes are checked
  by real decryption before activation. Journal/vault snapshots and the previous
  session code are rechecked after asynchronous verification. Scope change/unmount
  aborts activation; no user key or memo is sent to external services or logged.
  Ownership metadata is also checked before/after each decryption and before key
  activation. Already-started WebCrypto cannot be cancelled; its result is discarded
  when the context changed and no code is installed.
- Account-enabled storage bypasses this local recovery setup and retains its
  existing account encryption and acknowledgement contract.
- Unclassified errors no longer claim storage is full or recommend deleting data.

## Verification

- Hotfix checkout after review fixes: 13 unit/contract files, 180/180 tests passed.
- Hotfix production build and TypeScript: passed. Existing chunk-size and font
  resolution warnings remain, not introduced by this patch.
- Hotfix production-browser scenario: 4/4 passed, desktop Chromium, mobile Chromium,
  320px touch and reduced-motion. Real iPhone hardware was not tested.
- Scenario: missing-key explanation -> inline existing-code setup -> unchanged memo
  -> explicit save -> encrypted local vault/no plaintext -> new blank race form ->
  second distinct entry ID. Only synthetic data and synthetic keys were used.
- Mutation: disabling the missing-key guard caused the named test
  `keeps the race input and explains missing encryption setup instead of blaming storage capacity`
  to fail. Guard restored, suite passed again.
- Wrong valid-format code rejects without modifying the existing vault. Correct
  original code subsequently unlocks preparation; save remains a separate action.
- Luna max independent static review found two gaps: orphan/hidden ciphertext
  mistakenly treated as empty, and no snapshot recheck after asynchronous decryption.
  Both were reproduced by new tests against 527e327 before being patched. Those two
  named tests pass after the patch; this does not claim a global transaction spanning
  preparation and a later, separate journal save or replace existing writer guards.
- Follow-up review added ownership-only changes to the same verification boundary.
  The new named ownership-change test fails when that guard is disabled and passes
  when restored. Updated private-setup suite: 7/7; with the isolated CI-failing
  PlanBeta account file: 10/10 passed. The earlier broad hotfix suite remains 180/180
  before that one additional test, not a claimed new full-suite pass.
- Initial navigation-worktree browser attempts failed because its preview was not
  running, then because the development-only react-grab overlay intercepted clicks.
  Neither was counted as a production save failure. Production build passed.

## Separate Navigation Work

The navigation worktree also now clears completed guest drafts after successful
save, retaining account PENDING/CONFLICT behavior. Its log-entry tests passed
176/176 and production browser 4/4. That change is not in this hotfix: main does
not include that new guest navigation-memory implementation. Remaining navigation
review findings must be fixed and reviewed separately before PR #338 is expanded.

## Release Gate

PR: https://github.com/hojune0330/TRAINORACLE/pull/339
Luna max final bounded static review found no remaining merge blocker in the
preparation guards after the ownership recheck fix. The reviewer did not rerun
tests. Parent reran the final production-browser scenario: 4/4 passed.

The first PR CI run (34753985153, 527e327) passed contract-tests but failed one
existing `PlanBeta.account.contract.test.tsx` V6 progress test (expected remote
revision 2, observed 1). Isolated local reexecution passed all three versions;
this is not enough to declare that CI green. Final-head CI must be checked.

Independent review, GitHub CI, merge, Pages deployment and public version check
are separate from the local results above. Record their actual results in the PR;
do not infer deployment from this document. Never request the owner's private
memo or recovery code for diagnostics, and do not reload the owner's unsaved form.

[DRAFT_COMPLETE]
