# Garmin one-time consent and automatic journal storage

## Delivered implementation

- Explicit AUTO/REVIEW consent on connect, server-confirmed preference CAS, automatic OAuth callback completion; existing connections default to REVIEW.
- Server-side autosave runs without an open browser. It rechecks owner, account/storage controls, storage consent revision, connection epoch, source revision and preference revision at atomic commit.
- Insert-only encrypted journal projection and inbox acknowledgement share the owner lock/transaction. Existing journals, memos, deletion tombstones and rewards are not overwritten or manufactured. Provider raw/detail storage remains unchanged.
- Missing essential metrics, manual/multisport records and same-date existing journals require review. Same-date matching is deliberately conservative and may flag distinct workouts; it is not a precise cross-provider duplicate classifier.
- Retried delivery does not create a second journal. Excluded records remain excluded on source revision changes. Transient failures defer that row for five minutes; other rows can progress.
- UI exposes saved status, last journal write, review count, settings, and persisted journal navigation; visible AUTO sessions refresh every 30 seconds while idle. Other provider cards remain unavailable until implemented and operationally verified.
- Legacy status/inbox/read responses retain their shape; additional fields are negotiated with `experience:true`. Deploy the new server before enabling the new client.
- Daily GitHub credential reminder checks public expiry metadata at 14/7/1 days. It does not automatically renew Cloudflare credentials or change Garmin OAuth grants. Notification delivery depends on repository notification settings.

## Verification and operational state

- Synthetic local HTTP + PGlite + AES-GCM, worker and deployment tests: 58 passed before final presentation-only adjustments. Expiry boundaries: 1 passed.
- Focused UI/domain tests: 24 passed. TypeScript passed. Production build passed with existing font/chunk warnings.
- Chromium synthetic browser: setup, automatic saved-record view at 390px, and 200% text; no horizontal overflow or page errors. Screenshots are local under tmp/garmin-*.png, not real-user evidence.
- Applied only `20261105020000_garmin_autosave.sql` via named migration `garmin_autosave` to the previously authorized project. Live schema verifies the RPC exists, anon cannot execute it, existing connections default to REVIEW, and RLS remains enabled.
- No actual user health records were used in tests. No provider/runtime flags, stored credentials or existing encryption keys were changed by this implementation.

## Release and remaining activation

Apply DB migration before server, then client; leave feature switches off until the existing runtime configuration is complete. Roll back by disabling collection/worker/new connections, preserving stored data and schema. Do not drop the additive migration or rotate the old journal key to recover access.

Still required for actual use: secure existing journal key transfer, company receiver signing secrets and provider profile installation, runtime configuration/portal delivery verification, own-account OAuth and a real activity round trip. Full remote CI, runtime deployment and public receipts must be recorded separately; local build is not that evidence. AI use permission is unchanged. General account/public activation remains gated on the actual account round trip.
