# TrainOracle Plan Output Rationale Privacy Spec Checklist

## TL;DR
> Summary:      Create `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` as the next productization draft for privacy-safe plan option rationale and coach-visible reasoning copy. Keep it draft-only: no runtime evidence, no canonical promotion, no issue closure, no plan-option changes.
> Deliverables:
> - `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
> - Metadata block with `open_issues_total: 6`, `canonical_blocking_count: 3`, executed tests `0/0`, and canonical/upload flags false
> - Six open issue rows listed below
> - Handoff/status docs updated from "future/not created" to "draft created"
> Effort:       Short
> Risk:         Medium - privacy and safety wording can accidentally imply issue closure, runtime proof, or D9/Safety Gate clearance.

## Scope
### Must have
- Recommended sections:
- Metadata and source state.
- Purpose and non-purpose.
- Upstream and downstream references.
- Hard constraints and LLM/privacy policy.
- Allowed rationale inputs: structured facts, source refs, confidence/uncertainty, non-sensitive reason codes, privacy booleans.
- Forbidden inputs/outputs: raw athlete text, raw memo text, symptom clauses, injury narratives, medical/rehab notes, evidence clauses, guardian private notes, private external LLM prompts/responses.
- `rationaleRefs` / rationale record contract that binds to Plan Generator without changing plan options.
- Check-in, Daily Brief/Inbox, Analysis, RVE/Safety Gate context boundaries.
- Redaction templates and safe copy modes for coach-visible text.
- Audit/evidence boundary with `rawTextStored: false`-style invariants.
- Open Issues.
- Self-check and automation validation packet.
- Final marker `[DRAFT_COMPLETE]`.
- Open issue rows and metadata counts:
- Metadata must set `open_issues_total: 6`, `canonical_blocking_count: 3`, `executed_tests_total: 0`, `executed_tests_passed: 0`, `self_check_is_runtime_evidence: false`, `upload_allowed: false`, and `canonical_promotion_allowed: false`.
- `OI-POR-APP-BRIDGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet own rationale privacy record/API/audit/capability boundaries.
- `OI-POR-PLAN-GENERATOR-BINDING-001` | P1 | YES | OPEN | Plan Generator `rationaleRefs` and `OI-PG-OPTION-RATIONALE-PRIVACY-001` are not bound to this draft.
- `OI-POR-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves rationale privacy filtering, source refs, or no raw values.
- `OI-POR-CHECKIN-CONTEXT-BINDING-001` | P2 | NO | OPEN | Daily Log, Daily Brief/Inbox, and Analysis context consumption remains downstream binding work.
- `OI-POR-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Coach-visible UI copy surfaces are not accepted implementation contracts.
- `OI-POR-EXTERNAL-LLM-POLICY-001` | P2 | NO | OPEN | Future LLM summarization/explanation boundary is not accepted; private athlete data stays disabled.
- Handoff docs to update:
- `SPEC_DOCUMENTATION_REPORT.md`.
- `SPEC_WORK_STATUS.md`.
- `SPEC_OVERVIEW_FOR_HOJUNE.md`.
- `SPEC_TARGET_PATCH_MATRIX.md`.
- `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Must not close `OI-PG-OPTION-RATIONALE-PRIVACY-001` or any Plan Generator issue.
- Must not claim runtime evidence, terminal/CI proof, canonical promotion, upload approval, or source acceptance.
- Must not store raw athlete text, raw private notes, raw symptoms, evidence clauses, or external LLM prompts/responses.
- Must not use or authorize external LLM processing with private athlete data.
- Must not clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, human review, or medical risk.
- Must not create, rank, modify, or delete plan options, planned sessions, progression logic, taper policy, or calendar mapping.
- Pitfalls:
- Do not let "redaction template" mean free-form private copy with a different label; it must be reason-code/source-ref based.
- Do not let coach-visible reasoning copy become a hidden plan recommendation engine.
- Do not make `D9_CLEARED` sound like medical clearance.
- Do not count grep/text self-checks as runtime evidence.
- Do not update handoff docs in a way that removes `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` from future work.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + repository text/metadata checks via shell commands.
- QA policy: every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-<N>-plan-output-rationale-privacy-spec-checklist.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Create the draft skeleton, metadata, and guardrails.
- Task 2: Define rationale privacy sections and record contract.
- Task 3: Add open issue table, self-check, and validation packet.

Wave 2 (after Wave 1):
- Task 4: Update handoff/status docs.
- Task 5: Run consistency and privacy scans.

Critical path: Task 1 -> Task 3 -> Task 5

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1 | none | 3, 4, 5 | 2 |
| 2 | none | 3, 5 | 1 |
| 3 | 1, 2 | 5 | 4 |
| 4 | 1 | 5 | 3 |
| 5 | 3, 4 | final verification | none |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Create draft skeleton, metadata, and guardrails

  What to do: Create `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` with the recommended sections, metadata, source state, non-purpose, hard constraints, and `[DRAFT_COMPLETE]`.
  Must NOT do: Do not edit Plan Generator output behavior, plan options, canonical flags in existing specs, or runtime evidence claims.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [3, 4, 5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:1` - productization metadata structure with `open_issues_total`, `canonical_blocking_count`, executed tests `0/0`, false runtime-evidence marker, and false canonical promotion.
  - Pattern:  `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:39` - wording for new productization draft, not original restored file, not canonical, not runtime evidence, not issue closure.
  - Pattern:  `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:45` - non-purpose list forbidding D9 evaluator implementation, plan option creation, Safety Gate clearing, raw private storage, external LLM private data, runtime evidence claims, and issue closure.
  - Pattern:  `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:75` - invariant block for source refs, confidence/uncertainty, raw text bans, external LLM ban, and no D9/Safety Gate clearing.
  - Test:     `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:605` - self-check row style.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "spec_id: PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC|open_issues_total: 6|canonical_blocking_count: 3|executed_tests_total: 0|executed_tests_passed: 0|self_check_is_runtime_evidence: false|canonical_promotion_allowed: false|\\[DRAFT_COMPLETE\\]" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` returns all required markers.
  - [ ] `rg -n "not canonical|not runtime evidence|not issue closure|does not.*create plan options|does not.*clear.*D9|does not.*Safety Gate" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` returns draft posture and guardrail text.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: metadata and final marker present
    Tool:     bash
    Steps:    rg -n "open_issues_total: 6|canonical_blocking_count: 3|executed_tests_total: 0|executed_tests_passed: 0|canonical_promotion_allowed: false|\\[DRAFT_COMPLETE\\]" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-1-plan-output-rationale-privacy-spec-checklist.txt
    Expected: Evidence file contains each required marker at least once.
    Evidence: .omo/evidence/task-1-plan-output-rationale-privacy-spec-checklist.txt

  Scenario: forbidden draft claims absent
    Tool:     bash
    Steps:    ! rg -n "canonical_promotion_allowed: true|self_check_is_runtime_evidence: true|runtime PASS|issue closure claimed|D9 cleared by rationale|Safety Gate cleared by rationale" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-1-plan-output-rationale-privacy-spec-checklist-error.txt
    Expected: Command succeeds because no forbidden positive claim is present.
    Evidence: .omo/evidence/task-1-plan-output-rationale-privacy-spec-checklist-error.txt
  ```

  Commit: YES | Message: `docs(rationale-privacy): add productization draft skeleton` | Files: [`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`]

