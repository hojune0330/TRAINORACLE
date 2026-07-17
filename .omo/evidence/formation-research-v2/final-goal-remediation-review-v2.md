# Formation Research V2 Final Incremental Goal Review

## Layered Verdict

| Layer | Verdict | Boundary |
|---|---|---|
| A. Mechanical and research-package preparation | **PASS** | Signed-attestation trust and six-row cross-stage provenance are correctly enforced; prior owner, privacy, source, and protocol remediations remain intact. |
| B. Scientific acceptance and runtime activation | **FAIL / NOT ACCEPTED** | No signed human attestations, trusted reviewer-key environment, expert decisions, owner packet decisions, or manual-review passes exist. Runtime and canonical activation remain off. |

Layer B is the expected honest gate state. It does not invalidate the Layer A preparation PASS.

## Incremental Findings

### 1. Signed human-attestation trust: PASS for mechanism, no approval created

`reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv` contains only its header:

```text
ATTESTATION_STATE rows=0 trusted_key_env_present=False
```

Accepted screening, extraction, and appraisal now require:

- a named non-AI reviewer and non-placeholder qualification/record references;
- `APPROVE` for the exact stage and source;
- hashes of both raw inputs and the canonical record;
- an ISO timestamp;
- a trusted `key_id` supplied outside the repository through
  `FORMATION_TRUSTED_REVIEWER_KEYS_JSON`;
- an Ed25519 signature over every authority, hash, timestamp, and record-reference field.

The repository cannot self-authorize a reviewer key. Tests accept a correctly signed trusted
reviewer and reject AI identities, placeholders, self-signed/untrusted reviewers, signed-field
tampering, unknown sources, and invalid review types.

Evidence:

- `reports/review/FORMATION_HUMAN_REVIEW_ATTESTATION_CONTRACT.md`
- `reports/research/evidence/FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv`
- `specs/test-packages/formation-attestations.mjs`
- `specs/test-packages/formation-attestations.test.mjs`

### 2. Six-row cross-stage provenance: PASS

The six extraction rows created with a non-independent root gap fill remain explicitly
`NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION`. The same six source IDs enter appraisal
as `NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL`; none is relabeled independent.

```text
CROSS_STAGE_PROVENANCE extraction=6 appraisal=6 mismatches=0
```

Source IDs:

```text
FRV2-F-015
FRV2-F-016
SRC-DOI-10.1136-BMJ.H1793
SRC-PMID-34250468
SRC-WEB-COCHRANE-HB-CH14
SRC-WEB-PRISMA-2020
```

`formation-research-integrity.test.mjs` mutates this provenance to appear independent and
confirms that appraisal validation rejects it.

Evidence:

- `reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv`
- `reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv`
- `specs/test-packages/validate-formation-extraction.mjs`
- `specs/test-packages/validate-formation-appraisal.mjs`
- `specs/test-packages/formation-research-integrity.test.mjs`

## Goal And Constraint Recheck

| Constraint | Result | Current evidence |
|---|---|---|
| Latest explicit owner choices govern | PASS | `FORMATION_OWNER_BASELINE_VALID conflicts=10 latest_decision=governs runtime=false` |
| Fixed 9.5-day deterministic primary default | PASS | Baseline retains `9_5_DAY_FORMATION`, `DEFAULT_AUTOMATED_PRESCRIPTION`, and one default plan; technical annex retains one deterministic primary plan with 2-3 MAIN events |
| Race self-check direction | PASS AS DIRECTION | `CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED` remains in the latest baseline and open conflict `FRV2-CONF-010`; current display-only state is not silently converted to runtime analysis |
| Private-note analysis/transport split | PASS | G-003 remains `ZERO_SIGNAL_FOR_ANALYSIS`; G-004 remains `USER_DIRECTED_FILE_OPERATION` for explicit backup/share |
| Claim support excludes abstract/metadata-only sources | PASS | `SUPPORTING_SOURCE_CHECK linked=34 prohibited=0` |
| Protocol authority remains bound | PASS | SHA-256 remains `f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6` |
| Research-only, runtime-off scope | PASS | No changed path under app, implementation, canonical active/reconstruct specs, root race decision, or canonical Formation decision files; forbidden-path count is 0 |
| Human gates remain open | PASS | Attestations 0; reviewers `NOT_REVIEWED=6`; manual scenarios `NOT_RUN=5`; accepted modes all exit 1 |

No new conflict was found with the latest owner direction. Existing canonical conflicts remain
registered and unpatched in this research worktree, which is the required pre-gate state.

## Executable Evidence

Preparation validators, all exit `0`:

```powershell
node specs/test-packages/validate-formation-research-v2.mjs
node specs/test-packages/validate-formation-source-audit.mjs
node specs/test-packages/validate-formation-screening.mjs
node specs/test-packages/validate-formation-extraction.mjs
node specs/test-packages/validate-formation-appraisal.mjs
node specs/test-packages/validate-formation-synthesis.mjs
node specs/test-packages/validate-formation-decision-packets.mjs
node specs/test-packages/validate-latest-owner-decision.mjs
node specs/test-packages/validate-formation-final-review-preparation.mjs
```

Observed summaries:

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2824 pending_rows=167
FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167
FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=10 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
```

Integrity tests:

```powershell
node --test specs/test-packages/formation-attestations.test.mjs specs/test-packages/formation-csv.test.mjs specs/test-packages/formation-research-integrity.test.mjs specs/test-packages/validate-formation-synthesis-boundaries.test.mjs specs/test-packages/validate-formation-p1-target-plans-newlines.test.mjs
```

Result: `23/23` passed. The added coverage includes all signed-trust cases and rejection of
lost non-independent extraction provenance during appraisal.

Accepted-mode checks intentionally fail:

```powershell
node specs/test-packages/validate-formation-screening.mjs --accepted
node specs/test-packages/validate-formation-extraction.mjs --accepted
node specs/test-packages/validate-formation-appraisal.mjs --accepted
```

Observed:

```text
screening: exit=1 missing_attestations=167 pending_human=167 deferred=2
extraction: exit=1 missing_attestations=167 pending_rows=167 pending_conflicts=2824
appraisal: exit=1 missing_attestations=167 pending_human=167 pending_conflicts=208
```

Cross-stage check:

```powershell
$e = Import-Csv reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv
$a = Import-Csv reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv
$ex = @($e | Where-Object {
  $_.adjudication -eq 'NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION'
} | Select-Object -ExpandProperty source_id | Sort-Object)
$ap = @($a | Where-Object {
  $_.adjudication -eq 'NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL'
} | Select-Object -ExpandProperty source_id | Sort-Object)
$diff = @(Compare-Object $ex $ap)
"CROSS_STAGE_PROVENANCE extraction=$($ex.Count) appraisal=$($ap.Count) mismatches=$($diff.Count)"
```

Observed: `extraction=6 appraisal=6 mismatches=0`.

Scope check examined `git status --porcelain=v1` for changes under `app/`, `impl/`,
`dashboard/`, canonical `specs/active` and `specs/reconstruct`, root race decision, and
canonical Formation decision files. Observed:

```text
FORBIDDEN_IMPLEMENTATION_OR_CANONICAL_STATUS count=0
```

## Final State

```yaml
research_package_preparation: PASS
signed_human_attestation_trust_mechanism: PASS
cross_stage_non_independence_provenance: PASS
scientific_acceptance: FAIL_NOT_YET_REVIEWED
canonical_product_patch_authority: false
runtime_activation_authority: false
```

