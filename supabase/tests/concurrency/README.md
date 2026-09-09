# Independent PostgreSQL Connection Tests

Opt-in native PostgreSQL tests for migration 0037. These supplement, not replace,
the single-session PGlite tests in `../local-postgres/`. No package changes or npm
installation are needed: only Node built-ins and native PostgreSQL binaries.
The existing `../local-postgres/package.json` `npm test` command includes both the
collection gateway handler tests and the three connection-guard tests. Native
concurrency stays opt-in; no workflow or dependency-lock change is required.

## Run On Windows

From the repository root:

```powershell
node --test supabase/tests/concurrency/local-postgres-guard.test.mjs
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin"
```

Without `--run`, the five database cases are explicitly SKIPPED, not passed.
`--pg-bin` must identify installed `initdb`, `pg_ctl`, `postgres`, and `psql` binaries.
Missing binaries/startup failures are failures, never simulated PostgreSQL passes.
On this Codex Windows host, `initdb` requires tool-approved execution outside the
restricted-token sandbox. Do not disable the sandbox globally or weaken permissions.
Windows can deny an otherwise probed high port; a failed startup is not a race
result. Inspect only the printed synthetic cluster's `server.log`, then rerun with
a new generated cluster if appropriate. There is no connection fallback.
The harness is currently verified on Windows; it must not run as a privileged
PostgreSQL service or reuse an installed service's data directory.

## Boundaries

- No database URL, production environment file, credential or existing database is
  accepted. Child processes have a fresh allowlisted environment, `psql -X -w`,
  and nonexistent task-local password/service-file paths.
- Every run creates a new temporary cluster and random
  `trainoracle_concurrency_test_<16 lowercase hex>` database. Numeric `127.0.0.1`
  is the only bind/connect address; a free high port is selected. Before creating
  the test database, the bootstrap connection verifies the server's exact new
  data directory, address, port and synthetic administrator identity. A port race
  fails startup; it does not fall back to another server.
- Only the initial provisioning connection uses the new cluster's `postgres`
  database. All fixtures/writers use the generated test database. No user database
  is truncated or dropped. Test reset truncates only this run's synthetic rows.
- Local trust authentication is limited to the loopback-only short-lived cluster.
  Other local OS processes can access it while running; use an isolated test host
  when local processes are untrusted. All contents and keys are synthetic.
- Sessions close and `pg_ctl stop -m fast -w` runs at teardown. Directories are
  deliberately retained and printed, never recursively deleted. A forcibly killed
  Node process cannot guarantee teardown; use the exact printed task-owned data
  directory to check/stop that cluster, never an installed service directory.
- Statement/lock/query deadlines bound failures. SQL errors are reduced to SQLSTATE
  for assertions; request bodies are not printed. Server statement logging is off.

## Evidence

The suite prints three distinct backend PIDs: observer and two writer connections.
It polls `pg_stat_activity` and `pg_blocking_pids`, requiring actual advisory-lock
waiting before releasing the blocker. Sleeps are polling intervals, not proof of
concurrency. Both writer queries must be in flight before the same-owner barrier
is released. Assertions also inspect persisted revisions, receipts and ciphertext.

| Case | Required result |
| --- | --- |
| `cas` | Initial and existing-index races: one commit, one conflict, one revision increment, no loser receipt, both staged payloads retained |
| `idempotency` | Concurrent identical operation: identical receipt, one revision; changed request rejected; late replay cannot rewind |
| `legacy-first` | Collection waits for uncommitted legacy write, then conflicts on changed source revision |
| `collection-first` | Legacy waits for uncommitted collection, then SQLSTATE 42501; original source unchanged |
| `isolation` | B finishes while A holds its transaction/lock; cross-owner part/receipt reads and signed requests denied; same UUID scoped by owner |

Bootstrap roles, `auth.users`, JWT helpers, consent rows, and synthetic AES-GCM/HMAC
fixtures follow `../local-postgres/account-plan-collection.test.mjs`. The 37 actual
repository SQL migrations are loaded without changes on normal runs. Auth helpers
simulate verified identity; they are not real Supabase JWT authentication. Synthetic
plan bodies deliberately cannot authorize a training prescription. This does not
validate PostgREST, real accounts, devices, production migrations, keys or recovery.

## Defect Injection

The optional mutations alter only the loaded SQL string inside a fresh test cluster,
never migration/runtime files. Each replacement must match exactly once. These runs
must FAIL the selected named test, not pass or be counted as successful product tests:

```powershell
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin" --case cas --mutation owner-lock
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin" --case idempotency --mutation replay
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin" --case legacy-first --mutation owner-lock
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin" --case collection-first --mutation owner-lock
node supabase/tests/concurrency/account-plan-concurrency.test.mjs --run --pg-bin "C:\Program Files\PostgreSQL\17\bin" --case isolation --mutation owner-read
```

Record actual command results separately from opt-in availability. Never relabel a
PGlite pass, a skipped test, or an expected mutation failure as a native race pass.
See [2026-09-08 execution results](RESULTS_2026-09-08.md) for observed results.
