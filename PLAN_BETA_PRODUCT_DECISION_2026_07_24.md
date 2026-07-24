# PLAN_BETA_PRODUCT_DECISION_2026_07_24.md

```yaml
decision_id: TO-DEC-PLAN-BETA-2026-07-24-001
product: TrainOracle
service_provider: aaclub
decision_owner: COACH_HOJUNE
status: OWNER_DIRECTED_BETA_IMPLEMENTATION
implementation_target: PUBLIC_GITHUB_PAGES_BETA
source_specs_remain_authoritative: true
canonical_spec_promotion: false
open_issue_closure: false
```

## 1. Beta Outcome

TrainOracle opens a real training-plan beta in addition to the local journal.
A visitor may start with a plan even when no journal exists, compare distinct
candidate plans, select one, and record progress against the selected plan.

This decision authorizes a bounded beta implementation. It does not declare the
Formation draft canonical, accept unresolved physiological formulas, or turn
`D9_CLEARED` into medical clearance.

## 2. Entry Paths

- `PLAN_FIRST`: start a plan without writing a journal first.
- `JOURNAL_FIRST`: keep the current one-minute journal path.
- `JOURNAL_CONTEXT_PLAN`: note that recent valid session entries exist, but do
  not claim that their values alter beta prescriptions.
- `PROFILE_ONLY_PLAN`: use only the minimum structured profile when journal
  coverage is absent or insufficient.

`PROFILE_ONLY_PLAN` is allowed only after the current D9/RVE/Safety Gate path
allows generation. It must display limited confidence and must not invent pace,
training load, or longitudinal history.

## 3. Minimum Plan Intake

The first beta asks only for:

1. goal/event group;
2. experience band;
3. available training days;
4. requested frame length;
5. a structured current-risk check.

Frame length defaults to 9 or 10 days. A user may explicitly request 7 days.
A 7-day plan remains part of a continuing plan lineage: the selected candidate
and recorded progress become structured input for the next frame instead of
resetting into unrelated calendar weeks.

## 4. Candidate And Selection Policy

- Emit `BALANCED` then `CONSERVATIVE` when generation is allowed and both are
  feasible.
- Keep candidate order deterministic.
- Sparse-data plans prefer duration and RPE ranges over exact pace.
- Candidate copy must state source mode and confidence.
- The athlete may select a candidate when self-selection is allowed.
- A linked-coach policy may require coach selection; self-selection then fails
  closed.
- Selection creates a local immutable beta active-plan snapshot.

## 5. Safety And Privacy

- `D9_ACTIVE` blocks generation.
- `D9_UNKNOWN` blocks generation or requires human review.
- Favorable journals, templates, rewards, or profile answers cannot clear an
  existing block.
- A recent structured pain level of 4 or 5, or an analyzable memo that maps to
  `D9_ACTIVE`/`D9_UNKNOWN`, blocks candidate generation even after a favorable
  current check.
- Blocked output contains no hidden sessions or alternative plan.
- Raw memo and symptom clauses are not plan inputs, reward inputs, telemetry,
  or audit payloads.
- Current beta persistence is browser-local and must say so plainly.

## 6. Return Motivation

The beta may award non-economic, browser-local Oracle Points for:

- one daily visit;
- one or more eligible journal records on a distinct day.

Rest-day and pain/injury check-ins count as journal days. Distance, pace,
training load, hard-session completion, safety clearance, consent, and obeying a
generated plan never increase points. Points are never removed for a missed day,
rest, pain report, plan pause, or withdrawal.

Initial beta values:

```yaml
oracle_points:
  daily_visit_once: 1
  eligible_journal_day: 4
  monetary_value: none
  purchasable_advantage: none
  server_sync: false
```

The first beta shows points and safe recording continuity. Decoration purchases,
cash value, leaderboards, and paid advantages remain out of scope.

## 7. Honest Beta Limits

The public beta may provide locally generated candidates and local progress
tracking. It does not yet provide account sync, payment, remote coach approval,
medical judgment, journal-value-driven prescriptions, or production-grade
adaptive replanning.
