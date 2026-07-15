# TRAINORACLE Feasible Recovery And Formation Sequencing Plan

## TL;DR
> **Summary**: 현재 가능한 기준선·문서·검증 정리만 순서대로 끝낸다. 고급 훈련 분석, 통계적 판단, 실제 처방과 그림자 운영은 명시적인 보류 목표로 남긴다.
> **Deliverables**: 현재 상태 장부, 병합 후 증거 기록, Formation 읽기 지도, 그림자 모드 비실행 안내 패킷, 보류 목표 등록부
> **Effort**: Medium
> **Parallel**: NO - 현재 기준선이 다음 작업의 근거다.
> **Critical Path**: PR #66/#67 상태 확인 -> 기준선 장부 -> Formation 읽기 지도 -> 그림자 안내 패킷 -> 보류 목표 등록

## Context

### Original Request
- 기존 `TRAINORACLE SPEC Recovery And Formation Readiness Plan`을 순서대로 진행한다.
- 높은 수준의 모델과 심층 분석이 필요한 일은 실행하지 않고 목표로 남긴다.

### Current Facts
- `origin/main`은 PR #64 병합 상태이며 head는 `0588e68`이다.
- PR #66은 provenance runtime과 누락된 ORDER_008/009 산출물을 담은 draft다.
- PR #67은 선택형 메모 포함 내보내기·공유를 담은 draft다.
- `TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md`는 review draft이며 runtime authority가 아니다.
- 기존 대형 계획의 W5-W10은 owner 결정, 고급 연구, 실제 데이터, 법·보존, 백엔드, 또는 구현 권한을 전제로 한다.

### Metis / Parallel Review Status
- `formation_execution_plan`, `readiness_inventory`, `test_readiness`, `gap_analysis` 읽기 전용 검토를 요청했다.
- Metis 검토 반영: W0의 PR #64 병합 gate는 폐기하고 `0588e68` 기준선 감사로 대체한다. G0는 owner-adopted이며 C2/C3 구현 증거만 남았다. PR #66은 분리·rebase 없이 병합하지 않으며, PR #67은 provenance 뒤에 재검증한다.
- `test_readiness`는 계획 생성 시점에 결과가 도착하지 않아 근거로 사용하지 않는다.

## Work Objectives

### Core Objective
실행할 수 있는 recovery/readiness 작업을 완료하고, 실행하면 안 되는 Formation 작업을 이유·재개 조건·필요 역량과 함께 보류한다.

### Must Have
- 현재 상태를 merged/draft/deferred로 정확히 구분한다.
- provenance가 main에 들어오기 전에는 Formation 입력이나 그림자 생성을 열지 않는다.
- 선수에게 보이는 설명은 “시뮬레이션이며 실제 훈련을 바꾸지 않는다”를 유지한다.
- 보류 항목은 사라지지 않고 목표 등록부에 남는다.

### Must NOT Have
- 실제 훈련 처방, 자동 일정 변경, 효능·안전성 주장
- 통계 임계값·과학적 타당성·법률 결론의 추정
- 새로운 backend, 계정 동기화, 파일럿 등록, 보상 운영
- private memo의 분석·보상·계획 입력

## Verification Strategy
- **Test decision**: 문서/상태 작업은 source-link and command verification. 현재 앱/impl/D9 테스트 기반은 존재하지만 Formation 구현/그림자 UI 테스트는 0개이므로, 앱 변경이 필요한 후속 작업은 accepted source bundle 뒤 별도 계획에서 TDD를 다시 시작한다.
- **Manual QA policy**: 문서가 참조하는 PR/commit, source status, and user-facing copy를 사람이 아닌 agent가 GitHub/API 또는 browser surface로 확인한다.
- **Evidence**: `.omo/evidence/formation-sequencing/task-{N}-*.md`
- **Known baseline commands**: `cd app && npm.cmd run typecheck`, `cd app && npm.cmd run typecheck:e2e`, `cd app && npm.cmd test -- --reporter=verbose`, `cd app && npx.cmd playwright test --workers=1 --reporter=list`, `cd impl && npm.cmd run typecheck && npm.cmd test`, `cd runtime-evidence/d9-evaluator && npm.cmd test`.

