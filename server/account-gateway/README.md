# Optional company Node account journal gateway

This is the existing account-journal endpoint hosted on a company-controlled Node
runtime for bounded large FILE corrections. It is not a second database, migration,
provider API, upload archive, or alternate authorization system. It defaults OFF.

`POST/OPTIONS /api/account-journal` is mounted by the existing
`node server/garmin-integration/deployment.mjs` entrypoint. Garmin and account flags
are independent; Garmin can remain OFF. The preparatory Render Blueprint also
sets `TRAINORACLE_ACCOUNT_GATEWAY_ENABLED=false` and contains no account keys.

When explicitly enabling this route, the operator uses the **same** protected
configuration as the existing Supabase account-journal Edge function:

- `SUPABASE_URL`: the same existing project, HTTPS exact origin.
- `SUPABASE_ANON_KEY`: the project's publishable or legacy anon key. Secret and
  service-role keys are rejected here, even though the Garmin worker separately
  uses a scoped service-role relay. This route never receives that relay key.
- `TRAINORACLE_JOURNAL_KEYRING_JSON`: existing journal key IDs/keys, unchanged.
- `TRAINORACLE_JOURNAL_ATTESTATION_JSON`: existing journal attestation key, unchanged.
- `TRAINORACLE_JOURNAL_ALLOWED_ORIGINS`: exact approved browser origins.
- `TRAINORACLE_ACCOUNT_GATEWAY_ENABLED=true`: deployment-only route enablement.

The matching browser setting is `VITE_ACCOUNT_JOURNAL_GATEWAY_URL` with an exact
HTTPS URL ending `/api/account-journal`, without credentials/query/fragment.
When absent, the existing Supabase function route remains in use. An unavailable
configured Node route does not cause an automatic resend through another host;
the original operation ID and pending draft remain the retry source. Do not
misrepresent a timeout as proof the database did not commit.

The same `createAccountJournalHandler`, journal repository and plan-collection
repository execute the existing validation, optimistic revision checks, source
review, encryption, attestation, history, restoration and final permission checks.
The small REST adapter implements only their used select/filter/RPC calls; it has
no table write API, arbitrary URL, caller-provided RPC name, or service-role path.
It sends `apikey` plus the verified caller's bearer JWT and the **original**
`x-trainoracle-storage-revision` to each database call. `/auth/v1/user` verifies
identity; existing SQL checks current session, account eligibility, consent and
row ownership. No user metadata becomes authorization.

The constructor alone selects `runtimeBudget: COMPANY_NODE`. Clients cannot
request that profile. Its capability advertises 3,500,000 document/correction
bytes; Edge advertises the smaller measured correction budget. Both retain the
400 KiB compressed and 655,360-byte HTTP envelope bounds. Client capability checks
must honor the selected endpoint's effective limit. A Node process removing the
Edge CPU restriction does not promise unlimited file size or processing speed.

No payload, bearer token, configuration value or raw error is logged. Responses
retain no-store, exact CORS origins, and the existing error contract. The process
uses memory for bounded decoding and existing Supabase ciphertext for durable
data; it writes no health files or alternate local database. `/healthz` reports
accountGateway DISABLED or CONFIGURED_UNVERIFIED, never account-storage success.

Host/operator/region/retention approvals and real-account verification remain
external prerequisites. A free preparatory host is not a claim of live-service
availability. Restore routing only to a codec-compatible reader; never erase
consent, rotate away required keys, drop rows, or modify RLS as rollback.

Focused command (synthetic local HTTP + existing complete PGlite migration chain):

```text
node --test server/account-gateway/service.test.mjs server/garmin-integration/deployment.test.mjs
```

The test creates a synthetic four-hour TCX with 14,400 samples, uses the real
company HTTP adapter and journal handler, commits AES-GCM payloads through the
actual attested SQL RPC, corrects and reads the source, and loses one commit ACK
before retrying the same operation. It also checks origin/default-OFF rejection,
cross-owner denial, revoked session, stale consent and synthetic erasure. CPU/wall
measurements include the local test's HTTP/database execution and are not hosted
performance guarantees. No live Garmin or Supabase account is used.

Observed on 2026-11-04 with Node 24.22.1: seven account/deployment tests passed.
The 3,383,337-byte synthetic document saved in 1,531 ms wall / 1,875 ms process CPU;
its correction with a deliberately lost commit ACK took 3,911 ms wall / 4,813 ms
process CPU. Retrying the same operation returned revision 2; readback retained
all 14,400 samples and the exact replacement observation. These process CPU
figures include the local HTTP/PGlite test stack and concurrent runtime work;
they demonstrate the Node fallback path, not an Edge CPU-budget pass.

Public-key + user-JWT role behavior was checked against the current official
[Supabase API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys)
on 2026-11-04. Existing repository/RPC contracts were reused; no new Supabase SDK,
database object or elevated grant was introduced.
