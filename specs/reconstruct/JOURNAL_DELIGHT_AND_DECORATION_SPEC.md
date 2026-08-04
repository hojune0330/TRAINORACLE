# JOURNAL_DELIGHT_AND_DECORATION_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-journal-delight-decoration-spec
  spec_id: JOURNAL_DELIGHT_AND_DECORATION_SPEC
  title: Journal Delight And Decoration Contract
  version: 1.0-beta-contract
  round: V1_BETA_CONTRACT_ALIGNMENT
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_006.md Task A
    - ACCOUNT_FEDERATION_DECISION.md
    - app/src/domain/journal-store.ts local-first model
    - TRAINING_PLAN_METHOD_DECISION.md Section 5
  open_issues_total: 0
  canonical_blocking_count: NOT_ASSERTED_HERE
  canonical_promotion: NOT_CLAIMED
  runtime_implementation_status: NOT_CLAIMED
  runtime_evidence: none
```

---

## 1. Purpose And Status

This document is the decision-complete V1 beta product and data contract for
journal stickers, stamps, masking tape, page themes, ink colors, and avatar
badges. It settles the V1 beta catalog, storage, placement, migration, backup,
deletion, and authority rules.

This is a contract, not proof that the runtime implements it. A catalog entry,
schema, or acceptance rule written here must not be reported as shipped or
tested runtime behavior without separate runtime evidence.

The decoration experience supports reflection and journaling. It must not turn
training volume, speed, pain hiding, medical status, or safety clearance into a
reward path.

---

## 2. Authority Boundary

Journal decoration changes presentation and collection state only. It has no
plan-generation, safety, D9, RVE, analysis, pain/medical, coach, or performance
authority.

```yaml
decoration_authority:
  is_safety_authority: false
  is_medical_authority: false
  is_coach_authority: false
  can_create_training_plan: false
  can_modify_or_unlock_training_plan: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_override_Plan_Safety_Gate: false
  can_generate_analysis_or_health_inference: false
  can_diagnose_interpret_or_score_pain: false
  can_claim_medical_clearance: false
  can_claim_coach_approval: false
  can_claim_or_predict_performance: false
  can_change_training_recommendations: false
  can_reward_training_load: false
  can_export_to_athletetime: false
```

Decoration state must never change a training recommendation, generated plan,
analysis result, pain interpretation, medical or coach disposition, D9 result,
RVE result, Plan Safety Gate route, performance claim, or AthleteTime-linked
identity state. A decoration ID, ownership record, placement, point balance, or
streak is never evidence that training is safe, effective, prescribed, reviewed,
or likely to improve performance.

---

## 3. V1 Beta Vocabulary

### 3.1 Item Types

```yaml
decoration_item_types:
  allowed:
    - sticker
    - stamp
    - masking_tape
    - page_theme
    - ink_color
    - avatar_badge
