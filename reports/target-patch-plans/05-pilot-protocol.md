# P1 Target Patch Plan 05: Athlete-Visible Pilot Protocol

```yaml
issue_id: OI-FA-PILOT-PROTOCOL-001
approved: false
state: READY_FOR_OWNER_APPROVAL
readiness_class: READY_AFTER_NAMED_APPROVAL
classification: PROSPECTIVE_NON_EXECUTING_HUMAN_PARTICIPANT_PROTOCOL
runtime_authorized: false
canonical_spec_patch_authorized: false
owning_files:
  - `specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`
  - `specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`
  - `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`
  - `specs/active/APP_IMPLEMENTATION_BRIDGE.md`
owning_issues:
  - `OI-FA-PILOT-PROTOCOL-001`
  - `OI-AIB-GUARDIAN-CONSENT-001`
  - `OI-AIB-CONSENT-LEGAL-BASIS-001`
  - `PROPOSED-OI-AIB-SHADOW-PILOT-DATA-USE-001`
```

## Classification

Athlete-visible, voluntary, withdrawable, non-executing pilot. It measures process
feasibility/usefulness only and cannot establish safety or efficacy.

## Governing Decision

`FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md` leaves participant enrollment and
generation false. WO014 participant and independent-review forms are the review inputs.

## Exact Targets

Patch the four listed contracts after named review. Create the proposed App Bridge issue
at that exact target after recount, qualified legal/privacy review, and owner acceptance
of consent purpose, refusal behavior, withdrawal, retention, and guardian handling.

## Prerequisites

- Orders 011-013 accepted for pilot use.
- Named athlete, independent reviewer, safety adjudicator, and guardian where applicable.
- Accepted duration, baseline, cadence, stop/abort/resume criteria, retention, and deletion.

## Forbidden Work

No real-plan mutation, automatic execution, coercive reward, consent-linked streak,
silence-about-pain incentive, causal claim, safety claim, or participant enrollment now.

## Impact

Schema: future separate consent, progress, adverse event, withdrawal, and disposition.
API: future participant-visible read/withdraw/report surfaces. Runtime: not authorized.

## Baseline

The synthetic 37-scenario packet is complete; dependencies, named people, legal basis,
retention, rendered delivery, and actual pilot evidence are absent.

## RED

Fail scenarios for no separate consent, refusal disabling base journal, withdrawal not
deleting, reward tied to enrollment/load, adverse event without stop, and reviewer conflict.

## Patch Order

1. Record participant/legal/privacy and owner decisions in the protocol.
2. Finalize independent review, intervention, stop, resume, and disposition workflow.
3. Bind only non-coercive progress/check decoration.
4. Recount App Bridge and create the exact proposed issue.
5. Patch storage/API requirements without enabling runtime or enrollment.

## GREEN

All 37 synthetic scenarios and new consent/withdrawal/adverse-event cases pass; base
journal survives refusal; progress never implies compliance, load, safety, or efficacy.

## Manual QA

Named athlete reads plain Korean disclosure, refuses, joins, withdraws, reports harm,
and reviews disposition; independent reviewer verifies every action and copy state.

## Migration, Rollback, And Kill Switch

No migration now. Future pilot data uses a segregated retention namespace; withdrawal
triggers deletion workflow; `athleteVisibleShadowPilotEnabled=false` is the default switch.

## Privacy And Security Review

Qualified privacy/legal reviewers approve purpose, youth/guardian, retention/deletion,
access and incident handling; security reviewer checks isolation and unauthorized access.

## Closure Evidence

Named signatures, accepted protocol version/hash, scenario logs, rendered disclosures,
withdrawal/deletion proof, App Bridge diff/recount, review record, and closure PR.

## Human Decision

`COACH_HOJUNE` approves, revises, or rejects protocol duration and operating rules only
after named reviews. Current answer: NOT_RECORDED; plan unapproved and P1 OPEN.
