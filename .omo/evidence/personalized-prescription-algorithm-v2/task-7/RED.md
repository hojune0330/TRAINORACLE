# Todo 7 failing-first receipt

Date: 2026-08-23 KST
Baseline HEAD: `5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa`

The first contract test was added before the transform registry module existed.

Command:

`npm --prefix impl test -- test/plan-adaptation-registry.contract.test.ts`

Observed result: exit 1, 1 test file failed to load because
`../src/plan-generator/adaptation-transform-registry` did not exist. This is the
named RED for the missing versioned registry boundary.

An earlier invocation included unsupported Vitest option `--runInBand`; that
exit 1 is classified as a command error and is not claimed as the TDD RED.

Mutation coverage now retained in the green contract independently rejects a
deleted edge, deactivated edge, exchanged IDs, active FREQUENCY, active
INTENSITY, revoked edge, invented expiry, and rehashed proposal metadata.

