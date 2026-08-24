# Todo 5 Failing-First Receipt

Command: node --test specs/test-packages/validate-personalized-prescription-v2-taper-authority.test.mjs
Exit code: 1

Observed before the validator and matrix existed:
- ERR_MODULE_NOT_FOUND for validate-personalized-prescription-v2-taper-authority.mjs
- tests: 1
- pass: 0
- fail: 1

This was the expected trust-boundary RED: the new contract could not report success while its required authority artifact and validator were absent.

## Independent-gate regression RED

Command: node --test --test-name-pattern='rejects changed supplemental subgroup observations' specs/test-packages/validate-personalized-prescription-v2-taper-authority.test.mjs
Exit code: 1

Observed before the supplemental provenance fix:
- tests: 1
- pass: 0
- fail: 1
- failure: Missing expected exception
- mutation: the locally reported subgroup values n=5/n=4 were changed to n=999/n=1 in a temporary source root.

This proved the runtime validator bound the matrix numbers but did not yet consume the local file that reported those subgroup values.
