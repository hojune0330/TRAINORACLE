# personalized-auto-prescription - Work Plan

## TL;DR (For humans)

**What you'll get:** A runner can select a current same-event race result and receive a stored, reopenable session with exact repetitions, pace, recovery, warm-up, cooldown, downshift and stop rules. Middle/high-school athletes use the same training-eligibility rules as adults; age alone never blocks or changes the dose.

**Why this approach:** The existing same-event calculator and safety gate are reused. One fully evidenced 5000 m path is shipped first, then 800/1500/3000 m are added only after each exact template has its own source and executable gate, so one demo is never presented as universal personalization.

**What it will NOT do:** It will not loosen guardian/privacy/account rules, infer pace from another event, use goal pace as current ability, ingest raw memo text, or publish 100-400 m prescriptions.

**Effort:** XL
**Risk:** High - source adoption, minor/privacy separation, versioned storage, and safety-critical runtime binding must all agree.
**Decisions to sanity-check:** Youth inclusion is approved. Phase 1 is exact-current-5000 m only; 800/1500/3000 m activate individually after evidence. Existing quality-day frequency is preserved during phase 1.

Your next move: start work. Full execution detail follows below.

---

> TL;DR (machine): XL/high-risk phased delivery: align specs, harden manifest/components/storage, ship one atomic 5K PACE_TARGET path, then source and activate 800/1500/3000 templates.

## Scope
### Must have
- Separate `trainingEligibility` from `processingAuthorization`: age/school division is not a training rejection or dose multiplier, while existing account/sync/sharing/sensitive-data guardian and legal guards remain fail-closed.
- Amend active specs so approved SYSTEM templates may be selected by an athlete after all gates; coach-owned/tenant templates retain capability scope.
- Replace forgeable approval strings with a trusted manifest bound to template ID, version/content hash, population/event/experience scope, component versions, source/decision evidence, timestamps and revocation state.
- Resolve exact V2-SEED-05 semantics: `5×1000m @5000m RP`, `150 sec JOG`, approved warm-up/cooldown, downshift variants, stop conditions and derived totals.
- Require an explicit same-event CURRENT anchor. PB/SB/recent result provenance is stored; goal pace stays display-only.
- Bind exactly one existing eligible quality session in both candidates atomically. Any failure preserves both original RPE candidates.
- Persist detailed prescriptions in a versioned schema, migrate v1 plans non-destructively, and revalidate safety/manifest authority when starting or restarting a session.
- Show exact notation and plain Korean explanation in candidate and active-plan screens, with accessible details/help and no medical-clearance wording.
- Ship 5000 m first for youth and adults, then add 800/1500/3000 m only through separately evidenced template versions.
- Preserve D9 ACTIVE/UNKNOWN blocking and raw free-text exclusion.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No blanket minor prohibition, automatic youth downscaling, or sex/school-division-only multiplier.
- No relaxation of privacy, guardian, account, synchronization or sharing law/consent contracts.
- No cross-event/VDOT conversion, automatic fastest-record choice, stale/unknown anchor calculation, or goal pace as current capability.
- No runtime invention of repetition counts, recovery, warm-up/cooldown or reduced doses; variants are approved template versions.
- No bulk activation of all 30 research seeds, no 100-400 m prescription, and no claim that parser-ready means approved.
- No closure of historical review findings by rewriting old reports; record a superseding decision and keep evidence immutable.
- No raw memo, symptom, guardian narrative or medical text in prescription inputs/audits.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Vitest, Node contract validators and Playwright; every new gate begins with a failing mutation/contract test.
- Evidence: `<attemptDir>/task-{todo}-personalized-auto-prescription.*` (`attemptDir` = current attempt directory; outside ulw-loop use `.omo/evidence/`).
- Core commands: `npm --prefix impl test`, `npm --prefix impl run typecheck`, `npm --prefix app test`, `npm --prefix app run typecheck`, `npm --prefix app run typecheck:e2e`, `npm --prefix app run build`, and focused `npm --prefix app run test:e2e -- <spec>`.
- Document commands: existing detailed-catalog and activation validators plus new policy/manifest mutation tests; `[DRAFT_COMPLETE]` remains the final nonblank content where required.

