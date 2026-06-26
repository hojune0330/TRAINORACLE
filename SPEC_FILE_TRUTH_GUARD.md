# SPEC_FILE_TRUTH_GUARD.md

```yaml
doc_id: trainoracle-spec-file-truth-guard
spec_id: TRAINORACLE.SPEC_FILE_TRUTH_GUARD
title: TrainOracle SPEC File Truth Guard
version: "0.1"
round: RT1
status: DRAFT_HANDOFF_GUARD
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
```

---

## 1. Purpose

This guard prevents a recurring handoff error: treating a chapter title, table row, status label, conversation summary, or generated plan item as if it proved that a markdown document exists.

It applies to TrainOracle SPEC work before any file status, missing-contract status, or reconstruction step is recorded.

---

## 2. Source Of Truth Rule

```yaml
file_truth_policy:
  local_files_are_truth: true
  conversation_ledgers_are_reference_only: true
  generated_summaries_are_reference_only: true
  exact_filename_required_for_existence_claim: true
  h1_title_is_not_file_existence: true
  chapter_title_is_not_file_existence: true
  table_row_is_not_file_existence: true
  status_label_is_not_file_existence: true
  route_or_section_number_is_not_file_existence: true
```

Before saying a document exists, run an exact local filename search and record the path.

Allowed evidence:

- `Test-Path -LiteralPath <exact path>` returning true
- `Get-ChildItem` or `find` returning the exact filename
- `git ls-files` returning the exact tracked filename

Not allowed as existence evidence:

- H1 headings such as `# RULE_VALIDATION_ENGINE_CONTRACT.md`
- rows in an index table
- issue IDs, section labels, or chapter titles
- compressed conversation summaries
- model belief files
- prior handoff text saying a file should exist

---

## 3. Required File-State Labels

Use only these labels for missing/reconstructed work.

| Label | Meaning |
|---|---|
| `FOUND_LOCAL_FILE` | Exact local filename exists and path is recorded. |
| `MISSING_AFTER_EXACT_SEARCH` | Exact local filename was searched and not found. |
| `MISSING_OR_SOURCE_NOT_VERIFIED` | Prior status before the latest exact search, or when search scope is incomplete. |
| `RECONSTRUCTED_DRAFT_FOR_REVIEW` | A new draft was created because no local original was found. It is not a restored original. |
| `REFERENCE_ONLY_TEXT_SIGHTING` | The name appears in text, but no exact file exists at that path. |

Do not use `READY`, `APPROVED`, `CANONICAL`, `PASSED`, or `CLOSED` for a reconstructed document unless the target document itself and required runtime evidence support that label.

---

## 4. Exact-Search Checklist

For each target filename:

1. Search the repository by exact filename.
2. Search explicitly provided local source roots by exact filename when available.
3. Separately search text references to understand context.
4. Record exact-file results and text sightings in different sections.
5. If absent, create only a reconstructed draft and label it `RECONSTRUCTED_DRAFT_FOR_REVIEW`.

The text-search result must never override the exact-file result.

---

## 5. TrainOracle Safety Guardrails

```yaml
safety_guardrails:
  no_D9_semantic_redefinition_outside_RULE_SPEC_D1_D9: true
  no_safety_hard_stop_override: true
  no_runtime_evidence_claim_without_actual_log: true
  no_issue_closure_from_reconstruction_only: true
  no_absolute_downstream_count_without_target_recount: true
  no_raw_athlete_free_text_storage: true
  no_raw_symptom_clause_storage: true
  no_evidence_clause_storage_in_audit: true
  reason_code_storage_preferred: true
```

`11_API_AND_ENGINE_CONTRACTS.md` is a legacy Phase A-F reference document. It is not `RULE_VALIDATION_ENGINE_CONTRACT.md`.

---

## 6. C001 Pre-Reconstruction Exact-Search Snapshot

Captured in `.omo/evidence/spec-continuation-phantom-doc-guard-20260626/c001-red-filesystem-truth.md`:

This section is historical RED evidence only. Do not use it as current file state after reconstruction; read Section 7 for current state.

| Filename | Status before this guard pass |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `MISSING_AFTER_EXACT_SEARCH` |
| `PLAN_SAFETY_GATE_SPEC.md` | `MISSING_AFTER_EXACT_SEARCH` |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `MISSING_AFTER_EXACT_SEARCH` |
| `11_API_AND_ENGINE_CONTRACTS.md` | `FOUND_LOCAL_FILE` at `specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` |

## 7. Current Post-Reconstruction File State

After the C001 baseline, `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`, `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`, and `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` were created as reconstructed drafts.

| Filename | Current state |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `FOUND_LOCAL_FILE` at `specs/reconstruct/RULE_VALIDATION_ENGINE_CONTRACT.md`; status `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored |
| `PLAN_SAFETY_GATE_SPEC.md` | `FOUND_LOCAL_FILE` at `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`; status `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `FOUND_LOCAL_FILE` at `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`; status `RECONSTRUCTED_DRAFT_FOR_REVIEW`; not original restored |

[DRAFT_COMPLETE]
