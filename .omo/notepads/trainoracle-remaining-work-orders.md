# Goal

- objective: TRAINORACLE의 모든 잔여 OPEN/DEFERRED/BLOCKED 항목을 중복 없이 정식 작업지시서로 구조화한다.
- status: active

## Success Criteria

1. 사용자 산출물: 실행 Wave, 개별 작업지시서, 연구/전문검토/소유자 게이트, 완료 증거가 한 문서에서 추적된다.
2. 재계수 happy path: Task-R 1 OPEN + 5 DEFERRED, Formation 8 deferred goals, ORDER_008 Task C가 누락 없이 매핑된다.
   - Automated test `T-INV-001`: 계획 파일의 source-ID/goal 행을 원장과 대조한다.
   - Manual QA `QA-INV-001` (CLI/data): `rg -n 'R-safety-001|R-parent-001|R-parent-004|R-coach-003|R-frontend-003|R-a11y-005|ORDER_008.*Task C' .omo/plans/trainoracle-remaining-work-orders.md`; 모든 ID가 1차 소유 지시서에 존재하면 PASS.
3. 중복 edge path: 같은 privacy/calendar/shadow 항목이 여러 지시서에 중복 구현되지 않고 primary owner + reference로만 연결된다.
   - Automated test `T-DEP-001`: 각 work-order의 `primary_items` 유일성과 `depends_on` 참조를 검사한다.
   - Manual QA `QA-DEP-001` (CLI/data): 계획의 dependency matrix를 추출해 순환 의존성이 0이면 PASS.
4. 금지 경계 malformed path: 연구·전문검토·소유자 승인 전 실행 금지 항목이 구현 명령으로 오인될 수 없다.
   - Automated test `T-GATE-001`: 모든 gated order에 `execution_state`, `entry_gate`, `forbidden_before_gate`, `exit_evidence`가 있는지 검사한다.
   - Manual QA `QA-GATE-001` (CLI/data): gated order에서 `runtime_authority: false`와 금지행위가 모두 발견되면 PASS.
5. 인접면 regression path: 계획 작성이 앱, SPEC 본문, CI, 기존 ledger를 변경하지 않는다.
   - Automated test `T-SCOPE-001`: `git diff --name-only origin/main...HEAD`와 working tree가 `.omo/plans`, `.omo/drafts`, `.omo/notepads` 밖을 포함하지 않는지 검사한다.
   - Manual QA `QA-SCOPE-001` (CLI/data): 실제 diff 파일 목록이 계획 관련 경로로만 제한되면 PASS.

## Applicable Skills

- omo:ulw-plan: decision-complete planning and Metis gap analysis.
- ultra-research: primary-source research protocol for science/statistics orders.
- omo:review-work: multi-angle final review requirements.
- emil-design-eng: athlete-facing explanation/accessibility/shadow UX criteria.
- omo:programming: downstream TypeScript TDD and strict-boundary requirements.

## Findings

- Planning-only change. No production behavior changes are allowed in this goal.
- New production test files are not introduced because the artifact is a planning document; executable one-off contract checks provide RED/GREEN evidence for the document schema and inventory coverage.

## Evidence Ledger

- RED captured before plan creation:
  - `T-INV-001 RED: plan file missing`
  - `T-DEP-001 RED: primary_items/dependency contract missing`
  - `T-GATE-001 RED: gate contract missing`
  - command exit code: 1, `RED failures=3`
- `T-SCOPE-001` is a regression guard evaluated after plan creation.
- GREEN captured after plan creation:
  - `T-INV-001 GREEN: primary_count=15 unique=15`
  - `T-GATE-001 GREEN: 7/7 orders have all gate fields and runtime_authority=false`
  - `T-DEP-001 GREEN: Order 016 depends on accepted 010-015; wave graph is forward-only`
  - `T-SCOPE-001 GREEN: only plan/draft/notepad paths changed`
  - command exit code: 0, `GREEN failures=0`
- Manual QA artifacts captured through Git Bash CLI/data surface:
  - `QA-INV-001 PASS`: printed 15 normalized primary items, no duplicate.
  - `QA-DEP-001 PASS`: printed Wave 1-7 and verified accepted 010-015 dependencies.
  - `QA-GATE-001 PASS`: printed seven order/state/authority/forbidden blocks; all authority false and 016 dormant.
  - `QA-SCOPE-001 PASS`: working changes limited to `.omo/drafts`, `.omo/notepads`, and `.omo/plans`.

## Planning Reviews

- Scope inventory: 15 requested source units, 15 unique primary owners.
- Plan agent: corrected seven-order wave; research/preset in 010, privacy in 011,
  coach rules in 012, sync in 013, human review/shadow in 014, projection/a11y in
  015, and dependency-derived runtime evidence only in 016.
- Metis guardrails incorporated: immutable acceptance records; no real athlete data
  before governance; source hierarchy/counterevidence; youth age transition;
  correction/appeal; deterministic sync; disclosed shadow; independent review;
  200% zoom/assistive technology; kill switch and rollback.
- Binding ultrawork review: `APPROVED` with no conditions.
