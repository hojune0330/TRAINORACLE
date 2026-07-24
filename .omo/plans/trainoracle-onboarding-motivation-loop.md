# trainoracle-onboarding-motivation-loop - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A complete pre-implementation package for the new first-visit and daily-motivation flow: the owner decisions, source inventory, testable work order, Fable UX proposal, Terra contract binding, Sol safety review, one controlling GitHub issue, and four linked draft PRs. Another computer can continue from those exact records without guessing.

**Why this approach:** The first screen should invite one quick choice and then move directly into real journaling, not a long onboarding carousel. Motivation comes from seeing one's own real records become viewable, with decoration kept as a separately approved future layer rather than pressure or fake rewards.

**What it will NOT do:** It will not change the live app, claim that training-plan generation works, invent analysis, or activate points, streaks, unlocks, storage, or privacy changes.

**Effort:** Large
**Risk:** Medium - all deliverables remain documentation-only, but the work crosses UX, safety, repository binding, model review, and GitHub handoff boundaries.
**Decisions already fixed:** Optional one-context router; training-plan interest shown only as service preparing; factual analysis now plus future decoration behind a separate acceptance gate.

Your next move: Open this handoff with `gpt-5.6-terra` at `xhigh` reasoning, execute the documentation stack, and stop before app implementation for the owner's next decision.

---

> TL;DR (machine): Large documentation-only orchestration with medium product-safety risk; publish WO017 issuance, Fable UX, Terra binding, and Sol preflight as four stacked draft PRs, then stop at `implementation_activation: PENDING_OWNER` with no app/runtime changes.

## Scope
### Must have
- Record the three owner decisions in a durable review artifact without promoting a draft SPEC or claiming runtime evidence.
- Create root `CODEX_WORK_ORDER_017.md` as a documentation-only order, then actually complete its pre-implementation Fable, Terra Very High, and Sol High documentation stages.
- Define the optional one-context first-visit router, returning-user rule, deterministic factual-receipt mapping, and honest `서비스 준비 중` training-plan route.
- Keep factual analysis and future decoration as separate authorities. Decoration remains proposal-only until catalog, unlock, and monetization decisions are separately accepted.
- Publish one controlling issue plus a four-PR stack: issuance -> Fable UX -> Terra binding -> Sol preflight/owner activation packet.
- Stop with `implementation_activation: PENDING_OWNER` before any `app/` change.
- Keep the primary worker fixed to `gpt-5.6-terra` with `reasoning_effort: xhigh` for the full handoff. Fable and Sol remain bounded delegated artifact/review roles; they do not replace the primary worker.
### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not modify `app/`, `impl/`, runtime evaluators, storage, consent, identity, sync, schema, deployment, or production configuration.
- Do not claim root `CODEX_WORK_ORDER_010.md` through `CODEX_WORK_ORDER_016.md` exist. They are inline stage IDs in `.omo/plans/trainoracle-remaining-work-orders.md:120-126`.
- Do not accept, close, recount, or promote `SPEC_TAP_FIRST_LOGGING.md`, `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`, or `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`.
- Do not authorize money, points, badges, levels, streak pressure, load/pace/weight rewards, pain-free rewards, safety-clearance rewards, plan-compliance rewards, or decoration unlock runtime.
- Do not invent analysis, thresholds, readiness/fatigue scores, medical/safety clearance, plan candidates, plan requests, waitlists, or personalized training output.
- Do not treat Sol, Terra, Codex, or Fable as a qualified human privacy, youth, medical, legal, scientific, or owner approver.
- Do not update `reports/work-harness/TRAINORACLE_WORK_CATALOG.json`; it governs the existing Formation track. Do not edit stale `HANDOFF_NEXT_CHAT.md`.