```

`avatar_badge` is a presentation-only decoration type. Its V1 display surface
is `diary_header`; it does not alter an athlete profile, role, verification,
coach relationship, safety state, or identity state.

### 3.2 Fixed Runtime V1 Slots

Runtime V1 positional placement accepts only these four case-sensitive slot
values:

| slot | surface | allowed item types | cardinality per date page |
|---|---|---|---:|
| `HEADER_TAPE` | `diary_header` | `masking_tape` | 1 |
| `TOP_CORNER` | `diary_header` | `sticker` | 1 |
| `BODY_MARGIN` | `diary_body` | `sticker` | 1 |
| `PAGE_FOOTER` | `diary_footer` | `stamp` | 1 |

`page_theme`, `ink_color`, and `avatar_badge` are device-wide journal defaults,
not per-entry or per-date positional placements. They use `equipped.themeId`,
`equipped.inkId`, and `equipped.avatarId`. The avatar renders on
`diary_header`; none of these defaults accepts a slot or spatial field.

Arbitrary x/y coordinates, drag positioning, rotation, and scaling are a future
extension only. Runtime V1 must reject, ignore for rendering, and never persist
`x`, `y`, `position`, `rotation`, `rotationDeg`, or `scale` as accepted placement
authority. A client that displays drag, rotate, or resize controls is outside
this V1 contract.

---

## 4. Final V1 Beta Catalog

IDs and prices are case-sensitive. The following eight entries are the complete
V1 beta catalog; aliases and client-created IDs are not accepted.

### 4.1 Free Starter Set

These five items are available to every V1 beta journal user without an unlock
condition, training action, consent reward, or point spend.

| item ID | type | V1 application | price |
|---|---|---|---:|
| `THEME_TRACK_NOTEBOOK` | `page_theme` | device-wide `equipped.themeId` | FREE |
| `INK_NAVY` | `ink_color` | device-wide `equipped.inkId` | FREE |
| `STICKER_WEATHER_SUN` | `sticker` | `TOP_CORNER` or `BODY_MARGIN` | FREE |
| `STAMP_REST_DAY` | `stamp` | `PAGE_FOOTER` | FREE |
| `TAPE_CHECKER` | `masking_tape` | `HEADER_TAPE` | FREE |

### 4.2 Existing Point-Priced Set

These three existing IDs and prices are preserved exactly:

| item ID | type | V1 application | beta point price |
|---|---|---|---:|
| `THEME_SKY_JOURNAL` | `page_theme` | device-wide `equipped.themeId` | `12P` |
| `STICKER_FINISH_LINE` | `sticker` | `TOP_CORNER` or `BODY_MARGIN` | `8P` |
| `AVATAR_START_LINE` | `avatar_badge` | device-wide `equipped.avatarId` on `diary_header` | `20P` |

The word "priced" means only a spend from the closed beta point balance. It
does not mean cash, a purchased currency, property, compensation, or value that
can be withdrawn or transferred.

```yaml
beta_economic_contract:
  pointMeaning: NON_ECONOMIC_NON_TRANSFERABLE_BETA
  cash_purchase: forbidden
  cash_redemption: forbidden
  person_to_person_transfer: forbidden
  athlete_time_transfer: forbidden
  external_exchange: forbidden
  ownership_confers_training_advantage: false
  ownership_confers_safety_or_coach_status: false
```

Catalog ordering, visual artwork, and localized display names may change without
changing an item ID, type, price, allowed application, or authority boundary.

---

## 5. Exact DecorationStateV2 Contract

The payload at `trainoracle.decorations.v2` has exactly seven top-level fields.
It does not contain journal-entry IDs, raw journal data, or spatial coordinates.

```yaml
DecorationStateV2:
  version: 2
  spentPoints: required_nonnegative_number
  ownedItemIds: required_unique_recognized_catalog_ID_array
  equipped:
    themeId: required_owned_or_free_page_theme_ID_default_THEME_TRACK_NOTEBOOK
    inkId: required_owned_or_free_ink_color_ID_default_INK_NAVY
    avatarId: nullable_owned_avatar_badge_ID_default_null
  library:
    favoriteItemIds: unique_catalog_ID_array
    recentItemIds: catalog_ID_array_max_8
  pagePlacements:
    - date: required_YYYY-MM-DD
      slot: HEADER_TAPE_OR_TOP_CORNER_OR_BODY_MARGIN_OR_PAGE_FOOTER
      itemId: required_owned_or_free_sticker_stamp_or_masking_tape_ID
  pointMeaning: NON_ECONOMIC_NON_TRANSFERABLE_BETA
```

Machine-readable V1 constraints:

```yaml
decoration_library_v1:
  grants_ownership: false
  grants_equipment: false
  grants_placement: false
  favorites_unique: true
  recent_max_items: 8

decoration_placement_v1:
  scope: journal_date_page
  accepted_fields:
    - date
    - slot
    - itemId
  journalEntryId: forbidden
  x: forbidden
  y: forbidden
  position: forbidden
  rotation: forbidden
  rotationDeg: forbidden
  scale: forbidden