## Execution Strategy

### Ordered Waves
1. Current truth and merge evidence
2. Feasible recovery documents
3. Non-executing shadow preparation
4. Deferred-goal registry and handoff

### Dependency Matrix

| Task | Depends on | Blocks | Notes |
|---|---|---|---|
| 1 | none | 2-5 | PR and branch truth must be current. |
| 2 | 1 | 3-5 | Production test-hook removal is an independent rollback unit. |
| 3 | 1-2 | 4-5 | G0 is adopted; split/rebase and prove reader/writer eligibility. |
| 4 | 1-3 | 5 | Documentation and memo export follow the composed provenance state. |
| 5 | 1-4 | none | Explicitly registers non-feasible work. |

## TODOs

- [x] 1. Publish the current-state recovery ledger before changing any Formation gate

  **What to do**: From `origin/main@0588e68`, create `SPEC_AUTHORITY_AND_RECOVERY_LEDGER.md` and `reports/review/ORDER_007_TASK_R_CLOSURE_AUDIT.md`. Classify PR #64, #66, #67, ORDER_008/009, PR #63, and every Task-R finding as `DONE`, `OPEN`, `DEFERRED`, `SUPERSEDED`, or `BLOCKED`. Update only stale status/index/readiness documents that the ledger proves incorrect. Preserve the fact that PR #64 is journal/input work only and closes no Formation blocker.

  **Must NOT do**: Do not claim canonical acceptance, runtime readiness, or a closed Formation blocker merely because a PR merged or a document exists.

  **References**:
  - `.omo/plans/trainoracle-spec-recovery-and-formation-readiness.md:234` - original W1 truth-baseline scope.
  - `TRAINING_PLAN_METHOD_DECISION.md:61` - method decision has no production authority.
  - `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md:355` - controlling gate order.
  - `SPEC_WORK_STATUS.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_TARGET_PATCH_MATRIX.md`, `SPEC_TARGET_PATCH_READINESS.md` - current status surfaces.

  **Acceptance Criteria**:
  - [ ] Every ledger row has source path/PR, evaluated SHA, authority class, current state, next action, and blocking condition.
  - [ ] All status claims match `origin/main@0588e68` and current PR metadata.
  - [ ] No linked local Markdown path is broken.

  **QA Scenarios**:
  ```text
  Scenario: merged journal PR is not mistaken for Formation acceptance
    Tool: GitHub API / browser
    Steps: open https://github.com/hojune0330/TRAINORACLE/pull/64 and compare it with TRAINING_PLAN_METHOD_DECISION.md:61-63
    Expected: PR #64 is MERGED, while Formation remains draft/non-runtime.
    Evidence: .omo/evidence/formation-sequencing/task-1-pr64-boundary.md

  Scenario: stale status detection
    Tool: bash
    Steps: git fetch origin main; git rev-parse origin/main; rg -n 'PR #64|6a07dec|bc96e17' SPEC_WORK_STATUS.md TRAINORACLE_SPEC_INDEX.md
    Expected: every stale reference is listed before any edit; updated files contain 0588e68 or a correctly scoped historical reference.
    Evidence: .omo/evidence/formation-sequencing/task-1-status-reconcile.txt
  ```

  **Commit**: YES | Message: `docs(recovery): reconcile current authority baseline`

