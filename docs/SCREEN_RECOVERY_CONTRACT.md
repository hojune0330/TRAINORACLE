# Screen Failure Recovery Contract

Status: OWNER_APPROVED_RECOVERY_SCOPE
Date: 2026-10-02

## Boundaries

- Asset loading failures are not evidence of a corrupted plan. Match known module/CSS loading errors; do not classify every TypeError or failed fetch as an asset error.
- The application shell remains outside screen error boundaries. A failed auxiliary screen must offer a way back without unmounting its underlying screen.
- An explicit asset retry probes the same-origin HTML entry, then reloads the document to clear a rejected lazy-import cache. A failed probe does not reload or loop.
- A navigation during the probe cancels the recovery action. A one-minute tab-only recovery hint may restore a coarse tab; it contains no input, record ID, or account ID. Explicit account entry takes precedence.
- Unsaved-draft guards are checked before and after the probe. If a crash interrupts an unsafe draft, automatic reload remains blocked even after that form unmounts. This is not a guarantee that already-unmounted volatile input can be reconstructed.
- No recovery path deletes a journal, plan, user cache, account vault, or offline outbox. Existing normal application retention behavior is unchanged.

## Automatic Updates

This scoped approval replaces the former 2026-08-29 assumption that there were no real users and immediate replacement was always safe.

- Keep automatic updates, but defer activation/reload while the document is hidden, a draft is unsafe, or an input/textarea/select/contenteditable surface is mounted.
- Recheck safety after controller change. A failed update request leaves the current screen intact and is handled explicitly.
- Local preview does not register a new service worker by default. `?pwa-test=1` opts into local PWA verification. Existing registrations are not erased automatically.
- Recovery probes bypass offline-shell substitution. Cache only successful HTML as the offline shell; quota failure must not turn a successful network response into a screen error.
- Scope the new cache to the application. Preserve previous cached hashed assets and other applications' origin caches. Server-side old-asset retention is a release concern, not a promise made by this client cache.

## Stored Plans and Emergency Export

- Preserve `missing`, `invalid`, and `storage_error` semantics. Invalid data must not silently become an empty intake or be overwritten with a new plan.
- Show different actions/explanations for unreadable plan content and unavailable storage. Do not infer a corrected prescription.
- Emergency export contains only readable local journals whose ownership is known and visible to the current account. It is not a plan backup or a complete cloud/account backup.
- Distinguish no exportable records, unreadable data/ownership, and download failure. Never describe an empty fallback JSON file as a successful recovery.
- Recovery does not upload raw diagnostics, private notes, or broken stored content.

## Required Focused Regressions

1. Rejected Guide/PlanBeta imports with retained tabs, followed by restored network and successful retry.
2. Failed probe without reload loop; leaving the screen during a probe must cancel reload.
3. Unsafe draft before fetch, newly unsafe draft after fetch, interrupted draft after unmount.
4. Update rejection, activation/reload safety recheck, and unregistered input surface.
5. Offline PWA shell plus a genuinely failing recovery probe; failed/non-HTML responses never overwrite the shell.
6. Invalid plan and account-switch regressions; local backup ownership isolation and explicit download errors.

Physical iOS/Safari, authenticated account recovery, and arbitrary historical plan migrations require separate evidence; browser emulation and static tests are not substitutes.

[DRAFT_COMPLETE]
