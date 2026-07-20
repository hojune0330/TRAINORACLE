# Formation Coach Ruleset Fixtures

```yaml
fixture_pack_id: TO-WO012-COACH-RULESET-2026-07-16
status: READINESS_ONLY
fixture_count: 30
competition_direction_ref: reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md
competition_direction_state: OWNER_DIRECTION_RECORDED_PENDING_NAMED_REVIEW
completed_bout_records: SEPARATE
calendar_anchor_exposure: 0
same_competition_day_main_placement: ZERO_OR_ONE
canonical_counting_changed: false
runtime_authority: false
```

| ID | Scenario | Deterministic expected result |
|---|---|---|
| CR-01 | version/owner/frame missing | reject registry |
| CR-02 | 9.5 described as proven optimal | reject claim |
| CR-03 | fixed 72h described as clearance | reject claim |
| CR-04 | planned MAIN count 1 or 4 | reject candidate |
| CR-05 | planned MAIN count 2 | count valid; no safety meaning |
| CR-06 | planned MAIN count 3 | count valid; no safety meaning |
| CR-07 | one completed bout under a competition anchor | preserve one separate `COMPETITION` record and its load facts; anchor contributes `ZERO`; same-date planned MAIN placement remains capped at `ZERO_OR_ONE` pending formal acceptance |
| CR-08 | multiple completed bouts under one anchor on the same local competition date | preserve each completed bout record and dedupe each bout; anchor contributes `ZERO`; same-date planned MAIN placement is at most `ONE`, never one per bout |
| CR-09 | completed `SUB`, `LD`, or `TEST` | contribution `ZERO`; no promotion |
| CR-10 | duplicate adapter result for one session/view | reject input |
| CR-11 | planned and completed record for same session | report separate views; never sum |
| CR-12 | missed MAIN | planned fact retained; completed contribution `ZERO` |
| CR-13 | two MAIN compressed after miss | reject; no catch-up candidate |
| CR-14 | composite parent plus leaves | reject double count |
| CR-15 | whole-session RPE split to components | reject |
| CR-16 | strong plyometric between MAIN | preserve component; `NEEDS_COACH_CLARIFICATION` |
| CR-17 | stale/missing/legacy required fact | no permission; `NEEDS_COACH_CLARIFICATION` |
| CR-18 | private-note A versus B | byte-identical result; no source/hash/presence/reason/audit difference |
| CR-19 | active or unknown safety state | blocked; coach cannot override |
| CR-20 | automatic taper requested without registered template | no candidate; `NEEDS_COACH_CLARIFICATION` |
| CR-21 | automatic recovery from RPE/statistic/note/time | no candidate; reject trigger |
| CR-22 | automatic progression requested | no candidate; require coach-authored new version |
| CR-23 | competition date collides with flexible MAIN | preserve the competition date and bout records; move or cancel the flexible MAIN only by coach review; same-date planned MAIN placement remains `ZERO_OR_ONE` |
| CR-24 | re-anchor lacks displaced-session disposition | reject re-anchor |
| CR-25 | missed predecessor MAIN at successor start | no carry-over and no successor debt |
| CR-26 | exposure exactly at frame start | current named frame only |
| CR-27 | exposure exactly at frame end | contiguous successor only |
| CR-28 | DST fold/gap without explicit resolution | reject frame; no guessed instant |
| CR-29 | ambiguous precedence or unknown exception | reject registry/result; no fallback |
| CR-30 | unauthorized team view or coach correction | view returns generic unavailable; authorized correction appends version/audit and preserves prior record |

Trace:

- `WO012-T01`: CR-01/02/03/04/05/06/10/14/15/17/20/21/22/24/28/29.
- `WO012-T02`: CR-07/08/09/11/12/13/23/25/26/27.
- `WO012-T03`: CR-18/19/30.

The expected results define a future parser and deterministic CLI walkthrough. They
are not executed evidence, coach acceptance, physiological validation, or runtime
authority.

[DRAFT_COMPLETE]