## Execution strategy
### Parallel execution waves
- Wave 1: policy/spec alignment, trusted manifest, exact V2 components.
- Wave 2: storage/migration, candidate binding, athlete-facing evidence UX.
- Wave 3: 5K end-to-end release proof plus independent source packets for 800/1500/3000.
- Wave 4: accepted multi-event templates, readiness-qualified selection, full release proof.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 5, 8 | none |
| 2 | 1 | 3, 5, 9 | none |
| 3 | 1, 2 | 5, 7 | 4 |
| 4 | 1 | 5, 6, 7 | 3 |
| 5 | 2, 3, 4 | 6, 7 | none |
| 6 | 4, 5 | 7 | none |
| 7 | 3, 4, 5, 6 | 9, 10 | 8 |
| 8 | 1 | 9 | 7 |
| 9 | 2, 4, 7, 8 | 10 | none |
| 10 | 7, 9 | final wave | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Align specs and durable decisions around youth inclusion
  What to do / Must NOT do: Version and patch `specs/active/TEMPLATE_LIBRARY_SPEC.md` and the applicable training sections of `specs/active/PLAN_GENERATOR_SPEC.md` so age alone neither rejects nor modifies a training template. Define separate `trainingEligibility` and `processingAuthorization`; preserve all guardian/privacy/account/sync/sharing constraints. Allow athlete selection of approved SYSTEM templates after gates while retaining coach capability rules for coach/tenant templates. Create a new superseding decision report for the 2026-08-16 packet; do not rewrite historical evidence or falsely close unrelated issues.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3, 5, 8
  References (executor has NO interview context - be exhaustive): `.omo/drafts/personalized-auto-prescription.md`; `specs/active/TEMPLATE_LIBRARY_SPEC.md:140,343-400,447,507-517`; `specs/active/PLAN_GENERATOR_SPEC.md:198-214,369-373`; `specs/active/APP_IMPLEMENTATION_BRIDGE.md:319-329,674-678`; `reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md`; `reports/review/SPEC_TO_BETA_PERSONALIZATION_ALIGNMENT_AUDIT_2026-07-27.md:124-125`; IOC consensus `https://bjsm.bmj.com/content/49/13/843`; youth HIIT review `https://pubmed.ncbi.nlm.nih.gov/30100881/`; youth running consensus `https://pubmed.ncbi.nlm.nih.gov/33122252/`.
  Acceptance criteria (agent-executable): a validator fails on any age-only training rejection, passes when readiness/source/safety gates are present, and confirms guardian/legal text remains intact; metadata/open-issue counts are recomputed from the edited tables rather than copied from memory.
  QA scenarios (name the exact tool + invocation): Node mutation test changes a youth athlete to adult with identical readiness and proves the same training-eligibility result; a separate mutation removes required guardian authorization from sensitive server processing and must still fail. Evidence `<attemptDir>/task-1-personalized-auto-prescription.json`.
  Commit: Y | `docs(prescription): separate youth training eligibility from data authorization`

- [x] 2. Replace the forgeable approval array with a trusted template manifest
  What to do / Must NOT do: Extend the existing approval record rather than creating a second registry. Bind template ID, version, canonical content hash, eligible event/experience scope, population-applicability evidence, component version/hash set, source/decision IDs, reviewer role/qualification, decision timestamp, expiry/revocation status and manifest version. Remove unconditional `youthReview`; youth evidence belongs in population applicability and does not become an age gate. Production callers may only look up immutable records from this manifest; caller-supplied lifecycle/eligibility flags never grant authority.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 3, 5, 9
  References (executor has NO interview context - be exhaustive): `app/src/domain/detailed-prescription-approvals.ts`; `app/src/domain/detailed-prescription.ts:24-55`; `app/src/domain/pace-target-plan.ts`; `impl/src/prescription/types.ts`; `impl/src/prescription/runtime.ts`; `reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md:91-110,129-170`; `PRODUCT_NORTH_STAR.md:197`.
  Acceptance criteria (agent-executable): focused Vitest tests reject wrong hash/version, missing qualification/evidence, expired/revoked decision, out-of-scope event/experience and forged caller status; accepted exact manifest resolves once and is immutable.
  QA scenarios (name the exact tool + invocation): `npm --prefix app run test:unit -- detailed-prescription` plus mutation fixtures for tampered notation and revoked manifest. Evidence `<attemptDir>/task-2-personalized-auto-prescription.txt`.
  Commit: Y | `feat(prescription): bind activation to a trusted versioned manifest`