```

`ownedItemIds` always contains all five free starter IDs. A point-priced ID may
appear only after a valid legacy migration or a successful V2 point acquisition.
`spentPoints` carries the non-economic beta spend total and cannot exceed the
points supplied by the existing beta point source. Neither field carries cash
or transferable value.

`equipped.themeId`, `equipped.inkId`, and `equipped.avatarId` are device-wide
journal defaults. `themeId` is required and defaults to `THEME_TRACK_NOTEBOOK`;
`inkId` is required and defaults to `INK_NAVY`; `avatarId` is nullable and
defaults to `null`. They are not keyed by `journalEntryId` or date. The avatar is
an optional identity decoration rendered only in `diary_header`; it is never a
page placement or fixed-slot item. Theme, ink, and avatar selection changes
appearance only and must not rewrite, summarize, classify, analyze, or infer
meaning from a journal memo or symptom record.

`favoriteItemIds` must contain unique IDs. `recentItemIds` is ordered most-recent
first, de-duplicates an item by moving it to the front, and retains at most 8
IDs. Favorites and recents are library navigation metadata only: adding an ID to
either list does not grant ownership, make a paid item usable, equip an item, or
create a page placement.

`pagePlacements` is date-page scoped, never individual-entry scoped. A date may
have at most 4 placement rows and at most one row for each fixed slot. Replacing
an occupied `(date, slot)` row affects only that row. Only sticker, stamp, and
masking-tape items may appear in `pagePlacements`; theme, ink, and avatar IDs are
invalid there.

Arbitrary x/y coordinates, drag positioning, rotation, and scaling are a future
extension only. Runtime V1 accepts only the four fixed slots. It must reject,
ignore for rendering, and never persist `x`, `y`, `position`, `rotation`,
`rotationDeg`, or `scale` as accepted placement authority.

---

## 6. Storage And V1-to-V2 Preservation

The V2 preference/library/page-placement state is local-first and uses exactly
this key:

```yaml
decoration_storage:
  active_local_storage_key: trainoracle.decorations.v2
  payload_shape: DecorationStateV2_exactly
  server_promotion_namespace: TRAINORACLE_ONLY
  athletetime_transfer: forbidden
  raw_memo_copy: forbidden
  raw_symptom_clause_copy: forbidden
