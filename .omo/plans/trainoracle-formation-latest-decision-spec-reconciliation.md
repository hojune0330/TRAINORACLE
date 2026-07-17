# TRAINORACLE Formation Latest-Decision Spec Reconciliation Plan

## TL;DR

> **Summary**: Publish the completed research-preparation package, then create one bounded
> reconciliation PR that connects the latest owner baseline and research artifacts to the existing
> ten P1 plans without approving them, resolves documentation-only conflicts, and prepares the two
> remaining decision/human gates. Canonical spec patches and runtime work remain separate.
>
> **Deliverables**:
> - Draft research PR from `codex/formation-followup-research-plan`
> - Research-to-P1 reconciliation matrix for all 10 plans and all 12 conflicts
> - Recipient-sharing ownership bound to P1 plan 10 and `OI-FRG-RECIPIENT-SHARE-001`
> - One-page CA-02/03 competition-record owner decision sheet
> - Docs-only supersession patches for FRV2-CONF-004, 005, 006, and 010
> - Fail-closed reconciliation validator and regression tests
> - Approval-gated canonical patch queue with exact stop conditions
>
> **Effort**: Large
> **Parallel**: YES - 4 execution waves after the research PR
> **Critical Path**: Publish research PR -> freeze reconciliation schema -> bind conflicts and P1
> plans -> docs-only patches -> validator/review -> reconciliation PR -> external approvals ->
> canonical P1 queue

## Context

### Original Request

Continue from the completed Formation follow-up research. The latest explicit owner choices are the
product-direction source of truth. Recheck compatibility with the spec, prioritize the user view,
identify improvements, and do not silently resume superseded choices.

### Confirmed Owner Baseline

- Product identity: `9_5_DAY_FORMATION`.
- Target: `DEFAULT_AUTOMATED_PRESCRIPTION`.
- Eligible input yields exactly one deterministic primary 9.5-day plan.
- Execution confirmation, coach review/edit, and exceptions are separate from selection.
- No eligible candidate yields `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`.
- 9.5 days, 2-3 MAIN, and about 72 hours are product-policy values, not scientific optimality,
  recovery clearance, or safety claims.
- `PRIVATE_SELF_ONLY` content and metadata are zero-signal.
- Owner-directed backup and selected recipient sharing do not create analysis consent, standing
  access, Formation, plan, safety, reward, telemetry, or other secondary-use permission.
- Race self-check fields remain display-only now and are intended only for separately approved
  athlete-own future analysis.
- Multi-bout competition record identity remains unresolved until CA-02 and CA-03 are decided.

### Current Evidence State

```yaml
research_branch: codex/formation-followup-research-plan
base: origin/main@0bc9f3e
node_tests: 28/28_PASS
prepared_validators: 11/11_PASS
accepted_modes: 3/3_FAILED_CLOSED_AS_REQUIRED
independent_preparation_reviews: 5/5_PASS
canonical_human_screening: 0/167
supplemental_human_screening: 0/18
named_reviewers: 0/6
p1_plans_prepared: 10/10
p1_plans_approved: 0/10
scientific_acceptance: false
human_acceptance: false
runtime_authority: false
github_cli: MISSING
```

### Metis Review

The gap analysis found no logical contradiction, but identified publication, ownership, encoding,
and scope risks. This plan resolves them as follows:

- Publication is conditional on installed and authenticated `gh`; no push-only half-publication.
- Each of the 10 P1 plans receives the same reconciliation fields while its four authority flags
  remain false.
- Recipient sharing stays inside P1 plan 10 and existing issue `OI-FRG-RECIPIENT-SHARE-001`; no
  eleventh P1 plan is invented and the exact-ten validator remains authoritative.
- CA-02/03 get a short owner decision sheet; the existing detailed packet remains `NOT_REVIEWED`.
- Docs-only patches are limited to conflict targets 004, 005, 006, and 010 plus their resolution
  records. Historical evidence is labeled, never deleted or rewritten as if it were current.
- Prepared-state validation and negative fail-closed regressions are both required.
- The checked Korean documents are UTF-8 and contain no replacement/mojibake marker. Execution must
  preserve byte-safe UTF-8 and repeat that check.

