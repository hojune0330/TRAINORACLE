# Company-hosted Garmin integration candidate

This is a runnable authenticated service and PostgreSQL candidate, not a deployed
Garmin integration or evidence of app-specific Garmin permission. Actual Starter
OAuth2 and PUSH wire adapters were implemented after the owner obtained the issued
OAuth2 PKCE 2.0, Activity API 2.1 and Starter 2.0 documents on 2026-11-04. The
confidential documents are not copied into this repository. No live database, key,
flag, webhook, account or remote endpoint was changed to develop this candidate.

The service defaults OFF. `garmin-starter.mjs` fixes the documented authorization,
token, user ID, permissions and DELETE-registration endpoints. Default OAuth
scopes are fixed by Garmin and are **not** Activity permission. ACTIVITY_EXPORT
must separately be present in `/user/permissions`. The deployed profile loader
accepts STARTER only; the protocol-neutral adapter remains for focused synthetic
testing. No PING/PULL or historical access is enabled. Starter limits and provider
domain review are external prerequisites, not bypassed by local tests.

## What is implemented

- Verified Supabase bearer identity plus independently checked live `auth.sessions`,
  owner and storage-consent revision in SQL. Authenticated users have no direct
  table access; the company runtime must also sign a short-lived scoped proof.
- Single-use, session/owner/connection-epoch-bound encrypted PKCE state; bounded
  token/subject HTTP calls; exact scope matching; redirect rejection. Access and
  refresh credentials are AES-GCM encrypted under a separate provider keyring.
- Refresh lease and credential CAS. An ambiguous rotation requires reconnect,
  rather than reusing a refresh token whose outcome is unknown.
- A test/development company-internal normalized event endpoint with a separate HMAC key and
  freshness window. This is **not Garmin's public push endpoint**. Its sender
  must first authenticate the actual vendor message using the issued contract,
  bind provider subject/connection epoch, and attest monotonic activity revision.
  It is disabled for the actual Starter profile, which instead uses the issued
  PUSH format and never invents a semantic revision from arrival order.
- Actual PostgreSQL event deduplication, out-of-order suppression, same-revision
  conflict handling, source tombstones, owner isolation and deletion handling.
  Duplicate events return the durable ACK. Reusing an event ID with different
  content is rejected. Updated already-confirmed data requires review and never
  edits a previously confirmed journal automatically.
- Authenticated encrypted inbox/parts read; a final epoch recheck after decryption.
  Up to 100,000 allowlisted samples, 32 bounded encrypted parts; exact part hashes.
  Unsupported fields, raw notes, arbitrary provider JSON and unapproved route
  fields cannot be stored through the normalized endpoint.
- Explicit confirmation builds a minimal existing V2 journal document from the
  exact server-held source revision. Existing journal validation, AES encryption,
  HMAC gateway, consent and CAS are reused. The journal write and inbox ACK occur
  in **one database transaction**. Lost HTTP ACK retry with the same operation ID
  returns the durable receipt. Detail remains separate from the journal body.
- Imported summaries use `DERIVED` / `import:provider-activity`; no fake TCX or
  FILE_UPLOAD source, pace, RPE, safety answer, plan completion or AI grant is made.
  `analysisEligible` remains false. Existing provider source and purpose-specific
  AI permission policy remain separate.
- Disconnect invalidates the epoch before any remote HTTP work, then immediately
  attempts the issued DELETE-registration call. Failure is explicitly reported as
  remoteRevocationPending and retained in an encrypted retry outbox while account
  storage consent remains active. Already-saved journals are retained. A pending
  remote DELETE blocks reconnect so delayed cleanup cannot remove a new grant.
- Existing storage-consent withdrawal is destructive by design. A new narrow
  trigger erases this candidate's inbox, detail, pending state, outbox and token
  material too; it does not replace or weaken the existing erasure trigger.

## Browser contract

`POST /api/garmin-integration`, JSON, `Authorization: Bearer <access token>`,
`x-trainoracle-storage-revision: <the revision the user approved>`. No cookies.
All responses are `Cache-Control: no-store`; exact configured CORS origins only.
Every success includes `schemaVersion: "GARMIN_INTEGRATION_V1"`.

