# Evidence Manifest And Signature Contract

```yaml
contract_id: TRAINORACLE_EVIDENCE_MANIFEST_AND_SIGNATURE_V1
status: REVIEW_CONTRACT_NO_KEYS_OR_APPROVALS_ENROLLED
all_authority: false
runtime_authority: false
trusted_key_count: 0
```

## Purpose and trust boundary

This contract makes later human decisions attributable and reproducible. It creates no
approver, signature, policy acceptance, runtime permission, or trust store. Candidate
documents, request bodies, repository files, client-controlled environment variables,
and role names cannot enroll identities or keys.

## EvidenceManifestV1

An evidence manifest binds one repository, `main`, and one 40-character lowercase source
commit that is already reachable from the protected remote `main`. Dirty worktree files,
working branches, mutable URLs, generated timestamps, and uncommitted content are
ineligible.

Each entry contains exactly `path` and `sha256`:

- Decode repository path as UTF-8, reject invalid UTF-8, normalize to NFC, use `/`, reject
  absolute paths, `.`/`..`, duplicate normalized paths, NUL, backslash, and case aliases.
- Sort entries by normalized path Unicode code points. Hash the exact blob bytes stored at
  `sourceCommitSha`; working-tree bytes are irrelevant.
- Render each entry as `path`, ASCII TAB, 64 lowercase hex SHA-256, LF. Concatenate without
  a header or BOM and SHA-256 those UTF-8 bytes for `evidenceManifestSha256`.
- Generated evidence is eligible only when its committed artifact bytes are listed and
  hashed like every other artifact. Generator name/version and deterministic input refs
  belong in that artifact; generated output never receives special trust.
- The acceptance record being produced, its detached signatures, signed-payload digest,
  trusted-key records, qualification/conflict records, revocation records, and any file
  containing the manifest digest itself MUST NOT appear in that same manifest. This is
  the non-circularity rule.

After the manifest is made, the acceptance record binds its digest, source SHA, decision,
contract versions, remaining risks, and approval metadata. Its signed payload follows the
JCS/NFC and signature-omission rule in
`FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md`. A manifest digest never proves that a
person reviewed or approved it.

## Real identity and key enrollment

Enrollment is performed out of band by a designated trust custodian who is not the
subject being enrolled. The restricted append-only record contains:

1. opaque public `approverId`; verified real-world identity reference stored separately;
2. exact eligible role and scope; qualification issuer, evidence reference, issue/expiry
   date, and verification timestamp;
3. conflict declaration and independent conflict decision reference;
4. dedicated Ed25519 `keyId`, public key fingerprint, creation time, custody method, and
   proof-of-possession challenge signature;
5. enrollee and custodian acknowledgements plus enrollment-record version.

The private key never enters the repository. A role label or self-asserted key is rejected.
One key binds exactly one real identity. Role eligibility is evaluated at signing time,
not inferred from an earlier job title.

## Signature capture and verification

The reviewer receives the source SHA, canonical manifest, exact decision, remaining
risks, and their single role. After review, they sign the 32-byte `signedPayloadSha256`
digest with their enrolled Ed25519 key. Verification must confirm payload recomputation,
signature length/encoding, cryptographic validity, identity-key-role binding,
qualification currency/scope, conflict clearance, key status at `approvedAt`, and the
decision enum. Qualification and conflict checks happen before the restricted trust-
context builder exposes an eligible key to the V1 verifier. Failure is fail-closed and
remains `NOT_REVIEWED`.

No signature is copied between roles or records. The current
`TRAINORACLE_WO016_ACCEPTANCE_RECORD_V1` verifier rejects a repeated `approverId` or
`keyId` within one order, so one person cannot fill two required roles in that record.
A multi-role exception is not available until an owner approves a versioned V2 schema,
tests, and conflict policy. Required-role independence may still prohibit it in V2.

## Revocation, supersession, and re-review

- Key compromise, loss, departure, qualification expiry, identity mismatch, or conflict
  discovery creates an append-only revocation with effective time and reason category.
  New signatures with that key are rejected; affected prior decisions are marked for
  owner review without erasing history.
- Rotation enrolls a new key and never rewrites an old signature.
- V1 has no `supersedesRecordSha256` or acceptance-record version field. Supersession is
  therefore fail-closed: the trusted context selects one new merged-main source SHA per
  order, the six-record bundle contains exactly one record per order, and an older record
  is ineligible. Hash-linked supersession requires a later versioned schema and tests.
- Any evidence-byte, source-SHA, contract-version, risk, required-change, qualification,
  conflict, or required-role change invalidates reuse and requires a new manifest and
  complete re-review by every required role.
- `APPROVE_WITH_REQUIRED_CHANGES` cannot be promoted automatically after edits.

## Closed failure codes

| Code | Meaning |
|---|---|
| `EVIDENCE_SOURCE_NOT_MERGED_MAIN` | Source commit is not reachable from protected remote main. |
| `EVIDENCE_PATH_NONCANONICAL` | Path is invalid, non-NFC, duplicated, aliased, or unsorted. |
| `EVIDENCE_HASH_MISMATCH` | Committed blob or canonical manifest digest differs. |
| `EVIDENCE_CIRCULAR_REFERENCE` | Record/signature/trust metadata contributes to its own evidence hash. |
| `IDENTITY_OR_QUALIFICATION_UNVERIFIED` | Real identity, role scope, or qualification is absent/expired. |
| `CONFLICT_UNRESOLVED` | Conflict review is missing, self-decided, or disallows participation. |
| `KEY_UNKNOWN_OR_REVOKED` | Key is not enrolled for this identity/role/time or is revoked. |
| `SIGNATURE_INVALID` | Canonical payload or Ed25519 signature verification fails. |
| `REVIEW_STALE_OR_SUPERSEDED` | Evidence changed, required changes remain, or record is not the sole head. |

## Current foundation state

No real identity, qualification, conflict decision, key, signature, human response, or
policy acceptance is captured by this contract. `all_authority: false` remains mandatory.

[DRAFT_COMPLETE]
