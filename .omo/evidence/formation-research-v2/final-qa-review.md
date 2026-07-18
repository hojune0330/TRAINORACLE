# Formation Research V2 Final QA Review

## Verdict

**FAIL** as tested on 2026-07-17 (Asia/Seoul).

The prepared research package is internally consistent and every package-specific prepared
validator passes. The intentionally unaccepted screening, extraction, and appraisal paths
also fail for the correct human-gate reasons. Final QA is not clean because the protocol's
actual SHA-256 does not match its recorded frozen hash, abstract-only sources are listed as
support for six synthesized claims, and five trailing-whitespace instances remain in raw
search evidence. A CRLF defect found in the legacy P1 Formation validator was fixed and passed
on the final rerun.

No app server was needed or started because this is a research-only package.

## Scenarios

| ID | Scenario | Expected | Result |
|---|---|---|---|
| QA-01 | Run the V2 protocol/schema validator | Seven RQs, fixed owner identity, target authority, no runtime authority | PASS |
| QA-02 | Run source/citation integrity validation | 167 unique sources, 75 mapped occurrences, seven searched RQs, valid claim references | PASS |
| QA-03 | Run prepared screening | Both lanes and canonical ledger cover 167 sources exactly once | PASS |
| QA-04 | Attempt accepted screening | Nonzero exit for 167 pending human reviews and two deferred rows | PASS |
| QA-05 | Run prepared extraction | Both lanes and canonical ledger cover 167 sources; conflicts stay suppressed | PASS |
| QA-06 | Attempt accepted extraction | Nonzero exit for 167 pending rows and 2,668 conflicts | PASS |
| QA-07 | Run prepared appraisal | Both lanes and canonical ledger cover 167 sources | PASS |
| QA-08 | Attempt accepted appraisal | Nonzero exit for 167 pending reviews and 208 conflicts | PASS |
| QA-09 | Run synthesis, packet, final-prep, and owner-baseline validators | Prepared-only outputs, separate packet ownership, 0/6 reviewers, 0/5 manual scenarios, latest owner decision governs | PASS |
| QA-10 | Run every new Node script through `node --check` | All scripts parse | PASS, 15/15 |
| QA-11 | Independently reconcile CSV rows and source IDs | No missing, unknown, or duplicate IDs; all claim references resolve | PASS |
| QA-12 | Verify the frozen protocol hash | Actual hash equals the Task-01/ledger hash or a dated amendment records the change | **FAIL** |
| QA-13 | Run the legacy P1 Formation validator | Platform-independent pass | PASS after CRLF fix; 10/10 plans |
| QA-14 | Check changed-path scope | No app, runtime, `specs/active`, or `specs/reconstruct` changes | PASS |
| QA-15 | Check whitespace across tracked and untracked changes | No whitespace errors | **FAIL**, five Markdown hard-break lines |
| QA-16 | Enforce source-state eligibility for synthesized support | Abstract/metadata-only sources do not support final claims or rule candidates | **FAIL**, seven references across six claims |

## Commands And Outputs

### Prepared validators

```text
node specs/test-packages/validate-formation-research-v2.mjs
  FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
node specs/test-packages/validate-formation-source-audit.mjs
  FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
node specs/test-packages/validate-formation-screening.mjs
  FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
node specs/test-packages/validate-formation-extraction.mjs
  FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2668 pending_rows=167
node specs/test-packages/validate-formation-appraisal.mjs
  FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167
node specs/test-packages/validate-formation-synthesis.mjs
  FORMATION_SYNTHESIS_PREPARED reports=5 claims=21 rqs=7 runtime=false
node specs/test-packages/validate-formation-decision-packets.mjs
  FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
node specs/test-packages/validate-formation-final-review-preparation.mjs
  FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
node specs/test-packages/validate-latest-owner-decision.mjs
  FORMATION_OWNER_BASELINE_VALID conflicts=9 latest_decision=governs runtime=false
node specs/test-packages/validate-formation-p1-target-plans.mjs
  PASS: exactly 10 unique owner-approval-ready P1 target patch plans validated
```

All ten commands exited `0` on the final rerun.

### Required negative acceptance tests

```text
node specs/test-packages/validate-formation-screening.mjs --accepted
  FORMATION_SCREENING_INVALID acceptance blocked pending_human=167 deferred=2
  exit 1
node specs/test-packages/validate-formation-extraction.mjs --accepted
  FORMATION_EXTRACTION_INVALID acceptance blocked pending_rows=167 conflicts=2668
  exit 1
node specs/test-packages/validate-formation-appraisal.mjs --accepted
  FORMATION_APPRAISAL_INVALID acceptance blocked pending_human=167 conflicts=208
  exit 1
```

These are expected negative results and therefore PASS. Prepared evidence is not being
misrepresented as human acceptance.

### Node syntax

```text
git ls-files --others --exclude-standard -- 'specs/test-packages/*.mjs'
node --check <each returned script>
NODE_CHECK_SUMMARY total=15 passed=15 failed=0
```

### Independent CSV and reference reconciliation

PowerShell `Import-Csv` reconciliation against the canonical source-ID set produced:

```text
SOURCE_IDENTITY rows=167 unique_ids=167 urls=167 doi_or_pmid_or_url=167
screening lane 1/lane 2/canonical: rows=167 unique=167 missing=0 unknown=0 duplicates=0
screening decisions: INCLUDE=163 EXCLUDE=2 DEFER=2
extraction lane 1/lane 2/canonical: rows=167 unique=167 missing=0 unknown=0 duplicates=0
extraction conflicts: rows=2668 NOT_VERIFIED=2668 PENDING_HUMAN=2668 unknown_sources=0
appraisal lane 1/lane 2/canonical: rows=167 unique=167 missing=0 unknown=0 duplicates=0
appraisal conflicts: rows=208 PENDING_HUMAN=208 unknown_sources=0
claim references: claims=21 rqs=7 references=74 unique_references=62 unknown=0
```

The ten prepared research/review documents contain eight direct source-ID occurrences, all
resolving to the source ledger. Other narrative claims route through the 21-row claim matrix.
Reference existence passes, but source-state eligibility does not; see F-04.

### Latest-owner baseline and conflict register

```text
conflict rows=9 unique_ids=9 required_patch_nonempty=9 user_impact_nonempty=9
status: PATCH_REQUIRED=7 TARGET_REQUIRED=1 HUMAN_REVIEW_REQUIRED=1
severity: BLOCKER=3 BLOCKER_BEFORE_UI_ACCEPTANCE=1 HIGH=5
owner precedence: baseline=true protocol=true plan=true runtime_authority=false
```

The conflict register identifies required future patches without changing those canonical
targets. The latest explicit owner decision governs product direction; research authority
does not become runtime authority.

## Failures

### F-01: Frozen protocol hash mismatch (blocking)

```text
Get-FileHash -Algorithm SHA256 reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
actual:   c02388e444f03580ab82a7656624ba3a6cb8b0cfd5477d8d4760a88bd930288a
recorded: 5fda23e1bba850ce4cc609dc397f3656e686eb23eb824f40a7fbc8d10fecaf38
```

The file is LF-only with no BOM, so this is not newline normalization. Task 01 says any later
correction must record a new hash and search impact, but no dated amendment was found. Either
restore the frozen bytes or add a truthful amendment and search-impact record; do not merely
rewrite historical evidence without explaining the change.

### F-02: Legacy Formation P1 validator CRLF defect (resolved during QA)

```text
initial: exit 1, regex required LF-only line endings
fix:     owning_files/owning_issues expressions now use \r?\n
final:   exit 0, exactly 10 unique owner-approval-ready P1 target patch plans validated
```

The checked-out target plan uses CRLF. The validator was made newline-agnostic; the target plan
and approval state were not modified. This is retained as a discovered-and-resolved regression,
not a remaining blocker.

### F-03: Untracked whitespace scan

`git diff --check` exits `0` for tracked changes. A line-by-line scan of untracked files found
five trailing-space instances and zero missing final newlines:

```text
.omo/evidence/formation-research-v2/search-rq-b.md:3
.omo/evidence/formation-research-v2/search-rq-b.md:4
.omo/evidence/formation-research-v2/search-rq-e.md:3
.omo/evidence/formation-research-v2/search-rq-e.md:4
.omo/evidence/formation-research-v2/search-rq-e.md:5
```

### F-04: Abstract-only sources support synthesized claims (blocking)

An independent join of `FORMATION_CLAIM_MATRIX.csv` to `FORMATION_SOURCE_LEDGER.csv` found
seven supporting references from seven `ABSTRACT_ONLY` sources across six claims. Four of the
affected claims are `RULE_INPUT_CANDIDATE`:

```text
FRV2-CLAIM-B-001  DESCRIPTIVE_ONLY      FRV2-B-001
FRV2-CLAIM-C-001  RULE_INPUT_CANDIDATE  FRV2-C-005
FRV2-CLAIM-D-001  RULE_INPUT_CANDIDATE  FRV2-D-002; SRC-PMID-28463642
FRV2-CLAIM-D-004  PROHIBITED            FRV2-D-021
FRV2-CLAIM-E-002  RULE_INPUT_CANDIDATE  FRV2-E-001
FRV2-CLAIM-G-001  RULE_INPUT_CANDIDATE  FRV2-G-010
```

The source-audit validator still passes because it rejects only `UNRESOLVED` and
`RETRACTED_OR_CORRECTED` claim sources. That is weaker than the protocol/plan rule that
abstract-only evidence cannot support effect magnitude, detailed protocol, safety, or final
certainty. Classify these IDs as context/search seeds rather than synthesized support, or
record full-text verification before keeping them in supporting fields; then add a validator
regression for `ABSTRACT_ONLY` and `METADATA_ONLY` eligibility.

## Diff Scope

At the final scope rerun there were 108 changed entries: three tracked files and 105
untracked files (`.omo` 67, `reports` 24, `specs` 17). There were zero changes under `app/`,
`dashboard/`, `impl/`, `specs/active/`, or `specs/reconstruct/`, and no `index.html` change.
The package therefore makes no app/runtime or active canonical-spec change.

## Cleanup

No server, browser, port, database, temporary script, or generated scratch file was created.
All Node processes exited. The only file added by this QA assignment is this report.