| Request action | Extra request fields | Result |
| --- | --- | --- |
| `status` | none | capability `{enabled,reason}`, connection `{state,epoch,lastSyncAt}`, pendingCount |
| `connect` | none | authorizationUrl, state, expiresAt |
| `complete` | code, state | connection |
| `refresh` | none | connection |
| `inbox` | optional cursor UUID | items (20 maximum), nextCursor |
| `read` | documentId UUID | item linked to this owner's journal |
| `detail` | inboxId, expectedRevision, partIndex | inboxId, revision, partIndex, sha256, sampleCount, samples |
| `confirm` | inboxId, expectedRevision, operationId UUID | kind `saved`/`already_confirmed`, documentId, journalEntryId, revision, date |
| `dismiss` | inboxId, expectedRevision, operationId UUID | kind `dismissed`, inboxId, revision |
| `disconnect` | none | connection, remoteRevocationPending |

Inbox items contain `inboxId, revision, state, provider, observation, documentId,
detailManifest, clock, source`. Clock is null or `{basis:"DEVICE_OFFSET",
offsetSeconds,localDate}`. Source is null or `{manual,parent:{isParent,
parentSummaryId},summaryId,lapStartOffsetsSeconds}`. Observation is `PREPARED_DEVICE_ACTIVITY_V1`, with verified
GARMIN/PROVIDER_API lineage and `analysisEligible:false`; deleted items have null
observation. `ACTIVE` means token/subject binding succeeded, not that a workout
arrived. Only a committed event updates `lastSyncAt`.

The browser callback must clear code/state from its URL before telemetry or
navigation, use its existing authenticated account, and call `complete`; the
server does not accept an unauthenticated browser callback. It cannot bind a
different session or owner even if that browser has the correct state string.
The configured exact redirect URI must match the implemented callback route.

Fixed error envelopes are `{error:<code>}`. 401 AUTH_REQUIRED; 403 ACCESS_DENIED;
409 SOURCE_CHANGED, CONNECTION_CHANGED, CONSENT_CHANGED, REVIEW_REQUIRED,
OPERATION_CONFLICT, OAUTH_RESTART_REQUIRED, PROVIDER_ACCOUNT_ALREADY_BOUND,
ALREADY_CONNECTED, REVOKE_PENDING, PROVIDER_PERMISSION_REQUIRED, BUSY, EVENT_REUSED; 422 INVALID_INPUT / INVALID_OBSERVATION /
INVALID_DETAIL / DETAIL_PERMISSION_REQUIRED; 413 TOO_LARGE; 502
PROVIDER_UNAVAILABLE / PROVIDER_RESPONSE_INVALID / PROVIDER_SCOPE_MISMATCH; 503
OPERATIONS_PENDING / PROVIDER_CONFIGURATION_PENDING / JOURNAL_CONTRACT_UNAVAILABLE /
ENCRYPTED_DATA_UNAVAILABLE. Unknown errors expose no raw provider/database values.

## Actual Starter PUSH route and worker

`POST /webhooks/garmin` accepts only documented `activities`, `activityDetails`,
`manuallyUpdatedActivities`, `userPermissionsChange` and `deregistrations` lists.
PUSH must additionally be enabled with `TRAINORACLE_GARMIN_PUSH_ENABLED=true`.
Only the documented source CIDRs are accepted. `garmin-client-id`, if supplied,
must match this app; it is public routing metadata and is never treated as a
secret or a signature. The issued PUSH section did not establish cryptographic
payload signatures; the service does not invent them or claim that IP filtering
provides a signed-body guarantee.

The handler uses the TCP peer address. A forwarded IP is considered only when that
peer exactly matches `TRAINORACLE_GARMIN_TRUSTED_PROXY_ADDRESSES` (comma-separated).
That company proxy **must overwrite** `x-trainoracle-peer-ip` with its verified
upstream peer, reject arbitrary forwarded chains, use TLS, and prevent direct
public access to the Node port. The default trust list is empty; localhost is not
automatically trusted. Review this deployed ingress boundary before registration.
Do not invent a Garmin shared-secret header from the internal relay protocol.

