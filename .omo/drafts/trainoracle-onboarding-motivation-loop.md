---
slug: trainoracle-onboarding-motivation-loop
status: high-accuracy-review-blocked-by-independent-cli-policy
intent: clear
review_required: true
pending-action: do-not-execute-until-a-fresh-independent-cli-lane-can-return-okay
approach: "Create and publish a four-PR documentation stack for the first-visit router and truthful daily analysis-motivation loop; complete Fable, Terra High, and Sol High pre-implementation stages, then stop at owner activation."
---

# Draft: trainoracle-onboarding-motivation-loop

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| id | outcome | status | evidence path |
|---|---|---|---|
| C1 | First-time visitors choose why they came without reading a long explanation or being trapped in onboarding. | active | `app/src/screens/home/FirstPage.tsx:17-74`; `NEGATIVE_SPACE.md:78-81` |
| C2 | One-tap router choices lead directly to an existing journal route; visible/editable accumulation begins inside the journal and does not turn the router into a multi-step questionnaire. | active | `SPEC_TAP_FIRST_LOGGING.md:64-92`; `reports/review/TAP_FIRST_V1_PERSONA_REVIEW.md:54-67` |
| C3 | Saving and returning produces truthful curiosity about the athlete's own records and analysis without points, streak pressure, or invented findings. | active | `app/src/AppShell.tsx:40-57,114-147`; `app/src/screens/Trends.tsx:70-92`; `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:220-234,270-289,546-557` |
| C4 | Training-plan interest is presented only within the real implementation boundary and never as a functioning plan generator while it is not one. | active | `impl/src/plan-generator/generator.ts:3-12`; `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1761,1768,1794` |
| C5 | Fable, Terra High, Sol High, owner, and later implementation/QA actors receive non-overlapping authority and stop conditions. | active | `SPEC_TAP_FIRST_LOGGING.md:152-159`; `C:/Users/admin/.codex/skills/terra-sol-router/SKILL.md` |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->
| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| First-visit answers need persistence | Keep them session/transient only; do not add profile, audit, or server fields. | The choices are routing hints, not athlete facts, and no new consent or schema is needed. | yes |
| First-time versus returning | `localOnlyCount() === 0` means first-time for this local device; after a session skip the router remains suppressed only for that session. Any existing local entry routes to the compact returning-user prompt instead of onboarding. | This uses current local journal truth without adding a behavioral profile. | yes |
| Analysis can motivate before enough data exists | Show a labeled example or an honest insufficient-data state, never a fabricated personal result. | Every point needs source refs or an explicit insufficient state. | yes |
| A readiness score would be engaging | Do not use a readiness/fatigue scalar; use separate factual groups such as training performed, self-reported response, and data quality. | The accepted projection boundary forbids a scalar and diagnostic framing. | yes |
| More screens create more desire to continue | Cap the flow by context, not by question; choices accumulate visibly on the same path. | The repository's v1 persona review rejected repeated low-information screens. | yes |
| Money/points should be copied from Toss | Copy immediate feedback and visible accumulation only; do not copy economic reward, streak, load, pace, weight, pain-free, or compliance incentives. | Existing safety and delight drafts prohibit these reward paths. | yes |
| Test strategy | Create `specs/test-packages/validate-wo017-onboarding-motivation.mjs` and `specs/test-packages/validate-wo017-onboarding-motivation.test.mjs`; require `node specs/test-packages/validate-wo017-onboarding-motivation.mjs` and `node --test specs/test-packages/validate-wo017-onboarding-motivation.test.mjs` to PASS owner-decision, authority, path/link, forbidden-claim, no-runtime, and no-decoration-activation checks. Any later UI implementation uses tests-after plus mobile visual QA and reduced-motion/keyboard/screen-reader checks. | The current task is planning and instruction publication, not product code. | yes |

