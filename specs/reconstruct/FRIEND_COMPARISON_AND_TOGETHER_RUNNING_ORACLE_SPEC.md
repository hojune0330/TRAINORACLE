# FRIEND_COMPARISON_AND_TOGETHER_RUNNING_ORACLE_SPEC.md

```yaml
doc_id: FRIEND_COMPARISON_AND_TOGETHER_RUNNING_ORACLE_SPEC
spec_id: TO-FRIEND-ORACLE-001
title: TrainOracle Friend Comparison And Together Running Oracle
version: 1.0
round: RT1
status: DRAFT_FOR_REVIEW
owner: TrainOracle Product Owner
open_issues_total: 4
canonical_blocking_count: 1
executed_tests_total: 0
canonical_promotion_allowed: false
final_marker_required: DRAFT_COMPLETE_AT_END
```

## 1. Purpose

This draft defines an athlete-controlled comparison of explicitly shared running
facts and a non-authoritative suggestion for running together. A public profile by
itself is not comparison consent.

## 2. Separate Consent

The athlete must first make the profile public and then separately enable friend
comparison. The athlete selects one or more fields: one chosen achieved race record,
recent eight-week distance total, and recent eight-week energy-system session counts.
Disabling the comparison deletes the public comparison row. Making the profile
private makes the row unreadable immediately even before deletion completes.

## 3. Forbidden Data

The payload cannot contain raw journal or diary text, private memo content or memo
existence, pain or symptom data, sleep, mood, location, contact information, D9/RVE
state, detailed prescriptions, coach notes, account identifiers, or plan mutation
authority.

## 4. Comparison Semantics

- Same-event records may be shown as an absolute percentage difference for planning how to run together. The product does not label a winner, loser, superior athlete, or inferior athlete.
- Distance totals are descriptive and do not set either person's next volume.
- Energy-system counts mean “recorded more often”; they are not strengths, weaknesses, deficiencies, physiological measurements, or readiness scores.
- Missing or withheld data remains unknown and is never imputed as zero.

## 5. Together-Running Output

The first version recommends shared warm-up and cool-down, individual pace or RPE for
the main work, time-based repetitions when useful, and regrouping during recovery.
It does not prescribe one person's pace to the other, merge plans, or bypass either
person's safety gate.

## 6. Access And Withdrawal

Owner writes require authenticated account ownership and the existing server network
access gate. Anonymous reads require both the public-profile server feature and an
enabled comparison row belonging to a currently public profile. Row deletion is
always available to its owner.

## 7. Verification

Contract tests must prove exact payload keys, explicit field selection, public-profile
dependency, owner-only writes, public withdrawal, missing-data behavior, no ranking
language, and zero raw-text or sensitive-field storage.

## 8. Open Issues

| Issue | Canonical blocker | Status | Required evidence |
| --- | --- | --- | --- |
| `OI-FRIEND-ABUSE-001` | YES | OPEN | Blocking, reporting, rate limiting, and broad discovery rules before search launch. |
| `OI-FRIEND-YOUTH-001` | NO | OPEN | Guardian and youth sharing UX verification using the existing account gate. |
| `OI-FRIEND-GROUP-001` | NO | OPEN | Separate consent and deletion contract before group comparison. |
| `OI-FRIEND-EFFECT-001` | NO | OPEN | No causal claim until prospective evidence exists. |

[DRAFT_COMPLETE]
