# Home / Oracle navigation integration — 2026-10-06

## Implemented scope

- Home presents one prepared existing result or a labelled fictional example after safety notices. Source dates and partial/unavailable states remain visible; the six-topic grid and repeated coaching sections no longer occupy Home.
- Bottom navigation has four destinations (홈 / 일지 / 훈련 / 오라클) and a separate central 기록 action. Existing internal log routes remain compatible.
- Recording retains its opening date, month, scroll, focus and mounted training step. Returning to an unsaved mounted plan does not discard that plan. Actual destination changes still run discard/storage guards, and reload protection still sees preserved drafts.
- Oracle has 내 훈련 / 러닝 취향 / 읽을거리. Receipt drilldowns, file-exclusion notices, existing coaching, the six existing analyses and pace tools remain reachable. Labels describe the actual evidence, not a new scientific inference.
- V2 provides an optional 계획 선호 3문항 entry and the existing 56-topic library. The V1 production fallback does not claim that library is available and instead links to existing training content.
- Completed guest answers, selected character and context survive intra-app navigation in memory only. Account scope changes and remount/reload clear them. They are not placed in local/session storage, history or server storage.

## Integration boundary

Integrated existing feature source `f655407a7092cd9eda17d0a1e62f8bc11c1393d2` into main `26c86a9a3b79abe915f7f7db3ecc027288842315` in a clean isolated checkout. Unrelated dirty checkouts were not changed. No workflow edits.

Latest storage withdrawal migration 0058 is retained. Unapplied Oracle candidate identities are 0059–0062; their SQL semantics remain unchanged. Latest consent/revision/withdrawal checks and the Oracle comparison identity/revocation checks are both retained.

No production database migration, function deployment, real-account write, new tracking, payment change or account/share activation is part of this release. V2 remains disabled on the default site and is enabled only in a separately labelled account-disabled preview. Shared GitHub Pages account access is already retired; the release helper's explicit `--account-held` mode records that existing closed boundary, without fabricating legal/storage approvals and without disabling public feedback.

## Focused evidence

- App typecheck: passed before release packaging (final run recorded separately in handoff).
- Home/chrome/account/pace/entry focused initial run: 239 passed, 11 failed; failures were kept visible and repaired rather than treated as a successful run.
- Oracle experience / profile / Trends follow-up: 49/49 passed.
- Recording origin / home accessibility / navigation guards follow-up: 27/27 passed.
- V2 scope-memory / Oracle entry / multi-plan forwarding / navigation guard follow-up: 38/38 passed.
- Mounted-draft test defect injection: disabling preservation caused the targeted test to fail; source was restored before final checks.
- Local PostgreSQL full 0001–0062 chain, operator/comparison/profile focused files: 22/22 passed (synthetic local database only).
- Release operator tests: 7/7 passed. Public configuration selection/hold: 2/2 passed.
- Independent Luna maximum-reasoning source review identified the V2 METHODS link and nonnumeric/skip accessibility states. Both were corrected; experience follow-up 17/17 and entry/navigation follow-up 26/26 passed. Browser review also caught and corrected the V1 reading-link route.
- Guest callbacks reject a changed scope generation, including guest → account → guest. An explicit null keeps the child controlled and prevents a stale component-local result from returning.
- These figures are separate runs with overlap and must not be added together or labelled a full suite.

Packaging, publication, hosted checks and GitHub Actions status are separate evidence levels and will be reported after publication. No authenticated real-user round trip has been performed.