- [x] 2. Isolate and verify the production test-hook removal (W2A / C0)

  **What to do**: Split the independent `c6b8a43` change from PR #66 into its own branch/PR. Preserve the test that opens `/?app=1&uitest=seed` and confirms `trainoracle.journal.v1` is unchanged. Move any needed E2E fixture seeding outside the production app bundle.

  **Must NOT do**: Do not merge the mixed PR #66 wholesale. Do not seed real browser storage through a production query parameter.

  **References**:
  - `.omo/plans/trainoracle-spec-recovery-and-formation-readiness.md:323-330` - W2A invariant.
  - `app/src/main.tsx` and `app/src/domain/journal-store.ts` - current production hook locations.
  - `app/e2e/production-query.spec.ts` from commit `c6b8a43` - required RED-to-GREEN regression coverage.

  **Acceptance Criteria**:
  - [ ] Production source contains no `runStoreSelfTest` invocation or `?uitest=seed` write path.
  - [ ] The new E2E test fails against the old behavior and passes after removal.
  - [ ] Existing mobile save-layout E2E no longer depends on `uitest`.

  **QA Scenarios**:
  ```text
  Scenario: legacy test query cannot write storage
    Tool: browser / Playwright
    Steps: npm run build; npx playwright test e2e/production-query.spec.ts --project=desktop-chromium
    Expected: the assertion observes localStorage key trainoracle.journal.v1 as null.
    Evidence: .omo/evidence/formation-sequencing/task-2-production-query.txt

  Scenario: normal mobile journal flow still renders
    Tool: browser / Playwright
    Steps: npx playwright test e2e/mobile-save-overlap.spec.ts --project=mobile-chromium
    Expected: race save button stays above the bottom navigation without a test query.
    Evidence: .omo/evidence/formation-sequencing/task-2-mobile-regression.txt
  ```

  **Commit**: YES | Message: `fix(journal): remove production test storage hook`

- [x] 3. Complete the owner-adopted G0 provenance boundary as independently reviewable PRs

  **What to do**: Rebase the provenance-only work from PR #66 onto `origin/main@0588e68` after the C0 PR. Keep the already adopted G0 decision record, but distinguish `OWNER_ADOPTED` from `RUNTIME_EVIDENCE_PENDING`. Split reader and writer/eligibility changes into reviewable PRs. Preserve legacy entries for display and owner data export; exclude metadata-absent, missing, invalid, unknown-rule, nested, and incomplete derived fields from aggregates, Trends, analysis, and every future Formation input.

  **Must NOT do**: Do not infer `EXPLICIT` for legacy data. Do not make a partial record unsaveable. Do not turn race self-check fields into plan input.

  **References**:
  - `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:469-545` - adopted provenance contract.
  - `.omo/plans/trainoracle-spec-recovery-and-formation-readiness.md:332-405` - G0, C1-C3 scope and rollback.
  - `DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md` in PR #66 - adopted owner decision; implementation status must remain pending until tests pass.
  - `app/src/domain/journal-schema.ts`, `app/src/domain/safe-export.ts`, `app/src/domain/aggregates.ts` - reader/eligibility boundaries.

  **Acceptance Criteria**:
  - [ ] New entries represent `EXPLICIT`, `DERIVED`, or `MISSING`; legacy absence reads as ineligible legacy provenance.
  - [ ] Only direct explicit values and registry-approved, fully declared, non-nested derived values reach aggregate/Trend/analysis projections.
  - [ ] A record with no eligible field contributes zero rows, days, sessions, or lifetime totals to analysis.
  - [ ] A default-off eligibility flag and a snapshot/restore rollback rehearsal have evidence before rollout.
  - [ ] Existing local entries remain visible and raw owner export remains intact.

  **QA Scenarios**:
  ```text
  Scenario: legacy entry stays visible but does not affect analytics
    Tool: browser / Playwright
    Steps: seed a metadata-absent post-session entry through page.addInitScript; open Home and Trends.
    Expected: the entry is visible in the device journal and absent from aggregate/Trend values.
    Evidence: .omo/evidence/formation-sequencing/task-3-legacy-provenance.md

  Scenario: incomplete derived value is rejected from analysis, not from saving
    Tool: vitest
    Steps: add a test fixture with DERIVED provenance missing rule ID or explicit inputs; run npm run test -- journal-store.contract.test.ts.
    Expected: save/read succeeds according to its valid entry shape, while analysis projection omits the field and the row contributes zero aggregate totals.
    Evidence: .omo/evidence/formation-sequencing/task-3-derived-boundary.txt
  ```

  **Commit**: YES | Messages: `docs(data): record adopted provenance boundary`; `feat(journal): enforce provenance eligibility`

