# Todo 6 Failing-First Proof

Baseline HEAD: `5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa`

1. `node --test specs/test-packages/validate-personalized-prescription-v2-race-placement.test.mjs`
   - Exit `1`.
   - The focused test could not import the absent race-placement authority validator.
2. `npm test -- --run test/race-placement.contract.test.ts` from `impl/`
   - Exit `1` after the local dependency toolchain was made available.
   - Vitest failed to import the absent production `plan-generator/race-placement` boundary.

An earlier invocation also exited `1` because `impl/node_modules` was absent. That environment-only result is not counted as the behavioral RED. A temporary junction to the already-installed sibling worktree dependencies was used for verification and removed during cleanup.

The first implementation pass produced `4 pass / 1 fail` in the new runtime contract because one mutation violated both coordinate-set and fixed-anchor invariants. The test fixture was corrected to swap coordinates, isolating the intended fixed-anchor invariant; no production rule was weakened.