Allowed vendor fields are minimized and encrypted into durable jobs, bound to
the resolved owner/connection/epoch. Only then does ingress return HTTP 200;
normalization and journal processing happen afterward. Unknown/unlinked subjects
are ignored without storing their health payload. Activity names/descriptions,
tokens, callback URLs and unknown fields are not retained. A response failure
allows vendor retry; the durable job identity makes identical retries harmless.

The company worker calls signed `POST /internal/garmin/process` with `{}`. One
leased job is processed per call; run the worker scheduler after deployment and
observe terminal job/receipt state. No scheduler is installed by this code. HTTP
200 receipt alone is not a parsed activity or a saved journal. Conflicting
observations retain their encrypted minimal job for explicit review. Transient
failures release through lease expiry and can safely retry the same job.

Garmin PUSH has no documented semantic source revision. Exact content duplicates
reuse existing data; different summaries become CONFLICT, not last-write-wins.
Identical summary facts may gain previously absent detail as a new local storage
revision. An already-confirmed journal is never overwritten. Device time offsets
are retained as reported clock metadata, **not an inferred IANA time zone**.
Observation instant stays UTC; confirmation uses the displayed device date with
its explicit label. Generic monitoring duration remains UNKNOWN; separate timer,
moving and clock counters remain distinct when those fields are allowed.

Permission-removal notices close local access. Added permission notices do not
reactivate an ERROR/REVOKED connection without a new authenticated permission
check. Older permission notices do not supersede a newer change time. Untimestamped
deregistration is conservatively treated as a revocation of the current subject
binding, including after reconnect; another explicit connection may be necessary.
This prevents continued collection when generation cannot be proven.

Activity Files (tokenized one-time callback download), MoveIQ, unsupported sport
specific values and individual activity-deletion notifications are not invented.
Register only implemented feeds. Activity Files download/rate-limit handling is
not implemented here. The generic internal deletion tests prove local tombstone
behavior, not a claim that Garmin emits a particular deletion feed.

## Normalized development relay protocol

`POST /internal/garmin/events` is company-internal only (restrict it additionally at
the reverse proxy). Body: `{eventId,connectionId,epoch,subject,activityId,revision,
kind:"UPSERT"|"DELETE",observation,detail}`. DELETE requires null observation/detail.
The signed message is `<unix milliseconds>\n<path>\n<canonical JSON body>` using
HMAC-SHA256; headers are `x-trainoracle-relay-timestamp` and
`x-trainoracle-relay-signature`. Canonical JSON recursively sorts object keys and
preserves array order. These names are our internal protocol, never claimed to
be Garmin's required headers. Retry the exact event after a timeout; stable event
ID is mandatory. Network receipt is acknowledged only after durable SQL commit.

Observation fields: provider GARMIN, sourceId, nullable sourceVersion, sport,
offset-bearing startedAt, IANA timeZone, nullable distanceMeters/durationSeconds,
durationMeaning TIMER/MOVING/ELAPSED/UNKNOWN and bounded laps. Time meaning and
sport are never pooled or guessed. Detail is an array of monotonic offsetSeconds
and explicitly approved optional heartRateBpm, powerWatts, cadenceSpm,
speedMetersPerSecond, altitudeMeters, latitude, longitude (numbers or null).
Optional explicit counters are timerSeconds, clockSeconds, movingSeconds,
totalDistanceMeters; cadence units remain bikeCadenceRpm/swimCadenceSpm separately,
and temperature is airTemperatureCelsius. These fields also require the profile's
allowlist; no zero is substituted for missing samples.
No model/inference/train/evaluation/log/cache API exists here.

`POST /internal/garmin/revocations` with signed `{}` retries at most ten pending
revocations. Run it from an owner-controlled worker scheduler; the service does
not install a background job or imply one is already running. Failed remote
revocation stays pending. After storage erasure no credential is retained solely
to retry a remote API; provider-side disconnection may then require the provider
account interface.

## Runtime and review prerequisites

Run `node server/garmin-integration/service.mjs` on a supported Node release with
WebCrypto/fetch (the local suite uses the installed Node runtime). It binds only
`127.0.0.1`, port 8789 by default, behind a company TLS reverse proxy. Do not log
authorization headers, request bodies, OAuth callback queries or response bodies.
No dependency was added; the runtime uses Node and existing journal modules.

