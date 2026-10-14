# Seoul scenery validation — 2026-10-14

Base: `0eb26e4319c7e4fffb118976211c228cfa25e510`. Scope: Seoul display, map preview, upgrade icon and offline prop pipeline. No game rules or account/health data changes.

## Delivered source and artwork

- Six H3.1 models actually received through the official Studio → Blender Bridge: tree, rock, hurdle, checkpoint gate, shoe, observation tower.
- Actual transfer format: embedded-texture FBX; all six imported successfully in Blender 4.5.14. Original payload 4,182,872 bytes. IDs, hashes and cost recorded in `sources/manifest.json`.
- Source files are authoring-only. Cycles CPU/AgX renders were cropped and packed into six transparent WebPs, each at most 256×256, 54,220 bytes total.
- All six inspected at large and 64px sizes. Strong colors were moderated with AgX; no extra paid generation or retopology was used.
- Camera height now fits the observation tower into the short map preview. Preview captures wait for image loading to settle, including failure fallback.
- Source, derived files, prompt text and rights reference are preserved. Local parametric prototypes have been replaced, not relabelled.

## Local validation

- Final Vite build: `app/.scratch/seoul-tripo-final` passed. Existing font-resolution and chunk-size warnings remain. This is a local build, not production deployment.
- Initial Tripo integration: four browser scenarios passed (2.6 minutes): PC and 360×800 phone 90-second Seoul completion, six image responses, stars saved and restored after reload, next city unlocked; PC and phone image-blocked vector fallback.
- Final map framing/readiness follow-up verification is recorded below after completion.
- Prior applicable renderer and upgrade contracts: 5 passed; image loader/anchoring test: 1 passed. They are scoped local checks, not the full hosted suite.
- No physical iPhone or authenticated account round-trip was performed.

## Hosted release blocker

PR #360 head `48a2d68f068fc990dfa41cfa740e1fa8354ed75b` ran [TrainOracle CI 38499658698](https://github.com/hojune0330/TRAINORACLE/actions/runs/38499658698). It failed before browser/deploy jobs:

- Contract tests: 15 failures; repeated `Comparison fixture: Expected generated original`, including `supabase/tests/account-journal-handler.test.mjs:730`.
- Both UTC/KST app-unit runs: 166 failed files, 560 passed, 7 skipped. Examples include initial-record pace, account pace, plan navigation and generated-original fixtures.
- The PR delta against the refreshed base has no changes under `supabase`, `app/src/domain`, `app/src/services` or `app/src/infra`; these are outside the scenery patch. This does not claim every failure's root cause has been repaired or independently reproduced on base.
- No assertions, tests, workflow gates or account-publication flags were weakened. The draft remains unmerged; production publication is withheld until the repository release gates are resolved.

This distinction matters: source delivery, local game checks and a built preview are complete evidence only for their stated scope. They are not a green full CI, a main merge, a Pages deployment or real-account verification.

## Final local candidate — after preview framing fix

- TypeScript `tsc --noEmit`: passed.
- Vite final rebuild: passed in 17.52 seconds.
- The maintained four PC/phone browser cases ran against `http://127.0.0.1:4221` and the final build: **4 passed (2.5 minutes)**. No retry, weakened assertion or increased timeout.
- Final map screenshot waits for the image-load settled signal. Desktop and phone show the Tripo tower fully within the preview, with tree/gate scenery. Phone mud and night screenshots were refreshed from this final run.
- All six runtime hashes, alpha channels and maximum dimensions verified. Source hashes are separately preserved in the source manifest.
- Local preview is available on this computer at `http://127.0.0.1:4221/?app=1`; it is not a public deployment.
