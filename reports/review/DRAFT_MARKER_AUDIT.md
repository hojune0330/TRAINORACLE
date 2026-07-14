# DRAFT_MARKER_AUDIT.md

```yaml
audit_id: TO-DRAFT-MARKER-AUDIT-2026-07-14-001
scope: repository-wide tracked files
method:
  - "rg -n -i --glob '*.md' 'DRAFT_COMPLETE|DRAFT_FOR_REVIEW|\\bACCEPTED\\b' ."
  - "rg -n -i --glob '!*.md' 'DRAFT_COMPLETE|DRAFT_FOR_REVIEW|\\bACCEPTED\\b' ."
result: REVIEW_ONLY
runtime_changes: none
```

## Classification

| Class | Evidence | Meaning | Action |
|---|---|---|---|
| document-complete only | `specs/active/PLAN_GENERATOR_SPEC.md:58,1160`; `specs/active/ATHLETE_PROFILE_SPEC.md:1005`; `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:639` | `[DRAFT_COMPLETE]` is a document-end marker, not release or runtime proof. | Keep it separate from `status`. |
| ambiguous | `specs/active/PLAN_GENERATOR_SPEC.md:58,1074,1152`; `specs/active/PHYSIO_SOURCE_TRUST_SPEC.md:1004`; `reports/review/ORDER_007_R_frontend.md:60` | The same literal appears as metadata, a test expectation, and final line. A simple grep can falsely treat one document as having multiple completion markers. | Replace metadata literal with a boolean or a named marker policy in a later approved cleanup. |
| runtime-like misuse | `dashboard/index.html:642-654`; `dashboard/index.html:418,592-610` | Static dashboard chips render `DRAFT_FOR_REVIEW` or `accepted` text. They are presentation data, not a runtime authority, but can look like live verification. | Add an explicit static-snapshot label or generate them from reviewed metadata in a separate task. |
| acceptance-language, not status | `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:256,286-297`; `TRAINORACLE_SPEC_INDEX.md:115-119` | `ACCEPTED` often describes a source or a working-source decision, not canonical promotion. | Preserve the qualifier (`working source`, `not canonical`) wherever the word is used. |
| work-order instruction | `CODEX_WORK_ORDER_003.md:29,87`; `CODEX_WORK_ORDER_005.md:60,114`; `CODEX_WORK_ORDER_009.md:106-111` | Markers appear in instructions that forbid self-promotion. | Do not treat these occurrences as document status. |

## Findings

1. No application TypeScript source uses `DRAFT_COMPLETE`, `DRAFT_FOR_REVIEW`, or `ACCEPTED` as a program-control literal. The non-Markdown occurrences are dashboard HTML and design-token comments.
2. `DRAFT_COMPLETE` must never be read as “reviewed,” “canonical,” “merged,” or “runtime-tested.” It only says a draft document reached its declared end-marker shape.
3. `ACCEPTED` requires its object and scope: a source may be accepted for patching while the containing contract remains `DRAFT_FOR_REVIEW`.

## Proposed Follow-up (No Change Made)

1. Define one status vocabulary for document metadata and one separate vocabulary for source acceptance.
2. Replace `final_marker_required: "[DRAFT_COMPLETE]"` with a structured marker policy after owner approval.
3. Rebuild the static dashboard from that structured metadata, retaining a visible snapshot date.
