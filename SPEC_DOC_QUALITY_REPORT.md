# SPEC_DOC_QUALITY_REPORT.md

```yaml
doc_id: TRAINORACLE_SPEC_DOC_QUALITY_REPORT
spec_id: TRAINORACLE.SPEC_DOC_QUALITY_REPORT
title: "TrainOracle SPEC Documentation Quality Report"
version: "0.1"
round: WORK_ORDER_002_TASK_3
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
canonical_promotion_allowed: false
issue_closure_claimed: false
runtime_evidence_claimed: false
```

---

## 1. Purpose

This report records the Work Order 002 Task 3 documentation quality scan.

It is not source acceptance, not canonical promotion, not runtime evidence, and not issue closure.

---

## 2. Scope

Included:

- root `*.md`
- `specs/**/*.md`
- design-system and non-evidence markdown references
- `TRAINORACLE_SPEC_INDEX.md`
- `SPEC_WORK_STATUS.md`

Excluded from mutation:

- `.omo/evidence/` existing evidence files
- design/screen implementation files
- generated dependency folders

Read-only scan exclusion:

- `.git/`
- `.omo/`
- `node_modules/`
- `runtime-evidence/` for terminology count scan

---

## 3. Inventory Snapshot

Counts were taken from the local repository tree during Task 3.

| Area | Count |
|---|---:|
| root markdown files | 32 |
| `specs/active/` files | 8 |
| `specs/reconstruct/` files | 8 |
| `specs/legacy-reference/` files | 7 |
| `specs/test-packages/` files | 1 |
| `preview/*.html` files | 30 |
| `design-v3/` files | 7 |
| `ui_kits/` files | 19 |
| `impl/**/*.ts` excluding `node_modules` | 7 |

---

## 4. Markdown Link Scan

Local markdown links were scanned outside `.omo/` evidence.

| Metric | Count |
|---|---:|
| Local markdown links checked | 159 |
| Broken or suspicious local links | 1 |

Finding:

| File | Line | Link text captured | Judgment | Action |
|---|---:|---|---|---|
| `specs/test-packages/D9_SAFETY_EVALUATOR_V2_1_1_TEST_PACKAGE.md` | 120 | `\.\d` | Likely false positive from a regex literal in the D9 test package, not a markdown document link. | No direct edit in Task 3; leave as report-only unless a reviewer wants the regex fenced/escaped differently. |

Evidence context:

```text
120: fever regex includes an optional decimal-temperature fragment; the markdown scanner misread that regex fragment as a local link.
```

---

## 5. Terminology Scan Counts

The scan counted markdown occurrences outside `.omo/`, `.git/`, `node_modules/`, and `runtime-evidence/`.

| Term | Count | Initial interpretation |
|---|---:|---|
| `disposition` | 60 | Mostly D9 evaluator semantics and safety status mapping. |
| `verdict` | 89 | Mostly design/AI UI language and legacy UX language. |
| `status` | 331 | Mixed metadata, workflow status, stored status, and UI status. |
| `state` | 212 | Mixed workflow, UI, uncertainty, projection, and gate state. |
| `D9` | 781 | Current safety/evaluator concept and rule shorthand. |
| `D-9` | 96 | Mixed current rule suffix, legacy references, and cycle-like text. |
| `D-5` | 39 | Mostly cycle-day / 9.5-day product language. |
| `RULE_SPEC_D1_D9` | 183 | Current SPEC rule namespace. |
| `LEGACY_PHASE_D` | 78 | Legacy workflow namespace. |
| `CYCLE_DAY` | 67 | Calendar/cycle namespace. |

---

## 6. Terminology Standardization Proposal

Do not apply global search/replace. These are review proposals for future targeted patches.

| Concept | Preferred term | Avoid / constrain | Proposed rule |
|---|---|---|---|
| D9 evaluator output | `disposition` | `verdict` | Use `disposition` only for evaluator outcomes such as `D9_ACTIVE`, `D9_UNKNOWN`, `D9_CLEARED`. |
| RVE persistence | `storedStatus` or `RveStoredRuleStatus` | generic `status` when a stored enum is meant | Use `status` only when paired with a named owner, e.g. metadata status or RVE stored status. |
| Safety Gate result | `gateDecision` / `planGenerationAllowed` / `requiredNextAction` | `verdict` | Gate language should describe routing, not a medical or coaching verdict. |
| Product UI badge | `displayState` / `attentionCategory` | safety `disposition` | UI badges may summarize but must not redefine safety semantics. |
| AI/chat UI label | `verdict` only as non-authoritative UI copy | safety `disposition` | Existing design language can keep `verdict`, but SPEC contracts should map it to source-backed reason codes and uncertainty. |
| Current D-rule namespace | `RULE_SPEC_D1_D9.D-*` | bare `D-*` | Current rule references should be fully namespaced. |
| Legacy workflow D labels | `LEGACY_PHASE_D.D-*` | bare `D-*` | Legacy docs may preserve original text, but new specs should label legacy references. |
| Calendar/cycle day | `CYCLE_DAY.D-*` | bare `D-*` in data/API/audit | UI can render short `D-5` only when backing data stores `namespace: CYCLE_DAY` and `isRuleId: false`. |
| Evidence references | `sourceRefs` / `nonSensitiveReasonCodes` | raw memo, raw symptom phrase | Product explanations should use refs and reason codes, not raw athlete text. |
| Acceptance state | `PENDING_REVIEW`, `ACCEPTED_AS_WORKING_SOURCE`, `DECIDED` | “approved” without scope | Acceptance wording must state scope: working source only, not canonical promotion or issue closure. |

---

## 7. Current Quality Notes

- `TRAINORACLE_SPEC_INDEX.md` now lists design assets, implementation skeleton, CI, dashboard, Work Order 001/002, source decisions, and runtime evidence areas.
- `SPEC_WORK_STATUS.md` now reflects the 2026-07-09 state: Work Order 001 outputs, D9 runtime evidence, Work Order 002, and Round 1/2 source decisions.
- Work Order 002 Task 1 and Task 2 PR files are not treated as present on this Task 3 branch until their PRs merge.
- The one suspicious markdown link finding appears to be regex text, not a missing document.
- Terminology is understandable but still mixed across design, legacy, SPEC, and implementation contexts; future work should standardize at contract boundaries rather than rewriting historical design files.

---

## 8. Recommended Next Actions

1. Merge or review Work Order 002 Task 2 before implementing service screens from the UI kit.
2. Let the Project Lead AI decide Round 3 source acceptance; Codex must not turn this quality report into acceptance.
3. After Round 3 decision, patch target documents with target-local recounts.
4. For future UI implementation, enforce `CYCLE_DAY` namespace in data/API types before rendering short `D-*` labels.
5. For AI surfaces, bind `verdict` UI language to `sourceRefs`, `confidence`, `uncertaintyState`, `privacyTier`, `redactionState`, and non-sensitive reason codes.

[DRAFT_COMPLETE]
