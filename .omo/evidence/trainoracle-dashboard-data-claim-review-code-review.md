# TrainOracle Dashboard Data Claim Review

Review date: 2026-07-09

Goal: Verify that `dashboard/index.html` numerical claims are supportable from repository files.

Scope:
- Reviewed `dashboard/index.html`.
- Reviewed cited source acceptance decisions, runtime logs, spec files, Wave D patch report, and CI workflow.
- No source/spec/dashboard files were modified.
- Input diff/notepad path were not provided; `git status --short` and `git diff -- dashboard/index.html` were empty at review time.

Skill perspective check:
- `omo:remove-ai-slops` skill loaded and applied as a review lens for false-confidence tests, deletion-only tests, tautological tests, implementation-mirroring tests, needless extraction/parsing, and scope drift.
- `omo:programming` skill loaded and applied as a review lens for brittle prompt tests, untyped escape hatches, needless abstraction, oversized modules, and test relevance.
- No deletion-only or removal-only tests were found in the inspected runtime evidence. `impl/src/d9/evaluator.ts` is over 250 pure LOC, but it has a first-line `SIZE_OK` allowance explaining it is a verbatim extracted evaluator with recorded SHA; this review did not modify it.

## Findings By Severity

### CRITICAL

None.

### HIGH

1. Unsupported/misleading CI job count in `dashboard/index.html`.
   - Dashboard line: `dashboard/index.html:433`
   - Claim: `<strong>2</strong><span class="chip info">jobs</span>`
   - Evidence: `.github/workflows/ci.yml:10-44` defines one GitHub Actions job, `contract-tests`, with steps for D9 evidence tests, impl typecheck, and impl tests.
   - Correction: change the dashboard claim to `1 job`, or relabel the metric as `2 test suites` if the intended count is D9 evaluator tests plus impl skeleton tests.

### MEDIUM

None.

### LOW

1. The explicit requested numerical claims are supportable:
   - Accepted working sources = 4:
     - `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND1.md:24-27` accepts `PLAN_SAFETY_GATE_SPEC.md` and `RULE_VALIDATION_ENGINE_CONTRACT.md`.
     - `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND2.md:30-33` and `:69-76` accept `PHYSIO_SOURCE_TRUST_SPEC.md` and `DAILY_LOG_AND_CHECKIN_SPEC.md`.
     - Dashboard references: `dashboard/index.html:418`, `:541-562`.
   - Runtime tests = 18:
     - `runtime-evidence/d9-evaluator/d9-vitest-run-2026-07-09.log:16-17` says 11 passed.
     - `runtime-evidence/impl-skeleton/impl-vitest-run-2026-07-09.log:12-13` says 7 passed.
     - Dashboard references: `dashboard/index.html:423-424`, `:619-627`.
   - Spec open/blocking counts:
     - `PLAN_GENERATOR_SPEC.md`: `specs/active/PLAN_GENERATOR_SPEC.md:53-54` = 7 open, 2 blocking; table rows `:971-977`.
     - `APP_IMPLEMENTATION_BRIDGE.md`: `specs/active/APP_IMPLEMENTATION_BRIDGE.md:58-59` = 12 open, 4 blocking; table rows `:1075-1086`.
     - `ATHLETE_PROFILE_SPEC.md`: `specs/active/ATHLETE_PROFILE_SPEC.md:27-28` and `:713-721` = 11 open, 6 blocking.
     - `TEMPLATE_LIBRARY_SPEC.md`: `specs/active/TEMPLATE_LIBRARY_SPEC.md:15-16` and `:579-582` = 4 open, 0 blocking.
     - `PHYSIO_SOURCE_TRUST_SPEC.md`: `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md:17-18` and `:797-800` = 4 open, 0 blocking.
     - `RVE_RULE_EVALUATOR_BINDING_SPEC.md`: `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md:23-24` and `:804-807` = 4 open, 0 blocking.
     - `PLAN_SAFETY_GATE_SPEC.md`: `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md:20-21` and `:507-511` = 5 open, 3 blocking.
     - `RULE_VALIDATION_ENGINE_CONTRACT.md`: `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md:20-21` and `:468-472` = 5 open, 3 blocking.
     - `DAILY_LOG_AND_CHECKIN_SPEC.md`: `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:20-21` and `:607-612` = 6 open, 3 blocking.
     - `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`: `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md:21-22` and `:588-593` = 6 open, 3 blocking.
     - `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`: `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:16-17` and `:585-591` = 7 open, 4 blocking.
     - `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`: `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md:16-17` and `:562-568` = 7 open, 4 blocking.
     - `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`: `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md:16-17` and `:583-589` = 7 open, 4 blocking.
   - Wave D `3 open` is supportable from `SPEC_WAVED_BINDING_PATCH_REPORT.md:42-46`.

## Test / Evidence Review

- Existing runtime logs were inspected, not re-run, to preserve the user's read-only instruction.
- D9 runtime log supports 11/11 passed.
- Impl skeleton runtime log supports 7/7 passed.
- CI workflow supports running both suites, but as one GitHub Actions job.

## Status

codeQualityStatus: WATCH
recommendation: REQUEST_CHANGES
blockers:
- Correct `dashboard/index.html:433` from `2 jobs` to either `1 job` or `2 test suites`.
