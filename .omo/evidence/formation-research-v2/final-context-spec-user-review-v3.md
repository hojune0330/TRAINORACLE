# Formation Final Context, Spec, And User Review V3

```yaml
reviewed_at: 2026-07-17
scope: current_worktree_local_specs_git_history_and_owner_context
verdict: FAIL
register_topic_inventory: PASS_12_OF_12_NO_THIRTEENTH_TOPIC_FOUND
register_decision_completeness: FAIL_ROWS_008_AND_010_NEED_FULLER_BOUNDARIES
latest_owner_precedence: PASS
multi_bout_governance: PASS_OWNER_DECISION_REQUIRED
multi_bout_user_copy: FAIL_READS_AS_DECIDED
middle_school_state_model: PREPARED_NOT_HUMAN_VALIDATED
memo_backup_direction: PASS
recipient_share_status_copy: FAIL
selfcheck_future_analysis_direction: PASS_WITH_SCOPE_COPY_GAP
stale_status_inventory: FAIL
node_test_expectation: 25_OF_25_PASS
runtime_authority: false
source_files_modified: false
```

## Verdict

**FAIL.** The 12 rows in `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`
cover all conflict topics found in the active, reconstructed, historical-decision, and
current review sources. No thirteenth topic was found. The package is not context-clean,
however:

1. old final evidence still reports 9 or 10 conflicts without a current supersession index;
2. `FRV2-CONF-008` and `FRV2-CONF-010` identify the right conflicts but their patch text
   does not carry every latest-owner boundary;
3. multi-bout governance is correctly owner-pending, while user and owner-summary copy
   sometimes describes the recommended anchor-plus-bouts model as already chosen;
4. the selection/execution/current-plan/shadow model is well structured but has zero
   middle-school participants and one actor-ambiguous execution sentence;
5. backup is explained accurately, but in-app sharing is written as available even though
   the canonical recipient target does not exist yet; and
6. future self-check analysis needs to say explicitly that the direction is the athlete's
   own analysis, not current plan, safety, coach, or recipient use.

This is a documentation and handoff failure, not runtime authorization. Runtime remains
false.

## Register Audit

Executable inspection found:

```text
REGISTER rows=12 unique_ids=12 path_occurrences=23 unique_paths=19 missing_paths=0
STATUS HUMAN_REVIEW_REQUIRED=1 OWNER_DECISION_REQUIRED=1 PATCH_REQUIRED=9 TARGET_REQUIRED=1
SEVERITY BLOCKER=4 BLOCKER_BEFORE_UI_ACCEPTANCE=1 HIGH=7
FORMATION_OWNER_BASELINE_VALID conflicts=12 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_scenarios=0/12 user_improvements=15 runtime=false
NODE_TESTS tests=25 pass=25 fail=0
```

The topic sweep maps as follows:

| Register row | Conflict topic | Source result |
|---|---|---|
| 001 | system primary default versus no auto-selection, plus projection/calendar/rationale lineage | captured |
| 002 | Plan Generator draft-only and coach-final selection | captured |
| 003 | Template/Physio consumer restoration of coach-only selection | captured |
| 004 | superseded acceptance, method, joint-brief, blueprint, and research direction | captured |
| 005 | old Read Now coach-final/no-automatic-plan wording | captured |
| 006 | automatic finalization incorrectly left deferred | captured |
| 007 | memo owner-backup versus absolute export bans | captured |
| 008 | recipient share direction with no canonical target | captured, patch boundary incomplete |
| 009 | missing named youth/coach/privacy/accessibility acceptance | captured |
| 010 | current display-only self-check versus intended future analysis | captured, future-use scope incomplete |
| 011 | clarification reason versus preserved-current-plan outcome | captured |
| 012 | completed competition record versus undefined meet/bout identity | captured and correctly owner-pending |

The active/reconstruct sweep also found `NEEDS_COACH_CLARIFICATION` in Plan Generator,
Physio, RVE, and Plan Safety. Those are valid internal reason/gate states, not additional
owner-decision conflicts. Row 011 must keep the reason and add the user outcome; it must
not weaken a safety hold. The union of rows 001-003 and 011 already covers the affected
selection/output chain.

