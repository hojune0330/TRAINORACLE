# PRIVATE_MEMO_SAVE_HOTFIX_2026-09-13.md

## Scope

Status: LOCAL_VERIFIED_PENDING_PR_REVIEW_AND_DEPLOYMENT.
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
- Visible existing vault records prevent creating an unrelated new key. Existing
  codes are checked by real decryption before activation. Scope change/unmount
  aborts activation; no user key or memo is sent to external services or logged.
- Account-enabled storage bypasses this local recovery setup and retains its
  existing account encryption and acknowledgement contract.
- Unclassified errors no longer claim storage is full or recommend deleting data.

## Verification

- Hotfix checkout: 13 unit/contract files, 178/178 tests passed.
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

Independent review, GitHub CI, merge, Pages deployment and public version check
are separate from the local results above. Record their actual results in the PR;
do not infer deployment from this document. Never request the owner's private
memo or recovery code for diagnostics, and do not reload the owner's unsaved form.

[DRAFT_COMPLETE]