## Work Objectives

1. Preserve the research package as one independently reviewable PR.
2. Make every P1 plan point to the latest baseline, relevant research packet, conflict rows, and
   explicit unresolved human gates without changing approval.
3. Give recipient sharing one existing governance owner and one exact approval path.
4. Give the owner a short, understandable CA-02/03 choice without smuggling in a decision.
5. Remove obsolete product-direction wording only where the latest owner choice already resolves it.
6. Prove that incomplete human/scientific/privacy/accessibility/runtime gates still fail closed.
7. Hand off an exact topological queue for later canonical patches, not runtime implementation.

## Scope

### In Scope

- `.omo`, research/review reports, P1 patch plans, root decision/status documents, and spec validators.
- Supersession headers and latest-decision cross-references in the exact FRV2 conflict targets.
- One-page owner decision material and preparation-only review evidence.

### Out Of Scope

- `app/`, `impl/`, production schemas, migrations, network sharing, participant enrollment, or deploy.
- Human, scientific, legal/privacy, accessibility, safeguarding, medical, or runtime approval.
- Closing a P1 issue without its named acceptance record and target-local evidence.
- Treating candidate test packages or AI review as runtime evidence.
- Activating multi-bout counting before CA-02/03 approval.

## Reconciliation Schema

Every P1 plan receives a `Latest Research Reconciliation` section with exactly these fields:

```yaml
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
related_conflicts: []
research_inputs: []
decision_packets: []
prepared_evidence: []
remaining_named_gates: []
approval_state_unchanged: true
runtime_authorized: false
canonical_spec_patch_authorized: false
```

The plan's existing `approved: false`, `state: READY_FOR_OWNER_APPROVAL`, readiness class, issue ID,
and target list remain unchanged unless a separate accepted human decision explicitly authorizes a
later patch.

## PR Strategy

| PR | Branch basis | Allowed scope | Forbidden scope | Exit state |
|---|---|---|---|---|
| Research | current research branch | current 150+ research/preparation artifacts and validators | canonical spec patch, app/runtime | draft PR, human/runtime gates open |
| Reconciliation | fresh branch from merged research/main | P1 plans, conflict mapping, docs-only supersession, decision sheet, validators | P1 approval, canonical behavioral patch, app/runtime | draft PR, 10/10 still unapproved |
| Canonical P1 | one approved plan per PR unless targets are inseparable | only the plan's exact target files and tests | other P1 plans, runtime | accepted spec patch with issue recount |
| Runtime | later explicit authorization | separately named implementation targets | inference from docs or candidate tests | executable evidence required |

## Tasks

### 1. Publish The Frozen Research-Preparation Package

**Files**

- Current worktree and branch only: `codex/formation-followup-research-plan`
- `.omo/evidence/formation-research-v2/task-10-supplemental-final-verification.md`
- `.omo/evidence/formation-research-v2/FINAL_REVIEW_SUPERSESSION_INDEX.md`
- All paths shown by `git status -sb` after an explicit scope review

**Steps**

1. Require `gh --version` and `gh auth status` to pass. If either fails, stop this task with
   `BLOCKED_GITHUB_CLI_OR_AUTH`; do not commit, push, or substitute browser automation.
2. Verify the worktree path, current branch, `origin`, and `origin/main` base. Fetch before staging;
   if main advanced, inspect the range and rebase only after confirming no research-artifact conflict.
3. Review `git status -sb`, the complete untracked-file list, `git diff --stat`, and the generated
   artifact inventory. Stage only the Formation research/preparation package and this continuation
   plan; exclude temporary, browser, server, and unrelated user files.
4. Re-run the frozen 28-test/11-validator/3-fail-closed matrix before commit.
5. Commit tersely as `docs(formation): prepare follow-up research package`.
6. Push the branch with upstream tracking and open a **draft** PR to `main` titled
   `docs(formation): prepare follow-up research package`.
7. PR body must state: mechanically prepared, 0/167 canonical human screening, 0/18 supplemental
   screening, 0/6 named reviews, three packets `NOT_REVIEWED`, P1 approvals 0/10, runtime false.

**Acceptance**

