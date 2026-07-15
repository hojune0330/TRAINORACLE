# Draft Marker Audit

```yaml
audit_id: TO-DRAFT-MARKER-AUDIT-2026-07-14-001
scope: repository tracked content
method:
  - "rg -n -i --glob '*.md' 'DRAFT_COMPLETE|DRAFT_FOR_REVIEW|\\bACCEPTED\\b' ."
  - "rg -n -i --glob '!*.md' --glob '!node_modules/**' --glob '!app/dist/**' 'DRAFT_COMPLETE|DRAFT_FOR_REVIEW|\\bACCEPTED\\b' ."
result: REVIEW_ONLY
runtime_changes: none
```

## Classification

| Class | Current evidence | Meaning | Follow-up |
|---|---|---|---|
| Draft document marker | `specs/active/*`, `specs/reconstruct/*`, `SPEC_DOCUMENTATION_REPORT.md` | `DRAFT_FOR_REVIEW` describes review state, not runtime readiness or canonical promotion. | Preserve the qualifier in indexes and UI labels. |
| End marker | `impl/README.md`, `SPEC_FILE_TRUTH_GUARD.md`, `SPEC_DOCUMENTATION_REPORT.md` | `[DRAFT_COMPLETE]` means a document reached its declared shape. | Never treat it as approval, merge, or runtime proof. |
| Accepted working source | `TRAINORACLE_SPEC_INDEX.md:116-120`, reconstruct contracts | `ACCEPTED` can describe source scope only. | Keep the object and scope next to the word. |
| Static presentation | `dashboard/index.html:418,592-654` | Dashboard chips are static snapshot text, not program authority. | Add a snapshot date or generate from reviewed metadata in a separate approved task. |
| Work-order instruction | `CODEX_WORK_ORDER_003.md` through `CODEX_WORK_ORDER_009.md` | The same literals appear in instructions and prohibition rules. | Do not classify instruction text as document status. |

## Findings

1. The non-Markdown scan found no application TypeScript program-control use of these markers. Matches are dashboard HTML chips and a design-token comment.
2. A simple text search can overcount `[DRAFT_COMPLETE]`, because a document may state its required final marker and contain that marker at the end.
3. The dashboard can look more current or authoritative than it is. It must remain a static review surface until a separately reviewed source-of-truth binding exists.

## Deliberately Not Changed

This audit does not rename markers, alter dashboard status chips, grant acceptance, or promote any document. Those changes require a separate owner decision and a source-of-truth design.
