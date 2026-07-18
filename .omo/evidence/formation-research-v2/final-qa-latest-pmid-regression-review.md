# Final QA: Latest Untracked PMID Regression State

## Verdict

**PASS** for mechanical preparation. Human/scientific/runtime acceptance remains intentionally
closed.

## Authoritative Runs

### Node tests

```text
node --test --test-reporter=dot specs/test-packages/*.test.mjs
....................
........
NODE_TEST_EXIT 0
```

Result: **28/28 PASS**. The latest suite includes the untracked-PMID gap-audit regression.
Earlier verbose attempts emitted no final summary before the execution window and were discarded;
only the complete 28-dot, exit-0 run is authoritative.

### Preparation validators

```text
PREPARATION_VALIDATOR_SUMMARY total=11 passed=11 failed=0
```

Key current outputs:

```text
sources=167
supplemental candidates=18 identities=18 canonical_duplicates=5 human_screening=0
extraction conflicts=2824 pending_rows=167
appraisal conflicts=208 pending_human=167
claims=22 rqs=7 runtime=false
competition_fields=21 decisions=NOT_REVIEWED
owner conflicts=12 latest_decision=governs runtime=false
reviewers=0/6 manual=0/5 user_scenarios=0/12
```

### Accepted-mode gates

```text
screening:  exit=1 missing_attestations=167 pending_human=167 deferred=2
extraction: exit=1 missing_attestations=167 pending_rows=167 pending_conflicts=2824
appraisal:  exit=1 missing_attestations=167 pending_human=167 pending_conflicts=208
```

All three gates fail closed for the intended unresolved human-review reasons. No original
artifact was edited by QA; this evidence file is the only addition.