- [x] 4. Recover only mechanical ORDER_008/009 artifacts and align opt-in memo export policy

  **What to do**: Keep the tap-budget package, SSO status alignment, and draft-marker audit as separate report-only PRs after Task 1. Do not accept the preset research report as evidence because it lacks the required primary-source research. After Task 3 lands, rebase PR #67 and reconcile it with the explicit owner decision: default export excludes memo text; an explicitly selected local export may include memo text for backup or sharing. Keep this independent from Formation and from automatic sharing.

  **Must NOT do**: Do not treat quick-log presets as research-backed training prescriptions. Do not start SSO/provider work. Do not send memo data to a server or coach automatically.

  **References**:
  - `CODEX_WORK_ORDER_008.md:88-122` - Task B/C scope.
  - `CODEX_WORK_ORDER_009.md:87-113` - Task B/C scope.
  - `app/src/domain/journal-store.ts:86` and `app/src/screens/home/DeviceJournal.tsx:99` - export boundary.
  - PR #67 - owner-selected memo-inclusive local export.

  **Acceptance Criteria**:
  - [ ] Tap-budget test package includes tap count, retained answers, reduced motion, safety banner, and 375x667 checks.
  - [ ] Draft-marker audit distinguishes document completion from runtime/canonical claims.
  - [ ] Default safe JSON contains no memo/note/purpose and is byte-invariant to private memo content; opt-in full export intentionally contains selected local memo/note/purpose and has no network request.
  - [ ] Cancelling the confirmation produces no download, and full export changes no analytics/sync/coach/plan/reward/telemetry/audit behavior.

  **QA Scenarios**:
  ```text
  Scenario: default versus selected full export
    Tool: vitest and browser
    Steps: run the export contract test; in browser click default export, then memo-inclusive export and confirm the native dialog.
    Expected: default blob excludes raw memo; confirmed full-export blob includes it; no fetch/XHR/network call occurs.
    Evidence: .omo/evidence/formation-sequencing/task-4-export-choice.md

  Scenario: quick-log document guardrail
    Tool: bash
    Steps: rg -n '더 뛰|늘려|채워야|연속 N일|스트릭|내일도 꼭' specs/test-packages/QUICK_LOG_TAP_BUDGET_TEST_PACKAGE.md
    Expected: forbidden text appears only in the disallow-list, never as UI copy or a recommendation.
    Evidence: .omo/evidence/formation-sequencing/task-4-quicklog-guardrail.txt
  ```

  **Commit**: YES | Messages: `docs(quick-log): restore test-package evidence`; `feat(journal): restore opt-in memo export`

