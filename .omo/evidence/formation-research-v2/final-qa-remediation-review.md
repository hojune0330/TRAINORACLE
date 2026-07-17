# Formation Research V2 Remediation QA Re-review

## Verdict

| Acceptance surface | Verdict | Evidence |
|---|---|---|
| Research-package mechanical readiness | **PASS** | 16/16 Node tests, 10/10 normal validators, hash/whitespace/count checks pass |
| Human acceptance | **INTENTIONALLY BLOCKED** | 0 attestations, 0/167 confirmed rows, 0/6 reviewers, 0/5 manual scenarios |
| Scientific acceptance | **INTENTIONALLY BLOCKED** | 167 appraisal rows pending; 208 conflicts; zero whole-architecture-direct sources |
| Runtime acceptance | **INTENTIONALLY BLOCKED** | 22/22 claims retain `runtime_authority=false`; packets are `NOT_REVIEWED` |

The remediation is mechanically ready as a research-preparation package. It is not, and does
not claim to be, accepted science or an authorized runtime prescription. No app server was
needed or started.

## Scenarios

| ID | Scenario | Expected | Result |
|---|---|---|---|
| RQA-01 | Run all remediation Node tests | 16 tests pass | PASS, 16/16 |
| RQA-02 | Run all normal Formation validators | 10 validators exit 0 | PASS, 10/10 |
| RQA-03 | Attempt accepted screening | Fail for missing attestations, 167 pending, 2 deferred | PASS, expected exit 1 |
| RQA-04 | Attempt accepted extraction | Fail for missing attestations, 167 pending, 2,824 conflicts | PASS, expected exit 1 |
| RQA-05 | Attempt accepted appraisal | Fail for missing attestations, 167 pending, 208 conflicts | PASS, expected exit 1 |
| RQA-06 | Verify amended protocol provenance | Actual SHA-256 equals dated amendment hash | PASS |
| RQA-07 | Check tracked and untracked whitespace | No trailing whitespace or missing final newline | PASS |
| RQA-08 | Exercise Windows CRLF P1 path | CRLF fixture and all 10 P1 plans validate | PASS |
| RQA-09 | Exercise deterministic extraction pipeline | Second repair/build pass is byte-identical | PASS |
| RQA-10 | Reconcile claims and source eligibility | 22 unique claims; no unknown or abstract/metadata-only support | PASS |
| RQA-11 | Reconcile conflict ledgers | 2,824 extraction, 208 appraisal, 10 owner conflicts, all unique | PASS |
| RQA-12 | Reconcile lane/canonical coverage | Screening, extraction, appraisal are each 167/167 | PASS |
| RQA-13 | Verify blocked review/runtime gates | No fabricated review, scientific, or runtime acceptance | PASS |
| RQA-14 | Verify cleanup and scope | No temp fixtures or app/active-canonical changes | PASS |

## Node Tests

Command:

```text
node --test --test-concurrency=1 --test-reporter=spec \
  specs/test-packages/formation-csv.test.mjs \
  specs/test-packages/formation-research-integrity.test.mjs \
  specs/test-packages/validate-formation-p1-target-plans-newlines.test.mjs \
  specs/test-packages/validate-formation-synthesis-boundaries.test.mjs
```

Output summary:

```text
tests 16
pass 16
fail 0
cancelled 0
skipped 0
todo 0
exit 0
```

Coverage includes seven strict-CSV cases, forged acceptance rejection for all three human
lanes, two malformed source-ledger cases, empty packet-ownership rejection, CRLF P1 handling,
abstract-only support rejection, and deterministic extraction generation.

The deterministic test runs repair and build twice in a temporary fixture and compares
SHA-256 bytes for these five generated outputs:

```text
.omo/evidence/formation-research-v2/extraction-e-lane-1.csv
.omo/evidence/formation-research-v2/extraction-e-lane-2.csv
.omo/evidence/formation-research-v2/extraction-fg-lane-2.csv
reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv
reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv
```

## Normal Validators

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
VALIDATOR_SUMMARY total=10 passed=10 failed=0
```

## Negative Acceptance Gates

Each command exited `1`, which is the required result:

```text
node specs/test-packages/validate-formation-screening.mjs --accepted
  missing_attestations=167
  acceptance blocked pending_human=167 deferred=2

node specs/test-packages/validate-formation-extraction.mjs --accepted
  missing_attestations=167
  acceptance blocked pending_rows=167 pending_conflicts=2824

node specs/test-packages/validate-formation-appraisal.mjs --accepted
  missing_attestations=167
  acceptance blocked pending_human=167 conflicts=208
```

The validators require bound human attestations rather than trusting edited canonical status
markers. The dedicated regression tests also prove that deleting conflict rows or rewriting
pending markers cannot forge acceptance.

## Protocol Hash

```text
actual:   f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
recorded: f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
match: true
previous: 5fda23e1bba850ce4cc609dc397f3656e686eb23eb824f40a7fbc8d10fecaf38
```

`FORMATION_PROTOCOL_AMENDMENT_LOG.md`, Task 01, and the start-work ledger preserve both hashes,
the amendment ID, synthesis re-audit requirement, and `runtime_authority=false`.

## Claims And Conflicts

Independent CSV joins and row counts produced:

```text
claims=22 unique_claim_ids=22 rqs=7
supporting_refs=34 opposing_refs=30 unknown_refs=0
supporting source state: FULL_TEXT_VERIFIED refs=34 unique_sources=30
abstract_or_metadata_support=0

claim rows by RQ: A=5 B=2 C=3 D=4 E=2 F=2 G=4
extraction_conflicts=2824 unique_keys=2824 NOT_VERIFIED=2824 PENDING_HUMAN=2824
appraisal_conflicts=208 unique_keys=208 PENDING_HUMAN=208
owner_conflicts=10 unique_ids=10
owner status: PATCH_REQUIRED=8 TARGET_REQUIRED=1 HUMAN_REVIEW_REQUIRED=1
```

The abstract-only regression injects `FRV2-B-001` into a supporting field and confirms that
the synthesis validator rejects it. Current supporting fields contain only full-text-verified
sources.

## Coverage And Gates

Screening lane 1, screening lane 2, canonical screening, extraction lanes 1 and 2, canonical
extraction, appraisal lanes 1 and 2, and canonical appraisal each have:

```text
rows=167 unique_ids=167 missing=0 unknown=0 duplicates=0
```

Acceptance remains deliberately absent:

```text
human attestations=0
reviewer rows=6 assigned=0 reviewed=0
manual scenarios=5 NOT_RUN=5
appraisal rows pending human=167
whole-architecture-direct sources=0
claims runtime_authority=false: 22/22
```

This is the intended boundary: deterministic preparation and truthful suppression are ready;
human confirmation, scientific conclusions, owner packet decisions, and runtime activation are
not ready.

## Whitespace, CRLF, Scope, And Cleanup

```text
git diff --check: exit 0
UNTRACKED_WHITESPACE files=121 trailing_whitespace=0 missing_final_newline=0
CRLF fixture reports/target-patch-plans/01-coach-ruleset.md: crlf=103 bare_lf=0
P1 plans validated=10
temporary formation-integrity directories=0
temporary formation-claims directories=0
app/runtime/specs-active/specs-reconstruct changed paths=0
```

No unexpected test or validator failure remains. No process, port, browser, database, or
temporary fixture remains. This QA assignment changed only this report.