- [x] 3. Close V2-SEED-05 component and semantic gaps
  What to do / Must NOT do: Adopt one exact V2-SEED-05 version for `FIVE_K` and the recounted eligible experience scope. Preserve `5×1000m @5000m RP`, one set, five reps, 150-second JOG recovery and exact totals. Resolve versioned warm-up, cooldown, downshift variants and stop conditions from existing specs/research; missing components reject atomically. Do not invent a universal reduced repetition count at runtime and do not claim 5×1000 is appropriate for every experience band.
  Parallelization: Wave 1 | Blocked by: 1, 2 | Blocks: 5, 7 | Can parallelize with: 4
  References (executor has NO interview context - be exhaustive): `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md:708-739`; `specs/reconstruct/TRAINING_SESSION_PRESCRIPTION_CONTRACT.md`; `reports/review/V2_SEED_05_ACTIVATION_REVIEW_PACKET.md:28-110`; `impl/src/prescription/runtime.ts`; `impl/src/prescription/types.ts`; `impl/test/catalog-machine-notation.contract.test.ts`; `impl/test/prescription-runtime.test.ts`; `specs/test-packages/validate-detailed-prescription-catalog.mjs`.
  Acceptance criteria (agent-executable): parser, totals and component tests preserve JOG (never STAND), repetitions=5, qualityDistanceM=5000 and recoveryTotalSeconds=600; removing or changing any required component/hash fails activation.
  QA scenarios (name the exact tool + invocation): run detailed-catalog validators, `npm --prefix impl test`, and mutations for JOG→STAND, 5→4 reps, 150→120 seconds, missing warm-up/cooldown and missing stop code. Evidence `<attemptDir>/task-3-personalized-auto-prescription.json`.
  Commit: Y | `feat(prescription): resolve the exact 5k interval template`

- [x] 4. Add versioned detailed-prescription plan storage and migration
  What to do / Must NOT do: Promote the detached PACE_TARGET evidence shape into the QUALITY-session prescription union with template/component versions, manifest/evidence IDs, anchor provenance, rounding policy, recovery modes, totals, stop/downshift codes and fingerprint. Add a non-destructive v1→v2 migration for stored active plans. A stored snapshot is display state, not current authority; start/restart must recheck D9 and manifest revocation. Preserve existing plans and reject malformed/tampered payloads.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 5, 6, 7 | Can parallelize with: 3
  References (executor has NO interview context - be exhaustive): `app/src/domain/plan-session-schema.ts:24-82`; `app/src/domain/plan-beta-schema.ts:108`; `app/src/domain/plan-beta-pace-storage.contract.test.ts`; `app/src/domain/active-plan-storage.ts`; `app/src/domain/pace-target-plan.ts:48-75`; `app/src/domain/pace-target-evidence.ts`.
  Acceptance criteria (agent-executable): v1 RPE plans reload unchanged; v2 PACE_TARGET plans round-trip exactly; tampered fingerprints/components fail; a revoked template or D9 ACTIVE/UNKNOWN blocks start/restart without deleting the stored snapshot.
  QA scenarios (name the exact tool + invocation): focused Vitest storage/migration tests including v1 fixture, v2 fixture, corrupt fixture, revoked fixture and D9 mutation. Evidence `<attemptDir>/task-4-personalized-auto-prescription.txt`.
  Commit: Y | `feat(plan-storage): persist versioned detailed prescriptions`

