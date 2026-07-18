# Formation Research V2 Final Incremental QA

## Layered Verdict

| Layer | Verdict | Frozen-state evidence |
|---|---|---|
| Mechanical research-package readiness | **PASS** | 23/23 tests and 10/10 prepared validators pass |
| Authority enforcement | **PASS, ACCEPTANCE CLOSED** | Signature/identity/tamper regressions pass; attestation rows remain 0 |
| Cross-stage provenance | **PASS, HUMAN REAPPRAISAL REQUIRED** | All 6 non-independent extraction rows propagate into lane-2 and canonical appraisal |
| Scientific acceptance | **CLOSED BY DESIGN** | 167 appraisal rows pending, 208 conflicts, zero whole-architecture-direct sources |
| Owner/manual acceptance | **CLOSED BY DESIGN** | Reviewer decisions 0/6, manual scenarios 0/5, packets `NOT_REVIEWED` |
| Runtime authorization | **CLOSED BY DESIGN** | 22/22 claims retain `runtime_authority=false` |

The frozen filesystem is mechanically ready as a research-preparation package. It does not
claim human acceptance, accepted science, owner approval, or runtime prescription authority.
No app server was required or started.

## Test Suite

Command:

```text
node --test --test-concurrency=1 --test-reporter=spec \
  specs/test-packages/formation-attestations.test.mjs \
  specs/test-packages/formation-csv.test.mjs \
  specs/test-packages/formation-research-integrity.test.mjs \
  specs/test-packages/validate-formation-p1-target-plans-newlines.test.mjs \
  specs/test-packages/validate-formation-synthesis-boundaries.test.mjs
```

Result:

```text
tests 23
pass 23
fail 0
cancelled 0
skipped 0
todo 0
exit 0
```

The added authority and provenance coverage passed:

```text
human attestation rejects known AI agent identities
human attestation accepts a signed trusted reviewer identity
human attestation rejects placeholder authority references
human attestation rejects a self-signed untrusted reviewer
human attestation rejects signed-field tampering
attestation index rejects unknown sources and review types
appraisal rejects lost non-independent extraction provenance
```

Existing regression coverage also passed for strict CSV parsing, forged acceptance, deleted
conflicts, deterministic second-pass generation, malformed source ledgers, empty packet
ownership, Windows CRLF plans, and abstract-only supporting-source injection.

## Prepared Validators

All ten exited `0`:

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

## Closed Acceptance Gates

All three `--accepted` commands exited `1` for the intended authority and unresolved-work
reasons:

```text
screening:  missing_attestations=167 pending_human=167 deferred=2
extraction: missing_attestations=167 pending_rows=167 pending_conflicts=2824
appraisal:  missing_attestations=167 pending_human=167 pending_conflicts=208
```

The accepted paths cannot be opened by rewriting canonical status markers, deleting conflict
rows, supplying an AI/placeholder/untrusted identity, or tampering with signed fields.

## Cross-Stage Provenance

The six canonical extraction rows marked
`NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION` are:

```text
FRV2-F-015
FRV2-F-016
SRC-DOI-10.1136-BMJ.H1793
SRC-PMID-34250468
SRC-WEB-COCHRANE-HB-CH14
SRC-WEB-PRISMA-2020
```

For every row, QA confirmed:

```text
lane-2 appraisal notes: independence_state=NON_INDEPENDENT_EXTRACTION_INPUT
canonical appraisal notes: independence_state=NON_INDEPENDENT_EXTRACTION_INPUT
canonical adjudication: NON_INDEPENDENT_INPUT_PENDING_HUMAN_REAPPRAISAL
```

Reconciliation result:

```text
extraction_non_independent=6
lane2_marked=6
canonical_marked=6
canonical_human_reappraisal_adjudication=6
failures=0
```

The negative provenance regression removes these markers in a temporary fixture and proves
that appraisal validation fails.

## Integrity Counts

```text
protocol actual SHA-256:   f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
protocol recorded SHA-256: f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6
protocol hash match: true

claims=22 unique_claim_ids=22 rqs=7
supporting_refs=34 unknown_support=0 abstract_or_metadata_support=0
claims runtime_authority=false: 22/22

extraction_conflicts=2824 unique_keys=2824
appraisal_conflicts=208 unique_keys=208
owner_conflicts=10 unique_ids=10
```

Current supporting fields contain no abstract-only or metadata-only source. The synthesis
negative test independently verifies that an injected abstract-only supporting source is
rejected.

## Intentionally Open Work

```text
human attestation rows=0
screening human confirmations=0/167
extraction human confirmations=0/167
appraisal human confirmations=0/167
reviewers assigned=0/6
reviewer decisions=0/6
manual scenarios NOT_RUN=5/5
whole-architecture-direct sources=0
runtime authority=false
```

These are not mechanical QA failures. They are explicit release gates that prevent prepared
AI research from being presented as accepted evidence or activated product behavior.

## Regression Hygiene

```text
git diff --check: exit 0
untracked files scanned=126
trailing whitespace findings=0
missing final newlines=0
changed worktree entries=129
app/runtime/specs-active/specs-reconstruct changed paths=0
```

No hash, whitespace, or scope regression was found. No process, port, browser, database, or
temporary fixture remains. This incremental QA changed only this report.
