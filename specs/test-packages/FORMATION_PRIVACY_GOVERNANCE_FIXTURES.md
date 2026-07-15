# Formation Privacy Governance Fixtures

```yaml
fixture_pack_id: TO-WO011-PRIVACY-GOVERNANCE-2026-07-15
status: DRAFT_FOR_QUALIFIED_REVIEW
fixture_count: 41
runtime_authority: false
```

## Private-Note Zero-Signal Fixtures

Use synthetic canary `PRIVATE_CANARY_DO_NOT_PROPAGATE_7F3A` only inside test input.
Outside the private local view and explicit owner full backup, the canary and every
encoding, hash, length, presence marker, timing marker, and semantic derivative must be
absent.

| ID | Input | Expected result |
|---|---|---|
| PRIV-01 | no private note | baseline non-private outputs |
| PRIV-02 | private note A | byte/semantic identical to baseline outside private view |
| PRIV-03 | different private note B and length | byte/semantic identical to baseline |
| PRIV-04 | repeated private notes | rewards/analytics/telemetry/model/safety/plan identical |
| PRIV-05 | legacy/unlabelled note | read as private; no evaluator invocation |
| PRIV-06 | private purpose changed later | no retrospective evaluation of earlier text |
| PRIV-07 | default export | memo and purpose absent |
| PRIV-08 | explicit confirmed full local backup | memo included; no network request or analytics event |

Compare analytics, rewards, model input, safety, plan, logs, telemetry, sync queue,
network, audit, backup manifest, search index, crash report, and recipient list.

## Opaque Review Envelope Fixtures

| ID | Input | Expected result |
|---|---|---|
| OPAQ-01 | valid analyzable-note `D9_ACTIVE` | opaque `BLOCKED`; generic category only |
| OPAQ-02 | valid analyzable-note `D9_UNKNOWN` | opaque `D9_UNKNOWN`; fail-closed review |
| OPAQ-03 | analyzable-note `D9_CLEARED` | no positive envelope; cannot release |
| OPAQ-03A | analyzable-note `D9_CLEARED_WITH_ADVISORY` subtype | no envelope/reason/audit/presence marker; cannot release |
| OPAQ-04 | evaluator exception/timeout | `D9_UNKNOWN`; local save allowed; plan not authorized |
| OPAQ-05 | raw/excerpt/summary/token/embedding field | reject envelope |
| OPAQ-06 | plaintext or raw-text hash | reject envelope |
| OPAQ-07 | anatomical/symptom/diagnostic reason | reject envelope |
| OPAQ-08 | note ID/presence/length/language/frequency | reject envelope |
| OPAQ-09 | unknown extra field | reject envelope |
| OPAQ-10 | target/tenant/athlete/revision mismatch | reject; generic security event |
| OPAQ-11 | schema/evaluator/governance version mismatch | reject; target held |
| OPAQ-12 | expired/stale/not-yet-valid ref | reject; target held |
| OPAQ-13 | revoked consent/grant/safety epoch | revoke/reject; target held |
| OPAQ-14 | replay or epoch rollback | reject |
| OPAQ-15 | two notes with same disposition | same public shape; independent random refs |
| OPAQ-16 | source edit/delete | supersede ref; never auto-release |

## Governance Matrix Fixtures

| ID | Input | Expected result |
|---|---|---|
| GOV-01 | undefined/generic/cross-scope role | deny |
| GOV-02 | no retention, `forever`, or `while useful` | reject persistence |
| GOV-03 | bundled core journal + analysis + marketing consent | reject |
| GOV-04 | athlete refuses optional analysis | local journal remains available; no penalty |
| GOV-05 | guardian consent but athlete withdraws | owner guardrail stops optional consent-based youth processing; legal effects remain reviewer-defined |
| GOV-06 | guardian change/dispute or age-policy unknown | sensitive account processing blocked |
| GOV-07 | age transition | rights notice and control review; no automatic blanket unlock |
| GOV-08 | deletion request | primary/derived/index/cache/outbox/replica/restore suppression traced |
| GOV-09 | legal hold without accepted authority/policy | production blocked |
| GOV-10 | processor/region/subprocessor unknown | sensitive transfer blocked |
| GOV-11 | local owner file sent independently | no app recipient record or purpose change |
| GOV-12 | in-app coach/friend share before recipient contract | blocked |
| GOV-13 | key destruction missing, failed, or unproved | deletion incomplete; production blocked |
| GOV-14 | audit contains raw/reason/note-presence/correlation detail | reject audit record |
| GOV-15 | breach playbook or jurisdiction notification policy absent | sensitive persistence blocked |
| GOV-16 | revoked data reappears from outbox/cache/backup restore | reject restore; incident and deletion cascade resume |

`OPAQ-03A` is a subtype case, not a new D9 disposition. It is counted as one fixture.

## Deterministic Harness

```yaml
clock: 2026-07-15T00:00:00Z
test_rng: deterministic_fixture_only
opaque_ref_A: 00000000-0000-4000-8000-0000000000a1
opaque_ref_B: 00000000-0000-4000-8000-0000000000b2
accepted_schema_version: 1
accepted_evaluator_version: d9-note-adapter-test-v1
accepted_governance_version: wo011-test-v1
accepted_safety_epoch: 7
expires_at: 2026-07-15T00:10:00Z
verifier_results:
  - ACCEPTED_ENVELOPE
  - REJECTED_ENVELOPE
product_projection:
  state: GENERIC_BLOCKED_OR_PAUSED_ONLY
  copy_ko: 확인이 필요한 상태예요.
```

Production randomness must be CSPRNG and is not seeded. Normalization sorts object keys,
uses UTF-8/NFC text only in synthetic inputs, omits undefined fields, and compares exact
canonical JSON bytes. Unknown fields reject rather than normalize away. Invalid envelope
details normalize to `REJECTED_ENVELOPE -> D9_UNKNOWN -> BLOCK_OR_HUMAN_REVIEW` and the
single product projection above.

Canary scans use normalized exact text, base64, URL encoding, SHA-256/SHA-512/MD5 test
digests, and contiguous Unicode n-grams of length 3 or more. The capture-surface list is
the exact list in the private-note fixture introduction; adding a new surface requires
adding it to the harness before acceptance.

## Acceptance-Test Trace

| Acceptance test | Fixtures |
|---|---|
| `WO011-T01` private-note non-interference | `PRIV-01` through `PRIV-08` |
| `WO011-T02` opaque envelope rejection and mapping | `OPAQ-01` through `OPAQ-16`, including `OPAQ-03A` |
| `WO011-T03` role, retention, youth, deletion, key, audit, breach | `GOV-01` through `GOV-16` |

## Required Canary Scan

Allowed canary sinks are exactly `private_local_view` and the explicitly confirmed
`owner_full_backup_file`. The backup must contain the canary while network, telemetry,
audit, recipient, and purpose-change outputs remain empty. Scan every other generated
artifact and capture surface for:

- exact canary.
- Unicode-normalized form.
- base64 and URL encoding.
- substrings/n-grams.
- common digest encodings.
- length/token-count markers.
- note-specific reason categories.

PASS requires zero matches. Malformed envelopes must all normalize to the same generic
blocked/paused projection without revealing which validation failed.

## Acceptance Boundary

These are synthetic enforcement requirements. They do not prove legal compliance or
authorize persistence. Qualified review must pass before any executable runtime suite
can be adopted.

[DRAFT_COMPLETE]