## Verification strategy
> Automated verification is agent-executed. The only human decision is the final product-owner activation gate, which is deliberately outside verification and remains pending.
- Test decision: tests-after with Node ESM validator plus `node:test` mutation coverage. No app build is required because `app/` and `impl/` must remain unchanged.
- Evidence: local command/browser receipts use ignored `.omo/evidence/wo017/task-<N>.txt` and `.omo/evidence/wo017/final-<N>.md`; every publication/final gate also posts a sanitized durable summary to the controlling GitHub issue. Receipts must contain no cookie, token, private authenticated URL, account identifier, or raw athlete text.
- Required commands:
  - `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase issuance` -> `PASS WO017 phase=issuance`.
  - `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase fable` -> `PASS WO017 phase=fable`.
  - `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase terra` -> `PASS WO017 phase=terra`.
  - `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase sol` -> `PASS WO017 phase=sol`.
  - `node --test specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` -> zero failed tests and at least eight named mutation cases.
  - `node specs/test-packages/reasoning-tier-harness.mjs validate` -> PASS with the Formation catalog unchanged.
  - `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --check-worktree` -> `PASS WO017 changed-path allowlist`.
  - `git diff --check` -> exit 0; through the Git Bash MCP run `if git diff --name-only origin/main...HEAD | rg -q '^(app|impl)/'; then echo 'FAIL forbidden app/impl path'; exit 1; else echo 'PASS no app/impl paths'; fi` -> exit 0.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) is used only where a declared dependency prevents safe parallelism.
- Wave 1: Todo 1 alone because all later document acceptance commands depend on its validator.
- Wave 2: Todos 2 and 3 in parallel with disjoint files after the validator exists.
- Wave 3: Todo 4 after owner/source artifacts exist.
- Wave 4: Todo 5, then Todo 6 integrated issuance gate.
- Wave 5: Todo 7 publishes the issuance issue/PR.
- Wave 6: Todo 8 obtains and publishes Fable UX output.
- Wave 7: Todo 9 performs Terra Very High binding/scenario work.
- Wave 8: Todo 10 performs Sol High advisory review and creates the pending activation packet.
- Wave 9: Todo 11 validates the full stack and stops at the owner gate.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6 | none |
| 2 | 1 | 4 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 1, 2, 3 | 5, 6 | none |
| 5 | 1, 4 | 6 | none |
| 6 | 1, 4, 5 | 7 | none |
| 7 | 6 | 8 | none |
| 8 | 7 | 9 | none |
| 9 | 8 | 10 | none |
| 10 | 9 | 11 | none |
| 11 | 10 | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Build the phased WO017 validator and mutation suite
  What to do / Must NOT do: Create `specs/test-packages/validate-wo017-onboarding-motivation.mjs`, `specs/test-packages/validate-wo017-onboarding-motivation.test.mjs`, and fixture directories under `specs/test-packages/fixtures/wo017/`. Add only `.omo/evidence/wo017/` to `.gitignore` so local receipts never dirty the four-commit stack. Export pure validators and CLI modes `--artifact owner|source|order|handoff|fable|terra|sol`, `--phase issuance|fable|terra|sol`, and `--check-worktree [--paths-file <file>]`. Validate structured authority fields, owner IDs, actor order, exact output paths, final markers, source classification, ordered factual-receipt mapping, plan-stub disclosure, separate decoration gate, sanitized Fable provenance, exact WO017 PR titles/issue links, `implementation_activation: PENDING_OWNER`, and changed-path allowlists. Do not use global forbidden-word scans because prohibition sections contain those terms.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2, 3, 4, 5, 6 | Can run with: none
  References: `.gitignore:1-4`; `specs/test-packages/validate-wo012-spec-linkage.mjs`; `specs/test-packages/validate-wo012-spec-linkage.test.mjs`; `CODEX_WORK_ORDER_008.md:88-101`; this plan's Scope and Required commands
  Acceptance criteria: `node --test specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` exits 0 with positive fixtures and named rejections `MANDATORY_ROUTER`, `PLAN_REQUEST_CAPTURE`, `DECORATION_RUNTIME`, `AI_AS_HUMAN_APPROVAL`, `PHANTOM_WORK_ORDER`, `FALSE_ANALYSIS`, `APP_PATH_CHANGE`, `IMPLEMENTATION_ACTIVATED`, `MOOD_PLUS_PAIN_PRECEDENCE`, `UNSAFE_FABLE_PROVENANCE`, and `MISSING_WO017_PR_LINK`; `git check-ignore .omo/evidence/wo017/probe.txt` prints the path and exits 0.
  QA scenarios: happy: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase issuance --root specs/test-packages/fixtures/wo017/valid-issuance` -> `PASS WO017 phase=issuance`; failure: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase issuance --root specs/test-packages/fixtures/wo017/mandatory-router` -> exit 1 and `FAIL WO017 MANDATORY_ROUTER`. Evidence `.omo/evidence/wo017/task-1.txt`.
  Commit: N | grouped into Todo 7 issuance commit