- [x] 5. Create the Formation “read now / decide later” map and deferred-goal registry

  **What to do**: Produce `FORMATION_READ_NOW_DECIDE_LATER.md` as an owner-readable two-page map of what Formation currently promises, what it explicitly does not do, and the exact gates before any runtime. Add `FORMATION_DEFERRED_GOALS.md` with required capability, reactivation condition, owner decision, and prohibited claim for each high-analysis item. Use `DEFERRED_HIGH_ACCURACY_RESEARCH` for the sport-science and statistical lanes; use `DEFERRED_QUALIFIED_REVIEW` for legal/privacy lanes; use `DEFERRED_OWNER_DECISION` for coach/pilot lanes.

  **Must NOT do**: Do not create new coach-rule values, load thresholds, sample thresholds, legal conclusions, backend choices, or pilot dates. Do not change Formation status from review draft.

  **References**:
  - `TRAINING_PLAN_METHOD_DECISION.md:91-103` - athlete-visible shadow boundary and unaccepted details.
  - `specs/reconstruct/TRAINING_PLAN_FORMATION_AND_ADAPTATION_SPEC.md:1758-1768` - ten canonical blockers.
  - `TRAINING_PLAN_BLUEPRINT_MULTIPERSPECTIVE_REVIEW.md:350-375` - required source-gate sequence.

  **Deferred Goals**:
  - Evidence/counterevidence sport-science review: requires high-accuracy research with primary citations and owner checkpoint.
  - G1-G5 coach/load/evidence/privacy/governance decisions: requires owner-approved decision packet; G5 also requires qualified legal/privacy review.
  - G6 race descriptive analysis: requires owner-specified scope, sample policy, and high-accuracy statistical review.
  - G7 product projection: requires dedicated design review and accessibility evidence.
  - G8 pilot protocol, W9 fixtures/backend, W10 activation: require all preceding accepted gates and explicit owner reactivation.
  - Formation test implementation: requires an accepted source bundle, fixture contracts for provenance/safety/consent/scope/DST/versioning, and resolution of the current note-derived `D9_CLEARED` behavior before it can be reused as a plan-input path.

  **Acceptance Criteria**:
  - [ ] A middle-school reader can identify “this does not change today’s training” in the first screenful.
  - [ ] Every deferred goal has a named reason, reactivation condition, and no-current-runtime assertion.
  - [ ] The map has no unqualified science, safety, or legal claim.

  **QA Scenarios**:
  ```text
  Scenario: owner-readable boundary
    Tool: browser or rendered Markdown preview
    Steps: open the map at 375x667 and 1440x900; read the first screenful.
    Expected: it states simulation/draft/non-executing status without scroll or inference.
    Evidence: .omo/evidence/formation-sequencing/task-5-readable-boundary.png

  Scenario: prohibited runtime claim scan
    Tool: bash
    Steps: rg -n '자동 처방|실제 계획 변경|효능 입증|안전성 입증|canonical acceptance' <new-map-and-registry-paths>
    Expected: any occurrence is a negated prohibition or an explicitly deferred goal, never a current claim.
    Evidence: .omo/evidence/formation-sequencing/task-5-claim-scan.txt
  ```

  **Commit**: YES | Message: `docs(formation): separate ready work from deferred analysis`

## Final Verification Wave
- [x] F1. Plan Compliance Audit

  Verify every completed task against its acceptance criteria and confirm no task crossed into a deferred Formation gate. Evidence: `.omo/evidence/formation-sequencing/f1-plan-compliance.md`.

- [x] F2. Current-State Evidence Audit

  Run `git fetch origin main && git rev-parse origin/main`, inspect PR #64/#66/#67 metadata, and verify every ledger SHA/state. Evidence: `.omo/evidence/formation-sequencing/f2-current-state.txt`.

- [x] F3. User-Facing Copy Audit

  Open `FORMATION_READ_NOW_DECIDE_LATER.md` in a rendered Markdown browser surface at 375x667 and 1440x900. Confirm the text says draft/simulation/non-executing without implying an actual plan change. Evidence: `.omo/evidence/formation-sequencing/f3-readable-boundary.png`.

- [x] F4. Deferred-Goal Boundary Audit

  Search all new recovery/Formation documents for current-tense claims of prescription, efficacy, safety validation, backend activation, or shadow processing. Confirm every high-model item has a named deferred state and reactivation condition. Evidence: `.omo/evidence/formation-sequencing/f4-deferred-boundary.txt`.

## Commit Strategy
- One documentation-only branch for Tasks 1-5 after all evidence is green.
- Suggested commit: `docs(formation): sequence feasible readiness work`.

## Success Criteria
- No document calls a draft, merged PR, or test result a canonical Formation acceptance.
- No Formation runtime or athlete shadow processing is enabled.
- Every high-model/deep-analysis item has a named reactivation condition.
