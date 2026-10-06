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
- Final recording focus repair includes the bottom navigation in the return-target lookup; mounted-plan cancel and browser Back both assert restored focus. Navigation follow-up: 8/8 passed.
- These figures are separate runs with overlap and must not be added together or labelled a full suite.

## Post-publication focused follow-up

Manual Pages publication of `81dba67d` was hosted successfully at Pages commit `62d3549a` on 2026-10-06. Public basic and V2-preview manifests both matched the source; browser review confirmed the result-first Home and eight-group reading library. This first publication is superseded by the exclusion-notice repair below.

GitHub run `37398189408` completed contract-tests successfully, but the main app unit group reported 7,195 passed, nine failed and 33 skipped. Its browser and automatic deployment jobs did not run. Four failing files were retained as real failures: a missing mock export, old topic-label expectations in two files, and an exclusion-notice visibility regression.

- Actual UI repair: the existing imported/no-provenance explanation remains available on every selected training analysis, not only the summary. The file panel retains its existing notice without duplicate rendering.
- Test repair: preserve all existing guest-scope, count, route and callback assertions while supplying the honest empty-plan mock and current literal topic labels.
- Provenance/exploration/navigation follow-up: 19/19 passed sequentially. An earlier parallel local run had a five-second training-step timeout (18 passed, one failed); the sequential run kept the same assertions and timeout.
- Guest-reward mock follow-up: 3/3 passed. Full remote gate status remains separate from these focused repair checks; no failed or skipped gate is represented as successful.
- Current-label fixtures in OracleReturnPanel and OracleExplore were verified in a two-file focused run. Final typecheck passed after the notice repair.

Final packaging, publication and the new exact-commit GitHub Actions status are reported in the deployment receipt and handoff. No authenticated real-user round trip has been performed.