- [x] 2. Create the durable owner-direction record
  What to do / Must NOT do: Create `reports/review/WO017_OWNER_DIRECTION.md`. Record verbatim `권장 / 권장 / 권장+b` and bounded interpretations: optional one-context router with direct-record/skip; plan interest only as `서비스 준비 중`; factual analysis now plus future decoration only after separate acceptance. Add `runtime_authority: false`, `app_modification_authorized: false`, `decoration_runtime_authorized: false`, `plan_request_capture_authorized: false`, and `qualified_human_approval_recorded: false`. Existing local entries define returning users; router choices are transient.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 4 | Can run with: 3
  References: `.omo/drafts/trainoracle-onboarding-motivation-loop.md`; `SPEC_TAP_FIRST_LOGGING.md:3-19,64-92,120-150`; `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:132-176,207-220,292-313`; `NEGATIVE_SPACE.md:47-57,73-81`
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --artifact owner reports/review/WO017_OWNER_DIRECTION.md` -> `PASS WO017 artifact=owner`; final line `[DRAFT_COMPLETE]`.
  QA scenarios: happy: exact artifact command; failure: `node --test --test-name-pattern="rejects decoration runtime" specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` -> one named test passes. Evidence `.omo/evidence/wo017/task-2.txt`.
  Commit: N | grouped into Todo 7 issuance commit

- [x] 3. Create the source-authority and physical-file inventory matrix
  What to do / Must NOT do: Create `reports/review/WO017_SOURCE_AUTHORITY_MATRIX.md`. Classify physical sources as `CURRENT_APP_EVIDENCE`, `DRAFT_REFERENCE_ONLY`, `HISTORICAL_REFERENCE_ONLY`, or `MISSING_PHYSICAL_FILE`. Record root 017 as to-be-created and root 010-016 as absent stage IDs. Never infer a file from a heading, decision record, or conversation.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 4 | Can run with: 2
  References: `app/src/screens/home/FirstPage.tsx:17-74`; `app/src/screens/log-entry/EntryChooser.tsx:11-58`; `app/src/AppShell.tsx:14-24,36-90`; `app/src/screens/Trends.tsx:1-74,82-145`; `impl/src/plan-generator/generator.ts:3-12`; `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1754-1768,1792-1795`; `.omo/plans/trainoracle-remaining-work-orders.md:116-126`
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --artifact source reports/review/WO017_SOURCE_AUTHORITY_MATRIX.md` -> `PASS WO017 artifact=source`.
  QA scenarios: happy: exact artifact command; failure: `node --test --test-name-pattern="rejects phantom work order" specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` -> one named test passes. Evidence `.omo/evidence/wo017/task-3.txt`.
  Commit: N | grouped into Todo 7 issuance commit

