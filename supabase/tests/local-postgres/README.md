# Local PostgreSQL Rehearsal

This package runs the repository migrations in an in-memory PGlite PostgreSQL instance.
It never accepts a database URL or reads credentials. It is separate from the app bundle.

```powershell
cd supabase/tests/local-postgres
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The dependency is pinned in package-lock.json. The plan-envelope suite loads migrations 0001 through
0031 unchanged, demonstrates that V6 is rejected, then executes the actual 0032 SQL.
It checks V3 preservation, V6 envelope roundtrip, malformed envelopes, owner A/B RLS,
anonymous access denial, duplicate-ignore semantics, archive filters and the feature guard.

Supabase-managed auth.users and JWT helper functions are synthetic bootstrap fixtures.
The application migrations, policies and triggers are not replaced with mocked equivalents.
This is not proof of real OAuth, PostgREST, multiple network connections, browser restore,
or production migration application. An empty selection in the synthetic payload tests the
SQL envelope only; it is not a valid executable training plan. Clients must still validate
the content fingerprint, retained evidence, dates and full semantic structure independently.

Each test file owns its disposable database; assertions within a file share that fixture.
No fixture survives close.
Do not change these tests to connect to an external database. The separate read-only preflight
SQL inspects live metadata; production DDL remains a separately approved action.

The database does not enforce immutable payloads for the same owner: direct UPDATE and
conflict-UPDATE remain possible under the current migrations. A characterization test makes
this limitation explicit. Duplicate-ignore preservation is the client's query behavior, not
a database-wide guarantee. Future server immutability hardening must revise this boundary
test rather than treating today's acceptance as a product requirement.

Tool reference: https://pglite.dev/docs/

## Shared lounge admission (default OFF)

`lounge-admission.test.mjs` applies the actual 0001–0041 migrations. It checks
current-user/session ownership, logout, expiry, first-wave account eligibility,
KST age boundary, current configured notice versions, account deletion and the
exact four-field private admission response. Supabase-owned auth tables and JWT
helpers alone are synthetic. It does not prove actual OAuth/PostgREST validation.

`lounge-grants.test.mjs` adds the actual 0042 migration. A general Supabase JWT
must stay within TrainOracle because it can contain email/metadata and account
API authority. The client calls `issue_lounge_grant()` using its existing SDK;
only the random lounge-specific proof goes to the lounge server. The server's
public project key can call `inspect_lounge_grant(grant_token)` but cannot read
account tables or ask for an arbitrary subject. No new password, signing key or
service-role key is supplied to the lounge.

The database stores only proof hashes, account/session references and issue/expiry
times. Proofs expire no later than the issuing JWT or eight hours. Actual session
or account deletion cascades; expired rows are removed by the existing daily
`purge_expired_beta_data()` entry point even while the lounge is disabled. Its
service-only permission and two-column return contract are preserved. A failed
cleanup is not deletion proof. The actual scheduled job must be checked before
activation; local SQL does not establish that the job is running in production.

The separate native PostgreSQL 17 test is:

```powershell
node ../concurrency/lounge-admission-native.test.mjs --pg-bin 'C:\Program Files\PostgreSQL\17\bin'
```

It creates only a fresh loopback cluster and synthetic accounts, accepts no
database URL or credentials, uses independent SQL connections and stops its own
cluster. Its retained synthetic files are not production backups. A native SQL
pass is not proof of live Supabase or a distributed logout/write transaction.

### Activation is a separate release step

- App: `VITE_LOUNGE_PUBLIC_ENABLED`, `VITE_LOUNGE_REALTIME_URL`,
  `VITE_LOUNGE_PAGE_URL`; omitted/false stays hidden. Use owned HTTPS origins.
- DB: 0041–0042 and `lounge_admission_controls`, initially disabled. Bind the
  actual approved current privacy/terms versions; do not infer a new consent or
  mark old users as having read the new purpose notice.
- Lounge server: explicit TrainOracle issuer enablement, this project's public
  key/URL and the correct link destination. No privileged key or general user JWT.
- New frontend requires the server's `trainoracleEntryEnabled === true`; older
  servers without that capability do not show active entry/link controls.
- Verify the public persistent-nickname/data-use notice, daily cleanup, actual
  two-service login/account switch/logout, provider latency/load, preview and
  exact-SHA CI before activation. The lounge settings do not enable ACCOUNT or
  change training/diary/health policies.

### Local verification checkpoint — 2026-10-01

- The complete maintained local-postgres package argument list, serialized with
  `--test-concurrency=1`, passed **208/208** on Node **24.11.1** (no skips/failures).
  This includes the new admission/grant SQL checks, not actual GoTrue/PostgREST.
- The separate PostgreSQL **17.6** rehearsal passed **16/16**, with independent
  connections, six observed advisory-lock waits, ownership/lock defect injection
  and restoration, session/account cascades, and OFF-state cleanup rollback.
  Its owned cluster stopped; no production database was accessed.
- Focused app admission/auth checks passed **98/98** on Node **22.17.1**. After
  the final default-closed information disclosure change, the two new app test
  files passed **66/66** again; installed TypeScript and a fresh Vite build passed.
  The same final two files also passed **66/66** on Node **24.11.1**, UTC.
  These are overlapping runs, not 164 distinct tests or a full app CI pass.
- The existing main run `36722595714` had a failing `app-quality` job before
  this integration. That release gate remains separate from these local results.
  No production migration, deployment, issuer activation or asset acceptance is
  implied. Cross-service profile erasure on source-account deletion and actual
  provider response headers/load still require end-to-end release verification.
