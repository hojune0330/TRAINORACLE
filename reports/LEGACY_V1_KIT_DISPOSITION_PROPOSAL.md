# LEGACY_V1_KIT_DISPOSITION_PROPOSAL.md

```yaml
document_metadata:
  doc_id: trainoracle-report-legacy-v1-kit-disposition-proposal
  title: TrainOracle Legacy V1 Kit Disposition Proposal
  issue_basis: CODEX_WORK_ORDER_004 Task 3
  source_matrix: SPEC_SCREEN_TRACEABILITY_MATRIX.md
  status: PROPOSAL_FOR_OWNER_DECISION
  owner: COACH_HOJUNE
  decision_authority: TOTAL_RESPONSIBILITY_HOLDER
  created_at: "2026-07-10"
  modifies_legacy_kit_files: false
  moves_legacy_kit_files: false
  deletes_legacy_kit_files: false
  canonical_promotion: false
  issue_closure: false
```

---

## 1. Purpose

This report proposes how to treat the old `ui_kits/trainoracle-app/*` kit before TrainOracle moves deeper into service implementation.

It is a proposal only. It does not move, edit, delete, archive, or approve any kit file.

---

## 2. Evidence Basis

| Evidence | Use |
|---|---|
| `SPEC_SCREEN_TRACEABILITY_MATRIX.md` Section 4 | Defines CONFLICT C1-C4 for old `ui_kits/trainoracle-app/*` files. |
| `SPEC_SCREEN_TRACEABILITY_MATRIX.md` Section 5 | Lists old-kit AIChat, Inbox, Calendar, Dashboard, and v3/app traceability gaps. |
| `app/src/screens/` current files | Confirms the Phase 1 app currently has Home, LogEntry, LogDetail, and Trends only. |
| `ui_kits/trainoracle-app-v3/` current files | Confirms v3 prototype coverage for Home, LogEntry, LogDetail, and Trends. |

No runtime or UI behavior claim is made here.

---

## 3. Old Kit To V3/App Counterpart Map

| Old kit file | Product role | v3 static/prototype counterpart | Phase 1 `app/` counterpart | Current disposition signal |
|---|---|---|---|---|
| `ui_kits/trainoracle-app/Dashboard.jsx` | coach overview, rule/status cards, cycle dashboard | Partial: Home/Trends/LogDetail cover parts of summary and trend display | Partial: `Home.tsx`, `Trends.tsx`, `LogDetail.tsx` | High-risk legacy reference; rule labels conflict with namespace policy. |
| `ui_kits/trainoracle-app/Inbox.jsx` | AI Inbox / attention feed | No full direct v3 screen | None | Keep as product idea only until Daily Brief/Inbox contract-shaped UI exists. |
| `ui_kits/trainoracle-app/Calendar.jsx` | calendar and cycle planning view | No full direct v3 screen | None | Keep out of implementation until `CYCLE_DAY` backing model and Safety Gate display rules are designed. |
| `ui_kits/trainoracle-app/Primitives.jsx` | shared v1 UI primitives including `CycleRail` and `Verdict` | Partial: `JournalPrimitives.jsx` is v3 style but not a safe drop-in replacement | Partial: app has typed helpers around cycle/rule display | Do not reuse directly; it propagates bare `D-*` and ambiguous verdict semantics. |
| `ui_kits/trainoracle-app/AIChat.jsx` | free-text AI chat | No full direct v3 screen | None | Highest privacy risk; should not feed product implementation before raw-text and external-LLM boundaries are redesigned. |
| `ui_kits/trainoracle-app/SessionDetail.jsx` | session detail and rationale surface | Partial: `LogDetail.jsx` | Partial: `LogDetail.tsx` | Useful visual reference only; do not reuse data labels without source/ref/privacy contract mapping. |
| `ui_kits/trainoracle-app/Sidebar.jsx` / `App.jsx` | shell/navigation | Partial: v3 app shell | app has its own routing/shell | Low standalone value once Phase 1 app shell exists. |

