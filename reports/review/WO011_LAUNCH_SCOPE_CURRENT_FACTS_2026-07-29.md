# WO011 Launch Scope: Current Facts

    fact_snapshot_id: WO011-LAUNCH-CURRENT-FACTS-2026-07-29
    base_main_sha: 07b8b9ef2301feb164f7e2256210f52407305cef
    source: reports/review/WO011_PRODUCT_FACT_QUESTIONNAIRE.md
    decision: NOT_ACCEPTED
    runtime_authority: false

## Facts That Are Still Unknown

- No launch country, age policy, release date, legal entity, account-linked public scope,
  vendor inventory, server retention design, or production incident architecture is
  accepted.
- In particular, under-14 Korean account access is not decided. Local journaling and
  future account features must remain separate.
- A feature flag or repository implementation does not turn an unknown public scope into
  an authorized launch.

## Facts That Are Current

- The current app stores structured journal values locally.
- Raw in-app journal recipients are not authorized.
- PRIVATE_SELF_ONLY is a zero-signal private local boundary outside an explicit owner
  backup action.
- Default export excludes memos. A person may explicitly create a local full backup and
  share that file as their own external action; this does not grant any in-app recipient
  access.
- Server share links and raw-memo synchronization remain blocked.

## Effect On Legacy PR #93

PR #93 recorded a time-specific launch-scope direction that is no longer the safe
authority. This snapshot retains current fail-closed facts and intentionally does not
treat a historical acceptance statement as product permission.

[DRAFT_COMPLETE]