## Findings (cited - path:lines)
- The empty home explains the product in several paragraphs, then sends the user to a second generic chooser; it has no visit-reason router (`app/src/screens/home/FirstPage.tsx:17-74`; `app/src/screens/log-entry/EntryChooser.tsx:17-58`).
- App state starts at `home` and only knows `home/log/trends/guide`; there is no accepted onboarding or purpose-profile state (`app/src/AppShell.tsx:14-24,36-90`).
- The existing tap-first draft already records the owner's same motivation direction, but its status remains `PLAN_AWAITING_OWNER_APPROVAL`; it is not canonical or runtime evidence (`SPEC_TAP_FIRST_LOGGING.md:3-19`).
- The v1 persona pass rejected one-question-per-screen chains because answers disappeared and feedback arrived too late; v2 requires one context per screen, a visible ink stack, and small transition budgets (`reports/review/TAP_FIRST_V1_PERSONA_REVIEW.md:28-67`; `SPEC_TAP_FIRST_LOGGING.md:64-92`).
- Immediate motion may communicate state, but must respect reduced motion and carry information rather than decorate (`SPEC_TAP_FIRST_LOGGING.md:120-138`).
- Product guardrails reject five-slide onboarding, AI-chat-first entry, badges/levels/streak pressure, and pressure on injured athletes (`NEGATIVE_SPACE.md:47-57,73-81`).
- The decoration contract is still `DRAFT_FOR_REVIEW`, has no runtime evidence, and leaves catalog, unlock numbers, and monetization open; it cannot authorize points or monetary rewards (`specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:3-20,132-176,207-220,292-313`).
- Trends currently use real local entries and already have a truthful empty state; any new teaser must preserve source refs or an explicit `INSUFFICIENT_SOURCE` state (`app/src/screens/Trends.tsx:70-92`; `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:220-234,270-289,546-557`).
- Direct `CODEX_WORK_ORDER_010.md` through `CODEX_WORK_ORDER_016.md` files are not present locally. Their IDs exist only in decision/review references. Execution will create root `CODEX_WORK_ORDER_017.md`; that work order must state this inventory fact and must not claim those absent files were opened.
- The executable Plan Generator is still an explicit stub (`impl/src/plan-generator/generator.ts:3-12`). The formation draft keeps Plan Generator/App Bridge binding and runtime evidence open and makes no production/app/runtime claim (`specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1754-1768,1792-1795`).
- `origin/main` and the planning worktree resolved to `1d8fc5382289ce3e2d16ad3b19f7257e1fa858c2` during discovery. The local `main` ref was 55 commits behind and must not be used as the base. Execution must refresh GitHub PR/issue state and record its own timestamped handoff evidence instead of reusing this observation.
- `app/` remains Fable-owned and Formation/Plan Generator implementation is still stopped (`TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md:43-49`). Terra may not implement the UI unless a later owner decision explicitly transfers that boundary.
- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` cannot authorize this surface: App Bridge, runtime, UI, and analysis bindings remain OPEN (`specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:577-588`). WO017 owns only routing/copy and presentation of facts already available in the current app.

## Decisions (with rationale)
- OWNER-017-01 accepted: the visit-reason router is optional, occupies one context screen, and always retains a direct-record/skip path.
- OWNER-017-02 accepted: `훈련 계획이 궁금해요` may appear now only with an equally visible `서비스 준비 중` label; it cannot collect a plan request, generate a candidate, or imply runtime availability.
- OWNER-017-03 accepted: daily motivation combines factual analysis progress with a future stamp/decoration layer. The two layers remain separate: analysis uses real source-backed records, while decoration requires its own catalog/unlock acceptance and may not use money, points, streak pressure, training load, pace, weight, pain-free status, safety clearance, or plan compliance.
- Recommended product pattern: an optional one-context visit-reason router, followed by immediate routing into an existing action. Do not create an explanatory carousel or a success-only completion slide.
- Recommended motivation pattern: each tap visibly changes the current page; each save gives a factual receipt of what was added and which real view can now use it. Deterministic mapping: post-session with a valid distance may point to the current weekly-distance view; evening with an explicit mood may point to the mood timeline; evening with structured pain may point to the pain timeline; every other save, including race-only or skipped values, receives only the generic local-save receipt. No good/bad score and no invented minimum-data threshold.
- Recommended recurring pattern: returning users do not repeat first-visit onboarding. They see a compact `오늘 무엇을 남길까요?` choice and, after saving, a truthful next-view invitation based only on existing records.
- Recommended actor routing: Fable owns independent UX/copy/persona flow and any later `app/` implementation; Terra High owns repository binding, work-order/contract/test artifacts, mechanical validation, and handoff; Sol High performs one non-authoritative adversarial preflight for dark patterns, youth pressure, privacy, and false claims; the owner approves public product choices and any storage or monetization change.
- Sol/Terra/Codex review is never a qualified human privacy, youth, medical, legal, or owner approval. If any proposal adds persistence, consent, identity, server sync, or privacy behavior, stop before implementation and require named qualified human review.
- Training-plan choice behavior is fixed: tapping it reveals an inline `서비스 준비 중` state and only existing `일지 시작`, `뒤로`, or `건너뛰기` routes. It creates no request record, candidate, waitlist, generated output, or profile signal.
- Work-order publication does not authorize app implementation. Required order: owner choices -> create documentation-only WO017 -> Fable UX/copy artifact -> Terra contract/test binding -> Sol advisory preflight -> owner implementation activation -> Fable `app/` implementation -> automated/mobile/accessibility QA. Insert qualified human review before activation if privacy/storage changes.
- Authority matrix: WO017 references but does not duplicate, accept, close, or promote `SPEC_TAP_FIRST_LOGGING.md`, `JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`, or `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`. It owns only first-visit routing/copy, returning prompt rules, and presentation of current source-backed facts.

## Scope IN
- First-visit purpose choice architecture, skip/back/direct-record route, and mobile copy.
- Visible accumulation/ink-stack behavior aligned to `SPEC_TAP_FIRST_LOGGING.md` without promoting that draft.
- Post-save factual feedback and daily-return analysis curiosity loop.
- Honest handling of example, insufficient-data, safety-review, and service-preparing states.
- Agent/model ownership, deliverables, evidence requirements, approval gates, and cross-links.
- Documentation-only work order and associated validation plan after approval.
- A future decoration concept may be designed as a visibly non-functional proposal, but no catalog, unlock threshold, streak, or runtime state may be activated under WO017.

## Scope OUT (Must NOT have)
- No `app/` implementation, deployment, schema migration, issue closure, canonical promotion, or runtime-evidence claim in this planning task.
- No money, points, badges, levels, streak-pressure copy, training-volume/pace/body-weight rewards, pain-free rewards, or plan-compliance rewards.
- No fabricated analysis, hidden default values, readiness score, medical/safety clearance language, or functioning-plan claim.
- No mandatory sign-up, coach connection, or onboarding completion before local journaling.
- No raw memo, symptom clause, or visit-reason text in audit/profile/server storage.
- No five-slide carousel, one-question-per-screen chain, or screen transition that hides previous choices.
- No modification of `app/`, `impl/`, runtime, storage, consent, schema, identity, sync, or deployment while executing the documentation-only WO017 issuance package.

## Open questions
- None blocking plan creation. Fable, Terra, and Sol may recommend copy or interaction deltas, but only the owner may change the three accepted product choices.

## Approval gate
status: approved-for-execution-after-dual-review
approval_evidence: "Owner reply: 권장 / 권장 / 권장+b"
approval_interpretation: "OWNER-017-01 option A; OWNER-017-02 option A; OWNER-017-03 option A plus future option B under separate decoration acceptance."
execution_evidence: "Owner instruction: 한번더 고정밀 검토 후 이상 없으면 진행해."
next_action: Current plan hash is `5fa90e4a4e7f855e867a659a6f4c121effdaf2d83ce888b105a5a1ba266f4562`. Content review corrections are complete, but the required independent Codex CLI lane cannot execute its descriptor verifier under the inherited nested sandbox policy. Do not issue WO017 or modify `app/` until a fresh Momus plus independent CLI round both return unconditional OKAY on the same live hash.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->

## High-accuracy review state
Round `wo017-1a7f7b1aa2564fdf9b9669055a27c619` was terminalized as `INCONCLUSIVE`: the independent Codex CLI launch emitted a Windows temporary-home warning before a process/session receipt was accepted. The in-flight Momus lane was invalidated and shut down without reuse. No plan verdict from that round is accepted.

Round `wo017-3616b5f237b34644a06c16e751cd645e` was terminalized without approval. Momus returned `ITERATE` because task commands, changed-path/GitHub checks, and the owner stop gate were not concrete enough. Independent gpt-5.6-sol xhigh returned `INCONCLUSIVE` because its first descriptor-relative verifier command was rejected by the read-only sandbox before it read the plan. The plan was then expanded to cover the user's full Fable -> Terra High -> Sol High authorization and corrected to use exact dependencies, commands, connector names, branch bases, and the final pending-owner stop.

Fresh review round metadata is appended only after a disposable workspace, pre-created verifier, copied plan, and matching plan SHA have all been verified locally. No earlier session or verdict may be reused.

Round `wo017-19f8b1843487e76f3552b` was terminalized without approval. Momus verified hash `30b0b7887bee23e6fe5d61e5b2c043a323008454f40e0645e0e44bf648441fbc` and returned `ITERATE`: Node's `--test-name-pattern` order was wrong, a failure setup assumed POSIX `printf`, and the gate-reviewer verdict token needed `APPROVE`. Independent gpt-5.6-sol xhigh session `019f8b1b-a00c-7021-91d3-cc9596aaa26c` did not read the plan because nested PowerShell execution was policy-blocked; its technical `REJECT` is treated as `INCONCLUSIVE` for plan quality. All three Momus corrections were applied, producing a new plan hash.

```json
{
  "phase": "review_round_initialized",
  "review_required": true,
  "plan_path": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
  "plan_sha256": "30b0b7887bee23e6fe5d61e5b2c043a323008454f40e0645e0e44bf648441fbc",
  "review_round_id": "wo017-19f8b1843487e76f3552b",
  "round_status": "terminal_no_approval",
  "pending-action": "start fresh round on revised plan hash",
  "review": {
    "momus": {
      "status": "ITERATE",
      "workspace_root": "D:/admin/Documents/TRAINORACLE-onboarding-work-order",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "round_id": "wo017-19f8b1843487e76f3552b",
      "plan_sha256": "30b0b7887bee23e6fe5d61e5b2c043a323008454f40e0645e0e44bf648441fbc",
      "launch_id": "momus-19f8b1aec9d411678c",
      "session": "019f8b1b-867b-7822-8a96-444db11d4877",
      "result": "Correct test-name ordering, Windows-portable synthetic path setup, and gate-reviewer APPROVE token."
    },
    "independent": {
      "status": "INCONCLUSIVE",
      "workspace_root": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b1843487e76f3552b/workspace",
      "runtime_home": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b1843487e76f3552b/codex-home",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "verifier": ".review/verify-plan.ps1",
      "round_id": "wo017-19f8b1843487e76f3552b",
      "plan_sha256": "30b0b7887bee23e6fe5d61e5b2c043a323008454f40e0645e0e44bf648441fbc",
      "launch_id": "independent-19f8b1aec9d1e7f2be",
      "session": "019f8b1b-a00c-7021-91d3-cc9596aaa26c",
      "result": "Verifier command was blocked by policy before any plan read."
    }
  }
}
```

```json
{
  "phase": "review_round_initialized",
  "review_required": true,
  "plan_path": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
  "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
  "review_round_id": "wo017-19f8b24df6ed660b8446f",
  "round_status": "inconclusive",
  "sandbox": "workspace-write-isolated-review-workspace",
  "pending-action": "fresh round required after independent verifier policy block",
  "review": {
    "momus": {
      "status": "invalidated_by_other_lane",
      "workspace_root": "D:/admin/Documents/TRAINORACLE-onboarding-work-order",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "round_id": "wo017-19f8b24df6ed660b8446f",
      "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
      "launch_id": "momus-19f8b2558d54da3e21",
      "session": "019f8b25-cb01-70a3-8b6f-80eca7525cb0",
      "result": "ITERATE on Task 11 exact GitHub QA; the claimed EOF defects were independently disproved by physical line counts. The round is invalidated by the independent lane."
    },
    "independent": {
      "status": "INCONCLUSIVE",
      "workspace_root": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b24df6ed660b8446f/workspace",
      "runtime_home": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b24df6ed660b8446f/codex-home",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "verifier": ".review/verify-plan.exe",
      "verifier_sha256": "57a95af2e2b627a3808feb6afbf21cbf580acc973424d047b5ee619d8ab0c01b",
      "round_id": "wo017-19f8b24df6ed660b8446f",
      "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
      "launch_id": "independent-19f8b2558d51ad73cf",
      "session": "019f8b25-e483-7161-b379-106533bb45b0",
      "result": "The precompiled descriptor verifier was policy-blocked before plan read despite an isolated workspace-write request."
    }
  }
}
```

## Subsequent content-review iterations
- Native Momus and supplementary gpt-5.6-sol xhigh reviews continued only to improve plan quality; they do not substitute for the required independent Codex CLI lane.
- Corrections applied after those reviews: deterministic pain-before-mood receipt precedence; ignored local evidence with sanitized GitHub summaries; exact PR titles, bases, artifact links, and issue links; private Fable provenance; callable Chrome control; predecessor-only activation SHAs; serial final receipt F5; disposable F1; final-gate stack freeze; per-layer forbidden-path checks; and pre-publication draft-ledger validation.
- Current live plan SHA-256: `5fa90e4a4e7f855e867a659a6f4c121effdaf2d83ce888b105a5a1ba266f4562`.
- Final content-only receipts on that exact hash: Momus session `019f8b4c-8c18-77e1-80c2-3a195ed840b3` returned `OKAY`; supplementary native gpt-5.6-sol xhigh session `019f8b4c-a299-7bf2-a616-ff233173b870` returned `SUPPLEMENTARY VERDICT: OKAY`.
- Required dual-review status: `BLOCKED`. No active review round is accepted, no execution authority exists, and no WO017 issue/PR has been created.

```json
{
  "phase": "review_round_initialized",
  "review_required": true,
  "plan_path": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
  "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
  "review_round_id": "wo017-19f8b207dc8b2f1cd6303",
  "round_status": "inconclusive",
  "pending-action": "start fresh round with normal isolated workspace-write sandbox",
  "review": {
    "momus": {
      "status": "invalidated_by_other_lane",
      "workspace_root": "D:/admin/Documents/TRAINORACLE-onboarding-work-order",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "round_id": "wo017-19f8b207dc8b2f1cd6303",
      "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
      "launch_id": "momus-19f8b2117604fa7342",
      "session": "019f8b21-bead-78a1-af83-6f13ce46dc50",
      "result": "OKAY on the matching hash, but invalidated because the independent lane was inconclusive."
    },
    "independent": {
      "status": "INCONCLUSIVE",
      "workspace_root": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b207dc8b2f1cd6303/workspace",
      "runtime_home": "C:/Users/admin/AppData/Local/Temp/trainoracle-plan-review-wo017-19f8b207dc8b2f1cd6303/codex-home",
      "target": ".omo/plans/trainoracle-onboarding-motivation-loop.md",
      "verifier": ".review/verify-plan.exe",
      "verifier_sha256": "80f12c1fa8947873b0afe5a8516ce2a2c4633e499d28736b9b8734c04e6a4c40",
      "round_id": "wo017-19f8b207dc8b2f1cd6303",
      "plan_sha256": "1a596822368eb7a62ec0e1712ce218db970683bed95dbf6b1bf4264f73a43e00",
      "launch_id": "independent-19f8b2117601124da1",
      "session": "019f8b21-d856-7fd0-98eb-ef31204de376",
      "result": "Standalone verifier execution was blocked by the read-only sandbox before plan read."
    }
  }
}
```
