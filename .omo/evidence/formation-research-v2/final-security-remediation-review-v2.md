# Formation Research V2 Security Remediation Re-Review V2

```yaml
review_date: 2026-07-17
package_security_preparation: PASS
privacy_safeguarding_preparation: PASS
human_scientific_acceptance: BLOCKED_NOT_PERFORMED
runtime_approval: BLOCKED_NOT_GRANTED
blocker_findings: 0
high_findings: 0
human_attestations: 0
runtime_or_network_code_changed: false
```

## Verdict

The Formation research package now passes the focused security-preparation re-review. The prior
human-attestation forgery blocker is closed: trusted reviewer identity comes from an external
trust source, every authority and record-binding field is signed with Ed25519, and self-signed,
untrusted, tampered, unknown-source, and unsupported-review-type records are rejected.

This is a package-preparation verdict only. No human review, scientific acceptance, participant
enrollment, production processing, or runtime prescription is approved. Runtime remains blocked.

## Blocker Closure

### AUTH-REM-01: Closed

`formation-attestations.mjs` now requires:

- `FORMATION_TRUSTED_REVIEWER_KEYS_JSON` supplied outside the repository;
- exact `key_id -> reviewer_id + qualification_ref + Ed25519 public key` binding;
- `decision: APPROVE`, a non-placeholder authority record, and an ISO timestamp;
- recomputed SHA-256 bindings for both raw lane records and the canonical record;
- an Ed25519 signature over review type, source ID, reviewer ID, qualification reference,
  decision, both hashes, timestamp, record reference, key ID, and signature algorithm;
- an allowed review type and a source ID present in the canonical source ledger.

The trust root is not accepted from the attestation row or repository ledger. A reviewer cannot
become trusted by adding a public key beside a self-signed row. Exact reviewer and qualification
binding prevents substituting another identity under a trusted key, and signed-field coverage
prevents changing the decision, record references, timestamps, or hashes after signature.

The attestation ledger remains header-only. Repository text therefore contains no human approval,
and accepted modes remain closed when the external trust source is absent.

## Focused Control Trace

| Control | Result | Evidence |
|---|---|---|
| External human identity trust | `PASS` | `loadTrustedReviewerKeys` reads the environment-only trust map; the contract states repository text alone cannot create a trusted reviewer. |
| Exact reviewer, qualification, and key binding | `PASS` | Verification requires the trusted map's reviewer ID and qualification reference to equal the signed row and uses that map's public key. |
| Signed-field integrity | `PASS` | The Ed25519 preimage covers all authority, source, decision, hash, time, record, key, and algorithm fields; tampering is rejected. |
| Self-signed or unknown reviewer rejection | `PASS` | A valid signature under a key absent from the external trust map fails as `untrusted reviewer key`. Known AI/agent identities and placeholder authority references also fail. |
| Attestation scope | `PASS` | Only `SCREENING`, `EXTRACTION`, and `APPRAISAL` are accepted, and the source ID must exist in `FORMATION_SOURCE_LEDGER.csv`. |
| Screening exclusion review-state history | `PASS` | Exclusion rows must mirror the canonical screening row as `PENDING_HUMAN/PENDING_HUMAN_CONFIRMATION` or `CONFIRMED/HUMAN_CONFIRMED`; both current exclusions are pending. |
| Appraisal conflict history | `PASS` | Every lane disagreement retains its conflict row. Confirmed canonical rows require `HUMAN_CONFIRMED`, a valid attestation, conflict state `CONFIRMED`, and the retained resolution matching the canonical value. Deleting a conflict row fails validation. |
| Decline/no-answer disclosure boundary | `PASS` | `PREFER_NOT_TO_ANSWER` and `NOT_ASKED` remain `SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE` with no recipient, network, audit, or telemetry event. |
| Private-note and user-directed transport boundary | `PASS` | Content and metadata remain zero-signal; explicit backup/share remains `USER_DIRECTED_FILE_OPERATION` with recipient/scope/purpose/duration/preview and no analytics, reward, or Formation event. |
| Reviewer-unavailable continuity | `PASS` | The current coach-authored plan and local journal remain available with correction, local backup/export, later review, and user-controlled sharing paths. |
| Runtime/network implementation scope | `PASS` | No `app/`, `impl/`, backend, migration, production configuration, or runtime-network path changed. Formation changes are research documents, ledgers, and test-package validators. |

## Executed Verification

All Formation test-package tests were run from the exact worktree:

```text
tests: 22
passed: 22
failed: 0
```

This includes six attestation tests covering AI identity rejection, signed trusted acceptance,
placeholder rejection, self-signed untrusted rejection, signed-field tampering, unknown sources,
and unsupported review types. It also includes strict CSV, marker-forgery, conflict-deletion,
determinism, source-ledger corruption, packet ownership, CRLF, and abstract-only source tests.

All ten prepared-state validators passed:

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2824 pending_rows=167
FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167
FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=10 latest_decision=governs runtime=false
PASS: exactly 10 unique owner-approval-ready P1 target patch plans validated
```

Accepted-state attempts remain intentionally closed:

```text
screening --accepted: exit 1, 167 missing human attestations
extraction --accepted: exit 1, 167 missing human attestations
appraisal --accepted: exit 1, 167 missing human attestations
```

The current environment contains no `FORMATION_TRUSTED_REVIEWER_KEYS_JSON`, and the attestation
ledger contains zero data rows. No acceptance can be inferred from the passing preparation checks.

## Residual Operational Boundary

The external trust configuration is security-critical. Its provisioner must protect integrity,
control reviewer enrollment and revocation, and keep reviewer private keys outside the repository.
Compromise of that external authority is outside this package's verifier boundary and must not be
treated as a repository-controlled risk.

Even with valid future research attestations, runtime requires separate named expert decisions,
owner packet decisions, canonical patches, local legal/privacy/safeguarding approval, participant
and accessibility review, and authenticated owner activation. Research-stage signatures cannot
authorize runtime.

[FINAL_SECURITY_REMEDIATION_V2_PACKAGE_PASS_RUNTIME_BLOCKED]
