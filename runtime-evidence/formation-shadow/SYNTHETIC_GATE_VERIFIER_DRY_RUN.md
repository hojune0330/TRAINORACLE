# Synthetic WO016 Gate Verifier Dry Run

```yaml
evidence_id: TO-WO016-SYNTHETIC-GATE-2026-07-16
evidence_kind: SYNTHETIC_PARSER_TEST_ONLY
runtime_artifact: false
real_acceptance_record: false
owner_activation: false
result: PASS
cases: 17
```

Command:

```text
node specs/test-packages/test-wo016-gate-verifier.mjs
```

Observed result:

```text
PASS WO016 synthetic gate verifier RED/GREEN cases=17
```

The cases cover exact-valid synthetic input plus unknown bundle field, missing order,
duplicate order, stale source SHA, invalid signature, duplicate approval role, unknown
record field, unclosed blocker, absent owner activation, malformed JSON, and four
candidate attempts to self-supply keys, expected SHA, blocker closure, or owner
activation, plus wrong-role key use and one-key/multiple-identity reuse. Keys and records are created
in memory for the test. They are not production trust material, real approvals, runtime
evidence, or authority to start Order 016.
