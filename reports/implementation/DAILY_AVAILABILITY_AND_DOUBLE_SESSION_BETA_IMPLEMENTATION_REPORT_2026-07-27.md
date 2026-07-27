# DAILY_AVAILABILITY_AND_DOUBLE_SESSION_BETA_IMPLEMENTATION_REPORT_2026-07-27.md

```yaml
report_metadata:
  report_id: trainoracle-implementation-daily-availability-double-session-beta-2026-07-27
  title: Daily Availability And Double Session Beta Implementation Report
  status: IMPLEMENTATION_READY_FOR_REVIEW
  owner: COACH_HOJUNE
  runtime_evidence_claim: local_test_and_browser_evidence_only
  canonical_promotion_allowed: false
  numeric_template_activation_authorized: false
```

## 1. What Changed

The public TrainOracle plan beta now asks an athlete three additional things
before it creates two selectable candidates:

1. Whether they can move on 3, 4, 5, 6, or every day in the selected 7-, 9-,
   or 10-day frame. Recovery movement counts as an available day; a fully off
   day does not.
2. Whether the athlete wants one session per day or constrained AM/PM support.
3. The existing training intent, which can be BASE, LT, VO2, GLY, ATP-PC, or
   recovery. The beta still uses duration and RPE only.

`EVERY_DAY` does not add high-intensity days. Existing quality-session rules
remain unchanged.

## 2. Double-Session Behavior

The feature is deliberately narrow:

- It is off by default and requires an explicit athlete choice.
- The Balanced candidate can add only one PM recovery session in a 7-day frame
  or two in a 9- or 10-day frame.
- A PM session is always `EASY` plus `RECOVERY_INTENT`, `RPE 1-2`, and an
  experience-banded duration range.
- PM cannot appear on a quality day. The app cannot create two high-intensity
  sessions on one beta day or move a missed session later.
- Candidate and active-plan views show `DAY n · 오전` and `DAY n · 오후`.
  Progress is stored by both fields, so an AM record cannot overwrite a PM
  record.
- Older local plans load as AM-only single-session plans. They do not acquire
  a PM session or inferred consent.

This is a local ordinal beta display, not a civil-date calendar projection,
`DOUBLE`/`FLEX` crosswalk, medical recovery decision, or numeric prescription.

## 3. User-Facing Explanation

The availability prompt is now:

> 이번 계획에서 운동할 수 있는 날은 며칠인가요?

It explains that walking, very easy jogging, cycling, and similar recovery
movement count, while fully off days do not. The new second-session question
has a nearby `?` explanation and says plainly that an afternoon session is
`RPE 1-2`, not high intensity or make-up work.

The RPE help now distinguishes:

- `RPE 1-2`: brisk walking, very easy jogging, easy cycling, or gentle uphill
  walking with comfortable breathing.
- `RPE 3-4`: basic aerobic work where sweat is possible and conversation or a
  phone call remains possible.

## 4. Verification Performed

| Check | Result |
|---|---|
| `impl` TypeScript typecheck | PASS |
| `impl` full test suite | PASS, 92 tests |
| `app` TypeScript typecheck | PASS |
| `app` full unit suite | PASS, 299 tests |
| `app` full Playwright suite | PASS; no failure artifacts after the 164-test cross-viewport run |
| Detailed prescription catalog validator | PASS, `30/30` inert draft entries |
| Training schedule research acceptance validator | PASS, 60 public rows and 24 paper candidates; runtime authority remains disabled |
| Manual Playwright visual check | PASS at 375x812 and 1280x900; no horizontal overflow, PM labels and high-intensity RPE visible |

The expected error-boundary test logs emitted by the app unit suite are part of
that suite's deliberate failure-boundary coverage, not a failed test result.

## 5. Preserved Boundaries

- D9 ACTIVE and UNKNOWN continue to block plan creation or require human
  review.
- D9 CLEARED is not medical clearance.
- No raw memo, symptom clause, or evidence clause is added to plan progress or
  audit data.
- The detailed template catalog remains draft-only. This change does not expose
  repetitions, distance, pace, or recovery intervals as personal prescriptions.
- Dedicated 100m, 200m, and 400m planning remains deferred.

## 6. Documents And Next Gate

`specs/reconstruct/DOUBLE_SESSION_BETA_SAFETY_CONTRACT.md` records the local
AM/PM invariants and three open upstream issues. It is `DRAFT_FOR_REVIEW` and
does not resolve the existing calendar crosswalk, safety-hold integration, or
numeric-template eligibility work.

The next detailed-prescription task is not to turn on all 30 catalog entries.
It is to prepare one review packet for one non-sprint event and experience
scope: exact source extraction, Template Library ID/version, eligibility,
youth policy, anchor freshness/provenance, warm-up/cooldown, downshift and
stop conditions, reviewer evidence, then an explicit owner decision. Until
then, the RPE-and-duration beta remains the active public boundary.

[DRAFT_COMPLETE]
