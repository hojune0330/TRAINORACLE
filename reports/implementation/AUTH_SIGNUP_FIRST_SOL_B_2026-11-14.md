# Auth-first signup hotfix — Sol B

Isolated worktree TRAINORACLE-auth-hotfix-20261114, baseline 0db401. Source set SHA-256: `2362f478cf6e751dd34619e52c16a48d5384ef4144b2ccc53a8c0e461b5bc03f`. Ten owned source/test files are pinned in adjacent SOURCE.json. A-owned SQL and account-service.ts are excluded.

## Change

Google/Kakao signup and login buttons start their actual OAuth operation immediately. Explicit schema-5 AUTH_ONLY attempts carry entryMode and the existing provider/attempt/phase/verified owner/session proof, with null birthDate and legal versions: they are authentication intent, never fabricated enrollment consent. Existing callback scrub, PKCE code exchange, provider match, quarantine, exact returned session and 15-minute attempt TTL remain authoritative. The email/phone schema-4 protected paths are retained. Blocked preparation/storage recovers busy state without starting OAuth.

Account admission is read before any profile completion on initial load and retry. ADMITTED skips fields and duplicate enrollment writes. Only server canComplete renders existing age/required-consent completion form; its action says 회원가입 완료. Auth-only attempts cannot auto-save a profile. A supplies distinct server failure messages and retains admission/age enforcement. Generic false new-tab email copy is removed.

Successful callback proof is no longer shown as a persistent login-success banner while admission fails. Failure notice uses neutral 계정 확인 전까지 동기화는 대기해요 and preserves local-data reassurance. Export/delete rights remain reachable inside collapsed 계정 자료 관리 instead of prominent signup-failure panels. Existing member and new-member paths remain distinct from the auth proof itself.

## Focused execution

One focused Vitest command, exit_code=0: 5 files passed, 56 tests passed, 44 excluded by explicit test-name filter. Duration57.18s. Exact command is recorded in adjacent JSON. The selected cases cover auth-first button behavior, absence of pre-auth birth/consent facts, blocked storage recovery, exact identity/session/attempt/TTL, callback mismatch/implicit token/cached session rejection, existing admission without extra input, new-member completion, folded rights, stale callback-success suppression and server-first retry.

After that run, only one failure-state sentence changed to neutral account-verification wording; no repeat was run for that copy-only delta. No full suite, B typecheck/build, visual browser, provider call, live-account inspection or B operation/deployment was executed. This is focused synthetic evidence, not proof of real Google signup or public release.

## Local tooling

Existing original app/node_modules is reused through a local junction in this isolated worktree. No package install or lock change. Initial relative junction path was rejected; sandbox creation was denied; scoped local junction creation then returned exit0. These setup outcomes are separate from the test result.
