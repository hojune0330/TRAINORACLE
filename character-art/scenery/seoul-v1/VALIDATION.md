# Seoul scenery pilot validation — 2026-10-14

Base: `0eb26e4319c7e4fffb118976211c228cfa25e510`. Scope: Seoul display, map preview, upgrade icon and offline prop pipeline only. No game rules or account/health data changes.

## Passed local checks

- TypeScript `tsc --noEmit` using Node 24.19.0.
- Vite production-format local preview build (`app/.scratch/seoul-preview`). Existing unresolved font and chunk-size warnings remain; this is not a production publish.
- `draw.contract.test.ts` and `UpgradeChoice.test.tsx`: 5 tests passed, covering all-city renderer safety and upgrade behavior.
- `node --test scripts/minigame-scene-art.test.mjs`: 1 passed. Uses the actual loader module with a controlled Image implementation; shared requests, load failure, zero-sized image rejection and floor anchoring checked. The initial Vitest worker could not start this isolated check, so the DOM-independent test now uses Node's native runner rather than jsdom. No assertions were relaxed.
- Six alpha-cropped WebP files, each at most 256 pixels per side; 36,766 bytes total; per-file hashes and provenance in the public manifest.
- PC and 360×800 phone screenshots show the new map preview, mud/night ground, miniature scenery and Seoul completion.
- Four focused browser scenarios passed: PC and phone Seoul completion, save/reload/next-city unlock, all six image responses; PC and phone blocked-image fallback. First desktop run exceeded the unchanged 180-second test limit during reload; a single isolated rerun passed in 1.2 minutes. Initial combined run was 3 passed / 1 timed out; isolated desktop rerun was 1 passed. No time limits or assertions were weakened.

## Boundaries

- No physical iPhone verification, hosted CI success, merge or production deployment is claimed.
- Current six rendered props are original local prototypes, not the two generated Tripo candidates. Tripo export is pending user interaction with Studio's Send To menu. Four further Tripo generations are deferred until file delivery works, avoiding additional credits for unusable outputs.

## Recheck before promotion

The maintained treadmill browser suite for `tours Seoul|missing miniature` covered the current settled preview. After replacing any prototypes, rerun affected checks and visually inspect the delivered Tripo geometry/materials at 360px width; preserve the provenance distinction. Current phone evidence is in `review/`.
