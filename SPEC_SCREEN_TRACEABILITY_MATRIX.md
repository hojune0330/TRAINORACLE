# SPEC_SCREEN_TRACEABILITY_MATRIX.md

```yaml
doc_id: TRAINORACLE_SPEC_SCREEN_TRACEABILITY_MATRIX
spec_id: SPEC_SCREEN_TRACEABILITY_MATRIX
title: TrainOracle Screen To Spec Traceability Matrix
version: 0.1
round: WORK_ORDER_002_TASK_2
status: DRAFT_FOR_REVIEW
owner: CODEX
open_issues_total: 0
canonical_blocking_count: 0
executed_tests_total: 0
decision_authority: PROJECT_LEAD_AI
design_files_modified: false
issue_closure_claimed: false
canonical_promotion_claimed: false
runtime_evidence_claimed: false
```

## 1. Purpose

This document audits whether the imported TrainOracle service screens can be traced to the current local SPEC set.

It does not modify design files, accept reconstructed specs, close issues, claim runtime evidence, or redefine `RULE_SPEC_D1_D9.D-9`.

## 2. Scope And Source Status

Audited screen surfaces, read-only:

- `ui_kits/trainoracle-app-v3/`: Home, LogEntry, LogDetail, Trends
- `ui_kits/trainoracle-app/`: Dashboard, Calendar, SessionDetail, AIChat, Inbox
- `design-v3/screens/`: static Home, LogEntry, LogDetail, Trends

Primary SPEC sources used:

- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
- `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md`
- `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md`
- `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md`
- `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md`
- `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`
- `specs/reconstruct/RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`
- `specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md`
- `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md`
- `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md`

Important source caveat: Round 3 and Round 4 source documents are in `specs/reconstruct/`, not `specs/active/`. Round 4 accepts `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`, `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`, and `METRIC_ALGORITHM_CONTRACT.md` as working sources only. This is source availability, not implementation completion, issue closure, canonical promotion, or runtime evidence.

## 3. Summary Counts

| Metric | Count |
|---|---:|
| Screen elements / actions audited | 25 |
| `ALIGNED` | 6 |
| `GAP_UI_MISSING` | 8 |
| `GAP_SPEC_MISSING` | 0 |
| `RESOLVED_BY_SOURCE(ROUND4)` | 5 |
| `CONFLICT` | 5 |
| `OUT_OF_SCOPE` | 1 |

## 4. CONFLICT Items First

These items should be treated as service-development blockers until the UI copy/data model or the relevant implementation contract resolves the conflict.