## Latest Decision And Git History

The July 17 owner baseline is unambiguous: latest explicit owner decision governs,
the product direction is one deterministic 9.5-day primary default, execution remains a
separate gate, and no eligible automatic candidate preserves the current coach-authored
plan (`FORMATION_LATEST_OWNER_DECISION_BASELINE.md:4-13,18-26`). Memo backup, exact
recipient sharing, and athlete self-analysis boundaries are stated at lines 27-39 and
45-52. Older contrary direction is expressly historical or superseded.

Local history supports that precedence ordering. The older tracked decision/spec work is
dated July 14-16; `HEAD` is `0bc9f3e` from 2026-07-16. The current baseline records the
current-task directive at `2026-07-17T20:56:07+09:00`. The baseline, register, packets,
and scenarios are still untracked worktree files, so the latest authority is durable only
inside this worktree until committed and linked from the canonical handoff. Discarding the
worktree would expose only the older tracked direction again.

## Multi-Bout Decision

Governance is correct in the controlling artifacts:

- the baseline says one completed `COMPETITION` record counts once, but heat/final/multiple-
  event record identity is unresolved; anchor one plus bouts N is only a recommendation,
  and `FRV2-CONF-012` preserves owner-decision pending
  (`FORMATION_LATEST_OWNER_DECISION_BASELINE.md:74-76`);
- row 012 is `OWNER_DECISION_REQUIRED`
  (`FORMATION_SPEC_CONFLICT_REGISTER.csv:13`); and
- CA-02/03 are recommendations, the packet is `NOT_REVIEWED`, and runtime is false
  (`FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md:5-6,39-47,125-130`).

Presentation drifts from that state. U-07 says the heat and final were each counted, with
the pending caveat only at the end of the pass condition
(`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:38`). The owner brief likewise says the
calendar meet is one and actual starts must each be preserved at line 19, then marks the
same Competition Anchor decision `NOT_REVIEWED` at line 50. Both first-read statements
must lead with recommendation/research status.

Exact U-07 replacement:

> 연구 화면에서는 예선과 결승을 따로 보는 방식을 시험 중이에요. 아직 실제 계획 계산 규칙은 정하지 않았어요.

Teach-back should ask whether this is already the real-plan counting rule; passing answer:
no, the owner has not decided CA-02/03.

## Middle-School State Comprehension

U-01, U-02, U-04, and U-05 successfully separate system primary, coach review/current
plan, no-automatic-plan/current-plan preservation, and shadow-only comparison
(`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:32-36`). The audit also requires every
screen to show who selected, whether it executes, what plan remains current, next action,
and resolver (`FORMATION_LATEST_DECISION_AND_USER_GAP_AUDIT_V2.md:95-102`).

U-03 says only "this 9.5-day plan was confirmed" and hides the actor, contradicting the
scenario rule that the subject must be explicit
(`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:22,34`). Replace it with:

> 코치가 확인해 이 9.5일 계획이 현재 실행 계획이 되었어요.

The material is still only test preparation: participants tested are 0, scenarios run are
0/12, and owner acceptance is `NOT_REVIEWED`
(`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:7,101-107`). Therefore
"understandable by a middle-school user" is **not proven**.

## Memo Backup And Share

U-10 accurately separates default memo exclusion, explicit local inclusion, and analysis
consent (`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:41`). The aligned governance also
says default export excludes memos, explicit full local backup is allowed after warning
and confirmation, and the file operation creates no analytics/coach/Formation rights
(`FORMATION_RECORD_GOVERNANCE_CONTRACT.md:114-122`;
`NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md:157-169`).

U-11 is not current-status accurate. It says three notes are shown to a coach for seven
days as though the in-app flow exists (`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:42`),
while governance says in-app coach/friend/guardian sharing is blocked pending a recipient-
specific contract (`FORMATION_RECORD_GOVERNANCE_CONTRACT.md:117-122`) and row 008 has
`NO_CANONICAL_TARGET_YET` (`FORMATION_SPEC_CONFLICT_REGISTER.csv:9`). Make U-11 explicitly
future-contract-only until that target is accepted.

