# Connected activity UX delivery — 2026-11-05

## Changes

- Provider overview now shows connection state and actions. Garmin settings, review list, selected activity and saved-journal links are separate views; native Back and focus/scroll restoration use the existing navigation layer.
- COROS, Apple Health and Health Connect are distinct unavailable rows. No provider capability or operational feature flag is enabled by this release.
- Activity detail opens with distance, original time meaning and available pace. Overview, laps and graphs retain original numeric precision, null/zero distinctions, sample gaps and multisport warnings. Raw metrics remain accessible below every tab.
- Detail reads begin on entry, are keyed to account/scope/source/state, and preserve abort/late-response guards. Journal details mount only when explicitly expanded, avoiding duplicate expanded summaries in the journal.
- Review displays only actionable records; saved records link to the existing journal open callback with server-issued identity. Retries preserve the same operation ID. Viewing never saves or consents.
- Same-date comparison uses only locally loaded structured records owned by the current account. It does not read memo text into the comparison, fetch the complete server history or infer duplicates. Same-date autosave policy is unchanged.

## Verification

- Focused UI tests: 21 passed across connection panel and detail; thread pool used after Windows sandbox cache rename and fork-worker startup failures. Those infrastructure failures are not passes.
- Synthetic Chromium: settings Back/focus, native Back to review, ambiguous-save retry, journal-read retry and automatic detail read passed. 320/375/1280px and 200% text: no horizontal overflow. No external requests or page errors. Screenshots inspected for overview and detail.
- Original-table placement was corrected after browser inspection found it was limited to the overview tab. Now reachable from every tab.
- Production build uses the project's Node 24.19 runtime. Default Node 24.11.1 is rejected by the existing prebuild guard.
- Final source build, commit, domain workflow and receipt are recorded in tmp/garmin-ux-release.json after release. Full CI is not claimed as passed.

## Boundaries

No DB migration, receiver deployment, credential change, actual health-data ingestion, provider permissions or AI-use consent change. Account mode remains off for the public domain. Provider activation and a real-account workout round trip remain separate work. Local comparison can be incomplete; this is labeled in the UI.