- [x] 4. Create root CODEX_WORK_ORDER_017 with exact actor/model gates
  What to do / Must NOT do: Create root `CODEX_WORK_ORDER_017.md` with `status: ISSUED_DOCUMENTATION_ONLY`, `runtime_authority: false`, `app_modification_authorized: false`, and `next_actor: FABLE`. Task A Fable creates `reports/review/WO017_FABLE_UX_FLOW.md`; Task B Terra Very High creates `reports/review/WO017_TERRA_BINDING_MATRIX.md` and `specs/test-packages/WO017_ONBOARDING_MOTIVATION_SCENARIOS.md`; Task C Sol High creates `reports/review/WO017_SOL_ADVISORY_PREFLIGHT.md` and `reports/review/WO017_IMPLEMENTATION_ACTIVATION.md` with `PENDING_OWNER`; Task D is owner-only activation. Require separate stacked PRs, exact `[WO017]` PR titles, and the controlling-issue URL in every PR body. Plan tap shows inline `서비스 준비 중` with only journal/back/skip, no request/profile/waitlist/candidate/output. Receipt mapping is ordered: structured evening pain wins and points to the pain timeline (while confirming mood was also saved when both exist); otherwise explicit evening mood -> mood timeline; otherwise valid post-session distance -> weekly-distance view; otherwise generic local-save receipt. No fabricated threshold.
  Parallelization: Wave 3 | Blocked by: 1, 2, 3 | Blocks: 5, 6
  References: `CODEX_WORK_ORDER_009.md:1-30`; `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md:43-49`; `C:/Users/admin/.codex/skills/terra-sol-router/SKILL.md`; `app/src/screens/Trends.tsx:16-70,82-145`; `impl/src/plan-generator/generator.ts:3-12`; `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:577-588`; `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:220-234,270-289,546-557`
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --artifact order CODEX_WORK_ORDER_017.md` -> `PASS WO017 artifact=order`; final line `[DRAFT_COMPLETE]`.
  QA scenarios: happy: exact artifact command; failure: `node --test --test-name-pattern="rejects plan request capture|rejects AI as human approval|rejects ambiguous mood plus pain receipt" specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` -> all three named tests pass. Evidence `.omo/evidence/wo017/task-4.txt`.
  Commit: N | grouped into Todo 7 issuance commit

- [x] 5. Refresh index, status, and current worker handoff
  What to do / Must NOT do: Update `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`, and `reports/work-harness/NEXT_WORKER_HANDOFF.md`. Add WO017 as `ISSUED_DOCUMENTATION_ONLY / IMPLEMENTATION_NOT_AUTHORIZED`, link issuance artifacts/validator, and state Fable -> Terra Very High -> Sol High -> owner. Clarify the catalog JSON is Formation-only. Preserve all Formation gates and do not edit the catalog JSON, `HANDOFF_NEXT_CHAT.md`, README claims, issue counts, or SPEC statuses.
  Parallelization: Wave 4 | Blocked by: 1, 4 | Blocks: 6
  References: `TRAINORACLE_SPEC_INDEX.md:108-114,215-218`; `SPEC_WORK_STATUS.md:79-96,229-232,251,281`; `reports/work-harness/NEXT_WORKER_HANDOFF.md:1-17`; `reports/work-harness/TRAINORACLE_WORK_CATALOG.json:1-20`
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --artifact handoff TRAINORACLE_SPEC_INDEX.md SPEC_WORK_STATUS.md reports/work-harness/NEXT_WORKER_HANDOFF.md` -> `PASS WO017 artifact=handoff`; `node specs/test-packages/reasoning-tier-harness.mjs validate` -> PASS; protected-file diff empty.
  QA scenarios: happy: both acceptance commands; failure: `node --test --test-name-pattern="rejects implementation authorized handoff" specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` -> one named test passes. Evidence `.omo/evidence/wo017/task-5.txt`.
  Commit: N | grouped into Todo 7 issuance commit

- [x] 6. Run the local issuance gate and duplicate check
  What to do / Must NOT do: Run issuance validators once after inputs stabilize; stage no files yet. Before any publication, require the draft ledger to say `status: approved-for-terra-xhigh-execution`, identify `gpt-5.6-terra` with `reasoning_effort: xhigh` as the primary worker, record the owner's latest model-routing instruction, and contain no active obsolete review round; if not, stop before commit. A new pre-execution Momus or independent CLI review is not required. `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --check-worktree` must inspect tracked and untracked paths. Use connector calls `mcp__codex_apps__github_search_issues({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})` and `mcp__codex_apps__github_search_prs({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})`; ignore only the exact handoff PR `[HANDOFF][WO017] Terra xhigh execution order`, then require zero exact execution-title or execution-branch duplicates before publication. Stop with returned URLs if duplicates exist.
  Parallelization: Wave 4 | Blocked by: 1, 4, 5 | Blocks: 7
  References: Verification strategy; current `origin/main`; GitHub repository `hojune0330/TRAINORACLE`
  Acceptance criteria: issuance phase, tests, Formation harness, `git diff --check`, worktree allowlist, and Terra-xhigh owner-authorization ledger validation all pass; GitHub queries return zero execution duplicates after excluding the exact handoff PR; `git diff -- reports/work-harness/TRAINORACLE_WORK_CATALOG.json HANDOFF_NEXT_CHAT.md` empty.
  QA scenarios: happy: run all named commands and connector queries; failure: run `node -e "const fs=require('node:fs');fs.mkdirSync('.omo/evidence/wo017',{recursive:true});fs.writeFileSync('.omo/evidence/wo017/synthetic-paths.txt','app/src/AppShell.tsx','utf8')"`, then `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --check-worktree --paths-file .omo/evidence/wo017/synthetic-paths.txt` -> exit 1 `FAIL WO017 APP_PATH_CHANGE`, then run `node -e "require('node:fs').rmSync('.omo/evidence/wo017/synthetic-paths.txt',{force:true})"`. Evidence `.omo/evidence/wo017/task-6.txt`.
  Commit: N | validation gate

