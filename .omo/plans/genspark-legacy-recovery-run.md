# Genspark Legacy Recovery Run

## TL;DR
> Summary:      Recover useful TrainOracle legacy materials from the already accessible Genspark agent page by capturing the current browser surface, asking the session for additional source materials, and producing a limits-aware recovery report. The run must never treat compacted notices or agent reconstructions as original full history.
> Deliverables:
> - `.omo/evidence/genspark-legacy-recovery-20260625/01-browser-state.md`
> - `.omo/evidence/genspark-legacy-recovery-20260625/01-body-text.txt`
> - `.omo/evidence/genspark-legacy-recovery-20260625/01-link-manifest.json`
> - `.omo/evidence/genspark-legacy-recovery-20260625/02-request-prompt.md`
> - `.omo/evidence/genspark-legacy-recovery-20260625/02-agent-response.md`
> - `.omo/evidence/genspark-legacy-recovery-20260625/02-download-attempts.json`
> - `.omo/evidence/genspark-legacy-recovery-20260625/03-recovery-report.md`
> - `.omo/evidence/genspark-legacy-recovery-20260625/03-adversarial-compaction-expiry.md`
> - `.omo/evidence/genspark-legacy-recovery-20260625/03-sensitive-boundary-audit.txt`
> Effort:       Short
> Risk:         Medium - authenticated session state, compacted history, expired file links, and sensitive data boundaries can all produce misleading recovery claims.

## Scope
### Must have
- Use the already accessible Genspark agent page in Chrome as the only authenticated browser surface.
- Fully expand the currently loadable page state, then capture sanitized page text, link manifest, compacted notices, and screenshots as evidence.
- Request additional TrainOracle legacy conversations/materials inside the existing Genspark session using the exact prompt in Task 2.
- Attempt recovery of useful linked materials from the browser session without exporting cookies, tokens, localStorage, or account secrets.
- Classify every recovered or referenced item as original source, currently loaded chat text, compacted summary, agent-generated reconstruction, expired/unavailable link, duplicate, or sensitive skip.
- Produce a final recovery report that separates useful recoverable material from compacted, expired, blocked, duplicate, or sensitivity-limited material.
- Preserve the existing project rule that local/repo files are truth and conversation ledgers are reference only, per `TRAINORACLE_SPEC_INDEX.md:28` and `TRAINORACLE_SPEC_INDEX.md:29`.
- Treat legacy material as reference-only unless later verified and promoted by a separate SPEC process, per `TRAINORACLE_SPEC_INDEX.md:42` and `SPEC_WORK_STATUS.md:83`.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not edit product SPEC files, design files, source code, or existing handoff documents.
- Do not claim compacted history is original full text.
- Do not claim any expired, inaccessible, or agent-reconstructed item is recovered source.
- Do not store cookies, bearer tokens, access tokens, refresh tokens, session IDs, localStorage dumps, or raw authenticated headers in evidence.
- Do not import raw athlete free-text, raw symptom clauses, injury narratives, medical notes, guardian private notes, or sensitive free-form comments into recovery outputs, per `SPEC_WORK_STATUS.md:95`.
- Do not let recovered legacy material override current SPEC baselines; new SPEC authoring prioritizes L0 current SPEC baselines over L1/L3/L2/L1.5 material, per `specs/legacy-reference/SOURCE_MAP.md:27` and `specs/legacy-reference/SOURCE_MAP.md:39`.
- Do not treat `11_API_AND_ENGINE_CONTRACTS.md` as `RULE_VALIDATION_ENGINE_CONTRACT.md`; the current status explicitly forbids that claim at `SPEC_WORK_STATUS.md:68`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none for product code; tests-after evidence integrity checks with Chrome automation plus PowerShell assertions.
- QA policy: every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-<N>-genspark-legacy-recovery-run.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> User constrained this recovery plan to 3 concrete steps, so each step is intentionally broad but still has binary evidence gates.

Wave 1 (no dependencies):
- Task 1: Capture current loadable Genspark browser surface and link manifest.

