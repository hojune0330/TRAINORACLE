# Todo 5 Report

Verdict: DONE - inactive evidence matrix only

## Delivered

- One versioned Markdown matrix with an embedded strict JSON payload.
- A fixed 22-source inventory derived from exact LF-normalized local source-gate fragments and source IDs.
- Each source is partitioned exactly once: 22 reviewed rows, 0 exclusions.
- One supplemental extraction binds the existing `SRC-PMID-12165889` row to the exact local research file and line 109; it is provenance for the same study, not a 23rd source.
- The reported daily/rest subgroup observations remain exactly 5/4 athletes and carry that supplemental evidence reference.
- Twelve event/population requests cover 800/1500/3000/5000; seven unsupported cells remain explicit NOT_FOUND.
- All 14 requested evidence fields are provenance cells using only REPORTED, NOT_REPORTED, or NOT_APPLICABLE.
- Thirty-seven exact protocol observations preserve local source numbers and typed units.
- Direct null/conflicting studies, both junior-high 3000 studies, controlled-female and adult-flat-3000 gaps, overload harm, and opposing psychological observations are represented.

## Authority Boundary

Every row is INACTIVE_RESEARCH_CANDIDATE. Numeric taper authority is NOT_GRANTED. Runtime and formula authority are false. There is no average protocol, 9.5-day taper rule, inferred youth/female multiplier, baseline assumption, placement activation, or runtime formula.

The following remain open:
- OI-PG-COMPETITION-TAPER-POLICY-001: OPEN
- OI-FA-COACH-RULESET-001: OPEN
- CA-O3: NOT_REVIEWED
- Source-gate numeric taper decision: OPEN

## Verification

- Node mutation suite: 12/12 pass.
- Standalone validator: exit 0 with PREPARED_DRAFT_NON_RUNTIME_TAPER_MATRIX.
- Manual QA: pristine exit 0; 18/18 invalid mutations exit 1.
- Supplemental 999/1 mutation: exit 1 with no misleading success verdict.
- Embedded JSON parse and final-marker checks: pass.
- git diff --check: exit 0.
- Temporary asset cleanup: pass.

## Scope

Todo 5 changed only the matrix, its validator/test, and task-5 evidence. Runtime, active specs, and Todo 1-4 artifacts were not edited by this task.

The worktree remains intentionally dirty with preserved Todo 1-4 changes; provenance records that boundary rather than claiming a clean tree.
