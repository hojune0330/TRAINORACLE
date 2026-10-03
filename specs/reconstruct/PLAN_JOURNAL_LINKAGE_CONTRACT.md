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
  plan_progress_is_explicit_after_linked_journal: true
```

The plan may say `LT_INTENT`; the journal energy field remains missing until the athlete explicitly chooses an actual system. A linked journal may describe a modified or stopped session without changing the accepted plan snapshot.

Saving any journal never changes a progress mark. A returned journal may offer an explicit
`COMPLETED` progress action only when the current active-plan occurrence still resolves exactly,
the linked journal is `COMPLETED`, its selected AM/PM slot matches the linked slot, it has an
explicit `NO_SIGNAL_REPORTED` body check, and no progress mark already exists. This is a UI
choice using the ordinary progress command; it is not a safety clearance or automatic completion.

`planExecutionRelation` is derived from `activityOutcome`, `activitySlot`, and the exact planned
link. `AS_PLANNED` requires `COMPLETED` and an AM/PM slot equal to the linked planned slot.
Any non-completed linked outcome or a selected opposite AM/PM slot is `MODIFIED`. A completed
linked journal with an unspecified or missing AM/PM slot is `UNKNOWN`, not a claimed change. An
unlinked journal is `NOT_APPLICABLE`. Existing stored journals are not rewritten merely because
this derivation is clarified.

## 3. Link Record

### 2026-10-02 Owner-Approved Lifecycle UX Addendum

The owner approved review follow-ups 1-5: repair saved-session editing, make record
confirmation reachable from the primary action, connect the journal receipt to plan
progress, capture an optional short change description, and distinguish prescription
basis while explaining next-cycle maintenance or reduction from actual evidence.
Verify the edited-session journey through the next cycle. This does not promote this
entire draft or new dosing.

- A confirmed journal save may offer an explicit progress action on its receipt,
  without requiring a separate trip to the plan. Journal save and progress save remain
  distinct transactions; a progress failure must not invalidate or hide the saved journal.
- Recheck the active occurrence and the saved journal revision when acting. Never
  overwrite an existing progress mark or apply an old journal to a replaced plan.
- `COMPLETED` retains the exact occurrence, matching AM/PM and explicit no-pain
  conditions above. Explicit rest/skip can be reflected as rest/skip. A pain report
  can only offer pain review, never completion. Partial or different exercise must not
  be collapsed into completed or skipped; display its linked journal outcome instead.
- Linked journal result labels are read-only projections, not progress writes or proof
  of compliance. They survive return/reload, show ambiguity when multiple results
  disagree, and disappear when their source is deleted or no longer resolves exactly.
- Optional `planExecutionChange` is a self-reported qualitative field on a linked
  partial journal: `FEWER_REPETITIONS`, `SHORTER_DURATION`, or `DIFFERENT_WORKOUT`.
  Omission means unspecified. It creates no numeric volume, energy classification,
  physiological deficit or adaptive prescription authority. It is preserved in owner
  backup/account storage but not automatically shared publicly.
- The quick form offers these choices at review without an obligatory extra page.
  Returning to a non-partial outcome clears the saved change field; detailed editing
  preserves it only while the linked partial outcome remains.
- Prescription basis describes inputs used in calculated workout segments, not merely
  records present in storage. Pending record confirmation is a draft, not an applied
  personal prescription. Other segments retain their displayed time/RPE basis.
- Next-cycle explanations distinguish missing, changed, conflicting, single and repeated
  comparable results. A partial workout alone does not prove a physiological deficit.
  Existing reviewed reduction rules remain unchanged; explanations grant no automatic
  increase in intensity, volume or frequency.
- Progress reflection requires exactly one saved record for the journal ID and planned
  occurrence, even when duplicate results happen to agree. No duplicate is deleted.
- Numeric next-cycle reduction additionally requires explicit completed outcome, matching
  actual AM/PM and explicit no-pain response. A recorded RPE may remain a descriptive
  comparison without meeting this dose-change requirement. Pain-associated RPE is not
  ordinary effort evidence, including when its date is outside the current safety window.
  Missing legacy fields remain unknown; do not backfill answers or clear safety checks.


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

## 11. Planned Versus Actual Review Extension (2026-09-28)

See [PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT](PLAN_EXECUTION_DEVIATION_AND_REPLAN_CONTRACT.md)
for the draft execution-comparison/replan path. Exact linkage identifies the
original prescription; it is not measured compliance. In particular, the existing
derived AS_PLANNED relation must not prove equal pace, repetitions or recovery.

Split, additional or mixed activity needs explicit versioned correspondence before
its structured components can represent planned segments. Do not loosen the v1
single-occurrence rule or auto-match by date/title. Preserve existing records and
links, source-read completeness, account scope and missing/conflict states. New
comparison authority, storage extensions and schedule acceptance need their own
implementation evidence; this addition closes no issue or changes runtime behavior.

### 11.1 Owner-approved descriptive comparison repair (2026-09-29)

The actual AM/PM choice is a performed fact, not part of the immutable planned link.
For a same-date journal whose original link and prescription resolve exactly, an
opposite actual slot remains MODIFIED but may display the original prescription
alongside the actual facts. It does not grant AS_PLANNED, adherence, progress
completion or adaptation authority. Wrong dates, altered link fields, missing
originals and account-scope failures remain unavailable. No stored link is rewritten.

[DRAFT_COMPLETE]
