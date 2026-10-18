# Compact UI and game integrated manual release — 2026-10-18

## Scope and owner approval

- Source baseline: `2495f54bfefc7fed1900f7b58df66b83637cc631`.
- Includes the approved compact home/connected navigation changes and Sleep Inn game already on main.
- The owner explicitly approved coordinating with the game task, checking only the two related browser failures, and manually publishing without another full CI run: `관련 검사만 확인 후 수동 배포`.
- This is a single-release exception, not a change to CI workflow, branch policy, safety gates, account availability, or future release requirements. The final commit uses `[manual-pages] [skip ci]` to avoid a redundant whole-suite run; this is **not** a CI pass.
- This task is the sole publisher for both GitHub Pages and trainoracle.io. The game task transferred its two test corrections and a narrow search empty-state fix without committing or publishing them.

## Narrow correction

- Two game-lounge checks expected four cards; the new approved game makes five. Preserve every other selection, return-focus, search, and image-fallback assertion.
- The Sleep Inn match was not included in the empty-result condition. Reuse its visibility predicate so searching `수면` does not show a game and “no matching game” at once.
- Add that search assertion to the existing catalog test, not a new full suite.

## Evidence before this commit

- CI `39103925928` succeeded on compact-UI source `e7be37e49dfa3ad9719898f0d91eefcb04c16ee1`. Its publication was skipped because main had advanced; it is not evidence of live deployment.
- Integrated CI `39107549269` on the baseline passed contracts, app-quality (type/build), UTC, KST and dedicated browser checks. Generic desktop/reduced-motion failed; other generic jobs were cancelled. The aggregate gate failed and deployment was cancelled. This run is **not passed**.
- Identified failures to correct: `game-lounge.spec.ts` catalog test and `party-reference-ui.spec.ts` missing-art test, both stale four-card assertions.

## Remaining delivery boundary at commit time

1. Build the exact committed source with preserved public settings and account hold.
2. Run only the two named browser tests against that release package, including the new search assertion.
3. If they pass, manually publish the preserving GitHub Pages package and dispatch the domain-hosting workflow with the identical full source SHA.
4. Verify public receipts and a minimal guest navigation/game-entry/asset smoke on both origins.

These steps are pending at commit time, not claimed as passed. Final build, focused-test and live results are recorded in the release handoff and deployment receipts. No real-account, database, mobile-store or full game-progression verification is claimed by this release.