```

The existing purchase/ownership key is `trainoracle.decorations.v1`. It is the
legacy migration source only when V2 is absent. Once a valid V2 exists, V2 is
authoritative for spend, ownership, equipped defaults, library state, placements,
and point meaning.

### 6.1 Legacy V1 Read, Readback, And No-Delete Rules

1. If a valid V2 payload exists, validate and use it as authoritative. Do not
   merge V1 into it or rerun migration.
2. If V2 is absent and V1 is valid, create V2 with `version: 2`, copy V1
   `spentPoints`, copy only recognized V1 paid `ownedItemIds`, add all five free
   starter IDs to `ownedItemIds`, initialize `equipped.themeId` as
   `THEME_TRACK_NOTEBOOK`, `equipped.inkId` as `INK_NAVY`, `equipped.avatarId` as
   `null`, initialize empty library/placement state, and preserve
   `pointMeaning: NON_ECONOMIC_NON_TRANSFERABLE_BETA`.
3. If both keys are absent, initialize V2 with `version: 2`, `spentPoints: 0`, all
   five free starter IDs in `ownedItemIds`, the same required theme/ink and null
   avatar defaults, empty library/placement state, and the required point meaning.
4. Write the initialized/migrated payload only to
   `trainoracle.decorations.v2`, then read it back and verify the exact seven-field
   `DecorationStateV2` shape and copied values before making it authoritative.
5. Recognized V1 ownership of `THEME_SKY_JOURNAL`, `STICKER_FINISH_LINE`, and
   `AVATAR_START_LINE` and the V1 `spentPoints` value must match V2 readback after
   migration. Unknown legacy IDs do not become V2 ownership.
6. A paid item reference in `equipped`, `library`, or `pagePlacements` is usable
   only when its ID is in V2 `ownedItemIds`. Favorites and recents do not add it.
7. The original `trainoracle.decorations.v1` value remains byte-for-byte
   readable. V2 initialization, V2 writes, journal trash/deletion, logout,
   malformed-data recovery, backup, and restore must never mutate, overwrite,
   or delete it during this beta.
8. Repeated initialization must not spend points again, duplicate a purchase,
   duplicate a favorite, or grow recents beyond 8.
9. A malformed V1 or V2 payload is left untouched for recovery. It yields a safe
   default for that payload only and must not prevent journal display. Invalid
   owned IDs are item-scoped; they do not erase valid ownership rows.

These preservation/readback/no-delete rules retain existing paid ownership while
making the verified V2 payload authoritative and keeping the V1 bytes for this
beta. They do not claim that the runtime implements them.

---

## 7. Backup Separation And Restore

A user-downloaded backup is one envelope with separate `journal` and
`decorations` sections. Decoration data is not a separate backup artifact and is
not embedded in a journal entry.

```yaml
user_downloaded_backup_envelope:
  journal: existing_journal_backup_section
  decorations: required_distinct_decoration_backup_v2_section
  decorations_payload:
    version: 2
    spentPoints: DecorationStateV2.spentPoints
    ownedItemIds: DecorationStateV2.ownedItemIds
    equipped: DecorationStateV2.equipped
    library: DecorationStateV2.library
    pagePlacements: DecorationStateV2.pagePlacements
    pointMeaning: NON_ECONOMIC_NON_TRANSFERABLE_BETA
    rawMemo: forbidden
    memo: forbidden
    rawSymptomClause: forbidden
    symptomText: forbidden
    injuryNarrative: forbidden
    medicalNote: forbidden
    coachPrivateNote: forbidden
```

The `decorations` section may reference only a placement `date`, fixed `slot`,
and catalog `itemId`. It must not duplicate raw memo, symptom, injury, medical,
guardian, or coach text from the `journal` section or any other store.

Restore validates `journal` and `decorations` independently within the same
envelope. One invalid decoration item must not reject or overwrite valid journal
content. Restored page placements attach only to a date that has at least one
restored journal entry; orphan date rows are skipped and must not create a
journal entry. Library membership still does not grant ownership: paid references
must be present in the validated `decorations.ownedItemIds` field.

---

## 8. Journal Trash, Restore, And Deletion

Page placements belong to a journal date page. They never belong to an
individual journal entry. Global `equipped`, `library`, ownership, and point
state do not follow journal trash or deletion.

| journal action/state | required date-page placement behavior |
|---|---|
| One or more active journal entries remain on a date | Keep that date's placements visible, even if another same-date entry is trashed or deleted. |
| Move the last active same-date entry to trash | Retain that date's placements in V2 through the trash period, but hide them because the date now has zero active entries. |
| Restore any same-date entry before expiry | Reveal the same `(date, slot, itemId)` rows without a second point spend. |
| Permanently delete or expire one entry while another active or trashed same-date entry remains | Retain all date placements; do not cascade them. |
| Permanently delete the last same-date entry | Remove only the `pagePlacements` rows for that date. Keep global equipped defaults, library lists, V1 ownership/point history, and other dates. |
| Automatic 30-day expiry of the last same-date entry | At that entry's `trashedAt + 30 * 24 hours`, apply the same date-row cascade as permanent deletion. |

The journal lifecycle record owns each entry's `trashedAt`. Decoration code must
not extend, shorten, or reset the 30-day period. Each trashed entry may expire
independently; date placements are removed only after no active or trashed
journal entry remains on that date. An older backup must not recreate a missing
journal entry or restore orphan placements for a date with no journal entries.
Deleting one placement removes only its `(date, slot)` row and never deletes or
edits journal content.

```yaml
same_date_placement_lifecycle:
  visible_while_any_same_date_entry_active: true
  retained_while_only_trashed_entries_remain: true
  restored_without_second_spend: true
  cascade_only_after_last_same_date_entry_permanently_gone: true