- Draft PR URL exists and head/base match the intended branches.
- No `app/`, `impl/`, runtime schema, migration, or deployment diff exists.
- PR wording does not call the research scientifically accepted, human-reviewed, or runtime-ready.

**QA Scenarios**

- Happy: authenticated CLI, reviewed scope, all checks pass, one draft PR opens.
- Failure: missing `gh`, failed auth, advanced conflicting main, or unrelated dirty file produces a
  named block and zero remote mutation.

### 2. Freeze The Research-To-P1 Reconciliation Matrix

**Files**

- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`
- `reports/target-patch-plans/README.md`
- `reports/target-patch-plans/01-coach-ruleset.md` through `10-record-governance.md`
- New: `reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv`

**Steps**

1. Create one matrix row per `FRV2-CONF-001..012`, with fields for conflict, target plan IDs, exact
   target files, latest owner clause, research inputs, decision packets, remaining gate, allowed next
   action, forbidden action, and current authority.
2. Add the standardized `Latest Research Reconciliation` section to all ten P1 plan files.
3. Link plans 02 and 03 to the new load/minimum-evidence research and packets while retaining
   `REQUIRES_HIGH_ACCURACY_RESEARCH`: preparation exists, accepted human appraisal does not.
4. Link plans 01, 06, 08, 09, and 10 to the competition, user, privacy, and latest-owner artifacts
   relevant to their conflicts. Do not make the multi-bout candidate canonical.
5. Update the P1 README with `research_reconciliation: 10/10`, `approved_plans: 0`, and a plain-language
   note explaining that research attachment is not plan approval.

**Acceptance**

- Exactly 12 unique conflict rows and exactly 10 unique P1 plan references reconcile.
- Every matrix path exists or is the controlled token `NO_ACCEPTED_TARGET_YET`.
- Every P1 file still contains `approved: false`, `runtime_authorized: false`, and
  `canonical_spec_patch_authorized: false` exactly once in its authority block.

**QA Scenarios**

- Happy: every conflict has a current target/gate and every plan links only relevant research.
- Failure: deleted conflict, duplicate plan, missing path, changed approval flag, or scientific
  overclaim makes the reconciliation validator exit nonzero.

### 3. Bind Recipient Sharing To Existing Governance Ownership

**Files**

- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv` row `FRV2-CONF-008`
- `reports/target-patch-plans/10-record-governance.md`
- `specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md` issue
  `OI-FRG-RECIPIENT-SHARE-001` as a referenced target, not an accepted patch
- `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md` as a referenced workflow target
- Reconciliation matrix from Task 2

**Steps**

1. Replace `NO_CANONICAL_TARGET_YET` in the conflict mapping with the existing governance contract,
   sharing workflow, P1 plan 10, and issue `OI-FRG-RECIPIENT-SHARE-001`.
2. Do not create an eleventh P1 plan. Add recipient-sharing ownership and prerequisites to plan 10's
   reconciliation section while preserving its named qualified-review gate.
3. Require selected recipient identity, exact fields, memo inclusion off by default and explicit when
   selected, purpose, expiry, preview, confirmation, revocation, download/re-share behavior,
   privacy-safe audit, youth handling, and deletion propagation.
4. Preserve current unavailability and prohibit analysis consent, standing coach/guardian access,
   Formation, plan, safety, reward, telemetry, and other secondary use.

**Acceptance**

- Conflict 008 has an exact governance owner and remains not implemented/not runtime-authorized.
- The P1 inventory stays exactly ten; existing P1 validator semantics remain intact.
- The share boundary is at least as strict as the governance contract and latest owner baseline.

**QA Scenarios**

- Happy: the athlete can understand future selected sharing without being told it works now.
- Failure: memo defaults on, recipient/scope/expiry is absent, standing access appears, or the P1
  count becomes 11 causes validation failure.

### 4. Prepare The CA-02/03 Competition-Record Owner Decision Sheet

**Files**

