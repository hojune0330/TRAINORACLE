# Coach Team And Microcycle View Decision

```yaml
decision_id: TO-WO012-COACH-VIEW-2026-07-16
status: PROPOSAL_BLOCKED_ON_ORDER_011
owner: COACH_HOJUNE
source_commit: 5c4673fc968d3e8b8ae22f50837eded7678594f0
review_role: INTERNAL_READINESS_REVIEW_ONLY
runtime_authority: false
team_view_authority: false
```

## Proposed View

- The named local-civil 9.5-day frame is the coaching/accounting view.
- The seven-day Monday calendar remains presentation and scheduling context only and
  must be labeled `calendar week`; it does not reset or redefine the frame.
- The first pilot shows one linked athlete only. Team aggregation, peer ranking,
  percentile, and comparison are unavailable.
- Every row shows athlete, named frame, plan version, as-of time, source freshness,
  action state, and whether it is fact, proposal, review, or accepted plan.
- Planned and completed exposure totals are separate; the surface never adds them.
- Corrections append a scoped new version and audit event. Prior accepted history and
  original classifier labels remain visible to authorized audit roles.

## Access Boundary

No coach view is enabled until Order 011 accepts athlete/team scope, purpose, grant,
expiry, revocation, youth handling, audit, retention, and private-note zero-signal. A
coach can never see `PRIVATE_SELF_ONLY`, raw analyzable notes, note existence, or
note-derived reasons. An expired, revoked, wrong-athlete, wrong-team, or missing grant
returns a generic unavailable state and no athlete facts.

## Required Coach-Owner Walkthroughs

The owner must record a binary expected result for normal two-MAIN, normal three-MAIN,
race anchor, missed MAIN, active/unknown safety, stale source, composite session,
unknown exception, re-anchor, DST boundary, exact frame-end exposure, unauthorized
team access, and append-only correction cases. Current documents supply expected
fail-closed mechanics but do not supply owner approval.

## Remaining Decision

Order 011 qualified review and owner walkthrough acceptance are required before this
proposal can change `R-coach-003` or authorize a surface. Calendar/version mechanics
remain owned by Order 013.

[PROPOSAL_ONLY]
