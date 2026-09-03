# SPEC_QUICK_PROGRESSIVE_JOURNAL_V2_DECISION.md

```yaml
document_metadata:
  doc_id: trainoracle-owner-decision-quick-progressive-journal-v2
  spec_id: SPEC_QUICK_PROGRESSIVE_JOURNAL_V2_DECISION
  title: TrainOracle Quick Progressive Journal V2 Decision
  version: "1.1"
  round: RT2
  status: OWNER_APPROVED_WORKING_DIRECTION
  owner: COACH_HOJUNE
  open_issues_total: 0
  canonical_blocking_count: 0
  executed_tests_total: 0
  canonical_promotion_allowed: false
  runtime_evidence_claimed: false
  final_marker_required: "[DRAFT_COMPLETE]"
```

## 1. Decision Purpose

TrainOracle must support two honest recording depths without splitting one activity into
duplicate records:

- a very short path for athletes who want to leave only today's essential facts;
- detailed editing for athletes who want to add objective values, structured context,
  diary text, private notes, or decoration.

The quick path is not a lower-quality fact path. It asks fewer questions, preserves
missing values as missing, and updates the same entry when the athlete later adds detail.

## 2. Post-session Quick V2 Flow

```yaml
flow:
  entry_point: quick_record
  step_1: choose_activity_outcome
  performed_branch:
    step_2: choose_UNSPECIFIED_AM_or_PM
    step_3: choose_exact_RPE_1_to_10_or_MISSING
    step_4: choose_no_body_signal_or_signal_reported
    positive_signal_extension: choose_structured_body_area_then_explicit_save
  rest_or_skip_branch:
    save_immediately_without_slot_RPE_or_objective_waiting_state: true
  completion:
    local_storage_receipt_required_before_success_UI: true
    correction_updates_same_id: true
    detail_continuation_updates_same_id: true
```

The normal performed/no-pain path costs at most five deliberate taps including the
entry-point tap. A positive body signal is a safety exception: selecting the body area
and confirming the record may exceed that budget. Safety questions must not be removed
merely to preserve a marketing tap count.

## 3. Truth And Provenance

```yaml
truth_contract:
  activity_outcomes: [COMPLETED, PARTIAL, LIGHT_ACTIVITY, RESTED, SKIPPED]
  new_activity_slots: [UNSPECIFIED, AM, PM]
  legacy_read_only_slot: SINGLE
  new_RPE: exact_integer_1_to_10_or_MISSING
  new_rpeBand_write: forbidden
  exact_RPE_and_band_together: forbidden
  explicit_exact_RPE_may_enter_descriptive_analysis: true
  missing_RPE_may_enter_analysis: false
  silent_defaults: forbidden
  planExecutionRelation:
    values: [AS_PLANNED, MODIFIED, NOT_APPLICABLE, UNKNOWN]
    provenance: DERIVED
    derived_from: [activityOutcome, plannedSessionLink]
  correction_to_RESTED_or_SKIPPED:
    clear_performed_only_values:
      - activitySlot
      - painCheckStatus
      - painParts
      - system
      - distanceKm
      - durationMin
      - avgPace
      - rpe
      - rpeBand
      - intensityAssessment
    objectiveDataState: NONE
    clear_matching_performed_only_provenance: true
    retain_same_entry_id: true
```

Legacy band-only records remain readable and must be labelled approximate. They are not
silently converted to a midpoint or used as an exact response signal.

## 4. Plan Link Boundary

Only the athlete's explicit action on one visible planned session may attach the exact
immutable planned-session link. A generic quick record never receives a link from date,
title, RPE, energy label, device activity, or later similarity matching. Quick and
detailed capture depths do not change the identity or authority of an existing link.

## 5. Device Reconciliation Boundary

A performed entry originating in quick capture, including its later `DETAILED`
continuation, with objective state `WAITING` and no objective values may be offered as a
same-date candidate. Capture depth does not change its identity. Rest and skip are never
candidates. Multiple AM/PM candidates are not guessed.

The athlete explicitly chooses either a new separate journal or one existing journal to
complete. Date/distance similarity is only a warning, not authority to force merging.
Reconciliation checks the selected journal id and saved revision again when saving;
stale, ambiguous, wrong-date, or already-completed targets do not overwrite facts.

After reconciliation, the mixed-origin journal remains editable for athlete-authored
subjective fields and diary text. Imported objective values and their provenance remain
read-only at both the form and ordinary/private storage boundaries. Existing plan links
remain immutable. Changing such a record to rest/skip cannot silently erase imported
facts; the form explains why that change is unavailable. Standalone imported journals
remain read-only in this release and the UI must not promise otherwise.

Confirmation does not turn provider-derived facts into athlete-entered facts, and
imported values remain excluded from analysis or planning until a separate provider
trust and provenance rule is accepted. An unchanged derived value does not become
explicit merely because the athlete saves a private memo.

Device reconciliation never edits diary text or its purpose. It preserves any existing
private-memo ciphertext unchanged, even while the memo is locked. A storage shell's
empty memo is not a deletion request. A dedicated memo-preserving write rejects changes
to memo text or purpose; explicit diary editing/deletion retains its separate behavior.

## 6. Safety And Privacy

- Performed quick capture requires an explicit structured post-activity body check.
- A reported signal requires at least one structured body area.
- Positive structured signals may raise review; no favorable answer clears D9, RVE, or Safety Gate blocks.
- Quick capture does not store raw symptom clauses, medical narratives, or private memo text in audit or analysis payloads.
- The analysis projection blanks the user-authored session title and admits each structured
  context field only when that exact field has eligible provenance. One eligible RPE must
  not carry unprovenanced context or an unregistered derived plan relation into analysis.
- `일지 더 쓰기` preserves the existing memo-purpose and safe-export boundaries.

## 7. Rewards And Historical Records

Points recognize that the current date received an honest record; they do not reward
distance, intensity, volume, completion, or a no-pain answer. A historical backfill is
valuable data but must not mint a spendable current-day reward. Rest, partial activity,
and skipped plans remain honest records and must not be hidden or punished.

An explicit rest or skip remains an eligible structured day record even when RPE and
objective values are missing. It contributes to recorded-day continuity but must not
inflate performed-session count, distance, or RPE averages.

## 8. Comparison And Navigation

The comparison surface shows two records together and only computes a difference when
both sides contain eligible objective values. Same-day AM/PM comparison is allowed.
Missing is not zero. Private memo text is not compared. Ordinary workout and evening
recording belong visually to `일지`; only a race form belongs to `경기기록`.

## 9. Supersession And Non-authority

This decision supersedes conflicting runtime-design details in
`SPEC_TAP_FIRST_LOGGING.md` §6 while preserving that document as interaction history.
It patches the working-source direction of `DAILY_LOG_AND_CHECKIN_SPEC.md` §7B but does
not promote that reconstructed draft to canonical status.

This decision is not release evidence, provider approval, medical judgment, safety
clearance, automatic-adaptation authority, canonical promotion, or downstream issue
closure. Runtime claims require matching test output from the final commit and deployed
artifact.

## 10. Change Record

| Version | Change | Preserved |
|---|---|---|
| 1.1 | Clarifies same-identity detailed continuation, explicit separate/reconcile choice, revision checks, and mixed-origin edit protections after the #314 independent review | Existing quick tap flow, safety and memo boundaries, imported-value analysis exclusion, canonical and issue-closure status |

[DRAFT_COMPLETE]