- Source: `reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md`
- Source: `reports/research/FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md`
- New: `reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md`
- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv` row `FRV2-CONF-012`
- Reconciliation matrix from Task 2

**Steps**

1. Create a one-page Korean decision sheet that first states the current rule: one completed
   `COMPETITION` record counts at most one exposure; a calendar meet anchor contributes no extra
   exposure by itself.
2. Explain the unresolved example with concrete records: 800 m heat, 800 m final, and 4x400 relay on
   one meet day. Separate calendar anchor identity from completed bout identity.
3. Present CA-02 and CA-03 as explicit `APPROVE | REVISE | REJECT`, with the recommendation clearly
   labeled as a proposal and the current state `NOT_REVIEWED`.
4. Preserve parent/child dedupe, at-most-one per completed bout, immutable competition identity,
   optional minimized timestamps, no fine-grained location, and the youth privacy gate.
5. State exactly what each answer would authorize in a later spec patch and what remains blocked by
   sports-science/privacy/runtime gates.

**Acceptance**

- A middle-school athlete and owner can distinguish meet, event/bout, completed record, and exposure
  from the text without interpreting a recommendation as a decision.
- The existing packet and new sheet both remain `NOT_REVIEWED`; conflict 012 remains
  `OWNER_DECISION_REQUIRED`; current counting does not change.

**QA Scenarios**

- Happy: a three-bout example produces three candidate completed records and zero extra anchor count,
  but is visibly noncanonical until approval.
- Failure: sheet auto-approves CA-02/03, counts the anchor, duplicates a bout, or collects GPS/private
  notes and the validator rejects it.

### 5. Apply Only The Four Latest-Decision Documentation Corrections

**Files**

- FRV2-CONF-004:
  - `FORMATION_RESEARCH_ACCEPTANCE_DECISION.md`
  - `TRAINING_PLAN_METHOD_DECISION.md`
  - `FABLE_CODEX_JOINT_PLANNING_BRIEF.md`
  - `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md`
  - `reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md`
- FRV2-CONF-005: `FORMATION_READ_NOW_DECIDE_LATER.md`
- FRV2-CONF-006: `FORMATION_DEFERRED_GOALS.md`
- FRV2-CONF-010: `RACE_SELFCHECK_FIELDS_DECISION.md`
- `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md` as read-only authority

**Steps**

1. RED first: add tests that fail while old current-authority wording can be read without a visible
   supersession marker or latest-baseline link.
2. Add a short structured header to each conflict-004 historical document:
   `product_direction_status: SUPERSEDED_PRODUCT_DIRECTION`, `historical_runtime_facts_preserved:
   true`, and the exact latest-baseline path. Do not rewrite research observations or past verdicts.
3. In the read-now document, replace only current product guidance that says no automatic plan with
   “no active runtime before named gates”; preserve runtime-off history.
4. In deferred goals, remove product identity/default selection from deferred scope; keep activation,
   safety, privacy, human review, implementation, and deployment deferred.
5. In the race self-check decision, preserve current display-only behavior while adding
   `CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED_FOR_ATHLETE_OWN_ANALYSIS`; prohibit current plan,
   safety, reward, telemetry, coach, guardian, or third-party use.
6. Change a conflict status only after its exact target assertions pass. Use
   `PATCH_APPLIED_PENDING_INDEPENDENT_REVIEW`, never `CLOSED`, in this PR.

**Acceptance**

- Historical evidence and dates remain readable and unmodified except for scoped status/link text.
- Search results cannot present coach-only selection, no-automatic-plan, or permanent-no-analysis as
  current product direction without the visible supersession context.
- No scientific, privacy, accessibility, safety, or runtime acceptance status advances.

**QA Scenarios**

- Happy: latest-direction readers reach the baseline immediately; historical reviewers can still
  reconstruct the old decision and runtime state.
- Failure: bulk rewriting history, erasing a prior verdict, permanent self-check analysis, or active
  runtime wording causes a negative regression failure.

### 6. Add A Fail-Closed Reconciliation Validator And Regressions

**Files**

- New: `specs/test-packages/validate-formation-spec-reconciliation.mjs`
- New: `specs/test-packages/formation-spec-reconciliation.test.mjs`
- Existing: `specs/test-packages/validate-latest-owner-decision.mjs`
- Existing: `specs/test-packages/validate-formation-p1-target-plans.mjs`
- Existing: `specs/test-packages/validate-formation-final-review-preparation.mjs`

**Steps**

1. Follow RED-GREEN-REFACTOR and the repository programming rules. Start with a failing happy-path
   test because the reconciliation matrix/sections do not yet exist, then implement the smallest
   validator that parses the CSV and exact structured fields.
2. Validate: 12 unique conflicts, 10 unique P1 plans, existing paths, allowed controlled tokens,
   authority flags false, share ownership inside plan 10, current CA-02/03 state, and the four scoped
   docs-only status markers.
3. Add independent mutation regressions for removed conflict, duplicate plan, forged P1 approval,
   runtime authorization, share-plan count 11, share secondary use, CA auto-approval, missing
   supersession, and self-check current coach/plan use.
4. Keep accepted human research modes unchanged; they must continue exiting nonzero without signed
   records. Do not let a reconciliation pass satisfy screening/extraction/appraisal acceptance.
5. Use dynamic test totals in new status prose; preserve the frozen 28/28 number only in the
   historical research Task 10 and research PR evidence.

**Acceptance**

- Happy-path reconciliation validator exits 0 with a precise prepared-state summary.
- Every named mutation exits nonzero for the intended reason.
- Existing Node suite, 11 research validators, P1 validator, and three accepted-mode fail-closed
  checks retain their behavior.

**QA Scenarios**

- Happy: complete reconciliation passes while human/scientific/runtime flags remain false.
- Failure: any authority promotion, missing gate, unsupported share, or multi-bout activation fails
  before a canonical spec or runtime consumer can rely on it.

### 7. Recount, Review, And Freeze The Reconciliation Handoff

**Files**

- `reports/review/FORMATION_RESEARCH_TO_P1_RECONCILIATION_MATRIX.csv`
- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`
- `reports/target-patch-plans/README.md` and all ten P1 files
- New: `reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md`
- New evidence directory: `.omo/evidence/formation-spec-reconciliation/`
- `.omo/start-work/ledger.jsonl` and `.omo/boulder.json` for truthful workflow state only

