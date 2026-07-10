# JOURNAL_DELIGHT_AND_DECORATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-journal-delight-decoration-spec
  spec_id: JOURNAL_DELIGHT_AND_DECORATION_SPEC
  title: Journal Delight And Decoration Contract
  version: 0.1
  round: RT1_RECONSTRUCTED
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_006.md Task A
    - ACCOUNT_FEDERATION_DECISION.md
    - app/src/domain/journal-store.ts local-first model
  open_issues_total: 3
  canonical_blocking_count: 2
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. Purpose

This document defines the draft contract for journal delight features:
stickers, stamps, masking tape, page themes, ink colors, and safe collection
mechanics. It is a product and data contract only.

The goal is to make TrainOracle useful even for athletes who open the service
only to write a daily journal. Decoration must support reflection and habit
formation without turning training volume, pain hiding, or unsafe persistence
into a reward path.

---

## 2. Authority Boundary

Journal decoration is not safety, coaching, or plan-generation authority.

```yaml
decoration_authority:
  is_safety_authority: false
  can_create_training_plan: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_override_Plan_Safety_Gate: false
  can_reward_training_load: false
  can_export_to_athletetime: false
```

Decoration state may change how a journal entry looks. It must not change
training recommendations, safety disposition, D9/RVE output, Safety Gate
routing, or AthleteTime-linked identity state.

---

## 3. Decoration Taxonomy

The allowed draft decoration item types are:

```yaml
decoration_item_types:
  allowed:
    - sticker
    - stamp
    - masking_tape
    - page_theme
    - ink_color
```

Example catalog entries are illustrative only and do not define final design
assets:

| example_id | type | display_role |
|---|---|---|
| `stamp_rest_day` | `stamp` | Marks a rest-day reflection as complete. |
| `sticker_weather_sun` | `sticker` | Adds a weather-style visual note. |
| `theme_grid_notebook` | `page_theme` | Changes journal page background style. |

No example item is accepted as final visual design. Final item names, artwork,
pricing, and availability remain owner/design decisions.

---

## 4. Data Shape

Decoration data attaches to journal entries by reference. It must not duplicate
raw journal memo, symptom text, or health notes.

```yaml
decoration_item:
  id: required_string
  type: sticker_OR_stamp_OR_masking_tape_OR_page_theme_OR_ink_color
  catalogVersion: required_string
  unlockConditionId: optional_string
  safetyClass: neutral_OR_reflection_support
  designAssetRef: required_string

decoration_placement:
  placementId: required_string
  journalEntryId: required_string
  decorationItemId: required_string
  surface: entry_page_OR_entry_card_OR_calendar_cell
  anchor: header_OR_body_OR_footer_OR_margin
  position:
    x: number_0_to_1
    y: number_0_to_1
  rotationDeg: number
  scale: number
  createdAt: required_timestamp
```

Storage rules:

```yaml
decoration_storage:
  local_first_namespace: trainoracle.journal.v1_extension
  server_promotion_namespace: TRAINORACLE_ONLY
  athletetime_transfer: forbidden
  raw_memo_copy: forbidden
  raw_symptom_clause_copy: forbidden
```

If server sync is later enabled, decoration placements follow the same
local-first promotion path as journal entries. They stay in TrainOracle-owned
storage and must not be sent to AthleteTime.

---

## 5. Unlock And Collection Models

### 5.1 Options

| Option | Description | Benefit | Risk |
|---|---|---|---|
| A. All free immediately | Every decoration item is available from first use. | Lowest pressure, simplest privacy model. | Less collection motivation. |
| B. Consistency unlock | Items unlock through safe recording behaviors such as writing on different days. | Encourages return visits without rewarding load. | Can create streak pressure if poorly designed. |
| C. Mixed | Basic catalog free, some items unlock through safe consistency or owner events. | Balanced motivation and long-term freshness. | Needs careful rule review. |

Recommended draft default:

```yaml
recommended_unlock_model:
  model: mixed
  default_available_items: required
  unlock_basis: safe_recording_consistency_only
  final_decision_owner: TOTAL_RESPONSIBILITY_HOLDER
```

The recommended model keeps a usable base catalog available immediately and
permits only safe, non-load-based unlocks for optional collection depth.

### 5.2 Forbidden Unlock Conditions

The following unlock conditions are explicitly forbidden:

```yaml
forbidden_unlock_conditions:
  - weekly_distance_threshold
  - monthly_distance_threshold
  - pace_or_speed_threshold
  - workout_count_threshold_that_excludes_rest_or_injury_days
  - pain_free_training_streak
  - training_load_increase
  - weight_loss_or_body_metric_target
  - D9_cleared_or_safety_gate_passed_reward
```

Decoration must not reward an athlete for running more, running faster,
ignoring pain, losing weight, or clearing safety checks.

---

## 6. Safe Streak Contract

Streak is a recording habit signal, not a training compliance score.

```yaml
safe_streak_rules:
  counts_as_recorded_day:
    - post_session_journal
    - evening_checkin
    - race_journal
    - rest_day_journal
    - injury_or_pain_checkin
  does_not_require_training: true
  rest_day_breaks_streak: false
  injury_day_breaks_streak: false
  pain_report_penalty: forbidden
  missed_day_shame_copy: forbidden
```

Any future streak copy must make clear that rest days and injury/pain records
are valid journal days. A streak must not imply that the athlete should train
when rest, pain reporting, or human review is appropriate.

---

## 7. Journal-Only Mode

TrainOracle may support a `journal_only` path for users who want diary and
reflection features without plan generation.

```yaml
journal_only_mode:
  plan_generation_enabled: false
  safety_gate_action_surface: none_for_plan_generation
  D9_risk_can_still_be_recorded_as_reason_code: true
  raw_symptom_text_audit_storage: forbidden
  activation_to_training_mode_requires_gate_check: true
```

In `journal_only` mode there is no plan-generation action to block. This does
not weaken safety semantics. If the user later enables training-plan features,
the normal D9/RVE/Safety Gate path must run before any plan is generated.

---

## 8. Privacy And Audit Boundary

Decoration audits must stay structured:

```yaml
decoration_audit:
  athleteId: required_string
  journalEntryId: required_string
  decorationItemId: required_string
  action: placed_OR_moved_OR_removed_OR_unlocked
  unlockConditionId: optional_string
  createdAt: required_timestamp
  rawMemoStored: false
  rawSymptomClauseStored: false
  safetyDispositionChanged: false
```

No audit event may store raw athlete free text, raw symptom clauses, injury
narratives, medical notes, guardian notes, or coach private notes.

---

## 9. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-JDD-CATALOG-DESIGN-001 | Final decoration catalog and visual assets are not accepted | OPEN | YES | This contract defines taxonomy and data shape only; final assets remain design/owner decision. |
| OI-JDD-UNLOCK-NUMBERS-001 | Safe unlock thresholds are not accepted | OPEN | YES | Streak or consistency counts must be owner-approved and must not use training volume, speed, body metrics, or safety clearance. |
| OI-JDD-MONETIZATION-001 | Free versus paid decoration policy undecided | OPEN | NO | Monetization, if any, must not sell safety clearance, coach authority, or training-load advantages. |

---

## 10. Non-Claims

This draft does not claim:

- Any decoration asset or final UI design is accepted.
- Any unlock threshold is accepted.
- Any monetization policy is accepted.
- Any runtime test has passed.
- Any open issue is closed.
- Any canonical promotion is granted.
- Decoration can clear D9, RVE, Safety Gate, or human review.

[DRAFT_COMPLETE]