---

## 4. Product Value And Safety Risk

| Area | Product value | Main risk | Matrix basis |
|---|---|---|---|
| Dashboard | Useful coach scanning surface for load, uncertainty, cycle status, and review priorities. | `Rule 4`, `9 Rules`, and `R-*` labels can be mistaken for current safety rule authority. | C1 |
| Inbox | Strong service idea for daily brief, attention items, and coach workflow. | `R-2 위반` and `9/9 pass` can imply rule verdicts or safety clearance. | C2 |
| Calendar | Valuable for cycle planning and athlete schedule visibility. | Bare `D-*` values in backing arrays blur `CYCLE_DAY` with `RULE_SPEC_D1_D9`. | C3 |
| Primitives | Contains reusable UI ideas like `CycleRail`, `Verdict`, and metric cells. | Shared primitives can spread unsafe labels across screens. | C4 |
| AIChat | Potentially useful coach-assistant surface. | Free-text input lacks explicit raw-text persistence and private external LLM boundary. | Matrix GAP_UI rows for AIChat free-text and AI reply. |

The old kit has product value, but it should not be treated as implementation-ready source. Its unsafe labels are not cosmetic; they affect safety interpretation.

---

## 5. Disposition Options

| Option | Description | Cost | Risk | Result |
|---|---|---:|---:|---|
| A. Archive isolation | Move old kit to an archive area later and add a clear "reference only, do not implement" header. | Low to medium | Low after move | Best for reducing accidental reuse, but requires owner approval because it changes files/paths. |
| B. Keep as-is with matrix warning | Leave files where they are and rely on `SPEC_SCREEN_TRACEABILITY_MATRIX.md` warnings. | Lowest | High | Fast, but future implementers may still copy unsafe labels or primitive data shapes. |
| C. Redesign and migrate selectively | Treat old kit as idea source only; redesign Inbox, Calendar, Dashboard, and AIChat into v3/app-compatible screens after SPEC bindings exist. | Highest | Lowest for product quality | Preserves product value while replacing unsafe labels, privacy gaps, and namespace ambiguity. |

---

## 6. Recommendation

Recommendation: choose Option C as the product direction, with Option A as an interim containment step only after owner approval.

Reason:

- Inbox, Calendar, Dashboard, and AIChat are valuable product surfaces.
- Direct reuse is unsafe because C1-C4 and AIChat privacy gaps are structural, not just copy issues.
- Phase 1 `app/` already has safer foundations for Home, LogEntry, LogDetail, and Trends.
- Redesigning missing surfaces against the accepted specs keeps the training-log product flow while preserving the safety chain.

This is not a decision. The decision remains with the TOTAL_RESPONSIBILITY_HOLDER.

---

## 7. Required Owner Decisions Before Any File Action

| Decision | Required before |
|---|---|
| Whether to archive old `ui_kits/trainoracle-app/*` | Any move, rename, delete, or header patch to old kit files. |
| Whether Inbox becomes a first-class Phase 2 screen | Creating app implementation scope for Daily Brief/AI Inbox. |
| Whether Calendar becomes a first-class Phase 2 screen | Creating app implementation scope for cycle/calendar planning. |
| Whether AIChat remains in product scope | Any private-data LLM flow, chat storage, or assistant UI work. |
| Whether old primitives may be mined for visual ideas | Any v3/app redesign that resembles v1 primitive behavior. |

---

## 8. Guardrail Check

| Guardrail | Result |
|---|---|
| No old kit file moved | PASS |
| No old kit file modified | PASS |
| No old kit file deleted | PASS |
| No `app/` file modified | PASS |
| No design file modified | PASS |
| No issue closed | PASS |
| No canonical promotion claimed | PASS |
| No runtime evidence claimed | PASS |

[DRAFT_COMPLETE]