Wave 2 (after Wave 1):
- Task 2: Request additional TrainOracle legacy materials inside the Genspark session and attempt authenticated downloads.

Wave 3 (after Wave 2):
- Task 3: Run adversarial compacted/expired-link checks and write the limits-aware recovery report.

Critical path: Task 1 -> Task 2 -> Task 3

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1    | none       | 2, 3   | none                 |
| 2    | 1          | 3      | none                 |
| 3    | 1, 2       | final  | none                 |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Capture current loadable Genspark browser surface

  What to do: In the already accessible Genspark tab, expand `Load older messages` until the control is absent, disabled, or two consecutive attempts add no new body text. Capture the current state before asking the agent anything: sanitized browser-state notes, full body text, redacted DOM snapshot, screenshot, link manifest, and compacted-notice inventory. Record the supplied baseline findings and observed deltas: approximately 453 KB body text, 48 links, 46 file-like links, 39 unique file-like links, and compacted notices present.
  Must NOT do: Do not export cookies, localStorage, sessionStorage, request headers, authenticated tokens, or full URLs containing secret query parameters. Do not rely on screenshots alone.

  Parallelization: Can parallel: NO | Wave 1 | Blocks: [2, 3] | Blocked by: []

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `.omo/ulw-loop/genspark-legacy-recovery-20260625/brief.md:1` - existing recovery goal says to use the accessible Genspark page, extract currently loadable conversation and file-link manifest, and report compacted or blocked material.
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:28` - local files are truth.
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:29` - conversation ledgers are reference only.
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:44` - `.omo/` is the process-evidence area.
  - API/Type: Browser evidence schema - save counts under `counts.totalLinks`, `counts.fileLikeLinks`, `counts.uniqueFileLikeLinks`, `counts.compactedNotices`, and `counts.bodyBytes`.
  - Test:     PowerShell evidence assertions below - no app test framework is involved.
  - External: User supplied browser inspection - accessible page, fully expandable older messages, ~453 KB body text, 48 links, 46 file-like links, 39 unique file-like links, compacted notices present.

  Acceptance criteria (agent-executable only):
  - [ ] Evidence directory exists: `Test-Path '.omo/evidence/genspark-legacy-recovery-20260625'`.
  - [ ] Body text exists and is plausibly complete: `(Get-Item '.omo/evidence/genspark-legacy-recovery-20260625/01-body-text.txt').Length -gt 400000`.
  - [ ] Link manifest parses: `Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/01-link-manifest.json' -Raw | ConvertFrom-Json | Out-Null`.
  - [ ] Link counts either match the supplied inspection or `01-browser-state.md` contains `COUNT_DELTA:` explaining the change:
    `powershell -NoProfile -Command "$m=Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/01-link-manifest.json' -Raw | ConvertFrom-Json; $ok=($m.counts.totalLinks -eq 48 -and $m.counts.fileLikeLinks -eq 46 -and $m.counts.uniqueFileLikeLinks -eq 39); $delta=(Select-String -Path '.omo/evidence/genspark-legacy-recovery-20260625/01-browser-state.md' -Pattern 'COUNT_DELTA:' -Quiet); if(-not ($ok -or $delta)){ exit 1 }"`.
  - [ ] Compacted notices are inventoried: `powershell -NoProfile -Command "$c=(Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/01-compaction-notices.json' -Raw | ConvertFrom-Json); if($c.Count -lt 1){ exit 1 }"`.
  - [ ] Sensitive browser secrets are absent from saved evidence: `powershell -NoProfile -Command "$hits=Get-ChildItem '.omo/evidence/genspark-legacy-recovery-20260625' -File -Recurse | Select-String -Pattern 'Cookie:','Authorization: Bearer','access_token=','refresh_token=','sessionid=','__Secure-'; if($hits){ $hits | Out-File '.omo/evidence/genspark-legacy-recovery-20260625/task-1-secret-scan-fail.txt'; exit 1 }"`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: happy path browser extraction
    Tool:     playwright(real Chrome)
    Steps:    Attach to the already open Genspark tab; repeatedly click text selector "Load older messages" until absent/disabled/no growth after two tries; evaluate `document.body.innerText`, `document.documentElement.outerHTML`, `[...document.links].map((a,i)=>({index:i,text:a.innerText.trim(),href:a.href,download:a.download||null}))`, and compacted-notice text matches `/compact|summary|older history|conversation was/i`; save outputs to:
              .omo/evidence/genspark-legacy-recovery-20260625/01-browser-state.md
              .omo/evidence/genspark-legacy-recovery-20260625/01-page-expanded.png
              .omo/evidence/genspark-legacy-recovery-20260625/01-body-text.txt
              .omo/evidence/genspark-legacy-recovery-20260625/01-dom-snapshot-redacted.html
              .omo/evidence/genspark-legacy-recovery-20260625/01-link-manifest.json
              .omo/evidence/genspark-legacy-recovery-20260625/01-compaction-notices.json
    Expected: body text length is greater than 400000 bytes; link manifest parses; compacted notices count is at least 1; no cookie/token patterns appear in evidence.
    Evidence: .omo/evidence/task-1-genspark-legacy-recovery-run.txt

  Scenario: inaccessible or unstable current tab
    Tool:     playwright(real Chrome)
    Steps:    If the accessible Genspark tab is gone, reloads to login, or no longer exposes the already inspected page, do not request credentials; write `BLOCKED: accessible Genspark tab lost or requires re-authentication` to .omo/evidence/genspark-legacy-recovery-20260625/01-browser-state.md and capture .omo/evidence/genspark-legacy-recovery-20260625/01-blocked.png.
    Expected: no cookies/tokens are requested or saved; task stops with BLOCKED evidence instead of inventing page content.
    Evidence: .omo/evidence/task-1-genspark-legacy-recovery-run-error.txt
  ```

  Commit: NO | Message: `docs(recovery): capture genspark browser baseline` | Files: [.omo/evidence/genspark-legacy-recovery-20260625/*]

- [ ] 2. Request additional TrainOracle legacy materials inside the session

  What to do: Send one exact recovery request inside the existing Genspark session, save the prompt and response, then attempt authenticated downloads for every useful file-like link from Task 1 and every new link returned by the agent. The request must ask for missing conversations/materials, source files, wrapper URLs, lineage, and the currently missing or source-not-verified contracts, while forcing provenance labels and sensitivity boundaries.
  Must NOT do: Do not ask Genspark to reveal credentials, session secrets, account data, unrelated personal data, or private athlete medical/symptom free text. Do not accept a generated answer as original source unless it points to a downloadable/source artifact that is recovered.

  Parallelization: Can parallel: NO | Wave 2 | Blocks: [3] | Blocked by: [1]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `SPEC_WORK_STATUS.md:58` - current missing/source-not-verified contract section.
  - Pattern:  `SPEC_WORK_STATUS.md:62` - `RULE_VALIDATION_ENGINE_CONTRACT.md` is required but not found in current repo.
  - Pattern:  `SPEC_WORK_STATUS.md:63` - `PLAN_SAFETY_GATE_SPEC.md` is required but not found in current repo.
  - Pattern:  `SPEC_WORK_STATUS.md:83` - local/repo files are truth for file existence and repository state.
  - Pattern:  `specs/legacy-reference/SOURCE_MAP.md:34` - L1 Genspark agent context records 81 file wrapper URLs.
  - Pattern:  `specs/legacy-reference/SOURCE_MAP.md:35` - L1.5 knowledge base mirror had 76 of 81 synced.
  - Pattern:  `specs/legacy-reference/SOURCE_MAP.md:40` - legacy docs operations priority is L1 > L3 > L2 > L1.5.
  - API/Type: Recovered material classification - `ORIGINAL_SOURCE`, `CURRENT_PAGE_TEXT`, `COMPACTED_SUMMARY`, `AGENT_RECONSTRUCTION_NOT_SOURCE`, `EXPIRED_OR_UNAVAILABLE`, `DUPLICATE`, `SENSITIVE_SKIP`.
  - Test:     PowerShell assertions below over `02-agent-response.md`, `02-recovered-material-index.json`, and `02-download-attempts.json`.
  - External: Genspark session only - no out-of-session scraping or credential export.

  Acceptance criteria (agent-executable only):
  - [ ] Exact request prompt is saved to `.omo/evidence/genspark-legacy-recovery-20260625/02-request-prompt.md`.
  - [ ] Genspark response is saved to `.omo/evidence/genspark-legacy-recovery-20260625/02-agent-response.md` and screenshot to `.omo/evidence/genspark-legacy-recovery-20260625/02-agent-response.png`.
  - [ ] `02-recovered-material-index.json` parses and every item has `name`, `sourceLayer`, `classification`, `recoveryStatus`, `sensitivityAction`, and `evidencePath`.
  - [ ] `02-download-attempts.json` parses and contains one row per unique file-like link attempted or skipped with a reason.
  - [ ] No item classified as `ORIGINAL_SOURCE` has `recoveryStatus` of `agent_generated`, `compacted_only`, `expired`, `forbidden`, or `unavailable`:
    `powershell -NoProfile -Command "$i=Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/02-recovered-material-index.json' -Raw | ConvertFrom-Json; if($i | Where-Object { $_.classification -eq 'ORIGINAL_SOURCE' -and $_.recoveryStatus -match 'agent_generated|compacted_only|expired|forbidden|unavailable' }){ exit 1 }"`.
  - [ ] The response explicitly labels reconstruction limits: `Select-String -Path '.omo/evidence/genspark-legacy-recovery-20260625/02-agent-response.md' -Pattern 'AGENT_RECONSTRUCTION_NOT_SOURCE|compacted summary|not original full text'`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: request and recover available material
    Tool:     playwright(real Chrome)
    Steps:    Type and submit this exact prompt in the existing Genspark session:
              "Please recover user-owned TrainOracle legacy source materials available to this Genspark agent/session. Search this session/workspace for original conversations, files, wrapper URLs, and linked materials that are not fully visible in the currently loaded page. Return a table with columns: item_id, original_name, source_layer (L1 agent context, L1.5 knowledge_base, L2 AI Drive native, L3 docs, current chat text, unknown), artifact_type (original file, file wrapper link, currently loaded chat text, compacted summary, agent-generated reconstruction, expired or unavailable), URL_or_filename, relevance, sensitivity_flag, recovery_status, exact_blocker. Prioritize TrainOracle source maps, lineage/version logs, Phase C/D workflow files, RULE_VALIDATION_ENGINE_CONTRACT.md, PLAN_SAFETY_GATE_SPEC.md, COACH_RATIFICATION_SAFETY_DEFAULTS_2026_06_04_001, and any conversation/material that explains missing SPEC contracts. Do not include cookies, tokens, account identifiers, unrelated personal data, private athlete free text, symptom narratives, medical notes, or session secrets. Do not claim compacted history is original full text; label compacted summaries as compacted summaries. If you reconstruct from context, label it AGENT_RECONSTRUCTION_NOT_SOURCE."
              Save the prompt, response, response screenshot, recovered-material index, download attempts, and recovered files manifest to the evidence paths named in this task.
    Expected: the response contains a provenance-labeled table or list; every recovered item is classified; available file-like links are attempted from the authenticated browser context; unavailable links have exact blockers.
    Evidence: .omo/evidence/task-2-genspark-legacy-recovery-run.txt

  Scenario: agent returns only summaries or refuses access
    Tool:     playwright(real Chrome)
    Steps:    If the agent can only summarize compacted history, refuses, or returns links that cannot be opened, save the full response and create `02-download-attempts.json` rows with `recoveryStatus` values `compacted_only`, `refused`, `expired`, `forbidden`, or `unavailable`; do not create source files from the summary.
    Expected: no compacted-only or generated material is marked `ORIGINAL_SOURCE`; blockers are explicit and reproducible.
    Evidence: .omo/evidence/task-2-genspark-legacy-recovery-run-error.txt
  ```

  Commit: NO | Message: `docs(recovery): request trainoracle legacy materials` | Files: [.omo/evidence/genspark-legacy-recovery-20260625/*]

- [ ] 3. Run adversarial compacted/expired-link check and write limits report

  What to do: Falsify the recovery claims before reporting them. Cross-check every compacted notice from Task 1 against the Task 2 response and recovered index. For each unique file-like link, confirm whether it was downloaded, duplicate, expired, forbidden, unavailable, not relevant, or intentionally skipped for sensitivity. Produce a final report that lists recovered useful materials, blocked/expired materials, compacted-only material, sensitive skips, and exact limits.
  Must NOT do: Do not smooth over failures. Do not promote useful-looking summaries into source. Do not include raw session secrets in the final report. Do not decide current SPEC changes in this run.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [final] | Blocked by: [1, 2]

  References (executor has NO interview context - be exhaustive):
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:73` - legacy reference material is not current SPEC replacement.
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:89` - current missing/source-not-verified required contracts remain a separate area.
  - Pattern:  `TRAINORACLE_SPEC_INDEX.md:113` - safety and privacy invariants apply to handling sensitive material.
  - Pattern:  `SPEC_WORK_STATUS.md:97` - evidence status section distinguishes candidate/process evidence.
  - Pattern:  `SPEC_WORK_STATUS.md:120` - current read-first sequence for future SPEC work.
  - Pattern:  `specs/legacy-reference/SOURCE_MAP.md:39` - current SPEC baselines outrank legacy materials for new SPEC authoring.
  - API/Type: Final report sections - `Recovered useful source`, `Useful but not source`, `Compacted or not original`, `Expired or blocked`, `Sensitive/session-boundary skipped`, `Limits`, `Next requested materials`.
  - Test:     PowerShell assertions below over `03-recovery-report.md`, `03-adversarial-compaction-expiry.md`, and `03-sensitive-boundary-audit.txt`.
  - External: None - final report is a local evidence artifact.

  Acceptance criteria (agent-executable only):
  - [ ] Final report exists: `Test-Path '.omo/evidence/genspark-legacy-recovery-20260625/03-recovery-report.md'`.
  - [ ] Adversarial check exists and includes both compacted and link-expiry checks:
    `powershell -NoProfile -Command "$p='.omo/evidence/genspark-legacy-recovery-20260625/03-adversarial-compaction-expiry.md'; if(-not (Select-String $p -Pattern 'Compacted notice check' -Quiet)){ exit 1 }; if(-not (Select-String $p -Pattern 'Expired link check' -Quiet)){ exit 1 }"`.
  - [ ] Final report states limits for compacted history, expired/unavailable links, agent-generated reconstructions, and sensitive/session-boundary exclusions:
    `powershell -NoProfile -Command "$p='.omo/evidence/genspark-legacy-recovery-20260625/03-recovery-report.md'; foreach($s in @('compacted history','expired','agent-generated','sensitive/session-boundary')){ if(-not (Select-String $p -Pattern $s -Quiet)){ exit 1 } }"`.
  - [ ] Every unique file-like link from `01-link-manifest.json` has a terminal status in `02-download-attempts.json`:
    `powershell -NoProfile -Command "$m=Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/01-link-manifest.json' -Raw | ConvertFrom-Json; $d=Get-Content '.omo/evidence/genspark-legacy-recovery-20260625/02-download-attempts.json' -Raw | ConvertFrom-Json; $expected=$m.counts.uniqueFileLikeLinks; $actual=($d | Where-Object { $_.terminalStatus }).Count; if($actual -lt $expected){ exit 1 }"`.
  - [ ] No final evidence leaks tokens or cookies:
    `powershell -NoProfile -Command "$hits=Get-ChildItem '.omo/evidence/genspark-legacy-recovery-20260625' -File -Recurse | Select-String -Pattern 'Cookie:','Authorization: Bearer','access_token=','refresh_token=','sessionid=','__Secure-'; if($hits){ $hits | Out-File '.omo/evidence/genspark-legacy-recovery-20260625/03-sensitive-boundary-audit.txt'; exit 1 } else { 'APPROVED: no cookie/token patterns found' | Set-Content '.omo/evidence/genspark-legacy-recovery-20260625/03-sensitive-boundary-audit.txt' }"`.

  QA scenarios (MANDATORY - task incomplete without these):
  > Name the exact tool AND its exact invocation - not "verify it works". Browser use: use Chrome to drive the page; if Chrome is not available, download and use agent-browser (https://github.com/vercel-labs/agent-browser). Computer use: OS-level GUI automation for a non-browser desktop app.
  ```
  Scenario: adversarial recovery report passes
    Tool:     powershell
    Steps:    Run PowerShell assertions from the acceptance criteria, then write:
              .omo/evidence/genspark-legacy-recovery-20260625/03-recovery-report.md
              .omo/evidence/genspark-legacy-recovery-20260625/03-adversarial-compaction-expiry.md
              .omo/evidence/genspark-legacy-recovery-20260625/03-recovery-inventory.csv
              .omo/evidence/genspark-legacy-recovery-20260625/03-sensitive-boundary-audit.txt
    Expected: report separates source from summaries/reconstructions, every file-like link has terminal status, limits are explicit, no secret patterns appear.
    Evidence: .omo/evidence/task-3-genspark-legacy-recovery-run.txt

  Scenario: compacted or expired material is overclaimed
    Tool:     powershell
    Steps:    Search final index/report for invalid pairings: `ORIGINAL_SOURCE` with `compacted_only`, `AGENT_RECONSTRUCTION_NOT_SOURCE`, `expired`, `forbidden`, or `unavailable`; if any hit exists, write it to .omo/evidence/genspark-legacy-recovery-20260625/03-adversarial-compaction-expiry.md and mark the task failed.
    Expected: any overclaim fails the task; the report is corrected before handoff.
    Evidence: .omo/evidence/task-3-genspark-legacy-recovery-run-error.txt
  ```

  Commit: NO | Message: `docs(recovery): report genspark legacy recovery limits` | Files: [.omo/evidence/genspark-legacy-recovery-20260625/*]

## Final verification wave (MANDATORY - after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit - confirm only `.omo/evidence/genspark-legacy-recovery-20260625/` artifacts were created or changed by execution, and all three task evidence files exist.
- [ ] F2. Code quality review - confirm no product code, SPEC, design, or handoff source files changed.
- [ ] F3. Real manual QA - execute the Chrome extraction/request flow and PowerShell evidence checks exactly as written.
- [ ] F4. Scope fidelity - confirm compacted history, expired links, agent-generated reconstruction, sensitive skips, and session-boundary limits are reported without overclaiming.

## Commit strategy
- No commit is required for this no-code recovery run unless the user explicitly asks to archive evidence in git.
- If committing later, commit only `.omo/plans/genspark-legacy-recovery-run.md` and `.omo/evidence/genspark-legacy-recovery-20260625/`.
- Use Conventional Commits: `docs(recovery): archive genspark legacy recovery evidence`.
- Reference the plan file path in the final commit footer: `Plan: .omo/plans/genspark-legacy-recovery-run.md`.

## Success criteria
- All three recovery tasks complete with evidence under `.omo/evidence/genspark-legacy-recovery-20260625/`.
- The final report says exactly what was recovered, what remains compacted or blocked, and what limits apply.
- No compacted, expired, inaccessible, or agent-generated material is represented as original full source.
- No cookies, tokens, authenticated headers, or sensitive private athlete/medical free text appear in saved evidence.
- Product SPEC/design/source files remain unchanged.
