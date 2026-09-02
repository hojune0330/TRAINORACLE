# PLAN_JOURNAL_LINKAGE_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-plan-journal-linkage-contract
  spec_id: PLAN_JOURNAL_LINKAGE_CONTRACT
  title: Plan Session To Journal Linkage Contract
  version: "1.0"
  round: RT1
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 3
  canonical_blocking_count: 2
  canonical_promotion_allowed: false
  runtime_authority: false
  executed_tests_total: 0
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Purpose

This contract defines the production-bound V1 link between one accepted planned session and one post-session journal result. It narrows `OI-ESA-PLAN-JOURNAL-LINKAGE-001` without closing that issue, promoting any SPEC, or claiming exact 9.5-day attribution.

The link exists only when the athlete selects a specific session in the visible plan and chooses to write its journal. Same-date proximity, title similarity, energy labels, RPE, memo text, and completion marks must never create a link automatically.

## 2. Fact Separation

```yaml
facts:
  planned_session: immutable plan occurrence reference
  progress_mark: COMPLETED | RESTED | SKIPPED | PAIN_CHECKIN
  journal_result: structured post-session entry

invariants:
  progress_mark_is_not_journal_result: true
  journal_result_does_not_auto_mark_progress: true
  planned_intent_is_not_actual_energy_classification: true
  linked_journal_does_not_prove_prescription_execution: true
```

The plan may say `LT_INTENT`; the journal energy field remains missing until the athlete explicitly chooses an actual system. A linked journal may describe a modified or stopped session without changing the accepted plan snapshot.

## 3. Link Record

```yaml
PlannedSessionLinkV1:
  schemaVersion: 1
  plannedSessionId: sha256
  planVersionId: sha256
  candidateFingerprint: sha256
  sessionContentFingerprint: sha256
  plannedDate: YYYY-MM-DD
  sessionDay: positive_integer
  sessionSlot: AM | PM
  plannedRole: REST | EASY | QUALITY
  plannedEnergyIntent: PlannedEnergyIntent
  linkSource: ATHLETE_SELECTED_FROM_PLAN
  linkedAt: ISO-8601-instant
```

`candidateFingerprint` is an opaque digest. The raw candidate identifier is not copied into the journal. `plannedSessionId` binds the plan version, session content, local planned date, day, and AM/PM slot. Changing any bound value invalidates the identifier.

## 4. Creation And Edit Rules

1. Only a session present exactly once in the stored active plan may create a link.
2. The athlete must explicitly choose `이 훈련 일지 쓰기` from that session.
   This action may open the quick post-session flow first; capture depth does not weaken
   or replace the exact stored link.
3. REST-only rows do not offer a post-session training journal action.
4. One visible journal result may reference one `plannedSessionId` in V1.
5. A journal edit may change performed facts but may not add, remove, or replace its plan link.
6. A plan change creates a different plan version and therefore different planned-session identities.
7. The link survives structured backup and account sync, while private memo text remains governed separately.

## 5. Privacy Boundary

The link contains no raw memo, symptom clause, free text, athlete name, email, phone number, or medical narrative. Private memo content and memo existence remain zero-signal for plan adaptation and energy-system analysis.

The structured link may be included in owner backup and authenticated structured journal sync. It must not be exposed in public profile cards, friend-sharing payloads, search indexes, or unauthenticated analytics events.

## 6. Calendar Boundary

V1 binds a local planned date and AM/PM display slot. It does not claim an exact occurrence instant, timezone ID, tzdb version, DST disambiguation, or half-day instant boundary. Therefore it must not label a journal as exact local-civil 9.5-day attribution.

## 7. Historical Boundary

The journal link is self-identifying, but the current plan archive does not yet preserve a complete immutable session ledger. V1 may display the linked day and slot stored in the journal. It must not reconstruct or silently mutate a historical prescription from the current active plan.

## 8. Required Tests

1. Same stored plan occurrence produces the same `plannedSessionId` across repeated clicks.
2. Different plan version, session content, planned date, day, or slot produces a different ID.
3. Identifier or projection tampering fails schema validation.
4. A session absent from the active plan cannot create a link.
5. Planned energy intent does not prefill the actual journal energy field.
6. Duplicate visible journal results for one planned session are rejected.
7. Journal edits preserve the exact link.
8. Existing unlinked journals remain readable and writable.
9. Safe export and authenticated sync preserve the structured link without raw memo text.
10. A generic quick entry cannot acquire a link from date, title, energy label, RPE,
    device activity, or later similarity matching.

## 9. Non-Authority

This contract does not authorize automatic adaptation, training-load increase, safety clearance, medical judgment, exact 9.5-day accounting, historical prescription reconstruction, or issue closure. It does not redefine D9 semantics or Plan Generator rules.

## 10. Open Issues

| Issue ID | Severity | Canonical blocker | Status | Required evidence |
|---|---|---:|---|---|
| `OI-PJL-EXACT-OCCURRENCE-001` | P1 | YES | OPEN | Timezone, tzdb, resolved occurrence instant, DST policy, frame boundary |
| `OI-PJL-HISTORICAL-LEDGER-001` | P1 | YES | OPEN | Immutable archived plan versions and full session snapshots |
| `OI-PJL-SERVER-CONFLICT-001` | P2 | NO | OPEN | Cross-device duplicate-link conflict and tombstone tests |

No upstream or downstream issue is closed by this draft or by V1 implementation tests.

[DRAFT_COMPLETE]
