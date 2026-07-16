# Formal Gates Task 04 Evidence - WO013 Target Binding

```yaml
task: 04
work_order: WO013
result: PASS_TARGET_PLAN_ONLY
formal_acceptance: false
runtime_authority: false
backend_choice: none
schema_choice: none
migration_choice: none
```

## RED

Command:

```powershell
node specs/test-packages/validate-wo013-target-binding.mjs
```

Initial result: exit `1`, because
`reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md` did not exist. This established
that the validator could not pass without the requested repository binding artifact.

The next run exposed the source pack's two declaration forms: 32 YAML `id:` rows and
four `### HASH/ID` headings. The parser was corrected to treat both as fixture IDs,
without weakening the exact count or uniqueness checks.

## GREEN

Command:

```powershell
node specs/test-packages/validate-wo013-target-binding.mjs
```

Observed output:

```text
WO013 target binding PASS fixtures=36 current=2 future=5 noTarget=29
```

The validator proves:

- all 36 fixture IDs from the canonical WO013 pack map exactly once;
- every non-absent target path exists in this repository;
- absent implementations are explicitly `NO_TARGET_YET`;
- patch stages are constrained to P1-P8;
- identity/hash, CAS, subscription, offline conflict, tombstone/key erasure, DST,
  DOUBLE/FLEX, outbox/rollback, and tenant-boundary concerns are present;
- the plan contains no recognized backend/database/migration/runtime authority claim.

## Scope Check

Created only:

- `reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md`
- `specs/test-packages/validate-wo013-target-binding.mjs`
- `.omo/evidence/formal-gates/task-04.md`

No `app/`, `impl/`, decision, plan, ledger, backend, schema, or migration file was
modified. This is a target-binding plan and executable document validator, not proof
that any calendar/sync runtime fixture currently passes.