```

---

## 9. Validation And Failure Containment

All validation failures are decoration-item-scoped:

| malformed input | result | journal behavior |
|---|---|---|
| unknown ID or case-mismatched ID | `UNKNOWN_DECORATION_ID` | Skip that equipped/library/placement item; render the journal and all other valid decorations. |
| invalid placement `date` | `INVALID_JOURNAL_DATE` | Skip that placement; render every same-date journal entry and all other valid decorations. |
| unknown, incompatible, or missing slot | `INVALID_SLOT` | Skip that placement; render the date page and all other valid decorations. |
| duplicate `(date, slot)` or more than 4 rows for one date | `PLACEMENT_LIMIT_EXCEEDED` | Keep the deterministic first valid row per slot, cap at 4, and render the journal. |
| duplicate favorite or more than 8 recents | `LIBRARY_LIMIT_NORMALIZED` | De-duplicate favorites/recents, cap recents at 8, and render the journal. |
| arbitrary coordinate, drag, rotation, or scale field | `UNSUPPORTED_V1_SPATIAL_FIELD` | Do not accept it as placement authority; render the journal without that invalid placement. |
| malformed backup/storage entry | `INVALID_DECORATION_ENTRY` | Quarantine or skip only that entry; do not erase valid sibling entries or journal content. |

Unknown IDs, invalid date values, and invalid slot values must never blank,
crash, delete, or block display of a journal entry or date page. A failure must
not mutate journal content, trash timestamps, global equipped defaults, valid
library rows, V1 ownership, safety state, or the preserved V1 payload.

This contract accepts no instruction-bearing free text. `instructionText`, raw
memo text, prompt text, generated instructions, and similar fields are forbidden
in catalog, equipped, library, placement, storage, and backup records. Prompt
injection is therefore not an input mode for the decoration contract; any such
field is data to reject, not an instruction to execute.

---

## 10. Unlock And Collection Safety

The five starter items are free and immediately available. The three point-priced
items may be acquired only through the non-economic beta point path. Decoration
ownership and availability must not depend on:

```yaml
forbidden_unlock_conditions:
  - training_volume_or_distance
  - pace_or_speed
  - workout_count_that_excludes_rest_or_injury_days
  - pain_free_status_or_pain_free_streak
  - training_load_or_training_load_increase
  - weight_loss_or_body_metric
  - D9_or_safety_clearance
  - RVE_or_Plan_Safety_Gate_outcome
  - medical_clearance_or_coach_approval
  - analysis_or_performance_score
  - consent_grant_or_continued_enrollment
  - obedience_to_a_generated_or_coach_plan
  - favorable_private_memo_or_symptom_content
```

No decoration may be unlocked, withheld, priced, removed, or upgraded because a
user trained more, moved faster, reported being pain-free, concealed pain,
received safety clearance, passed D9/RVE/Plan Safety Gate, followed a plan, or
received a coach/medical/performance label.

---

## 11. Safe Recording And Journal-Only Mode

Any recording-consistency signal is a journaling habit signal, not training
compliance. Rest-day and injury/pain check-ins count as valid journal records;
training is never required, and missed days must not use shame copy or remove an
owned decoration.

```yaml
safe_recording_rules:
  valid_record_types:
    - post_session_journal
    - evening_checkin
    - race_journal
    - rest_day_journal
    - injury_or_pain_checkin
  requires_training: false
  rest_day_penalty: forbidden
  injury_or_pain_penalty: forbidden
  pain_free_bonus: forbidden
  missed_day_shame_copy: forbidden
