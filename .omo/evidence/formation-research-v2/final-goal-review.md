# Formation Research V2 Final Goal Review

## Verdict

**FAIL for final package acceptance.**

The package is substantially complete as an AI-prepared research-planning package and is
clear that scientific, privacy, safeguarding, accessibility, owner, and runtime acceptance
have not occurred. It also preserves the fixed 9.5-day default automated-prescription
direction in the principal narrative artifacts. However, three repository-correctable
issues prevent a final PASS: one latest-owner-decision conflict in the claim matrix, one
broken protocol-freeze integrity record, and abstract-only sources still represented as
support for synthesized claim rows despite the frozen protocol's full-text boundary.

This verdict does **not** treat the open human gates as implementation defects. Those gates
are correctly open and must remain so. Runtime and canonical product implementation remain
unauthorized.

## Requirement Breakdown

| Requirement | Result | Evidence |
|---|---|---|
| Finish Tasks 1-8 preparation without fabricating human completion | PASS | `.omo/plans/trainoracle-formation-followup-deep-research.md`; `.omo/evidence/formation-research-v2/task-01.md` through `task-08.md` |
| Freeze and execute an RQ-A-G protocol and source audit | PASS WITH INTEGRITY BLOCK BELOW | `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`; `reports/research/evidence/FORMATION_SOURCE_LEDGER.csv`; `reports/research/evidence/FORMATION_SEARCH_LOG.md`; `.omo/evidence/formation-research-v2/task-01.md`; `task-02.md` |
| Prepare independent screening, extraction, and appraisal while preserving human gates | PASS | `reports/research/evidence/FORMATION_SCREENING_LEDGER.csv`; `FORMATION_EVIDENCE_EXTRACTION.csv`; `FORMATION_APPRAISAL_LEDGER.csv`; `FORMATION_EXTRACTION_CONFLICTS.csv`; `FORMATION_APPRAISAL_CONFLICTS.csv`; tasks 03-05 evidence |
| Produce five dependency-ordered research reviews and counterevidence | PASS AS PREPARATION | `reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md`; `FORMATION_COMPOSITE_AND_LOAD_EVIDENCE_REVIEW.md`; `FORMATION_MINIMUM_EVIDENCE_METHODS_REVIEW.md`; `FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`; `FORMATION_COUNTEREVIDENCE_AND_UNCERTAINTY_REVIEW.md` |
| Keep Load Components and Minimum Evidence decisions separate | PASS | `reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md`; `FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md`; both remain `NOT_REVIEWED` with zero field collisions |
| Latest explicit owner decisions govern | FAIL | Principal narratives pass, but `reports/research/evidence/FORMATION_CLAIM_MATRIX.csv` claim `FRV2-CLAIM-G-003` conflicts with `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md` |
| Fixed 9.5-day default automated prescription with one primary plan | PASS | `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`; `FORMATION_RESEARCH_TECHNICAL_ANNEX.md`; `FORMATION_RESEARCH_OWNER_BRIEF_KO.md`; `FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md` |
| No fabricated optimality, safety, recovery clearance, or universal thresholds | PASS, SUBJECT TO HUMAN REVIEW | Five synthesis reviews; `reports/research/evidence/FORMATION_CLAIM_MATRIX.csv`; `.omo/evidence/formation-research-v2/adversarial-sports-claims.md`; `adversarial-methods-claims.md` |
| Private note is zero-signal while user-selected backup/share remains possible | FAIL | Narrative treatment is correct in `FORMATION_LATEST_OWNER_DECISION_BASELINE.md`, `FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`, and `FORMATION_RESEARCH_TECHNICAL_ANNEX.md`; the claim matrix regression is blocking |
| Verify fit with specs and prioritize athlete/coach/guardian UX | PASS AS REVIEW/PATCH PLAN | `reports/review/FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md`; `.omo/evidence/formation-research-v2/user-spec-alignment-audit.md`; `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv` |
| No runtime or canonical product implementation before gates | PASS | Git status contains research, review, evidence, validator, plan, and execution-ledger changes only; no production app, backend, schema migration, or canonical product patch is present |

## Blocking Issues

### B1. Latest privacy/share decision is contradicted by claim `FRV2-CLAIM-G-003`

`reports/research/evidence/FORMATION_CLAIM_MATRIX.csv` states that the private note is
zero-signal in analysis, planning, safety signals, **and sharing**. The latest owner baseline
limits zero-signal to analysis/planning/reward/telemetry/safety use and separately permits:

- explicit `OWNER_FULL_LOCAL_BACKUP` including the user's own notes; and
- user-directed recipient sharing with exact recipient, scope, and duration.

