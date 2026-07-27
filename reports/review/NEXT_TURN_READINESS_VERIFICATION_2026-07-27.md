# NEXT_TURN_READINESS_VERIFICATION_2026-07-27.md

```yaml
document_metadata:
  doc_id: trainoracle-next-turn-readiness-verification-2026-07-27
  title: Next Turn Readiness Verification From Main And Open PRs
  version: "1.0"
  status: READINESS_VERIFICATION_ONLY
  owner: COACH_HOJUNE
  recorded_at_utc: "2026-07-27T05:10:00Z"
  verified_main_head: "64d025f8b5da3a203700e18b21021b33c446b52e"
  source_of_truth: "locally executed commands, origin/main, and GitHub API state only"
  canonical_promotion_allowed: false
  numeric_template_activation_authorized: false
  issue_closure_claimed: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. What This Document Is

This is a **readiness record**, not a feature change. It exists so the next
turn can start work without re-deriving the state of `main`, the open PR
backlog, or the local toolchain.

It performs Section 8 of
[`CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md`](../../CURRENT_IMPLEMENTATION_HANDOFF_2026-07-27.md)
("First Five Actions For The Next Worker") and stops before Section 9, which
requires an owner decision.

It does **not** promote a draft SPEC, close an open issue, activate a numeric
template, or claim that any open PR is approved.

## 2. Verified Mainline State

| Item | Verified fact |
|---|---|
| `origin/main` head | `64d025f` — merge of PR #135 |
| Preceding merges | `843c90e` (#134 CI locator fix), `4eeb255` (#133 handoff) |
| Latest `main` Actions run | `30233551416` |
| `contract-tests` | success |
| `app-quality` | success |
| `app-browser` | success |
| `deploy-pages` | success |
| Public URL | <https://hojune0330.github.io/TRAINORACLE/> returns `HTTP/2 200` |
| Deployed asset timestamp | `last-modified: Mon, 27 Jul 2026 02:57:22 GMT` — consistent with the #135 run |
| Live page console | 0 messages, 0 errors; title `TRAINORACLE` |

The previously recorded conditional warning is therefore resolved for
`64d025f`. The live site corresponds to current `main`. A later commit still
requires its own CI and Pages result before any new deployment claim.

## 3. Locally Reproduced Verification

Every row below was executed in this sandbox on `64d025f`. None of it is copied
from a prior report or from remote CI.

| Scope | Command | Result |
|---|---|---|
| `impl` typecheck | `npm run typecheck` | PASS |
| `impl` tests | `npm test` | PASS — 8 files, **92 tests** |
| `app` typecheck | `npm run typecheck` | PASS |
| `app` unit tests | `npm test` | PASS — 34 files, **299 tests** |
| `app` production build | `npm run build` | PASS — 1790 modules, `index` 490.66 kB / gzip 143.09 kB |
| e2e `desktop-chromium` | `playwright test` | PASS — 32 passed, 9 skipped |
| e2e `mobile-chromium` + `touch-narrow` + `reduced-motion` | `playwright test` | PASS — 111 passed, 12 skipped |
| Detailed prescription catalog validator | `validate-detailed-prescription-catalog.mjs` | PASS — `30/30` inert draft entries |
| Training research acceptance validator | `validate-training-schedule-research-acceptance.mjs` | PASS — 60 public rows, 24 paper candidates, runtime authority disabled |
| Reasoning-tier harness | `reasoning-tier-harness.mjs validate` | PASS — 18 tasks, 3 stages, `runtime=false` |
| Local preview page load | vite preview on `:4173` | PASS — 0 console messages |

**Total executed: 143 e2e invocations, 391 unit/contract tests, 3 validators.**
All skips are declared viewport/routing guards in the spec files
(`launch-ready.spec.ts:239`, `touch-surfaces.spec.ts:12`,
`touch-targets.spec.ts:13`, `touch-targets.spec.ts:70`), not disabled tests.

### 3.1 Environment facts for the next turn

- Node `v22.23.1`, npm `10.9.8`. CI pins Node 24 — a version-specific failure
  would not necessarily reproduce here.
- `impl` and `app` dependencies are installed via `npm ci`.
- Playwright browsers were **not** preinstalled; `npx playwright install
  --with-deps chromium` is required in a fresh sandbox.
- `playwright.config.ts` uses `channel: "chrome"` when `CI` is unset, which is
  absent here. Run e2e as `CI=1 npx playwright test` in this sandbox.
- The preview server must be stopped before running e2e, otherwise Playwright
  aborts with `http://localhost:4173 is already used`.
- Supabase CLI, `psql`, and `SUPABASE_*` environment values remain unavailable.
  Migration `0002` still cannot be executed here — this is the fourth
  consecutive turn with the same blocker.

## 4. Open PR Backlog As Observed

20 PRs are open. `MERGEABLE`/`CONFLICTING`/check states were read from the
GitHub API, not assumed.

| PR | Branch | Draft | Merge state | Checks | Observation |
|---|---|---|---|---|---|
| #129 | `fable/merged-work-audit-erase-completeness` | no | `MERGEABLE` / `CLEAN` | all pass | Privacy fix: `trainoracle.sync.owner.v1` moved into `ACCOUNT_KEYS`; +7 delete-failure contracts |
| #128 | `fable/notation-input-tolerance` | no | `MERGEABLE` / `CLEAN` | all pass | Notation reader accepts `x`/`X`/`*` and curly quotes; +6 regressions; ships an open-PR triage report |
| #126 | `codex/journal-archive-stage1` | yes | `MERGEABLE` | only `contract-tests` ran | Held by #128's triage over a DERIVED-value provenance gap; base is not `main` |
| #114 | `codex/journal-revisit-flow` | no | `CONFLICTING` | stale pass | Last updated 07-24; touches 13 `app/src` files that main has since changed |
| #103 | `codex/account-backend-foundation` | yes | `UNKNOWN` | — | +4185 lines over an area #116 already shipped |
| #115 | `fable/plan-detail-workouts` | yes | `UNKNOWN` | — | Proposal superseded by merged #123 and #127 |
| #130, #121, #122 | research / planning | yes | `UNKNOWN` | — | Document tracks |
| #93, #98, #99, #101, #102, #104, #105, #107, #108, #110, #111 | WO017 and governance | mostly yes | mixed | — | Chained document PRs; oldest is 07-22 |

