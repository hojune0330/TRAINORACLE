# Local PostgreSQL Rehearsal

This package runs the repository migrations in an in-memory PGlite PostgreSQL instance.
It never accepts a database URL or reads credentials. It is separate from the app bundle.

```powershell
cd supabase/tests/local-postgres
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The dependency is pinned in package-lock.json. The suite loads migrations 0001 through
0031 unchanged, demonstrates that V6 is rejected, then executes the actual 0032 SQL.
It checks V3 preservation, V6 envelope roundtrip, malformed envelopes, owner A/B RLS,
anonymous access denial, duplicate-ignore semantics, archive filters and the feature guard.

Supabase-managed auth.users and JWT helper functions are synthetic bootstrap fixtures.
The application migrations, policies and triggers are not replaced with mocked equivalents.
This is not proof of real OAuth, PostgREST, multiple network connections, browser restore,
or production migration application. An empty selection in the synthetic payload tests the
SQL envelope only; it is not a valid executable training plan. Clients must still validate
the content fingerprint, retained evidence, dates and full semantic structure independently.

Tests share one disposable database and execute in file order. No fixture survives close.
Do not change these tests to connect to an external database. The separate read-only preflight
SQL inspects live metadata; production DDL remains a separately approved action.

The database does not enforce immutable payloads for the same owner: direct UPDATE and
conflict-UPDATE remain possible under the current migrations. A characterization test makes
this limitation explicit. Duplicate-ignore preservation is the client's query behavior, not
a database-wide guarantee. Future server immutability hardening must revise this boundary
test rather than treating today's acceptance as a product requirement.

Tool reference: https://pglite.dev/docs/