Runtime-only environment variables (values are never printed by this service):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`; the relay also needs the existing protected
  server `SUPABASE_SERVICE_ROLE_KEY`, never a browser value.
- `TRAINORACLE_GARMIN_ENABLED=true` is an additional switch, default false.
- `TRAINORACLE_GARMIN_ALLOWED_ORIGINS` exact HTTPS origins, comma-separated.
- `TRAINORACLE_GARMIN_ATTESTATION_JSON`: `{keyId,key}` 32-byte base64 HMAC key with
  matching RUNTIME scope. `TRAINORACLE_GARMIN_RELAY_ATTESTATION_JSON` must use a
  different RELAY-scoped key. No keys are inserted by the schema candidate.
- `TRAINORACLE_GARMIN_VAULT_JSON`: `{activeKeyId,keys:{keyId:base64AES256}}`.
  Keep old decryption keys while referenced ciphertext exists.
- `TRAINORACLE_GARMIN_IDENTITY_KEY` and `TRAINORACLE_GARMIN_RELAY_HTTP_KEY`: separate
  base64 32-byte HMAC keys. Identity key rotation requires a planned mapping
  migration; never silently swap it and create new logical records.
- Existing `TRAINORACLE_JOURNAL_KEYRING_JSON` and
  `TRAINORACLE_JOURNAL_ATTESTATION_JSON` are needed only for confirmation.
- `TRAINORACLE_GARMIN_REVIEWED_PROFILE_JSON`: `{accessLevel:"STARTER",
  evidenceReference,validUntil,clientId,clientSecret,redirectUri,
  allowedDetailFields:[]}`. The adapter fixes issued URLs, raw Basic client
  authentication, fixed default scopes, separate ACTIVITY_EXPORT permission and
  conservative no-source-revision handling. The current web client requires the
  exact callback URL to include `?garmin_callback=1` (for the canonical origin,
  `https://trainoracle.io/?garmin_callback=1`). This separates Garmin codes from
  Supabase login codes; no arbitrary return URL is accepted.
- `TRAINORACLE_GARMIN_PUSH_ENABLED` and the pinned proxy list described above.

Before activation, compare the actual deployed existing journal gateway, auth,
consent/RLS definitions and generated journal validator with this candidate. The
source test chain does not prove hosted equivalence. Review this additive SQL,
generate the repository's real migration using `supabase migration new`, apply
only the exact reviewed delta to the authorized project, and record its receipt.
Never bulk-push 0051–0058 or assume those historical migrations are absent.

Approval requires a server-owned `garmin_integration_controls` row with the exact
adapter `configHash` (SHA-256 of expanded canonical protocol profile excluding
clientSecret and the separately enforced evidenceReference/validUntil), explicit evidence,
approved=true and a future validUntil, plus current ACCOUNT/account storage and
ACCOUNT_JOURNAL_V2/DEVICE_INTEGRATION gates. Synthetic test approval rows are not
evidence and must never be copied to a hosted database.

Recovery is to turn off new import capability and retain compatible reader,
schema, ciphertext, receipts and keys. Use additive forward repair for schema
issues. **Do not set account consent false to roll back**: existing and candidate
triggers erase account data. Do not drop/recreate tables or weaken RLS/ACLs.

Uncompleted operational requirements are real app/client issuance, exact redirect
and company ingress deployment/review, protected runtime keys and profiles,
additive SQL application, worker scheduling, actual user permission and a real
provider-to-account round trip. Starter has no historical/PING access; no such
client is implemented. Resolving
already-confirmed source conflicts is a separate explicit review UI flow; this
version preserves them and refuses overwrite. No adaptive AI coaching or plan
adjustment is enabled by Activity access.

Account consent withdrawal and `request_account_deletion` use the existing 0058
transaction: its consent change invokes the new erasure trigger immediately,
before a later auth-user deletion. Credentials and retry outbox are erased, so
remote Garmin DELETE cannot be retried afterward. Local REVOKED therefore means
TrainOracle has stopped collection, not proof Garmin has removed its permission.
The account UI must distinguish these and direct the user to Garmin Connect's
account-information application permissions when remote removal is unconfirmed.
This candidate does not reorder the existing account-deletion UI. An expired
access token or remote outage can leave disconnect pending; do not claim remote
success, and do not keep credentials through purpose erasure solely for retries.