- [x] 5. Bind one exact prescription into production candidates atomically
  What to do / Must NOT do: Reuse the current record/currentness conversion and detailed-prescription runtime. At generation time, resolve one explicit CURRENT 5000 m anchor and replace exactly one already-generated eligible QUALITY session in both BALANCED and CONSERVATIVE candidates. Add the prescription fingerprint to candidate identity. If anchor, authorization, manifest, component, event, experience or safety validation fails for either candidate, return both original RPE candidates with an explicit fallback code. Do not alter quality-day frequency in this task.
  Parallelization: Wave 2 | Blocked by: 2, 3, 4 | Blocks: 6, 7
  References (executor has NO interview context - be exhaustive): `impl/src/plan-generator/candidates.ts`; `impl/src/plan-generator/session-builder.ts`; `impl/src/plan-generator/types.ts`; `app/src/domain/pace-target-plan.ts`; `app/src/domain/detailed-prescription.ts`; `app/src/domain/athlete-records.ts`; `app/src/domain/pace-target-evidence.ts`; `app/src/screens/plan-beta/PaceEvidenceFlow.tsx`.
  Acceptance criteria (agent-executable): exact same inputs are deterministic; a valid 5000 m CURRENT anchor creates detailed prescriptions in both candidates; stale/unknown/cross-event/missing/revoked cases leave both candidates RPE-only; never one detailed and one RPE candidate. `D9_ACTIVE` and `D9_UNKNOWN` keep the stronger global invariant: production plan generation is blocked before candidates are exposed, while the lower-level binder remains atomic if exercised directly.
  QA scenarios (name the exact tool + invocation): focused impl/app Vitest contract cases for valid, stale, 1500m cross-event, forged status, revoked manifest, binder-level D9 atomicity, and production-level D9 ACTIVE/UNKNOWN zero-candidate blocking. Evidence `<attemptDir>/task-5-personalized-auto-prescription.json`.
  Commit: Y | `feat(plan-generator): bind atomic same-event pace prescription`

- [x] 6. Put explicit record choice and detailed instructions in the athlete flow
  What to do / Must NOT do: Integrate the existing PaceEvidenceFlow into real plan creation. The athlete selects PB/SB/recent result, confirms CURRENT, sees which result produced the pace, and may compare another current result without changing the chosen anchor. Candidate and active-plan views show notation plus plain Korean: total reps/distance, target time per rep, JOG recovery, warm-up, cooldown, RPE explanation, downshift and stop rules. Use accessible help icons/tooltips and semantic disclosure controls. Never auto-select fastest, imply medical clearance, or hide an RPE fallback.
  Parallelization: Wave 2 | Blocked by: 4, 5 | Blocks: 7
  References (executor has NO interview context - be exhaustive): `app/src/screens/plan-beta/PaceEvidenceFlow.tsx`; `app/src/screens/plan-beta/PlanCandidates.tsx`; `app/src/screens/plan-beta/ActivePlanCalendar.tsx`; `app/src/screens/PlanBeta.tsx`; `app/src/screens/plan-beta/labels.ts`; `app/src/domain/athlete-records.ts`; `app/src/domain/pace-target-evidence.ts`; `app/e2e/plan-beta.spec.ts`; frontend skill and existing visual conventions.
  Acceptance criteria (agent-executable): keyboard and touch users can select/replace a record, understand calculated pace and fallback, activate a candidate, reload and see the exact same prescription; text fits at 375×667 and desktop without overlap.
  QA scenarios (name the exact tool + invocation): Playwright Chromium at 375×667 and 1440×900 for valid 5K, missing record, stale record and D9 block; screenshots and accessibility assertions saved to `<attemptDir>/task-6-personalized-auto-prescription/`.
  Commit: Y | `feat(plan-ui): show evidence-backed detailed sessions`

