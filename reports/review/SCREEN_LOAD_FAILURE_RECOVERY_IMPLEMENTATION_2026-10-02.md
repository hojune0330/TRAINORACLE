# Screen Load Failure Recovery Implementation

Date: 2026-10-02
Baseline: cfffa394f817ac1abfa0fad9c905b1872b7a83d7
Scope: screen recovery and input preservation; no training formulas, prescriptions, journal schemas, or account migrations changed.

## Cause and Repair

The observed failure was a Guide module fetch from an unavailable local preview server. The module remained rejected in the current React.lazy instance after the server returned. Clearing only ErrorBoundary state reproduced the failure; a real reload recovered it.

The repair classifies known asset errors, checks the HTML entry with a bounded request, and reloads only on explicit retry after draft checks. The application chrome and independent overlay/base-screen boundaries remain available. The retry remembers only a coarse tab for one minute; account entry takes precedence. Navigation away cancels a late successful recovery response.

The backup panel no longer claims unverified data is intact. It is collapsed by default and explains that the download is local-journal-only, excluding plans and online-only data. Unknown ownership/read failures cannot become a successful empty backup.

PWA activation/reload waits for safe input state, including mounted input surfaces without a draft guard. Update rejection is caught. Local preview registration is opt-in. Failed navigation responses do not replace the offline shell, and prior caches are not globally deleted.

## Verification

- Focused unit/contract run: 55 passed, 1 existing skipped test, 0 failures. After adding the extra unregistered-input safeguard, the affected recovery/PWA files passed 19/19.
- App TypeScript and browser-test TypeScript: passed.
- Production-mode preview build: passed. Existing large-chunk/font-resolution warnings remain; they are not asserted fixed here.
- Final browser run: 16/16, four scenarios across desktop, mobile, 320px touch, reduced motion.
- Actual service worker: offline shell remained available; recovery probe failed while offline rather than reporting a cached shell as a healthy server.
- Pre-fix control: the PlanBeta retry test failed after unblocking the module because retry never restored the screen. The fixed build passed the same test.
- Existing plan tests covered invalid-read preservation, changed storage, account scope change, adjusted-plan reopening, export and journal actions. One pre-existing intake test remains skipped; it is not counted as passing.
- User preview URL remains `http://127.0.0.1:4434/?app=1`. The build is served from a new immutable output folder. User storage was not cleared or copied to another origin.

## Self-Review and Limits

- Added cancellation after finding that a delayed probe could otherwise reload an unrelated tab.
- Added conservative input-surface deferral after finding that a screen without a registered draft guard could otherwise be replaced during entry.
- Restoring volatile input already lost by a render crash is not guaranteed. The change prevents further automatic reload, not reconstruction of unknown text.
- No authenticated production account recovery, physical iOS/Safari test, full historical-version migration audit, or broad training-quality validation is claimed.
- Cache retention protects previously cached assets; it cannot recover never-downloaded old assets removed by a hosting provider. Explicit retry loads the current entry instead.
- Public deployment remains separate from local verification. Baseline CI run 36870045882 passed quality/contracts but failed app-browser; no required gate was disabled or relabeled.

## Local Evidence

- `.scratch/screen-recovery-unit-final.json`
- `.scratch/screen-recovery-delivery-browser/`
- `.scratch/screen-recovery-pre-fix-retry/`
- `.scratch/screen-recovery-release-20261002/`

These local test artifacts contain synthetic test data and are not runtime evidence of a real user's account. They are not staged wholesale.

[DRAFT_COMPLETE]