## Explicit company worker CLI

`worker.mjs` is an executable polling loop, not an installed operating-system
service or a registered schedule. Nothing starts on import or on the default
configuration. Run a single worker instance alongside the local company service
only after the deployment and permission prerequisites above are satisfied:

```text
node server/garmin-integration/worker.mjs
```

The operator supplies `TRAINORACLE_GARMIN_WORKER_ENABLED=true` and the existing
protected `TRAINORACLE_GARMIN_RELAY_HTTP_KEY` through the runtime environment.
There is no URL/host option: native Node HTTP connects only to `127.0.0.1`, ignores
proxy environment settings, never follows redirects, and signs only the two fixed
`/internal/garmin/process` and `/internal/garmin/revocations` paths. The worker does
not receive Supabase tokens, service-role credentials, Garmin client secrets or
activity payloads. The HMAC key itself is never transmitted.

Optional environment settings are bounded:

| Setting | Default | Allowed range |
| --- | --- | --- |
| `TRAINORACLE_GARMIN_WORKER_PORT` | 8789 | 1–65535; must match the local service |
| `TRAINORACLE_GARMIN_WORKER_PROCESS_INTERVAL_MS` | 5000 | 1000–60000 |
| `TRAINORACLE_GARMIN_WORKER_REVOCATION_INTERVAL_MS` | 60000 | 60000–1800000 |
| `TRAINORACLE_GARMIN_WORKER_REQUEST_TIMEOUT_MS` | 30000 | 1000–30000 |
| `TRAINORACLE_GARMIN_WORKER_MAX_BACKOFF_MS` | 300000 | 60000–1800000, at least both polling intervals |
| `TRAINORACLE_GARMIN_WORKER_MAX_RUN_MS` | 86400000 | 1000–604800000 |

Calls are sequential and awaited. Each task has its own schedule and exponential
failure backoff, capped by the configured maximum; a failed processing call does
not prevent a due revocation call. Success resets that task's backoff. Requests
have a total deadline and a 4 KB response limit. Responses must match the narrow
aggregate-count schema; arbitrary bodies or errors are neither accepted nor
logged. Logs contain only fixed event/task codes and validated aggregate counts.
Idle success polls do not produce repeated progress logs.

SIGINT/SIGTERM cancels an active request or sleep and stops scheduling. The whole
run also ends at its configured deadline; this code does not register a restart
policy. `--once` attempts each route once and exits with nonzero status if either
attempt failed. With the enable flag absent it prints `WORKER_DISABLED`, performs
no network calls and exits successfully. A timed-out call has an unknown remote
outcome; the existing durable job/receipt semantics handle retries. Do not run
multiple copies or treat the worker's existence as evidence that the deployed
queue is being drained.

The implementation and tests do not start an operational worker, install a
service, schedule a task, enable provider access or change database flags.

## Focused verification

`node --test server/garmin-integration/service.test.mjs server/garmin-integration/worker.test.mjs`

Tests use the existing pinned `@electric-sql/pglite` from
`supabase/tests/local-postgres`, execute the existing 0001–0062 migrations plus
this candidate, and use real numeric-loopback HTTP and AES-GCM. They are not a
real Garmin or hosted account round trip. On this workstation sandbox loopback
was denied EACCES; the exact test command was permitted outside that sandbox.

Official Supabase docs checked for this work (2026-11-04):
[changelog](https://supabase.com/changelog),
[database functions](https://supabase.com/docs/guides/database/functions),
[active session binding](https://supabase.com/docs/guides/auth/sessions).
The markdown changelog fetch returned unsupported content type; the official HTML
index was used. No new Supabase SDK/API convention or deprecated auth.role()
authorization was introduced. Local date projection uses IANA time zone data in
Node; deploy with maintained runtime/tzdata and verify any vendor-local timestamp
contract rather than relying on a fixed offset.