- [x] 7. Publish the issuance commit, controlling issue, and draft PR
  What to do / Must NOT do: Commit only the issuance allowlist, including this exact `.omo/plans/trainoracle-onboarding-motivation-loop.md` and its `.omo/drafts/trainoracle-onboarding-motivation-loop.md` resume ledger, as `docs(WO017): issue onboarding motivation planning track`; push `codex/onboarding-motivation-work-order`, create issue `[WO017] 신규 첫 화면과 매일 기록 동기 기획 트랙`, and create draft PR `[WO017] Issue onboarding motivation planning track` to `main`. Put the controlling-issue URL, full base/head SHA, sanitized validation summary, and rendered branch links to the work order, owner record, source matrix, plan, and validator in the PR body; put the PR URL/SHA in the issue. Do not merge.
  Parallelization: Wave 5 | Blocked by: 6 | Blocks: 8
  References: `C:/Users/admin/.codex/plugins/cache/sisyphuslabs/omo/4.19.0/skills/git-master/SKILL.md`; `C:/Users/admin/.codex/skills/terra-sol-router/SKILL.md`; recent repository commit subjects from `git log -10 --pretty=format:%s origin/main`
  Acceptance criteria: connector `mcp__codex_apps__github_search_issues({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})` returns exactly one exact-title controlling issue after filtering; `mcp__codex_apps__github_search_prs({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})` returns exactly one draft PR whose head is `codex/onboarding-motivation-work-order`; reciprocal URLs and exact head SHA appear in both; local branch equals pushed head and worktree is clean.
  QA scenarios: happy: exact connector queries plus `git rev-parse HEAD` and `git ls-remote origin refs/heads/codex/onboarding-motivation-work-order`; failure: if either pre-publication query in Todo 6 was nonzero, no create call is made. Evidence `.omo/evidence/wo017/task-7.txt`.
  Commit: Y | `docs(WO017): issue onboarding motivation planning track`

- [ ] 8. Obtain, verify, and publish the Fable UX/copy artifact
  What to do / Must NOT do: Use `mcp__node_repl__js` with the installed Chrome skill. Initialize `C:/Users/admin/.codex/plugins/cache/openai-bundled/chrome/26.715.61943/scripts/browser-client.mjs`, select `agent.browsers.get("extension")`, read `chrome.documentation()` once, then locate or open `https://www.genspark.ai/agents?id=20a1de44-c17e-4a59-b9a8-b0c8c46a6e2e`. Verify the visible agent/thread identity before sending the controlling issue/PR links and WO017 Task A; do not inspect cookies, storage, profiles, or credentials. Ask Fable for one self-contained artifact covering 375x667 flow, optional/skip/back/direct-record behavior, returning prompt, ordered factual receipts including mood-plus-pain precedence, four personas, reduced-motion/accessibility notes, and a visibly proposal-only decoration concept. Capture only a redacted visible-page receipt under ignored local evidence. A docs worker writes the returned content to `reports/review/WO017_FABLE_UX_FLOW.md` without inventing missing Fable text. Public provenance is limited to a sanitized model/session label, timestamp, issuance SHA, and a share-safe URL only when intentionally public; otherwise write `source_url: NOT_PUBLISHED_PRIVATE_SESSION`. Never publish account identifiers, authenticated/private URLs, cookies, or tokens. Create branch `fable/wo017-ux-flow` from issuance head and draft PR `[WO017] Add Fable onboarding UX flow` targeting `codex/onboarding-motivation-work-order`; include the controlling-issue URL and rendered Fable artifact link in its body and link the PR back from the issue. If Chrome cannot verify the visible session identity or Fable returns no substantive artifact, stop this task as blocked and do not substitute another model.
  Parallelization: Wave 6 | Blocked by: 7 | Blocks: 9
  References: `CODEX_WORK_ORDER_017.md` Task A; `app/src/screens/home/FirstPage.tsx:17-74`; `app/src/screens/log-entry/EntryChooser.tsx:11-58`; `reports/review/TAP_FIRST_V1_PERSONA_REVIEW.md:28-67`; `reports/review/WO017_OWNER_DIRECTION.md`
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase fable` -> `PASS WO017 phase=fable`; Fable artifact records sanitized label, timestamp, exact issuance SHA, share-safe URL or `NOT_PUBLISHED_PRIVATE_SESSION`, and no app implementation claim; one exact-title stacked draft PR targets the issuance branch and contains the issue URL.
  QA scenarios: happy: through `mcp__node_repl__js`, read the visible thread identifier/title and final substantive response, write only sanitized label/timestamp/SHA plus `NOT_PUBLISHED_PRIVATE_SESSION` when needed, then run the phase validator; failure: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase fable --root specs/test-packages/fixtures/wo017/fable-streak-pressure` -> exit 1 `FAIL WO017 STREAK_PRESSURE`. Evidence `.omo/evidence/wo017/task-8.txt` plus redacted browser receipt.
  Commit: Y | `docs(WO017): add Fable onboarding UX flow`