- [ ] 2. Define rationale privacy sections and record contract

  What to do: Add allowed input taxonomy, forbidden input/output lists, redaction templates, safe copy modes, source-ref/confidence/uncertainty requirements, and a rationale reference/record shape that Plan Generator can point to via `rationaleRefs`.
  Must NOT do: Do not define plan selection logic, change plan option schema outside references, or introduce free-form private rationale storage.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [3, 5] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - API/Type: `specs/active/PLAN_GENERATOR_SPEC.md:755` - `PlanOptionRecord` already has `rationaleRefs: string[]`; bind to that field without modifying plan options.
  - Pattern:  `specs/active/PLAN_GENERATOR_SPEC.md:860` - existing privacy/LLM policy forbids external LLM private athlete data and requires generated rationale to avoid sensitive raw values.
  - Pattern:  `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:548` - future boundary requiring this spec before plan option rationale generation from check-in context and coach-visible reasoning copy.
  - Pattern:  `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:537` - Daily Brief/Inbox says this spec is needed before plan copy uses brief or inbox context.
  - Pattern:  `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:128` - visualization contract allows only structured values, source refs, confidence/uncertainty, non-sensitive reason codes, and display-safe labels.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "rationaleRefs|sourceRefs|confidence|uncertainty|reasonCodes|privacyLevel|rawTextStored: false|rawSymptomClauseStored: false|externalLlmWithPrivateAthleteDataAllowed: false" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` returns all required contract fields or equivalent names.
  - [ ] `rg -n "raw_athlete_free_text|raw_memo_text|raw_symptom_clause|injury_narrative|medical_note|rehab_note|guardian_private_note|D9_evidence_clause|private_external_llm_prompt|private_external_llm_response" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` returns the forbidden values list.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: privacy-safe rationale contract fields exist
    Tool:     bash
    Steps:    rg -n "sourceRefs|confidence|uncertainty|reasonCodes|privacyLevel|rawTextStored: false|externalLlmWithPrivateAthleteDataAllowed: false" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-2-plan-output-rationale-privacy-spec-checklist.txt
    Expected: Evidence file contains every required safe-contract marker.
    Evidence: .omo/evidence/task-2-plan-output-rationale-privacy-spec-checklist.txt

  Scenario: no free-form private rationale storage allowed
    Tool:     bash
    Steps:    ! rg -n "rawRationaleText: string|privateRationaleText: string|athleteQuote: string|memoText: string|symptomClause: string|externalLlmPrompt: string" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-2-plan-output-rationale-privacy-spec-checklist-error.txt
    Expected: Command succeeds because unsafe raw/private text fields are absent.
    Evidence: .omo/evidence/task-2-plan-output-rationale-privacy-spec-checklist-error.txt
  ```

  Commit: YES | Message: `docs(rationale-privacy): define safe rationale contract` | Files: [`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`]

