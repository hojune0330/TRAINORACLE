# Half Compatibility And Support Coverage

Scope: impact review sections 2 and 3. Local implementation only, 2026-10-03.
Existing dirty work preserved. No commits, deployment, DB access, credentials,
public settings/App edits, or generated validator writes.

## Owned Changes

- `app/src/domain/friend-running-oracle.ts`: permit exact 21097.5 alongside the
  existing integer >=60 distance contract. Read legacy 21097 losslessly; new
  snapshots use canonicalPaceDistance and compare both half representations as
  the same event. No broad fractional-distance permission. Consent and goal
  exclusion remain unchanged.
- `app/src/domain/friend-running-oracle.contract.test.ts`: canonical creation,
  legacy read/comparison in both directions, unsupported-distance rejection,
  no consent, mismatched consent, duplicate consent, and goal exclusion.
- `app/src/domain/account/oracle-comparison-half.contract.test.ts`: mock transport
  tests for public-profile/own/public readers and save validation. These are not
  live API, DB, or browser-rendering evidence.
- `app/src/screens/plan-beta/plan-support-coverage.ts`: canonical catalog matching;
  runtime recordPaceSegments and catalogRecordPaceModel determine calculation
  capabilities independently of legacy template methods and individual eligibility.
- `app/src/screens/plan-beta/PlanSupportCoverage.tsx`: show catalog pace count and
  source events alongside retained legacy methods; distinguish actual/goal,
  configuration counts/eligibility, explicit remaining-plan apply, protected
  history, and non-convertible sprint/hill work.
- `app/src/screens/plan-beta/PlanSupportCoverage.contract.test.tsx`: counts,
  capability boundaries and rendered copy. Half counts: NEW_TO_RUNNING 14,
  DEVELOPING 39, EXPERIENCED 109. Half RP IDs respectively INTRO, TIMED,
  and TIMED + DISTANCE. Existing four legacy baseline methods remain unchanged.

## Parent Follow-Up Required

1. Server sharing is direct Supabase table access, not the generated account
   validators. `supabase/migrations/0031_friend_oracle_comparison.sql:56` rejects
   every non-integer event distance in `oracle_comparison_snapshot_is_safe`.
   Add a NEW migration replacing that function with an exact 21097.5 exception
   to its integer check. Preserve >=60, strict keys, consent, RLS and all other
   checks. Do not rewrite the deployed migration or normalize historical rows.
   Run DB positive controls for 21097/21097.5/5000 and negative controls for other
   decimals, under-60 distances, missing consent, and private extra fields.
   Until that change is applied, canonical half publication still fails at DB.
2. `app/src/screens/PublicProfilePage.tsx:162` still selects same-event candidates
   by raw distance equality. Another owner is editing this file. Use
   canonicalPaceDistance on both sides there; otherwise a mixed-event record pool
   can fall back to a different event before reaching the fixed comparison helper.
   Verify a received legacy half + canonical own half + faster unrelated PB, and
   the reverse combination. No edits made here to that owner's screen.
3. No generated bundle regeneration is required by this owned schema change:
   called buildAccountStateValidator, buildAccountPlanCollectionValidator, and
   buildAccountJournalRecordValidator in memory (write:false); each metafile had
   zero friend-running-oracle/oracle-comparison-sharing/public-profile inputs.
   Other owners' changes may independently require regeneration. Generated
   files remain parent-owned and were not written by this task.

## Verification

Runtime: `C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`
reported `v24.19.0`. Commands run from `app` with that executable.

`node_modules/vitest/vitest.mjs run` with these five files passed 43/43, including
the final restored implementation at 12:13:48 local tool time:

- `src/domain/friend-running-oracle.contract.test.ts`
- `src/domain/account/oracle-comparison-half.contract.test.ts`
- `src/domain/account/public-profile.contract.test.ts`
- `src/domain/account/friend-oracle-sharing.contract.test.ts`
- `src/screens/plan-beta/PlanSupportCoverage.contract.test.tsx`

Mutation evidence: temporarily restored integer-only snapshot validation and
raw catalog distance equality. Named canonical creation/read tests failed (3);
canonical count tests failed for all three experience bands (13 vs 14, 38 vs 39,
107 vs 109), plus existing count/UI checks (10 failures total). Restored only
those two injected lines, then reran the passing 43-test suite.

`node_modules/typescript/bin/tsc --noEmit`: latest run failed only in an unowned
file, `src/screens/plan-beta/CatalogWorkoutPicker.contract.test.tsx:43`, TS2769:
`exact` is not a valid ByRoleOptions property. No owned-file diagnostics remain.
Concurrent work can change this observation; do not interpret it as a release gate.

Owned tracked-file `git diff --check`: passed. Full CI, build, browser layout,
real sharing API/DB, deployment and production verification were not run.
This is focused contract/UI-copy work; privacy-sensitive negative controls were
included. Full release validation remains with the parent.