- [ ] 9. Run Terra Very High contract binding and scenario preparation
  What to do / Must NOT do: Continue in the primary `gpt-5.6-terra` session with `reasoning_effort: xhigh`, read-only outside owned files. Produce `reports/review/WO017_TERRA_BINDING_MATRIX.md` and `specs/test-packages/WO017_ONBOARDING_MOTIVATION_SCENARIOS.md`. Bind each Fable state/copy to current app evidence and draft authority, specify structured factual/insufficient states, and mark every future app change as `NOT_AUTHORIZED`. Do not edit `app/`, SPEC statuses, issue counts, or Fable artifact. Create branch `codex/wo017-terra-binding` from Fable head and draft PR `[WO017] Bind onboarding UX to current contracts` targeting `fable/wo017-ux-flow`; include the controlling-issue URL and rendered links to both Terra artifacts in its body and link the PR back from the issue.
  Parallelization: Wave 7 | Blocked by: 8 | Blocks: 10
  References: `reports/review/WO017_FABLE_UX_FLOW.md`; `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:220-234,270-289,546-557`; `specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md:115-127`; current app files cited by Task 8
  Acceptance criteria: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase terra` -> `PASS WO017 phase=terra`; every UX state has source path, authority, allowed fact, insufficient/error state, and implementation authorization false; exact-title stacked draft PR targets the Fable branch and contains the issue URL.
  QA scenarios: happy: phase command; failure: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase terra --root specs/test-packages/fixtures/wo017/terra-false-analysis` -> exit 1 `FAIL WO017 FALSE_ANALYSIS`. Evidence `.omo/evidence/wo017/task-9.txt`.
  Commit: Y | `docs(WO017): bind onboarding UX to current contracts`