The five narrative/review documents generally preserve this distinction, so the matrix row
is a stale or over-broad exception. Narrow the row to prohibited automatic/system uses and
state that explicit backup/share is a separate user-directed file or disclosure operation.
Also normalize the drift between `OWNER_FULL_LOCAL_BACKUP` and `OWNER_FULL_BACKUP` in
`FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md` and the detailed audit.

Evidence paths:

- `reports/research/evidence/FORMATION_CLAIM_MATRIX.csv` (`FRV2-CLAIM-G-003`)
- `reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md`
- `reports/research/FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md`
- `reports/review/FORMATION_RESEARCH_TECHNICAL_ANNEX.md`

### B2. Frozen protocol hash does not match the protocol file

`.omo/evidence/formation-research-v2/task-01.md` records:

```text
5fda23e1bba850ce4cc609dc397f3656e686eb23eb824f40a7fbc8d10fecaf38
```

The SHA-256 of the current `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md` bytes is:

```text
c02388e444f03580ab82a7656624ba3a6cb8b0cfd5477d8d4760a88bd930288a
```

No dated amendment or search-impact record explains the change. This fails the plan's
protocol-freeze acceptance and makes the provenance claim in Task 01 stale. Either restore
the frozen bytes or record the current hash with a dated amendment and explicit search,
screening, extraction, and synthesis impact assessment.

Evidence paths:

- `.omo/evidence/formation-research-v2/task-01.md`
- `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`
- `.omo/plans/trainoracle-formation-followup-deep-research.md`

### B3. Abstract-only sources still support synthesized claim rows

The frozen protocol says an abstract/seed source cannot support a final conclusion before
full-text, effect/interval, limitations, overlap, funding/conflict, and correction/retraction
verification. Seven supporting links across six claim rows point to sources whose
`full_text_state` is `ABSTRACT_ONLY`:

| Claim | Abstract-only supporting source |
|---|---|
| `FRV2-CLAIM-B-001` | `FRV2-B-001` |
| `FRV2-CLAIM-C-001` | `FRV2-C-005` |
| `FRV2-CLAIM-D-001` | `SRC-PMID-28463642`, `FRV2-D-002` |
| `FRV2-CLAIM-D-004` | `FRV2-D-021` |
| `FRV2-CLAIM-E-002` | `FRV2-E-001` |
| `FRV2-CLAIM-G-001` | `FRV2-G-010` |

The claim rows are marked `PREPARED_HUMAN_REVIEW_REQUIRED`, which prevents runtime leakage,
but `supporting_source_ids` plus `SUPPORTED`/`CONDITIONALLY_SUPPORTED` still overstates the
allowed role of those individual sources. Remove them from support, move them to an explicit
search-hypothesis/context field, retrieve and verify full text, or make the prepared status
unambiguously provisional at the source-link level. Extend validation so this boundary is
executable; the current source/synthesis validators only reject unresolved or corrected
sources and do not reject `ABSTRACT_ONLY` support.

Evidence paths:

- `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`
- `reports/research/evidence/FORMATION_SOURCE_LEDGER.csv`
- `reports/research/evidence/FORMATION_CLAIM_MATRIX.csv`
- `specs/test-packages/validate-formation-source-audit.mjs`
- `specs/test-packages/validate-formation-synthesis.mjs`

## Human Gates And Honest Open Work

These are expected external blocks, not package defects:

- Screening acceptance: `167/167 PENDING_HUMAN`, including two deferred records.
- Extraction acceptance: `167` pending rows and `2,668` field conflicts.
- Appraisal acceptance: `167` pending human confirmations and `208` controlled conflicts.
- Reviewer ledger: `0/6` named human approvals.
- Manual scenarios: `0/5` executed human results.
- Both owner decision packets: `NOT_REVIEWED`.
- Spec conflict register: nine patch/target/human-review items remain open.
- Runtime authority: `false` throughout.

Accepted-mode validators correctly fail:

```text
screening: exit 1, pending_human=167 deferred=2
extraction: exit 1, pending_rows=167 conflicts=2668
appraisal: exit 1, pending_human=167 conflicts=208
```

Preparation-mode validators all exit `0` and report the expected prepared counts. This is
good evidence that the package does not fabricate acceptance, but it does not waive B1-B3.

## Pass Conditions

1. Correct `FRV2-CLAIM-G-003` and normalize the explicit backup/share vocabulary to the
   latest owner baseline.
2. Reconcile the frozen protocol hash through restoration or a dated amendment with impact.
3. Enforce the abstract-only support boundary in the claim matrix and validators.
4. Re-run all preparation validators and this final goal review.
5. Keep Tasks 3-8, both packets, canonical patches, and runtime activation open until their
   named human gates genuinely pass.