**Steps**

1. Recount conflict rows, P1 plans, target issue rows, and changed target status from the files, not
   from the previous report or memory.
2. Produce a short Korean handoff with four lists: fixed now, prepared but unapproved, owner decision
   needed, named-human gate needed. Put FRV2-CONF-012 and unavailable sharing in plain language.
3. Run five independent preparation review lanes: owner/goal constraint, code/validator quality,
   privacy/security, executable QA, and user/spec context. AI review can pass preparation only.
4. Correct every blocking preparation finding and repeat the affected review. Preserve review
   supersession rather than deleting negative historical findings.
5. Update ledger/Boulder only after tests and reviews prove the recorded counts. Use
   `PREPARATION_PASS_GATES_OPEN`, not complete/accepted/runtime-ready language.

**Acceptance**

- Recounts match exact file contents and five preparation reviews pass.
- The handoff exposes P1 approvals 0/10, all named human-review counts, CA-02/03 state, and runtime
  false without burying them under test success.
- No generated review claims to be a qualified human, privacy, sports-science, statistics,
  accessibility, safeguarding, or owner decision.

**QA Scenarios**

- Happy: an owner can tell in one page what is settled, what is only prepared, and what decision is
  next.
- Failure: stale counts, a hidden gate, an AI-authored approval, or a deleted negative review blocks
  handoff finalization.

### 8. Publish The Bounded Reconciliation PR

**Files**

- Only the files named in Tasks 2-7, on a fresh branch from the merged research PR/main

**Steps**

1. Require the research PR to be merged or explicitly choose its head as the base. Default is merged
   `main`; do not duplicate the research package in an unrelated PR.
2. Create `codex/formation-latest-decision-reconciliation` from updated main.
3. Verify no `app/`, `impl/`, migration, deploy, production schema, or unrelated user diff exists.
4. Commit as `docs(formation): reconcile latest owner decisions` after the final verification wave.
5. Push and open a draft PR titled `docs(formation): reconcile latest owner decisions`.
6. PR body must name the four docs-only conflict patches, plan-10 share ownership, CA-02/03 open
   decision, all 10 P1 authority flags, validation, and remaining gates.

