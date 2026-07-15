# Formation Runtime Integration Test Package

```yaml
test_package_id: TO-WO016-RUNTIME-GATE-2026-07-15
status: SYNTHETIC_GATE_VERIFIER_EXECUTED_RUNTIME_TESTS_DESIGN_ONLY
runtime_authority: false
test_count: 24
```

## Gate-Verifier Contract

The future verifier accepts exactly six immutable decision records conforming to
`TRAINORACLE_WO016_ACCEPTANCE_RECORD_V1`. It also requires all ten canonical P1 blockers
to have accepted decision artifacts and approved target-patch plans. A canonical row may
remain `OPEN` only when its sole missing closure evidence is produced by Order 016 itself.

### Exact acceptance-record schema

```yaml
StrictAcceptanceRecordV1:
  allowedTopLevelFields:
    - recordSchemaVersion
    - repository
    - branch
    - orderId
    - decision
    - acceptedAt
    - sourceCommitSha
    - evidenceManifestSha256
    - signedPayloadSha256
    - contractVersions
    - remainingRisks
    - approvals
  recordSchemaVersion: TRAINORACLE_WO016_ACCEPTANCE_RECORD_V1
  repository: TRAINORACLE
  branch: nonempty_string
  orderId: CODEX_WORK_ORDER_010 | CODEX_WORK_ORDER_011 | CODEX_WORK_ORDER_012 | CODEX_WORK_ORDER_013 | CODEX_WORK_ORDER_014 | CODEX_WORK_ORDER_015
  decision: order_specific_enum_below
  acceptedAt: RFC_3339_UTC_datetime
  sourceCommitSha: lowercase_hex_40
  evidenceManifestSha256: lowercase_hex_64
  signedPayloadSha256: lowercase_hex_64
  contractVersions: nonempty_object_of_contract_id_to_nonempty_version
  remainingRisks: array_of_nonempty_strings
  approvals: nonempty_array_of_ApprovalV1

ApprovalV1:
  allowedFields: [approverId, role, approvedAt, keyId, signatureAlgorithm,
    signatureBase64]
  approverId: opaque_nonempty_real_person_id
  role: TOTAL_RESPONSIBILITY_HOLDER | COACH_OWNER | FABLE_INDEPENDENT_REVIEW | QUALIFIED_PRIVACY_REVIEWER | ATHLETE_REVIEW_PARTICIPANT | ACCESSIBILITY_REVIEWER
  approvedAt: RFC_3339_UTC_datetime
  keyId: trusted_nonempty_key_id
  signatureAlgorithm: ED25519
  signatureBase64: canonical_base64_of_64_signature_bytes
```

The signed payload is RFC 8785 JCS of the complete record with every declared default
materialized and with top-level `signedPayloadSha256` plus every
`approvals[*].signatureBase64` omitted. Eligible strings are NFC before JCS. The
top-level `signedPayloadSha256` is SHA-256 of those exact UTF-8 bytes, so the preimage is
not self-referential. Every approval signs those 32 digest bytes, and the verifier
resolves `keyId` only through its pinned trusted-key manifest. Unknown fields, duplicate
approval roles, duplicate approver IDs, or a signature whose decoded length is not 64
bytes are rejected.

The executable synthetic verifier receives candidate JSON with the sole top-level field
`records`. A trusted composition root separately injects `blockerClosures`,
`expectedSourceCommitByOrder`, `trustedKeys`, and `ownerActivation`; candidate JSON may
not supply or override any of them. The verifier rejects unknown candidate fields.
`records` contains exactly the six strict records above. `blockerClosures` contains exactly the ten canonical IDs, each
with `acceptedDecisionArtifact: true` and `approvedTargetPatchPlan: true` except a row
whose sole declared missing evidence is `WO016_RUNTIME_EVIDENCE`. `trustedKeys` maps a
referenced `keyId` to the exact closed object `publicKeyPem`, `approverId`, and
`allowedRoles`. The verifier binds every signature to all three and rejects reuse of one
key ID across multiple approval entries. A future runtime binding must load
that context from pinned read-only authority configuration, never from a request body,
uploaded file, candidate record, or client-controlled environment value. The synthetic
test context is not a production trust store and grants no runtime authority.

Allowed accepted decision enums and required approval roles are closed:

| Order | Sole accepted decision | Required roles |
|---|---|---|
| `010` | `ACCEPT_ORDER_010_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `FABLE_INDEPENDENT_REVIEW` |
| `011` | `ACCEPT_ORDER_011_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `QUALIFIED_PRIVACY_REVIEWER` |
| `012` | `ACCEPT_ORDER_012_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `COACH_OWNER` |
| `013` | `ACCEPT_ORDER_013_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `FABLE_INDEPENDENT_REVIEW` |
| `014` | `ACCEPT_ORDER_014_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `COACH_OWNER`, `ATHLETE_REVIEW_PARTICIPANT`, `FABLE_INDEPENDENT_REVIEW` |
| `015` | `ACCEPT_ORDER_015_FOR_WO016` | `TOTAL_RESPONSIBILITY_HOLDER`, `COACH_OWNER`, `ATHLETE_REVIEW_PARTICIPANT`, `ACCESSIBILITY_REVIEWER`, `QUALIFIED_PRIVACY_REVIEWER` |

Each order ID appears exactly once. Extra roles are allowed only from the closed role
enum and never replace a required role. The six records must name the same repository
and branch and must form the explicitly approved dependency SHA set. The verifier rejects
unknown fields, duplicates, stale/superseded decisions, mixed repositories, wrong
branch/SHA, invalid or missing signatures, readiness/packet-prepared states, unapproved
target-patch plans, or any other unresolved P1 entry gate.

## Fixtures

| ID | Input | Expected result |
|---|---|---|
| GV-01 | Current Order 010 bounded record lacks strict SHA/reviewer/manifest metadata | `GATE_BLOCKED`, missing 010-015 |
| GV-02 | Order 011 packet complete, policy false | reject as not accepted |
| GV-03 | Order 012 blocked packet | reject |
| GV-04 | Order 013 blocked packet | reject |
| GV-05 | Order 014 blocked packet | reject |
| GV-06 | Order 015 blocked packet | reject |
| GV-07 | six records, one missing approver | reject |
| GV-08 | qualified reviewer unassigned | reject |
| GV-09 | stale or mismatched source SHA | reject |
| GV-10 | duplicate/superseded acceptance | reject |
| GV-11 | any of the ten canonical P1 blockers lacks accepted decision artifact or approved target-patch plan | reject with exact blocker ID and missing artifact type |
| GV-12 | exact six strict records plus ten accepted blocker decisions and approved target-patch plans; any remaining OPEN state awaits only WO016 evidence | gate eligible only; still needs owner activation |
| RT-01 | otherwise identical private-note absent, text-A, text-B, and metadata-only variants | projection/input/output/cache/audit/telemetry/review/error bytes pairwise identical; zero presence events; any canary rejects, records a generic incident, and produces no candidate |
| RT-02 | raw analyzable note or any excerpt/summary/translation/token/hash/embedding/human-readable derived reason | reject; no downstream payload, projection, detailed audit/telemetry, or candidate |
| RT-03 | stale/wrong-target safety ref or note-derived `D9_CLEARED`/`D9_CLEARED_WITH_ADVISORY` | reject ref or suppress cleared result; no downstream result, source marker, presence signal, plan permission, or candidate |
| RT-04 | accepted note-derived block/review envelope, revoked consent, or evaluator failure | exact target-bound generic opaque `SAFETY_REVIEW_REQUIRED` may only block/review; extra reason/source/timestamp/provenance rejects; revocation/failure blocks with no candidate |
| RT-05 | concurrent successor writes | one commit or rollback/conflict |
| RT-06 | DST/fold/gap ambiguity | reject/review |
| RT-07 | kill switch active | no generation/presentation; journal intact |
| RT-08 | withdrawal | stop optional processing; journal intact |
| RT-09 | partial migration failure | rollback; journal intact |
| RT-10 | shadow candidate write to real plan | invariant failure, zero mutation |
| RT-11 | hidden or coach-like shadow copy | reject projection |
| RT-12 | rollback and restore | no revoked/private data resurrection |

`WO016-T01` is GV; `WO016-T02` RT-01..04; `WO016-T03` RT-05..09/12;
`WO016-T04` RT-10/11. The synthetic verifier executes malformed, missing, stale,
duplicate, signature, blocker, owner-activation, and exact-valid gate classes. RT-01..12
remain design-only until the entry gate passes.

The executable gate verifier uses generated Ed25519 keys and synthetic acceptance
records. It proves parser fail-closed behavior and a synthetic GREEN only; it neither
accepts the real six dependencies nor creates runtime evidence. The RT rows remain future
integration designs.

[DRAFT_COMPLETE]