- [ ] 10. Run Sol High advisory preflight and create the pending activation packet
  What to do / Must NOT do: Spawn `gpt-5.6-sol` at high reasoning for one bounded, non-authoritative adversarial review of the exact Terra head. Review coercive retention, youth/injury pressure, privacy/storage expansion, false plan/analysis claims, accessibility, AI-as-human authority, and decoration activation. A docs worker records the unaltered findings in `reports/review/WO017_SOL_ADVISORY_PREFLIGHT.md` and creates `reports/review/WO017_IMPLEMENTATION_ACTIVATION.md` with `implementation_activation: PENDING_OWNER`, exact issuance/Fable/Terra predecessor SHAs, `sol_head_sha: RECORDED_AFTER_COMMIT_IN_GITHUB_RECEIPT`, unresolved human gates, and no approval signature. After committing, record the resulting Sol head SHA only in the PR/issue receipt; never amend the packet to embed its own commit hash. Create branch `codex/wo017-sol-preflight` from Terra head and draft PR `[WO017] Record Sol pre-implementation advisory` targeting `codex/wo017-terra-binding`; include the controlling-issue URL and rendered links to both Sol artifacts in its body and link the PR back from the issue.
  Parallelization: Wave 8 | Blocked by: 9 | Blocks: 11
  References: exact Terra head; `NEGATIVE_SPACE.md:47-57,73-81`; `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:155-176,207-220,224-245,292-313`; `C:/Users/admin/.codex/skills/terra-sol-router/SKILL.md`
  Acceptance criteria: Sol report has exact model/effort, reviewed SHA, findings and verdict, and explicitly says non-authoritative; activation packet remains `PENDING_OWNER`; `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase sol` -> `PASS WO017 phase=sol`; exact-title stacked draft PR targets Terra branch and contains the issue URL.
  QA scenarios: happy: phase command; failure: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --phase sol --root specs/test-packages/fixtures/wo017/sol-ai-approval` -> exit 1 `FAIL WO017 AI_AS_HUMAN_APPROVAL`, and the same command with root `specs/test-packages/fixtures/wo017/sol-activated` -> exit 1 `FAIL WO017 IMPLEMENTATION_ACTIVATED`. Evidence `.omo/evidence/wo017/task-10.txt`.
  Commit: Y | `docs(WO017): record Sol pre-implementation advisory`

- [ ] 11. Validate the full PR stack and stop at the owner implementation gate
  What to do / Must NOT do: Run all phases and tests against Sol head, verify four PR bases/heads form the declared stack, and add a sanitized `STACK_READY_FOR_FINAL_GATES` controlling-issue comment with all PR/artifact links, model labels, validator summaries, remaining human gates, and `next_actor: FINAL_GATES`. Update no product file and do not set activation true. Leave every PR open and unmerged. Local ignored evidence may remain; `git status --short` must be empty.
  Parallelization: Wave 9 | Blocked by: 10 | Blocks: final verification
  References: Todos 7-10 GitHub objects and exact SHAs; activation packet; Verification strategy
  Acceptance criteria: all four phase validators and tests pass; Formation harness passes; no `app/`/`impl/` changes anywhere in the stack; issue comment lists the exact PR/artifact stack and says final gates must run before owner activation; all worktrees clean.
  QA scenarios: happy: call `mcp__codex_apps__github_search_issues({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})` and `mcp__codex_apps__github_search_prs({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})`; for each of the four returned exact WO017 PR numbers call `mcp__codex_apps__github_get_pr_info({repository_full_name:"hojune0330/TRAINORACLE",pr_number:<discovered_number>})`; then call `mcp__codex_apps__github_compare_commits({repo_full_name:"hojune0330/TRAINORACLE",base:"main",head:"codex/onboarding-motivation-work-order"})`, the same call with `base:"codex/onboarding-motivation-work-order",head:"fable/wo017-ux-flow"`, with `base:"fable/wo017-ux-flow",head:"codex/wo017-terra-binding"`, and with `base:"codex/wo017-terra-binding",head:"codex/wo017-sol-preflight"`. Require one exact controlling issue, four open draft PRs, and those exact adjacent base/head pairs. Failure: `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --check-worktree --paths-file specs/test-packages/fixtures/wo017/app-paths.txt` -> exit 1 `FAIL WO017 APP_PATH_CHANGE`. Evidence `.omo/evidence/wo017/task-11.txt`.
  Commit: N | final handoff only

## Final verification wave
> F1-F4 run in parallel after all todos. F5 runs only after all four approve. If any gate finds a blocker, do not edit, amend, rebase, force-push, or propagate fixes through the existing stack: post one sanitized `FINAL_GATE_REJECTED` issue comment, leave all PRs open/unmerged, and require a replacement execution plan with fresh receipts and SHAs. These checks do not replace the separate pending product-owner implementation decision.
- [ ] F1. Plan compliance audit: create a fresh disposable verification worktree at the exact Sol head and copy the sanitized ignored task receipts into its already ignored `.omo/evidence/wo017/`; do not modify the shared Git common exclude file. Spawn `lazycodex-gate-reviewer` there with this plan and those copied receipts. Its configured fallback report may remain untracked only inside that disposable worktree. Require terminal `APPROVE` with no blockers; an evidence worker saves the verbatim terminal message plus reviewed SHA to the primary worktree's ignored `.omo/evidence/wo017/final-1.md`, verifies the disposable path is the exact launcher-owned path, and removes that whole worktree with `git worktree remove --force <verified_literal_path>`.
- [ ] F2. Safety/authority audit: spawn `gpt-5.6-sol` with `reasoning_effort: high`, exact Sol head SHA, read-only scope, and the seven named review classes; require terminal `PASS` or findings, then have an evidence worker save the verbatim result and SHA to `.omo/evidence/wo017/final-2.md`. Any finding blocks completion.
- [ ] F3. GitHub handoff QA: call `mcp__codex_apps__github_search_issues({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})` and `mcp__codex_apps__github_search_prs({query:"WO017",repository_full_name:"hojune0330/TRAINORACLE",state:"open",topn:50})`; for each discovered PR number call `mcp__codex_apps__github_get_pr_info({repository_full_name:"hojune0330/TRAINORACLE",pr_number:<discovered_number>})`; call `mcp__codex_apps__github_fetch_issue_comments({repo_full_name:"hojune0330/TRAINORACLE",issue_number:<controlling_issue_number>})`; then run the four exact compare calls from Todo 11 and inspect each compare result's `files` list independently. Require one exact issue, four exact-title open draft PRs, actual expected bases/heads, issue URL and rendered owned-artifact links in every PR body, reciprocal PR URLs in issue comments, exact SHA chain, and no forbidden path in any adjacent layer. Save normalized connector results to ignored `.omo/evidence/wo017/final-3.md`.
- [ ] F4. Scope fidelity: resolve and record the exact main, issuance, Fable, Terra, and Sol SHAs. In the Sol worktree run `git diff --name-only <main-sha>..<issuance-sha>`, `git diff --name-only <issuance-sha>..<fable-sha>`, `git diff --name-only <fable-sha>..<terra-sha>`, and `git diff --name-only <terra-sha>..<sol-sha>`; validate every adjacent list against its owning allowlist so a later revert cannot hide an earlier forbidden change. Then run `node specs/test-packages/validate-wo017-onboarding-motivation.mjs --check-worktree`, `git diff --check <main-sha>..<sol-sha>`, and `rg -n "^implementation_activation: PENDING_OWNER$" reports/review/WO017_IMPLEMENTATION_ACTIVATION.md`. Require no `app/`, `impl/`, runtime, schema, consent, identity, sync, deployment, protected-catalog, or stale-handoff path in any layer. Save complete command/output/exit-code receipts to `.omo/evidence/wo017/final-4.md`.
- [ ] F5. Publish the final gate receipt: after F1-F4 all approve, read only their ignored sanitized summaries and call `mcp__codex_apps__github_add_comment_to_issue({repo_full_name:"hojune0330/TRAINORACLE",pr_number:<controlling_issue_number>,comment:<sanitized_F1_F4_results_exact_sol_sha_and_next_actor_OWNER>})`. Then call `mcp__codex_apps__github_fetch_issue_comments({repo_full_name:"hojune0330/TRAINORACLE",issue_number:<controlling_issue_number>})` to verify the final comment, run `git status --short` in every retained worktree -> empty, and leave `implementation_activation: PENDING_OWNER`.

## Commit strategy
- Four atomic documentation commits, one per stacked PR: issuance, Fable UX, Terra binding, Sol advisory/activation packet.
- No force-push, merge, issue closure, or implementation commit. New review deltas use ordinary commits on their owning stacked branch.
- A final-gate blocker freezes the entire four-PR stack; corrections require a replacement execution plan and regenerated stack instead of ordinary commits to an earlier branch.
- The controlling issue remains open with `next_actor: OWNER`.

## Success criteria
- The owner-authorized primary worker remained `gpt-5.6-terra` with `reasoning_effort: xhigh`; no additional pre-execution dual-review gate was invented.
- Root WO017, owner/source records, phased validator/tests, and current handoff surfaces physically exist and are linked.
- Fable UX, Terra Very High binding/scenarios, and Sol High advisory outputs each have exact source/head SHA and separate stacked PRs.
- First-visit, returning-user, factual receipt, service-preparing plan, and proposal-only decoration behavior are fully specified without stored router answers or fabricated analysis.
- All validators pass; Formation harness remains green; the full stack changes no `app/`, `impl/`, runtime, schema, consent, identity, sync, or deployment path.
- The project stops at `implementation_activation: PENDING_OWNER` with one controlling issue and four open draft PRs.