**Acceptance**

- Draft PR contains only reconciliation/preparation scope and targets the intended base.
- Reviewer can reproduce every validator command from the PR body.
- No PR text claims canonical P1 closure, implemented sharing, accepted multi-bout counting, or
  runtime authority.

**QA Scenarios**

- Happy: clean bounded diff and all checks yield a draft reconciliation PR.
- Failure: research PR not merged, wrong base, scope contamination, failed check, or unavailable
  authenticated `gh` leaves the branch local and produces a named block without partial push.

## Final Verification Wave

After all feasible tasks complete, run the full verification matrix and produce a handoff that
distinguishes preparation PASS from every open human/scientific/runtime gate.

```bash
node --test specs/test-packages/*.test.mjs
node specs/test-packages/validate-formation-source-audit.mjs
node specs/test-packages/validate-formation-screening.mjs
node specs/test-packages/validate-formation-extraction.mjs
node specs/test-packages/validate-formation-appraisal.mjs
node specs/test-packages/validate-formation-research-v2.mjs
node specs/test-packages/validate-formation-synthesis.mjs
node specs/test-packages/validate-formation-decision-packets.mjs
node specs/test-packages/validate-formation-supplemental-evidence.mjs
node specs/test-packages/validate-formation-final-review-preparation.mjs
node specs/test-packages/validate-latest-owner-decision.mjs
node specs/test-packages/validate-formation-p1-target-plans.mjs
node specs/test-packages/validate-formation-spec-reconciliation.mjs
```

The following three commands must exit `1` for missing genuine human attestations, not for syntax or
file errors:

```bash
node specs/test-packages/validate-formation-screening.mjs --accepted
node specs/test-packages/validate-formation-extraction.mjs --accepted
node specs/test-packages/validate-formation-appraisal.mjs --accepted
```

Final hygiene checks:

- `git diff --check` exits 0.
- `git status --short -- app impl` is empty.
- All modified Korean Markdown/CSV is UTF-8 and contains no `�`, `占쏙`, or `???` marker.
- Boulder JSON and every ledger JSONL line parse.
- No debug journal, test-results, Playwright report, server, port, browser, or temporary artifact
  remains.
- A final diff audit proves no current owner baseline was weakened and no old product direction was
  silently restored.

## Approval-Gated Canonical Queue

This queue is a future handoff, not authority to patch now:

| Gate wave | P1 plans | Required before execution |
|---|---|---|
| G0 Privacy/governance | 10, 07 | named qualified privacy/safety review and accepted product facts |
| G1 Coach policy | 01 | Order 011 result and owner-completed 30-case walkthrough |
| G2 Evidence semantics | 02 and 03 in parallel | sports-science/statistics/privacy acceptance and owner registry/threshold choices |
| G3 Identity/adapters | 04 and 08 in parallel | Orders 011/012, approved plan 01 for 08, repository identity decision for 04 |
| G4 Calendar | 06 | approved plan 04 plus accepted DOUBLE/FLEX and local-civil semantics |
| G5 Pilot/product | 05 and 09 in parallel | Orders 011-014 and named athlete/coach/privacy/AT/safeguarding reviews |

CA-02/03 must be decided before any target changes multi-bout record identity. A missing decision
leaves the current one-completed-record/one-exposure rule unchanged.

## Success Criteria

- Research PR is created only after `gh` is installed and authenticated.
- All 10 P1 plans have complete reconciliation fields; all remain unapproved and runtime-off.
- All 12 conflicts map to an exact target, draft target owner, or named decision/human gate.
- FRV2-CONF-008 points to plan 10 and existing recipient-share governance issue, without claiming
  in-app sharing exists.
- FRV2-CONF-004/005/006/010 pass exact-content validation and preserve historical evidence.
- CA-02/03 material remains `NOT_REVIEWED`; canonical multi-bout behavior is unchanged.
- Full Node tests and prepared validators pass; accepted modes still fail closed.
- `git diff --check`, UTF-8 checks, JSON/CSV parsing, and no-`app/`/no-`impl/` scope checks pass.
- The final report names all remaining human decisions and never uses preparation PASS as acceptance.
