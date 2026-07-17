# Formation Research V2 Security Remediation Re-Review

```yaml
review_date: 2026-07-17
privacy_safeguarding_remediation: PASS
package_security_preparation: FAIL
runtime_approval: BLOCKED_NOT_GRANTED
blocker_findings: 1
high_findings: 0
human_review_attestations: 0
production_or_network_code_changed: false
```

## Verdict

The disclosure, private-note, user-directed transport, and reviewer-unavailable remediations pass
as research-package contract preparation. The package does not yet pass security preparation as a
whole because a forged named-human attestation can satisfy the new attestation validator.

This verdict is not runtime approval. Participant enrollment, outbound delivery, production use,
and automated prescription remain blocked. No runtime or network implementation was reviewed or
authorized.

## Blocking Finding

### [BLOCKER] AUTH-REM-01: Human-attestation identity is denylisted, not authenticated

`FORMATION_HUMAN_REVIEW_ATTESTATION_CONTRACT.md:10-26` correctly says generated confirmation text
is not authority, requires a named non-AI reviewer and qualification reference, binds raw and
canonical records with SHA-256, and limits an attestation to its named research stage.

`formation-attestations.mjs:39-62` enforces:

- rejection of known AI/agent prefixes;
- rejection of empty or recognized placeholder authority references;
- `APPROVE`, timestamp, raw-record hash, and canonical-record hash checks.

Those checks establish record integrity after an identity is trusted, but they do not establish
identity authenticity. `reviewer_id`, `qualification_ref`, and `record_ref` are self-asserted
strings. The hashes are unkeyed and can be recomputed by the same actor writing the row. There is
no trusted reviewer registry, trusted credential issuer, signature, or proof-of-possession bound
to the Formation research attestation.

The following in-memory adversarial case was executed against the current validator:

```text
reviewer_id=KIM_MINJI_SPORTS_SCIENTIST
qualification_ref=https://attacker.invalid/credential
record_ref=https://attacker.invalid/review/1
raw_input_sha256=<recomputed valid hash>
canonical_record_sha256=<recomputed valid hash>
result={"forged_named_identity_accepted":true,"errors":[]}
```

The existing positive test intentionally accepts that named reviewer shape. The 3/3 attestation
tests prove denial of obvious AI names and placeholders; they do not prove non-AI authorship or
prevent a fabricated human identity.

Required closure:

1. Resolve reviewer identity and allowed review roles from a trusted registry supplied outside the
   candidate attestation. Do not accept trust roots, credentials, or allowed roles from the row.
2. Require a reviewer signature or equivalent verifiable proof over a canonical preimage that
   includes review type, source ID, reviewer identity, role, both record hashes, decision,
   qualification reference, record reference, and timestamp.
3. Verify the signature against the externally trusted identity and reject unknown, revoked,
   expired, role-mismatched, duplicate, or self-attested credentials.
4. Add an adversarial test that starts with a syntactically valid named reviewer and recomputed
   hashes but no trusted key/registry entry; acceptance must fail.
5. Keep the existing hash, AI-name, placeholder, duplicate, conflict, and missing-attestation
   checks as defense in depth.

The worktree already contains a stronger trusted-key/signature pattern for the later formal gate;
the research-stage attestation should reuse or deliberately bind to an equivalently external trust
model. A research attestation must still never grant runtime authority.

## Remediated Controls

| Control | Result | Evidence |
|---|---|---|
| Decline and unasked states are local suppression only | `PASS` | Protocol 342-346; youth review 41-48; owner baseline 46-48. Both states are `SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE`, imply no concern, and create no recipient, network, audit, or telemetry event. |
| Private-note content and metadata are zero-signal | `PASS` | Protocol 347-349; youth review 54-58; owner baseline 39-45; claim `FRV2-CLAIM-G-003`. Presence, length, time, frequency, missingness, topic/sentiment, embedding, and index state are excluded from analysis, planning, reward, telemetry, and safety. |
| Backup/share is a transport operation, not analysis consent | `PASS` | Protocol 345-351; youth review 60-66; owner baseline 27-30 and 43-48; claim `FRV2-CLAIM-G-004`. Recipient, fields, purpose, duration/retention, preview/confirmation, withdrawal limits, default exclusion, and exported-file limits are traced. No analytics, reward, or Formation event is permitted. |
| Reviewer-unavailable states preserve continuity and avoid coercive dead ends | `PASS` | Protocol 352-355; youth review 76-80; owner baseline 49-50. The current coach-authored plan and local journal remain, with correction, local backup/export, later review, and user-controlled sharing paths that do not require more disclosure. |
| Structured concerns do not diagnose or silently notify | `PASS` | Youth review 41-52 and claim `FRV2-CLAIM-G-001`. Non-emergency delivery requires separate participant confirmation; an unconfigured route is not shown as received or completed. |
| Human review is not currently claimed | `PASS` | Attestation ledger is header-only; reviewer ledger remains six `UNASSIGNED/NOT_REVIEWED` rows; prepared acceptance validators fail on missing attestations. |
| Attestation content is hash-bound | `PASS` | Raw and canonical SHA-256 values are recomputed; duplicate and divergence checks remain. This does not cure AUTH-REM-01 authenticity. |
| Forged human acceptance is prevented | `FAIL` | Named arbitrary identities and attacker-controlled non-placeholder references pass after hashes are recomputed; see AUTH-REM-01. |
| No runtime/network implementation changed | `PASS` | Worktree scope contains research reports, evidence, and `specs/test-packages` validators/tests; no `app/`, `impl/`, backend, migration, or production-network paths changed. Runtime flags remain false. |

## Executed Verification

Protocol amendment integrity:

```text
computed protocol SHA-256: f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
amendment log SHA-256:      f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
```

Executable tests:

```text
node --test formation-attestations.test.mjs formation-research-integrity.test.mjs validate-formation-synthesis-boundaries.test.mjs
11 tests passed, 0 failed
```

Prepared-state validators:

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=10 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
```

Accepted-state validators correctly remain closed in the current empty-attestation state:

```text
validate-formation-screening.mjs --accepted  -> exit 1, missing human attestation
validate-formation-extraction.mjs --accepted -> exit 1, missing human attestation
validate-formation-appraisal.mjs --accepted  -> exit 1, missing human attestation
```

## Exit Boundary

After AUTH-REM-01 is fixed and its adversarial test is green, the package security-preparation
verdict may move to `PASS`. That later result would mean only that the documentation, evidence,
and review-acceptance machinery is prepared for real human review. Runtime must remain blocked
until all named human decisions, canonical patches, pilot/legal/privacy/safeguarding gates, and a
separate authenticated owner activation record exist.

[FINAL_SECURITY_REMEDIATION_PACKAGE_FAIL_RUNTIME_BLOCKED]
