---
slug: trainoracle-next-spec-review-and-patch-plan
status: approved-and-executed
intent: unclear
pending-action: write .omo/plans/trainoracle-next-spec-review-and-patch-plan.md
approach: review-first, then target-patch-readiness, then runtime-evidence; no implementation or issue closure in this plan
---

# Draft: trainoracle-next-spec-review-and-patch-plan

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->
| C1 | Freeze current repo truth and fix handoff drift before new SPEC changes | active | SPEC_WORK_STATUS.md, TRAINORACLE_SPEC_INDEX.md, SPEC_TARGET_PATCH_MATRIX.md |
| C2 | Prepare reviewer packet so external reviewers can inspect GitHub with exact lenses and questions | active | SPEC_OVERVIEW_FOR_HOJUNE.md, SPEC_DOCUMENTATION_REPORT.md |
| C3 | Review Wave 3 productization drafts for overlap, acceptance boundaries, and target-patch readiness | active | specs/reconstruct/*.md, SPEC_TARGET_PATCH_MATRIX.md |
| C4 | Plan target patches into active/reconstructed contracts without closing issues from memory | active | specs/active/PLAN_GENERATOR_SPEC.md, specs/active/APP_IMPLEMENTATION_BRIDGE.md, specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md |
| C5 | Plan runtime evidence path for D9 evaluator -> RVE -> Safety Gate -> Plan Generator | active | specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md, specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md |
| C6 | Defer app/web implementation until contract and data-shape patches are reviewed | deferred | README.md, design-system/, designs/ |

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->
| next phase | Review packet + target-patch readiness before more SPEC creation | Wave 3 productization drafts all exist; the next risk is unreviewed acceptance and incorrect issue closure | yes |
| GitHub-only reviewer input | GitHub is enough for inventory, consistency, handoff clarity, and red-flag review if paired with a reviewer brief | The repo has README/index/status/report/matrix docs; reviewers still need scoped questions | yes |
| GitHub-only limits | GitHub alone is not enough for runtime evidence, hidden legacy-agent context, or actual product behavior | Docs explicitly say runtime evidence is missing and local files are truth | yes |
| "build all then fix" | Acceptable for low-risk UI prototypes only; not acceptable for safety/privacy/core coaching contracts | D9/Safety Gate/privacy issues require gates before implementation claims | yes |
| reviewer lenses | Use safety/medical-risk, privacy/data-governance, implementation/API, coaching/product-UX lenses | Different failures hide in different layers; one generic reviewer pass is too weak | yes |

## Findings (cited - path:lines)
- `SPEC_WORK_STATUS.md:20` records the repo as an incomplete SPEC contract-layer phase, not a completed app or canonical promotion.
- `SPEC_WORK_STATUS.md:60` states Wave 3 productization drafts are now all created as drafts for review.
- `SPEC_WORK_STATUS.md:132` requires actual D9 evaluator runtime output before closing RVE or Plan Generator safety-gate binding issues.
- `SPEC_WORK_STATUS.md:137` says target patches, App Bridge/API schema contracts, and runtime evidence begin only after preserving the safety core chain.
- `TRAINORACLE_SPEC_INDEX.md:55` records local files as truth.
- `TRAINORACLE_SPEC_INDEX.md:75-77` records the active SPEC candidates and says each file's metadata/open-issue table remains authoritative.
- `TRAINORACLE_SPEC_INDEX.md:116` records reconstructed/source-not-verified contracts as a separate class.
- `TRAINORACLE_SPEC_INDEX.md:129` records productization drafts as drafts, not canonical promotion or runtime evidence.
- `TRAINORACLE_SPEC_INDEX.md:165-168` records D9 block/advisory invariants that must remain stable.
- `SPEC_TARGET_PATCH_MATRIX.md:165` says no productization draft remains uncreated in Wave 3.
- `SPEC_TARGET_PATCH_MATRIX.md:187-190` records missing runtime evidence for D9 execution, RVE signal shape, and Safety Gate routing.
- `SPEC_TARGET_PATCH_MATRIX.md:208` records that the next safe work is not issue closure, but still mentions "productization draft selection"; because Wave 3 drafts now exist, this line should be updated in the next documentation cleanup.
- `SPEC_DOCUMENTATION_REPORT.md` and `SPEC_OVERVIEW_FOR_HOJUNE.md` are UTF-8 readable and already useful for GitHub handoff, but they should be used as reviewer entry points rather than sole source authority.
- `specs/active/PLAN_GENERATOR_SPEC.md:891-896` still has open target issues including safety-gate binding, physio consumption, output format, rationale privacy, and microcycle/calendar mapping.

## Decisions (with rationale)
- Treat the user request as an open-ended planning request, not an execution request.
- Do not create more productization SPEC drafts by default; Wave 3 draft coverage is now complete enough to review.
- Plan a Review Round 1 before target patching, because reviewers can catch cross-document drift before it becomes active-contract churn.
- Use GitHub as the reviewer-facing source package, but add a concise reviewer packet with read order, known non-claims, and exact questions.
- Keep runtime evidence separate from documentation QA and Markdown self-checks.
- Do not ask reviewers "what do you think?" in the abstract; assign them a lens and acceptance questions.
- The first execution todo after approval should update the patch matrix/readme-facing handoff language from "productization draft selection" to "productization draft review/acceptance and target-patch readiness."

## Scope IN
- Create a decision-complete plan for the next SPEC phase after user approval.
- Include reviewer packet creation, target-patch readiness, issue-count/recount guardrails, and runtime evidence preparation.
- Include what external reviewers should see on GitHub and what they cannot validate from GitHub alone.
- Include a recommended sequence for Plan Generator, App Bridge, Safety Gate, RVE, Daily Log, and Wave 3 productization bindings.

## Scope OUT (Must NOT have)
- No product SPEC edits before user approval of this plan.
- No issue closure.
- No canonical promotion.
- No runtime evidence claims.
- No D9 semantic redefinition.
- No use of conversation summaries as file-existence proof.
- No app/web implementation work.

## Open questions
- Approval question: proceed with a review-first plan that creates a reviewer packet and target-patch readiness workflow before any further product SPEC edits?

## Approval gate
status: approved
approval: user said "좋아 승인 그리고 이후 다음 작업까지 다 전부 진행해."
executed action: wrote the detailed `.omo/plans/trainoracle-next-spec-review-and-patch-plan.md` plan and proceeded with review packet / target patch readiness documentation.
approval brief: recommend review-first, then target-patch-readiness, then runtime-evidence; do not continue making new SPEC drafts or begin implementation until the review packet and patch matrix are updated.
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