Row 008's required patch must also add the boundaries already present in owner/governance
context: download/re-share behavior, youth handling, deletion propagation, no conversion
to analytics consent, and no blanket coach access. Recipient/field/purpose/expiry/preview/
confirmation/revocation alone is not decision-complete.

## Future Self-Check Analysis

The latest direction is correctly recorded: tension, condition, goal pace, and mood are
currently collection/display only; later use is intended only after provenance,
missingness, method, uncertainty, user explanation, and owner approval, for the athlete's
own analysis (`FORMATION_LATEST_OWNER_DECISION_BASELINE.md:37-39`). The current canonical
decision still says display only and includes a possible later plan-consumption approval,
so it must be patched (`RACE_SELFCHECK_FIELDS_DECISION.md:94-103`).

U-12 correctly says the fields do not currently alter the automatic plan, but "analysis"
is generic (`FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md:43`). Row 010 likewise omits
"athlete's own" and the continued prohibition on plan/safety/coach/recipient effects
(`FORMATION_SPEC_CONFLICT_REGISTER.csv:11`). Use:

> 지금은 기록과 표시만 해요. 나중에 내 분석에 쓰려면 목적, 방법, 누가 보는지 다시 알려드리고 선택을 받아요. 지금은 자동 계획이나 안전 판단을 바꾸지 않아요.

Any later Formation, recommendation, safety, coach, guardian, analytics, or reward use
needs a separately named owner decision; it must not ride on the self-analysis approval.

## Stale Counts And Status

Historical command output may remain unchanged, but it must be visibly historical. The
following live evidence files still advertise obsolete counts without a single current
index marking them superseded by this 12-row review:

- 9 rows: `final-context-review.md:26`, `final-qa-review.md:60`,
  `final-quality-review.md:293`, and `final-security-review.md:118,142`;
- 10 rows: `final-context-remediation-review.md:20,55`,
  `final-goal-remediation-review-v2.md:79,117`,
  `final-goal-remediation-review.md:134`,
  `final-qa-remediation-review-v2.md:72,139`,
  `final-qa-remediation-review.md:85,137`,
  `final-security-remediation-review-v2.md:89`,
  `final-security-remediation-review.md:113`, and `task-08.md:15`.

`FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md` also still says "three blockers" at line 10 and
does not incorporate the later 011/012 findings, although its UX-11/12 rows partially
anticipate them at lines 61-62. Mark it as a historical pre-12-row review or refresh it.

The current complete Node regression expectation is 25 tests, and a fresh
`node --test specs/test-packages/*.test.mjs` run passed 25/25. These still-live records
show the superseded 23-test snapshot: `.omo/start-work/ledger.jsonl:26`,
`final-goal-owner-constraint-review-v3.md:199`,
`final-quality-remediation-review-v3.md:52`, and
`final-qa-remediation-review-v2.md:34-35`. Preserve 23/23 as historical output, but the
current evidence index must state `25/25 PASS`.

Preferred correction: add a current evidence index declaring every earlier final review
historical, with `recorded_conflict_count` and `superseded_by`; do not rewrite historical
validator outputs. Task 08 should say that 10 was correct at Task 08 and the current count
is 12.

## Required Closure

1. Expand register rows 008 and 010 with the exact latest-owner boundaries above.
2. Mark all 9/10-row review evidence and the pre-011/012 alignment review historical.
3. Change U-03, U-07, U-11, and U-12 plus owner-brief line 19 to status-accurate copy.
4. Keep row 012 `OWNER_DECISION_REQUIRED` until CA-02/03 has an explicit owner decision.
5. Run the named middle-school, coach, privacy, and assistive-technology reviews; do not
   infer comprehension from prepared scenarios.
6. Commit/link the July 17 baseline and 12-row register before treating them as durable
   repository authority.

Until those steps pass, the latest product direction governs only as a worktree-level
target, canonical specs remain patch-required, human acceptance remains zero, and runtime
authority remains false.
