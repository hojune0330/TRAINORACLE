# Formation Research V2 Final Quality Remediation Review V3

## Verdict

| Scope | Verdict | Basis |
|---|---|---|
| Code and package preparation | **PASS** | No blocking, high, medium, or low code-quality findings remain in the frozen state. All 23 regression tests, all 10 normal validators, and syntax checks pass. |
| Human research acceptance | **NOT APPROVED (correctly blocked)** | The attestation ledger is empty, screening/extraction/appraisal each have 167 pending source rows, and conflict histories remain pending. No human identity, qualification, decision, or signature was fabricated for this review. |
| Runtime activation | **NOT AUTHORIZED** | The package and decision artifacts consistently retain `runtime_authority: false`. Research-stage attestation cannot enable runtime. |

## Findings

No actionable code-quality findings remain after the final frozen remediation.

The earlier transient defect for `FRV2-F-015` and `FRV2-F-016` is closed. The lane-2 appraisal
generator now derives independence from canonical extraction adjudication, the generated rows and
canonical appraisal ledger label all six root gap fills as non-independent, and the appraisal
validator independently joins the extraction ledger. The new negative regression test fails if
that provenance is changed back to independent.

## Former FQ Disposition

| ID | Result | Final evidence |
|---|---|---|
| FQ-01 acceptance marker/conflict deletion bypass | **PASS** | Screening, extraction, and appraisal accepted modes require exact raw/canonical hashes plus an Ed25519 signature from a key supplied through external `FORMATION_TRUSTED_REVIEWER_KEYS_JSON`. The signed payload covers review type, source, reviewer, qualification, decision, hashes, timestamp, record reference, key ID, and algorithm. Unknown sources/types, duplicate attestations, untrusted keys, self-signed rows, AI identities, placeholders, and signed-field tampering are rejected. Extraction and appraisal require exact conflict history; confirmed appraisal conflicts must be retained and marked `CONFIRMED`. |
| FQ-02 non-idempotent extraction repair | **PASS** | `repair-formation-extraction-preparation.mjs` falls back to the already-repaired E lane for `FRV2-F-015/016`. The two-pass byte/hash equality regression passes. |
| FQ-03 non-independent gap suppression | **PASS** | All six root gap fills have every extraction evidence field set to `NOT_VERIFIED`, extraction adjudication remains `NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION`, and all six canonical appraisal rows remain `NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL`. Cross-stage validation and a negative regression prevent provenance loss. |
| FQ-04 permissive CSV handling | **PASS** | Formation builders and validators use the shared strict parser. Tests cover embedded newlines/escaped quotes and reject unterminated or illegal quotes, width mismatches, duplicate headers, and blank headers. |
| FQ-05 stale protocol hash | **PASS** | The protocol SHA-256 is `f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6`; it matches the amendment log, Task 01 evidence, start-work ledger, and validator recomputation. |
| FQ-06 empty decision fields | **PASS** | Both packets contain complete, disjoint owned/forbidden field lists, explicit `NOT_REVIEWED` owner state, complete decision choices, and `runtime_authority: false`. The omission regression passes. |
| FQ-07 `NOT_APPLICABLE` appraisal merge | **PASS** | All 90 observed directness disagreements involving `NOT_APPLICABLE` resolve to canonical `NOT_VERIFIED`; no ordering fallback promotes them. Canonical enums are validated in both prepared and confirmed states. |
| FQ-08 unstructured exclusion reasons | **PASS** | The two exclusions use controlled codes `IRRELEVANT_EXPOSURE_OR_FRAME` and `WRONG_SOURCE_IDENTITY`, retain both lane reasons, and reconcile to canonical screening. Confirmed exclusion state must mirror the final screening record. |
| FQ-09 hardcoded count/oversized generator | **PASS** | No generator acceptance depends on a literal 167-row total. Lane 1 is split into 69/92/204 physical-line modules. Across the reviewed formation modules, the largest is 223 nonblank/non-comment LOC (250 physical lines), below the 250 pure-LOC ceiling. Current lane-1 CSV SHA-256 is `f4cb5efa1f8581523e385433f3e041de59d2920764ea61d3d71be52a3ea231be`. |

## Confirmed-State Review

- Screening exclusions derive expected `human_confirmation` and adjudication from the corresponding
  canonical screening row. An accepted package cannot leave an excluded record pending.
- Appraisal validates canonical overall/directness enums, requires confirmed rows to use
  `HUMAN_CONFIRMED`, retains the exact lane-disagreement key set, and requires every retained
  conflict to be `CONFIRMED` with its selected value equal to the canonical value.
- Appraisal accepted mode counts pending conflicts rather than requiring the conflict ledger to be
  deleted. This preserves audit history while allowing legitimate human resolution.
- The attestation ledger header includes `key_id`, `signature_algorithm`, and `signature_base64`;
  the repository contains no trust anchor or private key.

## Verification

| Check | Result |
|---|---|
| Attestation unit tests | **6/6 PASS** |
| Complete targeted Node regression suite | **23/23 PASS** |
| Normal formation validators | **10/10 PASS** |
| Formation module syntax checks | **PASS** |
| Accepted screening without human records | **BLOCKED**: 167 pending, 2 deferred |
| Accepted extraction without human records | **BLOCKED**: 167 pending rows, 2,824 pending conflicts |
| Accepted appraisal without human records | **BLOCKED**: 167 pending rows, 208 pending conflicts |
| Final reviewer/manual preparation | **0/6 reviewers; 0/5 manual scenarios**, explicitly pending |

Normal prepared-state outputs reconcile 167 sources, 75 audited citation occurrences, 22 claims,
five synthesis reports, two controlled exclusions, and ten unique P1 target patch plans.

## Open Gates

The package is mechanically and substantively ready to enter real human review. It is not evidence
that human review occurred. Full accepted-mode success was intentionally not exercised because no
external reviewer trust anchor, signed per-source attestations, confirmed conflict resolutions, or
completed manual-review records exist.

Runtime remains a separate owner/safety/integration decision after human research acceptance. This
review grants no prescription, safety, medical, privacy, deployment, or runtime authority.
