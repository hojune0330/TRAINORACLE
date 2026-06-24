# TrainOracle SPEC Inventory Execution Pass

## TL;DR
> Summary:      Produce an `.omo`-only confirmed inventory, missing/quarantine evidence, and reconstruction readiness brief for the current TrainOracle SPEC work unit. The pass must refresh local-file evidence and must not edit product SPEC files or claim runtime execution.
> Deliverables:
> - `.omo/evidence/trainoracle-confirmed-inventory.md` plus stdout capture
> - `.omo/evidence/trainoracle-missing-quarantine.md` plus stdout capture
> - `.omo/reports/trainoracle-reconstruction-readiness.md`
> - `.omo/evidence/trainoracle-no-product-spec-edits.txt`
> Effort:       Short
> Risk:         Medium - stale `.omo` artifacts and legacy/current namespace confusion can create false completion.

## Scope
### Must have
- Regenerate or positively revalidate the C001 confirmed inventory evidence from `D:\admin\Downloads\정본 제작 1차` and `D:\admin\Documents\트레인 오라클 진도`, covering `SPEC_ACTIVE`, `LEGACY_REFERENCE`, `TEST_PACKAGES`, `MISSING_OR_RECONSTRUCT`, `QUARANTINE_DUPLICATES`, and `UNKNOWN_REVIEW_REQUIRED`; this is required by `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:17-20`.
- Produce fresh C002 missing/quarantine evidence for exact required filenames, exact-name legacy aliases, H1 count, `[DRAFT_COMPLETE]` final marker, and Plan Generator count lines; this is required by `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:26-29`.
- Produce C003 readiness evidence and a git-status proof that product SPEC files were not edited; this is required by `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:35-38`.
- Treat model belief files as reference only, not active SPEC baselines, and ignore the HTML downloader wrapper mechanics recorded in `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:18` and `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:62-65`.
- Preserve prior guardrails: local files are truth, no unverified absolute counts, no runtime evidence claims, no issue closure, and no confusing `11_API_AND_ENGINE_CONTRACTS.md` with `RULE_VALIDATION_ENGINE_CONTRACT.md`; these guardrails are recorded in `.omo/drafts/train-oracle-spec-handoff.md:43-47` and `.omo/drafts/train-oracle-spec-handoff.md:60`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not edit product SPEC files under `D:\admin\Downloads\정본 제작 1차` or any product SPEC copy in the workspace.
- Do not move, quarantine, rename, or reconstruct product SPEC files; report classifications only.
- Do not close issues, update issue counts, or claim runtime evidence from markdown self-check text.
- Do not reuse stale `.omo` evidence without recording freshness, source roots, generated time, stdout, and cleanup.
- Do not treat legacy `11_API_AND_ENGINE_CONTRACTS.md` as the missing/current `RULE_VALIDATION_ENGINE_CONTRACT.md`.
- Do not parse or copy HTML downloader wrapper/copy-button mechanics from belief files into active evidence.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none + PowerShell CLI evidence checks, because this work unit produces evidence reports rather than product code.
- QA policy: every task has agent-executed scenarios
- Evidence: `.omo/evidence/task-<N>-<slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Preflight stale-state and dirty-worktree guard
- Task 2: C001 confirmed inventory generation/revalidation
- Task 3: Exact missing filename search
- Task 4: Structural quarantine scan
- Task 5: Belief/reference contamination guardrail extraction

Wave 2 (after Wave 1):
- Task 6: C002 missing/quarantine synthesis depends [1, 3, 4]
- Task 7: C003 no-product-SPEC-edits proof depends [1]
- Task 8: Readiness source-map summary depends [2, 5]

Wave 3 (after Wave 2):
- Task 9: C003 reconstruction readiness brief depends [6, 7, 8]

Critical path: Task 1 -> Task 3 -> Task 6 -> Task 9

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 6, 7   | 2, 3, 4, 5           |
| 2    | none       | 8      | 1, 3, 4, 5           |
| 3    | none       | 6      | 1, 2, 4, 5           |
| 4    | none       | 6      | 1, 2, 3, 5           |
| 5    | none       | 8      | 1, 2, 3, 4           |
| 6    | 1, 3, 4    | 9      | 7, 8                 |
| 7    | 1          | 9      | 6, 8                 |
| 8    | 2, 5       | 9      | 6, 7                 |
| 9    | 6, 7, 8    | final  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Preflight stale-state and dirty-worktree guard

  What to do: Record `.omo/evidence/trainoracle-preflight-state.md` with source root existence, current timestamp, current target artifact existence/mtime/size, and `git status --short`. Mark any pre-existing target output as provisional until fresh stdout evidence is captured in this pass.
  Must NOT do: Do not delete stale files, reset git state, or edit product SPEC files.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:3` - prior generated timestamp pattern to capture and revalidate
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.stdout.txt:1-7` - stdout evidence shape for PASS and cleanup
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:43-47` - local truth, no remembered counts, no runtime evidence claims
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:79-80` - no product SPEC edits and no reconstruction in prep/inventory mode

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-preflight-state.md'` returns `True`.
  - [ ] `Select-String -LiteralPath '.omo\evidence\trainoracle-preflight-state.md' -Pattern 'Source package:|Workspace:|git status --short|stale-state policy|product SPEC edits: forbidden'` returns all patterns.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: preflight captures roots and stale-state policy
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Test-Path -LiteralPath '.omo\evidence\trainoracle-preflight-state.md'; Select-String -LiteralPath '.omo\evidence\trainoracle-preflight-state.md' -Pattern 'Source package:|Workspace:|stale-state policy'"
    Expected: Test-Path prints True and Select-String prints all three labels.
    Evidence: .omo/evidence/task-1-preflight-state.txt

  Scenario: preflight rejects silent completion from pre-existing artifacts
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-preflight-state.md' -Pattern 'provisional until fresh stdout evidence|trainoracle-confirmed-inventory.md|trainoracle-missing-quarantine.md|trainoracle-reconstruction-readiness.md'"
    Expected: All target artifact names and the provisional/fresh-stdout policy are present.
    Evidence: .omo/evidence/task-1-preflight-state-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): record inventory preflight state` | Files: [.omo/evidence/trainoracle-preflight-state.md, .omo/evidence/task-1-preflight-state.txt, .omo/evidence/task-1-preflight-state-error.txt]

- [ ] 2. C001 confirmed inventory generation/revalidation

  What to do: Generate or revalidate `.omo/evidence/trainoracle-confirmed-inventory.md` and `.omo/evidence/trainoracle-confirmed-inventory.stdout.txt` from local filesystem metadata and file contents. It must include the six required classification sections and avoid unsupported file-existence claims.
  Must NOT do: Do not copy earlier manifest counts without recounting local files. Do not modify any source markdown file.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:17-20` - C001 scenario and expected evidence
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:10-15` - inventory summary fields to preserve if still true after recount
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:17-64` - required classification sections and table layout
  - Guardrail: `.omo/evidence/trainoracle-confirmed-inventory.md:71-73` - evidence command and no product SPEC writes statement

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-confirmed-inventory.md'` returns `True`.
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-confirmed-inventory.stdout.txt'` returns `True`.
  - [ ] `Select-String -LiteralPath '.omo\evidence\trainoracle-confirmed-inventory.md' -Pattern '## SPEC_ACTIVE','## LEGACY_REFERENCE','## TEST_PACKAGES','## MISSING_OR_RECONSTRUCT','## QUARANTINE_DUPLICATES','## UNKNOWN_REVIEW_REQUIRED'` returns all six sections.
  - [ ] `Select-String -LiteralPath '.omo\evidence\trainoracle-confirmed-inventory.stdout.txt' -Pattern 'PASS C001 inventory generated','cleanup=no processes spawned; no temp files created'` returns both patterns.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: C001 inventory contains required sections
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "$p='.omo\evidence\trainoracle-confirmed-inventory.md'; Test-Path -LiteralPath $p; '## SPEC_ACTIVE','## LEGACY_REFERENCE','## TEST_PACKAGES','## MISSING_OR_RECONSTRUCT','## QUARANTINE_DUPLICATES','## UNKNOWN_REVIEW_REQUIRED' | ForEach-Object { Select-String -LiteralPath $p -Pattern ([regex]::Escape($_)) }"
    Expected: Test-Path prints True and each required section is printed at least once.
    Evidence: .omo/evidence/task-2-c001-inventory.txt

  Scenario: C001 stdout proves fresh command and cleanup
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-confirmed-inventory.stdout.txt' -Pattern 'PASS C001 inventory generated|source_md_count=|cleanup=no processes spawned; no temp files created'"
    Expected: PASS, source count, and cleanup lines are present.
    Evidence: .omo/evidence/task-2-c001-inventory-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): refresh confirmed inventory evidence` | Files: [.omo/evidence/trainoracle-confirmed-inventory.md, .omo/evidence/trainoracle-confirmed-inventory.stdout.txt, .omo/evidence/task-2-c001-inventory.txt, .omo/evidence/task-2-c001-inventory-error.txt]

- [ ] 3. Exact missing filename search

  What to do: Search exact filenames in source package and workspace roots for `RULE_VALIDATION_ENGINE_CONTRACT.md`, `PLAN_SAFETY_GATE_SPEC.md`, `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001.md`, and `COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001`. Record raw search roots and found/not-found results in `.omo/evidence/trainoracle-exact-missing-search.md`.
  Must NOT do: Do not infer missing status from old evidence alone. Do not treat similarly named legacy files as found targets.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:49-56` - target missing/reconstruct names currently listed for source root
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:60` - do not claim nonexistent files and do not confuse `11_API_AND_ENGINE_CONTRACTS.md` with RVE contract
  - Pattern:  `.omo/evidence/inventory-classification-train-oracle-spec-handoff.md:29-31` - older missing result to supersede with fresh evidence

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-exact-missing-search.md'` returns `True`.
  - [ ] The report includes all searched roots and all four target strings.
  - [ ] The report explicitly distinguishes `11_API_AND_ENGINE_CONTRACTS.md` from `RULE_VALIDATION_ENGINE_CONTRACT.md`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: exact missing search names all required targets
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-exact-missing-search.md' -Pattern 'RULE_VALIDATION_ENGINE_CONTRACT.md|PLAN_SAFETY_GATE_SPEC.md|COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001.md|COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001'"
    Expected: All required target names are printed.
    Evidence: .omo/evidence/task-3-exact-missing-search.txt

  Scenario: exact search prevents legacy alias false positive
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-exact-missing-search.md' -Pattern '11_API_AND_ENGINE_CONTRACTS.md.*legacy|not RULE_VALIDATION_ENGINE_CONTRACT.md|alias is not a hit'"
    Expected: Output explicitly says the legacy API/engine contract is not the missing RVE contract.
    Evidence: .omo/evidence/task-3-exact-missing-search-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): record exact missing filename search` | Files: [.omo/evidence/trainoracle-exact-missing-search.md, .omo/evidence/task-3-exact-missing-search.txt, .omo/evidence/task-3-exact-missing-search-error.txt]

- [ ] 4. Structural quarantine scan

  What to do: Scan source package markdown files for H1 count, `[DRAFT_COMPLETE]` final marker status, exact H1/filename mismatch, duplicate/root-name alias candidates, and Plan Generator issue-count metadata lines. Record raw results in `.omo/evidence/trainoracle-structural-quarantine-scan.md`.
  Must NOT do: Do not rename or move files. Do not call a file canonical or quarantined solely because it has older dates or mojibake in old evidence.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:17-47` - table shape with H1 counts and final marker lines
  - Pattern:  `.omo/evidence/inventory-classification-train-oracle-spec-handoff.md:32-53` - older quick heuristic and correction note; new scan must avoid broad false matches
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:44` - no unverified absolute counts

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-structural-quarantine-scan.md'` returns `True`.
  - [ ] The report includes H1 count, `[DRAFT_COMPLETE]` final marker status, duplicate/root-name alias candidate fields, and Plan Generator count lines.
  - [ ] The report includes a note that quarantine is a report classification only, not a file move.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: structural scan includes required columns
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-structural-quarantine-scan.md' -Pattern 'H1 count|DRAFT_COMPLETE|duplicate/root-name alias|Plan Generator count lines|quarantine is report-only'"
    Expected: All required structural labels are present.
    Evidence: .omo/evidence/task-4-structural-scan.txt

  Scenario: structural scan rejects unverified absolute count reuse
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-structural-quarantine-scan.md' -Pattern 'recounted from local file|no remembered absolute counts|broad heuristic rejected'"
    Expected: The scan documents local recount and broad-heuristic rejection.
    Evidence: .omo/evidence/task-4-structural-scan-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): scan structural quarantine candidates` | Files: [.omo/evidence/trainoracle-structural-quarantine-scan.md, .omo/evidence/task-4-structural-scan.txt, .omo/evidence/task-4-structural-scan-error.txt]

- [ ] 5. Belief/reference contamination guardrail extraction

  What to do: Produce `.omo/evidence/trainoracle-belief-reference-guardrails.md` summarizing which belief/reference files may guide interpretation, which claims still require local SPEC verification, and which HTML downloader wrapper mechanics are excluded.
  Must NOT do: Do not promote belief/reference files to active SPEC baseline. Do not copy hidden downloader wrapper mechanics into readiness conclusions.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [8] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:18-19` - belief/reference file roles and HTML wrapper note
  - Guardrail: `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:62-65` - reference-only treatment and local verification requirement
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:69` - belief layer can guide interpretation, but factual claims need local target verification

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-belief-reference-guardrails.md'` returns `True`.
  - [ ] The report contains `reference only`, `not active SPEC baseline`, `local SPEC verification required`, and `HTML downloader wrapper ignored`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: belief files are constrained to reference-only role
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-belief-reference-guardrails.md' -Pattern 'reference only|not active SPEC baseline|local SPEC verification required'"
    Expected: All three guardrail phrases are present.
    Evidence: .omo/evidence/task-5-belief-guardrails.txt

  Scenario: HTML downloader wrapper is excluded
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-belief-reference-guardrails.md' -Pattern 'HTML downloader wrapper ignored|copy-button mechanics excluded|automation mechanics excluded'"
    Expected: The report explicitly excludes wrapper, copy-button, and automation mechanics.
    Evidence: .omo/evidence/task-5-belief-guardrails-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): constrain belief reference inputs` | Files: [.omo/evidence/trainoracle-belief-reference-guardrails.md, .omo/evidence/task-5-belief-guardrails.txt, .omo/evidence/task-5-belief-guardrails-error.txt]

- [ ] 6. C002 missing/quarantine synthesis

  What to do: Produce `.omo/evidence/trainoracle-missing-quarantine.md` and `.omo/evidence/trainoracle-missing-quarantine.stdout.txt` by synthesizing Tasks 3 and 4. Include exact searched roots, explicit found/not-found outcomes, legacy alias handling, structural quarantine candidates, and Plan Generator count-line local recount.
  Must NOT do: Do not claim missing files are reconstructed. Do not move quarantine candidates. Do not use grep hits or PASS text as proof without the report and stdout artifacts.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [9] | Blocked by: [1, 3, 4]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:26-29` - C002 required detector and expected evidence
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:49-60` - missing/reconstruct and quarantine sections to align with
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:60` - no `11_API_AND_ENGINE_CONTRACTS.md` confusion
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:65-66` - no reconstruction and no runtime PASS treatment

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-missing-quarantine.md'` returns `True`.
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-missing-quarantine.stdout.txt'` returns `True`.
  - [ ] The report includes searched roots, exact found/not-found results, `11_API_AND_ENGINE_CONTRACTS.md` alias separation, H1 count, final marker, Plan Generator count lines, and report-only quarantine classification.
  - [ ] stdout includes a C002 PASS line and cleanup line.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: C002 missing/quarantine report is complete
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "$p='.omo\evidence\trainoracle-missing-quarantine.md'; Test-Path -LiteralPath $p; Select-String -LiteralPath $p -Pattern 'searched roots|RULE_VALIDATION_ENGINE_CONTRACT.md|PLAN_SAFETY_GATE_SPEC.md|COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001|H1 count|DRAFT_COMPLETE|Plan Generator count lines|quarantine is report-only'"
    Expected: Test-Path prints True and all required report fields are printed.
    Evidence: .omo/evidence/task-6-c002-missing-quarantine.txt

  Scenario: C002 rejects misleading success and alias confusion
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-missing-quarantine.stdout.txt' -Pattern 'PASS C002 missing/quarantine generated|cleanup=no processes spawned; no temp files created'; Select-String -LiteralPath '.omo\evidence\trainoracle-missing-quarantine.md' -Pattern '11_API_AND_ENGINE_CONTRACTS.md.*not RULE_VALIDATION_ENGINE_CONTRACT.md|unsupported file-existence claims: none'"
    Expected: stdout PASS/cleanup lines exist and the report explicitly rejects alias confusion and unsupported existence claims.
    Evidence: .omo/evidence/task-6-c002-missing-quarantine-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): generate missing quarantine evidence` | Files: [.omo/evidence/trainoracle-missing-quarantine.md, .omo/evidence/trainoracle-missing-quarantine.stdout.txt, .omo/evidence/task-6-c002-missing-quarantine.txt, .omo/evidence/task-6-c002-missing-quarantine-error.txt]

- [ ] 7. C003 no-product-SPEC-edits proof

  What to do: Produce `.omo/evidence/trainoracle-no-product-spec-edits.txt` with `git status --short`, a list of changed paths, and an explicit assertion that no product SPEC files under source package or workspace SPEC paths were edited by this pass.
  Must NOT do: Do not stage, commit, revert, or clean files. Do not hide unrelated `.omo` changes.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [9] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:35-38` - C003 requires git status proof
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:79` - no product SPEC edits
  - Guardrail: `.omo/evidence/trainoracle-confirmed-inventory.md:71-73` - evidence statement style for no product SPEC writes

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-no-product-spec-edits.txt'` returns `True`.
  - [ ] The evidence file includes `git status --short` and `product SPEC edits: none`.
  - [ ] The evidence file lists any `.omo` changes separately from product SPEC files.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: no-product-SPEC-edits evidence exists
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Test-Path -LiteralPath '.omo\evidence\trainoracle-no-product-spec-edits.txt'; Select-String -LiteralPath '.omo\evidence\trainoracle-no-product-spec-edits.txt' -Pattern 'git status --short|product SPEC edits: none|.omo changes:'"
    Expected: Test-Path prints True and all three evidence labels are present.
    Evidence: .omo/evidence/task-7-no-product-spec-edits.txt

  Scenario: no product SPEC path appears as modified
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "$s=Get-Content -LiteralPath '.omo\evidence\trainoracle-no-product-spec-edits.txt' -Raw; if ($s -match 'D:\\admin\\Downloads\\정본 제작 1차\\.*\.md.*modified|SPEC.*\.md.*modified') { throw 'product SPEC modified' } else { 'PASS no modified product SPEC path recorded' }"
    Expected: Command prints PASS no modified product SPEC path recorded.
    Evidence: .omo/evidence/task-7-no-product-spec-edits-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): prove no product spec edits` | Files: [.omo/evidence/trainoracle-no-product-spec-edits.txt, .omo/evidence/task-7-no-product-spec-edits.txt, .omo/evidence/task-7-no-product-spec-edits-error.txt]

- [ ] 8. Readiness source-map summary

  What to do: Produce `.omo/evidence/trainoracle-readiness-source-map.md` listing the source files and evidence reports that the readiness brief may cite, plus exclusions for belief files and runtime evidence. This prepares Task 9 without deciding readiness prematurely.
  Must NOT do: Do not declare reconstruction ready until C002 and no-product-SPEC-edits evidence are complete.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [9] | Blocked by: [2, 5]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:17-64` - source classification evidence to cite
  - Pattern:  `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:62-65` - belief/reference treatment and HTML wrapper exclusion
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:65-69` - no reconstruction, no runtime PASS, namespace separation, belief-layer verification

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\evidence\trainoracle-readiness-source-map.md'` returns `True`.
  - [ ] The report includes source inventory, missing/quarantine evidence placeholder, belief-reference guardrails, no runtime evidence claims, and no issue closure.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: readiness source map lists allowed sources
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-readiness-source-map.md' -Pattern 'trainoracle-confirmed-inventory.md|trainoracle-missing-quarantine.md|trainoracle-belief-reference-guardrails.md|trainoracle-no-product-spec-edits.txt'"
    Expected: All allowed source/evidence filenames are present.
    Evidence: .omo/evidence/task-8-readiness-source-map.txt

  Scenario: readiness source map blocks premature claims
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\evidence\trainoracle-readiness-source-map.md' -Pattern 'no runtime evidence claims|no issue closure|belief files are reference only|HTML downloader wrapper ignored'"
    Expected: All premature-claim guardrails are present.
    Evidence: .omo/evidence/task-8-readiness-source-map-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): map readiness evidence sources` | Files: [.omo/evidence/trainoracle-readiness-source-map.md, .omo/evidence/task-8-readiness-source-map.txt, .omo/evidence/task-8-readiness-source-map-error.txt]

- [ ] 9. C003 reconstruction readiness brief

  What to do: Produce `.omo/reports/trainoracle-reconstruction-readiness.md` synthesizing C001, C002, no-product-SPEC-edits proof, and source-map guardrails. It must state readiness for later reconstruction only, list source files, list blockers/unknowns, and include must-not-claim guardrails for `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md`.
  Must NOT do: Do not write reconstructed SPEC content. Do not say D9 runtime tests passed. Do not declare issues closed.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [] | Blocked by: [6, 7, 8]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/019ef850-bb65-7082-ad74-7dc718b3f8e8/goals.json:35-38` - C003 readiness and git-status evidence requirement
  - Pattern:  `.omo/evidence/trainoracle-confirmed-inventory.md:49-56` - current missing/reconstruct target evidence
  - Guardrail: `.omo/drafts/train-oracle-spec-handoff.md:65-66` - no reconstruction and no runtime PASS claims
  - Guardrail: `.omo/evidence/model-belief-files-train-oracle-spec-handoff.md:64-65` - local verification and HTML wrapper exclusion

  Acceptance criteria (agent-executable only):
  - [ ] `Test-Path -LiteralPath '.omo\reports\trainoracle-reconstruction-readiness.md'` returns `True`.
  - [ ] The readiness brief includes source files, evidence files, missing/reconstruct target status, no-product-SPEC-edits status, no runtime evidence claims, no issue closure, and explicit later-reconstruction readiness.
  - [ ] The readiness brief names `RULE_VALIDATION_ENGINE_CONTRACT.md` and `PLAN_SAFETY_GATE_SPEC.md` as not currently found/reconstruct targets unless Task 3 finds otherwise.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: C003 readiness brief contains required sections
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "$p='.omo\reports\trainoracle-reconstruction-readiness.md'; Test-Path -LiteralPath $p; Select-String -LiteralPath $p -Pattern 'Source files|Evidence files|Missing/reconstruct targets|No product SPEC edits|No runtime evidence claims|No issue closure|Ready for later reconstruction'"
    Expected: Test-Path prints True and all required readiness sections are present.
    Evidence: .omo/evidence/task-9-c003-readiness.txt

  Scenario: C003 brief blocks false closure
    Tool:     powershell
    Steps:    powershell -NoProfile -Command "Select-String -LiteralPath '.omo\reports\trainoracle-reconstruction-readiness.md' -Pattern 'RULE_VALIDATION_ENGINE_CONTRACT.md|PLAN_SAFETY_GATE_SPEC.md|must not claim restored|must not close issues|D9 runtime evidence not claimed'"
    Expected: Both target filenames and all false-closure guardrails are present.
    Evidence: .omo/evidence/task-9-c003-readiness-error.txt
  ```

  Commit: NO | Message: `docs(trainoracle): write reconstruction readiness brief` | Files: [.omo/reports/trainoracle-reconstruction-readiness.md, .omo/evidence/task-9-c003-readiness.txt, .omo/evidence/task-9-c003-readiness-error.txt]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - every task done, every acceptance criterion met
- [ ] F2. Code quality review - diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA - every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity - nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch - clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/trainoracle-spec-inventory-pass.md`.
- Current work unit does not require a commit unless the caller explicitly asks; all task-level commit lines are `NO`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