Two PRs (#129, #128) are non-draft, mergeable, fully green, and touch product
code. Both are **owner merge decisions**, not mine to make.

### 4.1 Reviewed but not merged

I read the actual diffs rather than the PR prose:

- **#129** removes `trainoracle.sync.owner.v1` from the "keep unless
  `includeDeletionRecord`" path and puts it in the always-erased set, leaving
  only the tombstone key behind. The stated rationale holds: the tombstone
  prevents server-side resurrection, whereas the owner key does not, so
  bundling them was over-broad. It also gives the device-handover lock an
  escape route in the failure message. Consistent with the erase promise shown
  on screen.
- **#128** normalizes only letter aliases (`x`, `X`, `*` → `×`, curly → ASCII
  quotes) and leaves digits and structure untouched, with `toStrictEqual`
  against the original fixture. Its own report flags two items it deliberately
  did **not** decide — an unbounded repetition count rendered as fact, and
  sprint race-pace being accepted by the reader while
  `impl/src/prescription/anchor.ts` returns `SPRINT_RACE_PACE_FORBIDDEN`.
  Both are training-domain judgments and correctly escalated.

## 5. Open Items Carried Forward, Unchanged

Nothing below was resolved by this turn. Counts are quoted from their source
documents; no recount or closure is claimed.

```yaml
still_blocking:
  OI-DSB-CALENDAR-CROSSWALK-001: no accepted DOUBLE/FLEX or civil-date mapping
  OI-DSB-SAFETY-HOLD-INTEGRATION-001: no accepted dated-calendar hold and recheck flow
  OI-DSB-TEMPLATE-ELIGIBILITY-001: no accepted source/eligibility/youth/anchor binding
  PERS-ALIGN-001: no ACTIVE catalogue entry; numeric UI must stay unavailable
  PERS-ALIGN-002: PLAN_GENERATOR_SPEC still says requiresCoachSelection true
  PERS-ALIGN-003: DOUBLE/FLEX unresolved upstream of the AM/PM display
  PERS-ALIGN-004: preparePrescriptionRuntime not bound to a Template Library record
must_remain_true:
  D9_ACTIVE: blocks_plan_generation
  D9_UNKNOWN: blocks_or_requires_human_review
  D9_CLEARED: not_medical_clearance
  explicit_PM_recovery: never_quality_and_never_catch_up
  numeric_template_catalog: 30_of_30_inert_draft_entries
  research_index_runtime_authority: disabled
  sub_60m_race_pace_conversion: forbidden
```

## 6. Decisions Required Before The Next Build Step

The handoff's Section 9 names the next product task — **one non-sprint
detailed-template activation packet** — but that task cannot start without an
owner choice. These are the questions, with no answer supplied by me.

1. **Merge or hold #129 and #128.** Both are green and code-affecting. Waiting
   raises the same rebase risk that already made #114 and #103 unmergeable.
2. **Which single event and experience scope** the template activation packet
   should cover. Bulk activation of the 30 draft entries remains forbidden.
3. **Notation reader upper bound** — leave unbounded, display an
   "outside a realistic session range" note alongside the parsed facts, or
   reject. (#128 §3-1)
4. **Sprint race pace** — should the reader match the runtime's
   `SPRINT_RACE_PACE_FORBIDDEN`, or is the reader correct to parse what the
   athlete typed? (#128 §3-2)
5. **`Trends.tsx` provenance** — fix the unguarded distance sum now, or when
   device import formally opens. This is pre-existing, not introduced by #126.
6. **WO017 document chain (11 PRs)** — continue the track or close it.
7. **Migration `0002`** — still unexecuted; it needs credentials this sandbox
   does not have.
8. **The four launch questions** in `LAUNCH_READINESS_2026-07-25.md` §5: launch
   scope, contact point, launch date, first users.

## 7. What This Turn Did Not Do

- No application or spec source file was modified. The only added file is this
  report.
- No PR was merged, closed, rebased, or re-based onto `main`.
- No open issue was recounted or closed, and no draft was promoted.
- No numeric template was activated and no runtime authority was enabled.
- Mobile-viewport manual browser walkthrough of the *live* site was not
  repeated; the equivalent flow is covered by the passing `mobile-chromium` and
  `touch-narrow` e2e projects against the production build of the same commit.
- The content of #103, #101, and #107 was not reviewed line by line; they were
  confirmed to be document-only tracks.

## 8. Reproduction

```bash
git fetch origin --prune
git checkout 64d025f

(cd impl && npm ci && npm run typecheck && npm test)
(cd app  && npm ci && npm run typecheck && npm test && npm run build)

node specs/test-packages/reasoning-tier-harness.mjs validate
node specs/test-packages/validate-detailed-prescription-catalog.mjs
node specs/test-packages/validate-training-schedule-research-acceptance.mjs

cd app
npx playwright install --with-deps chromium
CI=1 npx playwright test            # stop any :4173 preview first
```

[DRAFT_COMPLETE]