| 화면 | UI 요소/동작 | 관련 SPEC 조항 (문서+섹션/라인) | 정합성 | 비고 |
|---|---|---|---|---|
| `ui_kits/trainoracle-app/Dashboard.jsx` | `Rule 4`, `9 Rules`, `R-3/R-6/R-7/R-4` validation pills | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 77-101; `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 197-231 | `CONFLICT` | Current UI uses ambiguous legacy-style rule labels without a `RULE_SPEC_D1_D9.*`, `LEGACY_PHASE_D.*`, or product signal namespace. It can be mistaken for current safety rule authority. |
| `ui_kits/trainoracle-app/Inbox.jsx` | `R-2 위반`, `Cycle 8 완료 · 9 Rules 9/9 pass` | `specs/reconstruct/DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 219-231; `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` lines 531-555 | `CONFLICT` | `PASS` must not imply safety clearance, and inbox categories must not redefine rule verdicts or clear Safety Gate/RVE state. |
| `ui_kits/trainoracle-app/Calendar.jsx` | calendar day array stores bare `D-1` through `D-.5` strings | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 98-101, 164-167, 196-207 | `CONFLICT` | UI display may show short labels, but backing data must preserve `namespace: CYCLE_DAY` and `isRuleId: false`. |
| `ui_kits/trainoracle-app/Primitives.jsx` | `CycleRail` stores bare `D-1` through `D-.5` strings | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 98-101, 207, 471-474 | `CONFLICT` | Shared primitive can propagate namespace ambiguity across Dashboard/Calendar/Session Detail. |
| `ui_kits/trainoracle-app-v3/Home.jsx`, `ui_kits/trainoracle-app-v3/LogEntry.jsx`, `ui_kits/trainoracle-app-v3/LogDetail.jsx` | `cycleDay="C7 · D-6/9.5"`, `cycleDay="C7 · D-6"`, `cycleDay="C7 · D-5"` | `specs/reconstruct/MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 88-101, 196-207 | `CONFLICT` | These are display props, but no backing `CYCLE_DAY` namespace object is visible in the screen code. Static v3 HTML is safer because it displays `CYCLE_DAY`. |

## 5. Full Traceability Matrix

| 화면 | UI 요소/동작 | 관련 SPEC 조항 (문서+섹션/라인) | 정합성 | 비고 |
|---|---|---|---|---|
| `ui_kits/trainoracle-app/Dashboard.jsx` | `Rule 4`, `9 Rules`, `R-*` validation pills | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 77-101; `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 197-231 | `CONFLICT` | Same as blocker C1. Rename or bind to explicit product signal namespace later. |
| `ui_kits/trainoracle-app/Inbox.jsx` | `R-2 위반`, `9 Rules 9/9 pass` | `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 219-231; `RVE_RULE_EVALUATOR_BINDING_SPEC.md` lines 531-555 | `CONFLICT` | Same as blocker C2. |
| `ui_kits/trainoracle-app/Calendar.jsx` | bare `D-*` cycle data | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 98-101, 164-167, 196-207 | `CONFLICT` | Same as blocker C3. |
| `ui_kits/trainoracle-app/Primitives.jsx` | bare `D-*` cycle rail primitive | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 98-101, 207, 471-474 | `CONFLICT` | Same as blocker C4. |
| `ui_kits/trainoracle-app-v3/*` | v3 JSX cycle day display props use bare `D-*` | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 88-101, 196-207 | `CONFLICT` | Same as blocker C5. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | post-session RPE input | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 196-209, 231-319; `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 312-314 | `ALIGNED` | RPE is a structured daily/check-in value and analysis metric family. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | evening sleep, weight, resting HR, mood, pain/body area | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 196-209, 231-319, 443-472 | `ALIGNED` | Structured readiness/body-area values can raise attention without clearing risk. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | `PrivacyNote` below memo and free input surfaces | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 328-368; screen lines 501-514 | `ALIGNED` | The JSX comment explicitly cites `memo_policy`; displayed copy says local-only/no server storage. |
| `design-v3/screens/02_LogEntry.html` | pain repeat review banner | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 443-472; `RVE_RULE_EVALUATOR_BINDING_SPEC.md` lines 487-523; `PLAN_SAFETY_GATE_SPEC.md` lines 299-345 | `ALIGNED` | Static screen shows Review and says plan generation may require safety confirmation. |
| `design-v3/screens/01_Home.html`, `design-v3/screens/03_LogDetail.html` | `CYCLE_DAY 6 / 9.5`, `CYCLE_DAY 5` labels | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 88-101, 196-207 | `ALIGNED` | Static v3 screens use the safer namespace-visible form. |
| `design-v3/screens/04_Trends.html` | stale source badge/comment | `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 90-92, 522-530 | `ALIGNED` | The static screen explicitly anticipates missing/stale source visibility. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | photo attachment row | `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`; `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | `RESOLVED_BY_SOURCE(ROUND4)` | Source contract now exists for photo attachment storage/privacy/sourceRef boundaries. Implementation, App Bridge binding, retention, and runtime evidence remain open. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | voice memo input | `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`; `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | `RESOLVED_BY_SOURCE(ROUND4)` | Source contract now exists for transient voice memo/audio/transcript handling. ORDER_004 Task 1 adds D9 precheck wording in PR #28; implementation evidence remains open. |
| `ui_kits/trainoracle-app-v3/LogDetail.jsx`, `design-v3/screens/03_LogDetail.html` | displayed photos / `PHOTO · track_0708.jpg` | `MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`; `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | `RESOLVED_BY_SOURCE(ROUND4)` | Source contract now exists for display-safe media labels/sourceRefs. App display binding and runtime evidence remain open. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | Race quick check / `D-0` race form | `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`; `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | `RESOLVED_BY_SOURCE(ROUND4)` | Source contract now exists for race-day quick check subtype and `CYCLE_DAY.D-0` handling. Daily Log reference binding is proposed in PR #30; implementation remains open. |
| `ui_kits/trainoracle-app-v3/Home.jsx` | historical memory row with pain text | `RACE_RECORD_AND_HISTORICAL_RECALL_SPEC.md`; `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` | `RESOLVED_BY_SOURCE(ROUND4)` | Source contract now exists for historical recall display records without raw quote persistence. Implementation and privacy review remain open. |
| `ui_kits/trainoracle-app-v3/LogEntry.jsx` | pain/body diagram can reach 4-5, but JSX form has no visible Review/block state | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 443-472; `RVE_RULE_EVALUATOR_BINDING_SPEC.md` lines 487-523; `PLAN_SAFETY_GATE_SPEC.md` lines 272-281, 299-345 | `GAP_UI_MISSING` | Static design has Review copy; Phase 1 app PR #20 added `PainReviewBanner` in `app/src/screens/LogEntry.tsx`, but this row stays `GAP_UI_MISSING` until owner-side app verification accepts the UI binding. |
| `ui_kits/trainoracle-app-v3/Home.jsx` | Home AI one-line insight | `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` lines 207-249, 259-319; `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 192-224 | `GAP_UI_MISSING` | Shows confidence and time range, but lacks sourceRefs, rationaleCodes, privacy tier, redaction state, and source freshness. |
| `ui_kits/trainoracle-app-v3/Trends.jsx` | trend cards, heatmap, mood, records | `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 192-224, 232-289, 522-530 | `GAP_UI_MISSING` | The dynamic JSX trend surface does not visibly bind each claim to source refs, confidence/uncertainty, missing/stale states, or metric-definition status. |
| `ui_kits/trainoracle-app-v3/LogDetail.jsx`, `design-v3/screens/03_LogDetail.html` | AI footnote / split-pattern explanation | `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` lines 207-249, 346-358; `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 154-159, 192-224 | `GAP_UI_MISSING` | Static screen shows sources, but confidence/privacy tier/reason-code/redaction state are not displayed. JSX detail has no equivalent AI footnote traceability. |
| `ui_kits/trainoracle-app/AIChat.jsx` | user free-text chat input | `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 328-368; `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 191, 295-321 | `GAP_UI_MISSING` | Chat input has no visible raw-text/privacy notice or external-LLM private-data boundary. |
| `ui_kits/trainoracle-app/AIChat.jsx` | AI reply with verdict/confidence and future sources note | `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` lines 207-249, 259-319, 346-358 | `GAP_UI_MISSING` | Verdict/confidence exists, but sourceRefs, non-sensitive reason codes, privacy tier, and redaction state are not represented as a contract-shaped output. |
| `ui_kits/trainoracle-app/Inbox.jsx` | AI Inbox items and detail panel | `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 328-409, 446-479; `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 514-518 | `GAP_UI_MISSING` | The UI has attention categories and confidence-like copy, but does not show contract fields such as `sourceRefs`, `nonSensitiveReasonCodes`, `privacyLevel`, or raw-text storage flags. |
| `ui_kits/trainoracle-app/Calendar.jsx`, `ui_kits/trainoracle-app/Dashboard.jsx` | normal-looking calendar/cycle cells when safety state may block | `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 315-338, 359-375; `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 102-122, 343-352 | `GAP_UI_MISSING` | Calendar/Dashboard should not hide active Safety Gate/RVE blocks behind ordinary cycle styling. |
| All audited screens | Pure visual layout, navigation labels, static spacing, color treatment | Work Order 002 screen audit scope; design implementation owned by Project Lead AI | `OUT_OF_SCOPE` | Design quality issues are intentionally not changed or judged here unless they affect SPEC traceability. |

## 6. Required Core Flow Findings

### 6.1 Daily Log Save Flow

`LogEntry` maps many fields to `DailyCheckInRecord`: RPE, sleep/rest/readiness-like values, mood, body-area pain, and constrained memo boundary. The strongest alignment is the `PrivacyNote` in `ui_kits/trainoracle-app-v3/LogEntry.jsx` lines 501-514, matching `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 328-368.

Remaining gaps:

- Photo attachments and voice memo now have Round 4 working-source contracts, but implementation, storage, retention, and runtime evidence remain open.
- Race quick check now has a Round 4 working-source subtype contract, but implementation and Daily Log binding review remain open.

### 6.2 Safety Signal Display Flow

The specs require structured daily signals to raise review or block, never clear `D9_ACTIVE` or `D9_UNKNOWN`. Key references:

- `DAILY_LOG_AND_CHECKIN_SPEC.md` lines 443-472
- `RVE_RULE_EVALUATOR_BINDING_SPEC.md` lines 487-523
- `PLAN_SAFETY_GATE_SPEC.md` lines 272-281 and 299-345

Static `design-v3/screens/02_LogEntry.html` lines 136-139 is aligned because it displays Review copy. The interactive v3 JSX `BodyDiagram` flow is not yet aligned because the user can select high pain, but no visible Review/block status appears in that component.

### 6.3 AI Output Display Flow

AI surfaces have the right product direction, but the contract shape is incomplete:

- Home AI one-line has confidence/time range but not source refs, rationale codes, privacy tier, or redaction state.
- Log Detail AI footnote has source text in static HTML but lacks confidence/privacy/reason-code state.
- AIChat and Inbox use verdict/confidence-like UI but do not expose `sourceRefs`, `nonSensitiveReasonCodes`, `privacyLevel`, or raw-text flags.

Relevant source lines:

- `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` lines 207-249, 259-319, 346-358
- `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` lines 328-409, 446-479
- `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` lines 192-224, 232-289

### 6.4 9.5-Day Cycle Display Flow

Static v3 HTML is mostly safe because it visibly uses `CYCLE_DAY`. The React v2/v3 component data and props often store or pass bare `D-*` strings.

Relevant source lines:

- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 88-101
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 164-167
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 196-207
- `MICROCYCLE_AND_CALENDAR_MAPPING_SPEC.md` lines 471-474

Service implementation should use a typed backing object such as `namespace: "CYCLE_DAY"`, `value: "D-5"`, `isRuleId: false`, then render short display labels only at the final UI layer.

### 6.5 Privacy Flow

v3 `LogEntry` has the strongest privacy treatment. Static v3 screens also include memo/local-only notices.

Remaining gaps:

- v2 AIChat free-text prompt has no privacy notice.
- historical recall/memory text now has a Round 4 working-source contract, but UI implementation and privacy review remain open.
- attachment and voice memo privacy are covered by the Round 4 media working source, but not by completed app/storage implementation.
- AI output surfaces need explicit privacy/redaction/source states before production.

## 7. Design File Modification Check

No design or screen implementation file was modified for this audit. Findings are documented here only.

Read-only design/screen paths checked:

- `ui_kits/`
- `design-v3/`

Forbidden paths not edited:

- `ui_kits/`
- `preview/`
- `design-v3/`
- `designs/`
- `colors_and_type*.css`
- root `index.html`

## 8. Follow-Up Recommendations

1. Resolve `CONFLICT` rows before service implementation uses these labels as data.
2. Bind the Round 4 media/transient-input source contract to App Bridge/storage before wiring photo or voice memo persistence.
3. Bind AI output surfaces to `sourceRefs`, `confidence`, `uncertaintyState`, `privacyTier`, `redactionState`, and `nonSensitiveReasonCodes`.
4. Add visible Review/block state to interactive pain/safety flows, not only static mockups.
5. Treat Round 3 and Round 4 accepted working sources as patch sources only; do not treat them as implementation completion, issue closure, canonical promotion, or runtime evidence.

[DRAFT_COMPLETE]
