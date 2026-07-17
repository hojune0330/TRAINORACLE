# Formation Research V2 Remediation Goal Review

## Verdicts

| Layer | Verdict | Meaning |
|---|---|---|
| A. Mechanical and research-package preparation | **PASS** | The prior package defects are remediated, preparation artifacts are internally consistent, latest owner choices govern the package, and no implementation authority leaked. |
| B. Scientific acceptance and runtime activation | **FAIL / NOT ACCEPTED** | Human screening, extraction, appraisal, expert, privacy, accessibility, owner, and manual-review gates remain open. Runtime and canonical product activation remain prohibited. |

Layer B's FAIL is the required honest state, not a Layer A defect.

## Constraint Verification

| Constraint | Result | Evidence |
|---|---|---|
| Latest explicit owner choices govern | PASS | `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`; `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`; `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`; owner validator reports 10 registered conflicts and latest decision governs |
| 9.5-day deterministic default identity with one primary plan | PASS | Baseline fixes `9_5_DAY_FORMATION`, `DEFAULT_AUTOMATED_PRESCRIPTION`, and one deterministic default; `reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md` says one deterministic primary plan with 2-3 MAIN exposure events |
| Race self-check direction is `CURRENT_DISPLAY_ONLY_FUTURE_ANALYSIS_INTENDED` | PASS AS PRODUCT DIRECTION; CANONICAL PATCH OPEN | Baseline decision 11 and conflict `FRV2-CONF-010` preserve current display-only behavior and future analysis only after provenance, missingness, method, uncertainty, explanation, and owner gates |
| Private-note zero-signal and user-directed backup/share are separate | PASS | Claim `FRV2-CLAIM-G-003` is `ZERO_SIGNAL_FOR_ANALYSIS`; `FRV2-CLAIM-G-004` is `USER_DIRECTED_FILE_OPERATION`; baseline keeps explicit owner backup/share separate from analytics, rewards, Formation, and standing access |
| No `ABSTRACT_ONLY` or `METADATA_ONLY` supporting reference | PASS | Direct claim-to-source join: 34 supporting source links, 0 prohibited states; synthesis validator and mutation test enforce the boundary |
| Current protocol hash is bound | PASS | Current SHA-256 is `f62882d7191a721137d2f80c4a4e7bf400ec4fe1620ade221f0a49420ddb24f6`; it matches Task 01 and `reports/research/FORMATION_PROTOCOL_AMENDMENT_LOG.md` |
| No app/runtime/canonical spec activation | PASS | Worktree status contains research/review/evidence/test-package artifacts only; forbidden implementation/canonical status check returned 0; ten canonical conflicts remain `PATCH_REQUIRED`, `TARGET_REQUIRED`, or `HUMAN_REVIEW_REQUIRED` |
| Human gates remain open | PASS | 0 human attestations, 6/6 reviewer rows `NOT_REVIEWED`, 5/5 manual scenarios `NOT_RUN`, both owner packets `NOT_REVIEWED`, `runtime_authority=false` |
| No scientific optimality or safety fabrication | PASS FOR PREPARATION | Synthesis/non-claim validators pass; whole-architecture direct sources remain 0; 9.5-day optimality and safety remain `UNKNOWN` |

## Remediation Checks

### R1. Latest decision and deterministic default

`reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md` now records a dated owner decision
with `LATEST_EXPLICIT_OWNER_DECISION_GOVERNS`. It fixes:

- `9_5_DAY_FORMATION` as product identity;
- `DEFAULT_AUTOMATED_PRESCRIPTION` as target authority;
- one deterministic primary plan for eligible inputs;
- coach review, modification, exception planning, and initial youth execution confirmation as
  separate from system default selection;
- no alternate-cycle roulette when no eligible candidate exists.

Conflicting canonical documents are registered rather than silently changed. This satisfies
research-package alignment while keeping runtime activation closed.

### R2. Race self-check precedence

The latest baseline expressly supersedes a permanent-display-only reading of
`RACE_SELFCHECK_FIELDS_DECISION.md`. `tension`, `condition`, `goalPace`, and `mood` remain
collection/display-only in the current local pilot. Future within-athlete analysis is intended
only after a separate contract passes provenance, missingness, method, uncertainty, user
explanation, and owner approval. `FRV2-CONF-010` keeps the required canonical patch visible.

Evidence paths:

- `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`
- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv` (`FRV2-CONF-010`)
- `.omo/evidence/formation-research-v2/task-08.md`
- `RACE_SELFCHECK_FIELDS_DECISION.md` (historical/current pilot state, not latest future direction)

### R3. Private-note claim split

The former over-broad privacy row is now two claims:

- `FRV2-CLAIM-G-003`: content and metadata are zero-signal for analysis, planning, rewards,
  telemetry, and safety signals.
- `FRV2-CLAIM-G-004`: explicit preview-confirmed backup or recipient sharing is a
  `USER_DIRECTED_FILE_OPERATION`, not analysis consent or standing access.

This matches the baseline's `OWNER_FULL_LOCAL_BACKUP` and scoped recipient-sharing choices.

Evidence paths:

- `reports/research/evidence/FORMATION_CLAIM_MATRIX.csv`
- `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`
- `reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`
- `reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md`

### R4. Source-support boundary

A direct join from every non-owner `supporting_source_ids` entry to
`FORMATION_SOURCE_LEDGER.csv` found:

```text
SUPPORTING_SOURCE_CHECK linked=34 prohibited=0
```

The synthesis validator now rejects `ABSTRACT_ONLY` and `METADATA_ONLY` supporting sources,
and the mutation test proves the rejection path. Such sources may remain in search, screening,
extraction, and appraisal preparation, but not as claim support.

### R5. Protocol integrity

Exact command:

```powershell
Get-FileHash reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md -Algorithm SHA256
```

Result:

```text
F62882D7191A721137D2F80C4A4E7BF400EC4FE1620ADE221F0A49420DDB24F6
```

Task 01 and `FORMATION_PROTOCOL_AMENDMENT_LOG.md` bind that hash to amendment
`TO-FORMATION-RESEARCH-V2-AMEND-2026-07-17-01`. The amendment records no search, date,
eligibility, screening, or extraction impact and requires the synthesis re-audit that is now
evidenced by R3-R4 and executable tests.

## Executable Evidence

Preparation commands, all exit `0`:

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
node --test specs/test-packages/formation-csv.test.mjs specs/test-packages/formation-research-integrity.test.mjs specs/test-packages/validate-formation-synthesis-boundaries.test.mjs specs/test-packages/validate-formation-p1-target-plans-newlines.test.mjs
```

Result: `16/16` tests passed. This includes forged-acceptance resistance for screening,
extraction, and appraisal; strict CSV failures; deterministic extraction rebuild; packet field
ownership; CRLF target-plan parsing; and rejection of abstract-only claim support.

Accepted-mode commands intentionally exit `1`:

```powershell
node specs/test-packages/validate-formation-screening.mjs --accepted
node specs/test-packages/validate-formation-extraction.mjs --accepted
node specs/test-packages/validate-formation-appraisal.mjs --accepted
```

Observed blocking summaries:

```text
screening: missing human attestations; pending_human=167; deferred=2
extraction: missing human attestations; pending_rows=167; pending_conflicts=2824
appraisal: missing human attestations; pending_human=167; conflicts=208
```

Direct boundary check:

```powershell
$sources = @{}
Import-Csv reports/research/evidence/FORMATION_SOURCE_LEDGER.csv |
  ForEach-Object { $sources[$_.source_id] = $_ }
$claims = Import-Csv reports/research/evidence/FORMATION_CLAIM_MATRIX.csv
$bad = @()
$linked = 0
foreach ($claim in $claims) {
  foreach ($id in ($claim.supporting_source_ids -split ';')) {
    if ($id -and -not $id.StartsWith('OWNER_') -and
        $id -notin @('NOT_FOUND', 'NOT_APPLICABLE', 'NOT_VERIFIED')) {
      $linked++
      $source = $sources[$id]
      if ($null -eq $source -or
          $source.full_text_state -in @('ABSTRACT_ONLY', 'METADATA_ONLY')) {
        $bad += $id
      }
    }
  }
}
"SUPPORTING_SOURCE_CHECK linked=$linked prohibited=$($bad.Count)"
```

Observed: `linked=34 prohibited=0`.

Worktree-scope command:

```powershell
$status = git status --porcelain=v1
$forbidden = $status | Where-Object {
  $_ -match '^.. (app/|impl/|dashboard/|specs/(active|reconstruct|contracts|accepted)/|RACE_SELFCHECK_FIELDS_DECISION\.md|FORMATION_.*DECISION\.md$)'
}
"FORBIDDEN_IMPLEMENTATION_OR_CANONICAL_STATUS count=$($forbidden.Count)"
```

It checks changes under `app/`, `impl/`, `dashboard/`, canonical `specs/active` or
`specs/reconstruct` paths, the root race decision, and canonical Formation decision files.
Observed:

```text
FORBIDDEN_IMPLEMENTATION_OR_CANONICAL_STATUS count=0
```

## Layer B Open Gates

Scientific acceptance and runtime activation remain unavailable because:

- `FORMATION_HUMAN_REVIEW_ATTESTATIONS.csv` contains 0 attestations;
- 167 screening rows await human confirmation, including 2 deferred records;
- 167 extraction rows and 2,824 field conflicts await human adjudication;
- 167 appraisal rows and 208 conflicts await human confirmation/adjudication;
- all 6 reviewer-ledger decisions are `NOT_REVIEWED`;
- all 5 manual scenarios are `NOT_RUN`;
- both decision packets are `NOT_REVIEWED`;
- ten spec conflicts/targets/human checks remain open;
- whole-architecture direct sources remain 0;
- `runtime_authority=false` throughout.

Therefore the correct final state is:

```yaml
research_package_preparation: PASS
scientific_acceptance: FAIL_NOT_YET_REVIEWED
canonical_product_patch_authority: false
runtime_activation_authority: false
```
