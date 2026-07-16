# Task 03 Evidence: WO012 Coach-Owner Walkthrough

```yaml
task: 03
order: CODEX_WORK_ORDER_012
base_commit: a6857bcdcd9f2989799c505f52773256ce492e14
recorded_at: 2026-07-16
fixture_rows_mapped: 30
review_groups: 7
owner_answers_recorded: false
ruleset_accepted: false
runtime_authority: false
```

## Delivered

- Korean owner-readable walkthrough with each source fixture ID exactly once;
- separate blank coach response template;
- executable validator that compares the 30 source IDs to the walkthrough and checks
  group membership, expected-state/action columns, non-acceptance markers, and all
  seven response sections.

The walkthrough describes 9.5 days and approximately 72 hours only as a coach pilot
hypothesis. It records no owner choice and grants no runtime authority.

## RED

Command:

```text
node specs/test-packages/validate-wo012-coach-walkthrough.mjs
```

Observed before the walkthrough and response template existed:

```text
Error: ENOENT: no such file or directory, open
reports/review/WO012_COACH_OWNER_WALKTHROUGH.md
exit code 1
```

The failure was caused by the missing required deliverable, not by a fixture or syntax
error.

## GREEN

Commands:

```text
node --check specs/test-packages/validate-wo012-coach-walkthrough.mjs
node specs/test-packages/validate-wo012-coach-walkthrough.mjs
git diff --check -- reports/review/WO012_COACH_OWNER_WALKTHROUGH.md \
  reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md \
  specs/test-packages/validate-wo012-coach-walkthrough.mjs
```

Observed:

```text
WO012 coach walkthrough validation passed: 30/30 fixtures, 7/7 groups, no runtime authority
walkthrough_rows=30
fixture_rows=30
exit code 0
```

## Scope Check

Task-owned files only:

- `reports/review/WO012_COACH_OWNER_WALKTHROUGH.md`
- `reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md`
- `specs/test-packages/validate-wo012-coach-walkthrough.mjs`
- `.omo/evidence/formal-gates/task-03.md`

No decision, plan, ledger, runtime, application, or acceptance-state file was edited by
this task.

[TASK_03_EVIDENCE_COMPLETE]
