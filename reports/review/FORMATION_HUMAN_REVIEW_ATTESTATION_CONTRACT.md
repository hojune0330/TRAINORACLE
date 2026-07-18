# Formation Human Review Attestation Contract

```yaml
status: PREPARED_NOT_APPROVED
attestation_ledger: reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv
current_attestations: 0
runtime_authority: false
```

Generated `CONFIRMED` or `HUMAN_CONFIRMED` text is never authority by itself. Accepted screening,
extraction, and appraisal each require one ledger row per source with:

- `review_type`: `SCREENING | EXTRACTION | APPRAISAL`;
- a named non-AI `reviewer_id` and a verifiable `qualification_ref`;
- `decision: APPROVE`;
- SHA-256 bindings for the two raw lane records and the canonical record;
- an ISO timestamp with timezone and an auditable `record_ref`.
- `key_id`, `signature_algorithm: Ed25519`, and a signature over every authority, hash,
  timestamp, and record-reference field.

Validators recompute the hashes and reject duplicate attestations, missing qualifications,
unknown sources, deleted conflicts, raw/canonical divergence, or AI/placeholder reviewer IDs.
They also require `FORMATION_TRUSTED_REVIEWER_KEYS_JSON`, supplied outside the repository, to
bind each `key_id` to the exact reviewer, qualification reference, and Ed25519 public key.
Repository text alone cannot create a trusted reviewer. The environment value is a JSON array:

```json
[
  {
    "key_id": "SPORTS-SCIENCE-KEY-1",
    "reviewer_id": "NAMED_REVIEWER_ID",
    "qualification_ref": "VERIFIED_PUBLIC_CREDENTIAL_REF",
    "public_key_pem": "-----BEGIN PUBLIC KEY-----..."
  }
]
```

The empty ledger is intentional: no human review has occurred. It keeps all accepted modes
blocked without fabricating approval.

Changing a final marker, deleting a conflict row, or copying one AI lane into another cannot
advance the package. Non-independent gap fills remain `PENDING_HUMAN_REEXTRACTION`, and a human
attestation cannot authorize runtime; it only closes the named research-review stage.
