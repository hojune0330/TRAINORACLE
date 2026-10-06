# Workout Memo Tool: Implementation and Review

Date: 2026-10-06
Checkout: TRAINORACLE-multi-event-pace-release-20261002
Branch: codex/multi-event-pace-release-20261002
Status: implemented and locally verified; not committed or deployed

## Product Decision

The ten supplied images are layout references, not production artwork or training authority. No AI image generation, image-generation API, or baked-in workout text is used. The tool presents an existing prescription as a readable memo, with a local deterministic PNG export.

The existing diary remains the owner of actual results. This change does not create a second result-entry form, alter a prescription, apply a pace change, or save a new account record.

## Delivered Scope

- Inline, collapsible workout memo inside training readers; no additional modal or navigation stack.
- Yellow, pink, and white paper styles using shared typography and semantic color tokens.
- Actual date and AM/PM when supplied by the caller. Missing dates stay unknown instead of being replaced with today.
- Distance, repetitions, sets, target pace/time, repetition/set recovery, warm-up, cool-down, reference basis, and stored safety conditions.
- Distance-, time-, mixed-, adjusted-, historical-, and compatible legacy-prescription presentation.
- Text copy, local PNG download, and file sharing when supported. Unsupported sharing falls back to download; clipboard failure exposes selectable text.
- More-menu pace-calculator entry using the existing calculator navigation and return behavior.

The screen, copied text, and PNG read the same memo model. Historical readers use the prescription stored with that plan or diary, not a newly calculated current PB.

## Review Findings Resolved

| Risk | Resolution |
| --- | --- |
| Reference numbers mistaken for the user's prescription | All displayed and exported values come from the existing prescription model. |
| Photo coaching phrases change the training intent | No universal "push the last rep" or other new coaching cue is added. |
| Planned workout mistaken for performed result | Explicit planned/preview/historical state labels; no success or completion assertion. |
| Old journal changes after a new PB | No current-record lookup in memo construction; use the stored prescription. |
| Missing date becomes a fabricated date | Preserve unknown date and day number. |
| Mixed training loses per-segment pace or set recovery | Preserve segment-specific targets and both recovery levels. |
| Stale catalog silently reconstructs a new workout | Show stored duration/RPE and an explicit limitation. |
| Target/actual basis is ambiguous in older adjusted data | State that the detailed reader must confirm the reference category; do not invent one. |
| Private journal or account data leaks through export | Export only public prescription fields; no diary text, account ID, record ID, or health-history lookup. |
| Export completes after a prescription/account change | Invalidate pending work and cached export on scope/model change or unmount. |
| Long recovery/safety text is cropped | Character-aware wrapping and dynamic PNG height; fail explicitly beyond the supported height. |
| Memo expansion breaks Back | Reuse inline details; native training-reader and calculator-return paths checked. |

## Verification Evidence

- TypeScript check: exit 0.
- Focused tests: 6 files, 70 tests passed, exit 0.
- Final memo-only recheck after wording refinements: 2 files, 18 tests passed, exit 0. These 18 are part of the 70, not additional unique coverage.
- Production build: exit 0; no upload or deployment.
- Browser run: exit 0; 9 viewport/paper cases across 320, 375, and 1024px.
- No horizontal overflow in those cases; 200% text and reduced-motion checks passed.
- Actual local PNG download checked: 1080 x 1530px, opaque nonblank pixels, Pretendard font loaded.
- Copied content, memo-reader Back, and More -> pace calculator -> Back checked.
- No page errors in the isolated browser run.
- Exported PNG directly inspected after the final font fix; all prescription and safety text remained visible.
- Git whitespace check: exit 0.

Evidence: `evidence/workout-memo-20261006/browser-result.json`, viewport screenshots, `exported-workout-memo-yellow.png`, and build/server logs.

Build warnings about existing font resolution, mixed import paths, and large chunks remain nonblocking. They are not evidence of production failure or a claim that bundle optimization has been completed.

## Limits and Next Release Work

- Native iPhone/Android share sheets have not been tested on physical devices. Share cancellation and unsupported-browser fallback are covered locally.
- Full contextual pace-calculator nesting inside every session reader is not part of this delivery. The More entry and workout memo entry points are implemented.
- The result-sheet references do not become an independent results database or duplicate diary flow.
- This is local implementation and synthetic browser evidence, not live deployment or authenticated account round-trip proof.
- Commit, push, deployment, and public-page confirmation remain separate release actions.

## Local Preview

- App: http://127.0.0.1:4466/?app=1&oracleV2=1
- Isolated synthetic tool preview: http://127.0.0.1:4466/e2e/fixtures/workout-memo.html

The isolated example is explicitly synthetic and never saved as the user's training.
