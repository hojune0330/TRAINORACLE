# Metis Sidecar Constraints Review

Reviewer: `Analyst the 13th`

Key constraints returned:

- Safety Gate scope must stay only at the pre-generation boundary.
- `D9_ACTIVE` / RVE `ACTIVE` blocks plan generation.
- `D9_UNKNOWN` / RVE `UNKNOWN` blocks plan generation and requires more information or human review.
- `D9_CLEARED` / RVE `CLEARED` does not block only for D9 and is not medical clearance.
- Advisory is not a fourth disposition; it stays under `D9_CLEARED`, stores as `CLEARED`, preserves non-sensitive advisory reason codes, and does not block.
- Good physio data, template selection, coach preference, athlete request, and free text cannot clear `ACTIVE` or `UNKNOWN`.
- Raw athlete free text, symptom clauses, injury narratives, medical notes, rehab notes, guardian private notes, and D9 evidence clauses must not be stored or passed to audit/template/plan requests.
- Blocked output may include only non-sensitive state, reason code, next action, and audit reference.
- Preserve `executed_tests_total: 0` unless actual terminal or CI logs exist.
- Do not close RVE, Plan Generator, Physio Source, App Bridge, or Athlete Profile issues from reconstruction alone.

Follow-up applied in `PLAN_SAFETY_GATE_SPEC.md`:

- Clarified that `BLOCK_OR_HUMAN_REVIEW` still means `planGenerationAllowed: false`.
- Added evaluator unavailable/timeout/exception/invalid-input/stale-version routing to `UNKNOWN`.
- Added explicit Template Library ownership boundary: Safety Gate owns query permission only, while template lifecycle policy remains owned by `TEMPLATE_LIBRARY_SPEC.md`.