- [ ] 3. Add open issue rows and metadata counts

  What to do: Add exactly six open issue rows and make metadata counts match: `open_issues_total: 6`, `canonical_blocking_count: 3`.
  Must NOT do: Do not mark any row closed, accepted, runtime-proven, or canonical-ready.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [5] | Blocked by: [1, 2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `specs/active/PLAN_GENERATOR_SPEC.md:887` - Plan Generator open issue table format and the existing `OI-PG-OPTION-RATIONALE-PRIVACY-001` row.
  - Pattern:  `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:586` - six-row productization open issue format with three canonical blockers.
  - Pattern:  `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:580` - issue table wording for implementation/runtime/privacy binding.
  - Pattern:  `specs/active/PLAN_GENERATOR_SPEC.md:1035` - final state keeps rationale privacy issue non-blocking in Plan Generator; do not close it here.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "open_issues_total: 6|canonical_blocking_count: 3|OI-POR-APP-BRIDGE-BINDING-001|OI-POR-PLAN-GENERATOR-BINDING-001|OI-POR-RUNTIME-EVIDENCE-001|OI-POR-CHECKIN-CONTEXT-BINDING-001|OI-POR-UI-SURFACE-BINDING-001|OI-POR-EXTERNAL-LLM-POLICY-001" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` returns all metadata and issue IDs.
  - [ ] `rg -n "\\| \`OI-POR-.*\\| P1 \\| YES \\| OPEN" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md | measure` reports exactly `3` matching rows in PowerShell, or `wc -l` reports `3` in bash.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: issue IDs and counts match
    Tool:     bash
    Steps:    rg -n "open_issues_total: 6|canonical_blocking_count: 3|OI-POR-APP-BRIDGE-BINDING-001|OI-POR-PLAN-GENERATOR-BINDING-001|OI-POR-RUNTIME-EVIDENCE-001|OI-POR-CHECKIN-CONTEXT-BINDING-001|OI-POR-UI-SURFACE-BINDING-001|OI-POR-EXTERNAL-LLM-POLICY-001" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-3-plan-output-rationale-privacy-spec-checklist.txt
    Expected: Evidence file contains two metadata counts and all six issue IDs.
    Evidence: .omo/evidence/task-3-plan-output-rationale-privacy-spec-checklist.txt

  Scenario: issue table does not close anything
    Tool:     bash
    Steps:    ! rg -n "\\| \`OI-POR-.*\\| .*\\| (CLOSED|RESOLVED|ACCEPTED|PASS) \\|" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md > .omo/evidence/task-3-plan-output-rationale-privacy-spec-checklist-error.txt
    Expected: Command succeeds because all `OI-POR-*` rows remain `OPEN`.
    Evidence: .omo/evidence/task-3-plan-output-rationale-privacy-spec-checklist-error.txt
  ```

  Commit: YES | Message: `docs(rationale-privacy): track draft open issues` | Files: [`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`]

- [ ] 4. Update handoff/status docs

  What to do: Update handoff docs that currently list `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` as future/not created. State that it exists as a new `DRAFT_FOR_REVIEW` productization draft, is not canonical promotion, is not runtime evidence, and does not close Plan Generator or downstream issues.
  Must NOT do: Do not recode mojibake/encoding in Korean handoff docs beyond the exact lines needed; do not remove `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` from remaining future work.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [5] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern: `SPEC_DOCUMENTATION_REPORT.md:110` - currently says `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` is future and not created.
  - Pattern: `SPEC_DOCUMENTATION_REPORT.md:162` - remaining future productization docs list.
  - Pattern: `SPEC_WORK_STATUS.md:53` - remaining drafts list currently includes rationale privacy and microcycle mapping.
  - Pattern: `SPEC_OVERVIEW_FOR_HOJUNE.md:115` - overview says rationale privacy spec is not created yet.
  - Pattern: `SPEC_OVERVIEW_FOR_HOJUNE.md:178` - remaining productization specs list.
  - Pattern: `SPEC_TARGET_PATCH_MATRIX.md:133` - Wave 3 productization drafts list.
  - Pattern: `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md:205` - Phase 3 productization contract list.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*Draft created|PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*DRAFT_FOR_REVIEW|not canonical promotion|not runtime evidence|does not close.*Plan Generator|MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md" SPEC_DOCUMENTATION_REPORT.md SPEC_WORK_STATUS.md SPEC_OVERVIEW_FOR_HOJUNE.md SPEC_TARGET_PATCH_MATRIX.md SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` returns updated handoff wording.
  - [ ] `rg -n "PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*Not created yet|PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*Future SPEC" SPEC_DOCUMENTATION_REPORT.md SPEC_WORK_STATUS.md SPEC_OVERVIEW_FOR_HOJUNE.md SPEC_TARGET_PATCH_MATRIX.md SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md` returns no stale status lines except intentional historical context if explicitly labeled as previous state.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: handoff docs reflect created draft
    Tool:     bash
    Steps:    rg -n "PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*(Draft created|DRAFT_FOR_REVIEW)|not canonical promotion|not runtime evidence|does not close" SPEC_DOCUMENTATION_REPORT.md SPEC_WORK_STATUS.md SPEC_OVERVIEW_FOR_HOJUNE.md SPEC_TARGET_PATCH_MATRIX.md SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md > .omo/evidence/task-4-plan-output-rationale-privacy-spec-checklist.txt
    Expected: Evidence file shows each handoff doc has updated draft posture or references the shared addendum.
    Evidence: .omo/evidence/task-4-plan-output-rationale-privacy-spec-checklist.txt

  Scenario: no stale not-created status remains
    Tool:     bash
    Steps:    ! rg -n "PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md.*(Not created yet|Future SPEC)" SPEC_DOCUMENTATION_REPORT.md SPEC_WORK_STATUS.md SPEC_OVERVIEW_FOR_HOJUNE.md SPEC_TARGET_PATCH_MATRIX.md SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md > .omo/evidence/task-4-plan-output-rationale-privacy-spec-checklist-error.txt
    Expected: Command succeeds because stale future/not-created rows have been updated.
    Evidence: .omo/evidence/task-4-plan-output-rationale-privacy-spec-checklist-error.txt
  ```

  Commit: YES | Message: `docs(specs): update rationale privacy handoff status` | Files: [`SPEC_DOCUMENTATION_REPORT.md`, `SPEC_WORK_STATUS.md`, `SPEC_OVERVIEW_FOR_HOJUNE.md`, `SPEC_TARGET_PATCH_MATRIX.md`, `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`]

- [ ] 5. Run consistency and privacy scans

  What to do: Verify the new draft and handoff updates preserve all guardrails, counts, references, and pitfalls.
  Must NOT do: Do not run product builds, mutate app code, or treat text scans as runtime evidence.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [final verification] | Blocked by: [3, 4]

  References (executor has NO interview context - be exhaustive):
  - Pattern: `specs/active/PLAN_GENERATOR_SPEC.md:43` - metadata counts must match open issue rows.
  - Pattern: `specs/active/PLAN_GENERATOR_SPEC.md:891` - `OI-PG-OPTION-RATIONALE-PRIVACY-001` remains open in Plan Generator.
  - Pattern: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:57` - raw athlete/private notes cannot be stored.
  - Pattern: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:561` - this new draft is required before check-in context drives plan rationale.
  - Pattern: `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:53` - Daily Brief/Inbox cannot clear D9/Safety Gate or create plan options.
  - Pattern: `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:43` - analysis contract forbids private external LLM processing and raw private storage.

  Acceptance criteria (agent-executable only):
  - [ ] `rg -n "OI-PG-OPTION-RATIONALE-PRIVACY-001.*OPEN" specs/active/PLAN_GENERATOR_SPEC.md` still finds the Plan Generator issue open.
  - [ ] `rg -n "create plan options|modify Plan Generator output|clear D9|clear Safety Gate|external LLM.*private athlete data.*allowed|raw athlete.*stored" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` only finds forbidden-action guardrails, never permissions.

  QA scenarios (MANDATORY - task incomplete without these):
  ```
  Scenario: Plan Generator privacy issue remains open
    Tool:     bash
    Steps:    rg -n "OI-PG-OPTION-RATIONALE-PRIVACY-001.*OPEN" specs/active/PLAN_GENERATOR_SPEC.md > .omo/evidence/task-5-plan-output-rationale-privacy-spec-checklist.txt
    Expected: Evidence file shows the Plan Generator privacy issue remains `OPEN`.
    Evidence: .omo/evidence/task-5-plan-output-rationale-privacy-spec-checklist.txt

  Scenario: no permission wording for known pitfalls
    Tool:     bash
    Steps:    ! rg -n "external_llm_with_private_athlete_data: ALLOWED|canonical_promotion_allowed: true|self_check_is_runtime_evidence: true|mayClearD9Risk: true|may_clear_safety_gate: true|rawTextStored: true|rawSymptomClauseStored: true|creates plan options" specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md SPEC_DOCUMENTATION_REPORT.md SPEC_WORK_STATUS.md SPEC_OVERVIEW_FOR_HOJUNE.md SPEC_TARGET_PATCH_MATRIX.md SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md > .omo/evidence/task-5-plan-output-rationale-privacy-spec-checklist-error.txt
    Expected: Command succeeds because no forbidden permission wording exists.
    Evidence: .omo/evidence/task-5-plan-output-rationale-privacy-spec-checklist-error.txt
  ```

  Commit: YES | Message: `docs(rationale-privacy): verify privacy draft handoff` | Files: [`specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`, `SPEC_DOCUMENTATION_REPORT.md`, `SPEC_WORK_STATUS.md`, `SPEC_OVERVIEW_FOR_HOJUNE.md`, `SPEC_TARGET_PATCH_MATRIX.md`, `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met.
- [ ] F2. Code quality review - docs are internally consistent, issue counts match issue rows, and no stale "not created" handoff status remains.
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured under `.omo/evidence/`.
- [ ] F4. Scope fidelity - nothing extra shipped beyond the draft and handoff updates; no product code, plan-option behavior, D9/Safety Gate behavior, canonical promotion, runtime evidence, or issue closure introduced.

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/plan-output-rationale-privacy-spec-checklist.md`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