- [x] 7. Prove and release the complete 5000 m personalized path
  What to do / Must NOT do: Add one end-to-end scenario from new/local athlete record through candidate generation, selection, persistence, reload and session start/restart authority checks. Exercise youth and adult division labels with identical readiness inputs and prove identical training eligibility/dose. Keep privacy/account guardian scenarios separate. Build and deploy only after all local and CI gates pass; capture source SHA and Pages deployment receipt.
  Parallelization: Wave 3 | Blocked by: 3, 4, 5, 6 | Blocks: 9, 10 | Can parallelize with: 8
  References (executor has NO interview context - be exhaustive): `.github/workflows/ci.yml`; `app/e2e/plan-beta.spec.ts`; `app/scripts/validate-hosted-release-env.mjs`; `runtime-evidence/d9-evaluator`; public URL `https://hojune0330.github.io/TRAINORACLE/`.
  Acceptance criteria (agent-executable): full impl/app/unit/typecheck/build/browser/D9/contract suite passes; deployed receipt source SHA equals reviewed main SHA; public browser produces and reloads the exact expected 5K session; console errors=0.
  QA scenarios (name the exact tool + invocation): run all CI-equivalent commands locally, then browser-control or Playwright against the public URL for youth/adult equivalence, stale fallback, revoked manifest and D9 blocking. Evidence `<attemptDir>/task-7-personalized-auto-prescription/`.
  Commit: Y | `test(release): prove personalized 5k prescription end to end`

- [x] 8. Build exact source-adoption packets for 800, 1500 and 3000 m
  What to do / Must NOT do: Recount current catalog and research materials, then use primary/official sources to define one same-event CURRENT-capability session per event with exact reps, distance, recovery mode/time, warm-up, cooldown, downshift, stop rules, population scope and transfer limitations. Separate observed/source protocol from TrainOracle adaptation. Update catalog entries and validators only after a source decision is explicit. Do not infer event formulas from VDOT/cross-event models and do not activate a template whose exact dose remains a range or coach-context placeholder.
  Parallelization: Wave 3 | Blocked by: 1 | Blocks: 9 | Can parallelize with: 7
  References (executor has NO interview context - be exhaustive): `specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md`; `reports/research/README_TRAINING_SCHEDULE_RESEARCH.md`; `reports/research/TRAINING_SCHEDULE_SOURCE_INDEX_2026-07.md`; `.ultra/docs/research/TRAINING_SCHEDULE_PUBLIC_SOURCES_2026-07.md` if present locally; `reports/review/DETAILED_PRESCRIPTION_PR_RECONCILIATION_RESULT.md`; `reports/review/PLAN_PRESCRIPTION_DETAIL_GAP_2026-07-26.md`; World Athletics and peer-reviewed primary sources.
  Acceptance criteria (agent-executable): each event packet identifies exact source lines/DOI/URL, population, adaptation, machine notation and unresolved limits; validators prove exactly one selected template per event and forbid ACTIVE status until every component/evidence field is complete.
  QA scenarios (name the exact tool + invocation): source URL/DOI reachability check, catalog parser tests, per-event notation mutations, count/hash validation and final-marker validation. Evidence `<attemptDir>/task-8-personalized-auto-prescription.json`.
  Commit: Y | `docs(prescription): adopt same-event templates for 800 to 3000m`

- [x] 9. Activate accepted 800/1500/3000 templates through the same runtime
  What to do / Must NOT do: Add only templates that passed Todo 8 to the trusted manifest and route them through the same anchor, safety, component, storage and UI path as 5000 m. Template eligibility chooses an approved version by event and experience; age/sex/school division never changes the dose. If multiple dose versions are needed, each is a separate approved template version. Do not add event-specific parallel engines or activate unsupported research seeds.
  Parallelization: Wave 4 | Blocked by: 2, 4, 7, 8 | Blocks: 10
  References (executor has NO interview context - be exhaustive): outputs of Todos 2, 4, 7, 8; `app/src/domain/detailed-prescription-approvals.ts`; `app/src/domain/detailed-prescription.ts`; `app/src/domain/pace-target-plan.ts`; `impl/src/plan-generator/candidates.ts`; `app/src/domain/plan-session-schema.ts`.
  Acceptance criteria (agent-executable): one valid CURRENT record for each supported event creates its exact approved session; each cross-event, stale, unknown, ineligible-experience or revoked case falls back atomically; no code path branches on minor status for training dose.
  QA scenarios (name the exact tool + invocation): table-driven Vitest tests across 800/1500/3000/5000, youth/adult labels, eligible/ineligible experience, cross-event and D9 states; Playwright smoke per event. Evidence `<attemptDir>/task-9-personalized-auto-prescription/`.
  Commit: Y | `feat(prescription): extend same-event plans to 800 1500 and 3000m`