```

`journal_only` mode has no plan-generation action. Enabling decoration in that
mode does not enable analysis, training plans, coach functions, or safety
clearance. If training-plan features are enabled later, their own D9/RVE/Plan
Safety Gate path must run independently before any plan action.

Shadow-pilot progress and journal decoration remain separate records. Consent,
continued enrollment, silence about pain, and favorable memo content are not
rewardable. Withdrawal must not claw back an owned item. Journal deletion follows
the same-date last-entry rule in Section 8; only that rule may remove date-page
placements, and it never removes catalog ownership.

---

## 12. Privacy And Audit Boundary

Decoration audit events are structured and minimal:

```yaml
decoration_audit:
  date: optional_YYYY-MM-DD_for_page_action
  decorationItemId: optional_catalog_ID
  action: equipped_OR_favorited_OR_recently_used_OR_placed_OR_replaced_OR_removed_OR_acquired_OR_restored_OR_date_cascade_deleted
  slot: optional_fixed_V1_slot
  createdAt: required_timestamp
  rawMemoStored: false
  rawSymptomClauseStored: false
  painOrMedicalInferenceStored: false
  safetyDispositionChanged: false
  analysisDispositionChanged: false
  coachDispositionChanged: false
  performanceDispositionChanged: false
```

No decoration audit may store or reconstruct raw athlete free text, raw symptom
clauses, injury narratives, medical notes, guardian notes, coach private notes,
or generated analysis.

---

## 13. Contract Acceptance Assertions

A conforming V1 implementation must demonstrate separately that:

- The exact eight catalog IDs, five free starters, and three point prices match
  Section 4 with `NON_ECONOMIC_NON_TRANSFERABLE_BETA` semantics.
- `DecorationStateV2` has exactly `version`, `spentPoints`, `ownedItemIds`,
  `equipped`, `library`, `pagePlacements`, and `pointMeaning`; all five starter
  IDs are owned, theme/ink/avatar are device-wide defaults, favorites are unique,
  recents are capped at 8, and library membership grants no ownership, equipment,
  or placement.
- Date-page positional writes contain only `{date, slot, itemId}`, accept only
  `HEADER_TAPE`, `TOP_CORNER`, `BODY_MARGIN`, and `PAGE_FOOTER`, cap each date at
  four rows with one row per slot, enforce item/slot compatibility, and contain
  no coordinate, drag, rotation, or scale authority.
- When V2 is absent, migration copies recognized V1 paid ownership and spend,
  adds the five starter IDs, writes only `trainoracle.decorations.v2`, and
  validates exact-value readback. Valid V2 is then authoritative while the V1
  value remains byte-for-byte readable and is never deleted during this beta.
- A user-downloaded backup contains separate `journal` and `decorations` sections
  in the same envelope, with no memo or symptom duplication in `decorations`.
- Same-date entries share page placements; zero active entries hides them,
  restoring any same-date entry reveals them, and permanent delete or 30-day
  expiry removes date rows only after no journal entry remains on that date.
- Journal trash/deletion never changes device-wide equipped defaults, library,
  ownership, point history, or placements on another date.
- Unknown IDs, invalid dates, invalid slots, and unsupported spatial fields fail
  per item without breaking journal display.
- Decoration never gains plan, safety, D9, RVE, analysis, pain/medical, coach, or
  performance authority, and no forbidden unlock basis is used.

These are acceptance requirements, not claims that the runtime currently passes
them.

---

## 14. Non-Claims

This contract does not claim:

- That the runtime, migration, backup, restore, trash, expiry, or placement UI is
  implemented or tested.
- That arbitrary coordinates, drag, rotation, or scaling are part of V1.
- That beta points are money, transferable value, wages, prizes, or purchasable
  currency.
- That decoration can generate or modify plans, analyze a journal, interpret
  pain, diagnose or clear a medical/safety issue, act as a coach, clear D9/RVE/
  Plan Safety Gate, or make a performance claim.
- That decoration ownership proves safety, adherence, efficacy, approval, or
  performance benefit.
- Any canonical promotion beyond the product/data decisions stated here.

[DRAFT_COMPLETE]