- [ ] 10. Final multi-event release, documentation and handoff
  What to do / Must NOT do: Update README/product overview, spec index, implementation report and durable handoff with a plain-language support matrix: which events, records, experience scopes and template versions are live; what falls back to RPE; what remains deferred. Recompute all issue/count tables from files. Run all verification and deploy the reviewed main SHA. Do not claim universal coaching, medical clearance, unsupported events or closed issues without evidence.
  Parallelization: Wave 4 | Blocked by: 7, 9 | Blocks: final wave
  References (executor has NO interview context - be exhaustive): `README.md`; `PRODUCT_NORTH_STAR.md`; spec/document indexes; `reports/work-harness/NEXT_WORKER_HANDOFF.md`; `.github/workflows/ci.yml`; outputs/evidence from Todos 1-9.
  Acceptance criteria (agent-executable): support matrix matches manifest exactly; all tests/validators/build/browser scenarios pass; git diff is clean after commit; public deploy receipt matches reviewed main SHA and all supported events work on mobile and desktop.
  QA scenarios (name the exact tool + invocation): full CI-equivalent run, public browser matrix for 800/1500/3000/5000, one fallback and one D9 block, visual QA at mobile/desktop, zero console errors. Evidence `<attemptDir>/task-10-personalized-auto-prescription/`.
  Commit: Y | `docs(release): publish personalized prescription support matrix`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit: verify every Must have/Must NOT have against the exact final SHA and evidence ledger; reject unsupported claims or missing event gates.
- [ ] F2. Code quality/security review: inspect trust boundaries, manifest tampering, migration, raw-text exclusion, deterministic output and fail-closed branches.
- [ ] F3. Real manual QA: independently execute public mobile/desktop plan creation, record replacement, candidate selection, reload, fallback and D9 block for every supported event.
- [ ] F4. Scope fidelity: confirm privacy/guardian/legal protections were not weakened, 100-400 m stayed deferred, historical reports stayed immutable and no unsupported template became ACTIVE.

## Commit strategy
- Keep documentation policy, manifest/runtime, storage, generator, UI, source adoption, multi-event activation and release evidence in separate reviewable commits as listed above.
- Never mix a scientific source-adoption decision with production activation in the same commit. Activation consumes a prior accepted artifact/hash.
- Push a feature branch and open a draft PR; merge only after all CI checks and final independent reviews pass. Record the merge SHA and Pages receipt in the handoff.

## Success criteria
- A youth or adult 5000 m athlete with the same CURRENT 5000 m result and readiness receives the same exact approved 5×1000 m prescription; age/school division does not alter eligibility or dose.
- 800/1500/3000 m appear as supported only after their individual source/component/manifest gates pass; otherwise the UI honestly returns RPE guidance.
- Every detailed session preserves exact repetition, target time, recovery mode/time, warm-up, cooldown, totals, provenance, downshift and stop rules across generation, selection, persistence and reload.
- Stale/unknown/cross-event evidence, forged authority, revoked/expired manifest, missing component, ineligible experience and D9 ACTIVE/UNKNOWN all fail closed without producing half-detailed candidate pairs.
- Existing guardian/privacy/account/sync/sharing controls remain unchanged and their regression tests pass.
- Full CI and public browser QA pass at the deployed main SHA, with zero console errors and a durable deployment receipt/handoff.
