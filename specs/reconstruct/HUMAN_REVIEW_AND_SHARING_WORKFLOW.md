# Human Review And Sharing Workflow

```yaml
spec_id: HUMAN_REVIEW_AND_SHARING_WORKFLOW
status: READINESS_ONLY_BLOCKED_ON_GOVERNANCE
runtime_authority: false
in_app_delivery: false
latest_owner_direction_bound: true
qualified_human_acceptance: false
```

## Review

Reviewer A is the linked coach; Reviewer B is independent. Both receive the same
immutable redacted packet, declare conflicts, lock/sign without seeing the other's
verdict, and record source eligibility, exact versions, rule application, preserved
safety route, typed result, and clarification need. They do not choose or mutate the real
plan.

Disagreement is never averaged. A named third adjudicator may append a decision; without
one the result remains `UNRESOLVED` and completion stops. Records are append-only and
contain reviewer role, conflict declaration, packet digest, versions, verdict, time, and
adjudication ref, never raw note or reason detail.

## Sampling And Independence

This proposed three-frame pilot uses no statistical sampling: Reviewer A and Reviewer B
independently review the baseline packet and every frame packet (`4/4` checkpoints). All
synthetic critical, sharing, and reviewer fixtures are also reviewed; a convenient or
favorable subset is invalid. A later larger pilot needs a separately accepted sampling
plan and cannot inherit this rule silently.

Reviewer B cannot be the linked coach, athlete, guardian, candidate/rule author, product
operator who created the packet, or a person with a financial, supervisory, family, or
selection interest in the outcome. Both reviewers declare conflicts before packet
access. A conflict means the verdict is not independent and cannot count toward
completion.

Reviewer C, when needed for adjudication, must be named, conflict-free, independent of
Reviewers A and B, and must not have authored the candidate, rule, packet, or disputed
verdict. C sees the two locked verdicts only after recording the independence and
conflict declaration. A conflicted or missing C leaves the result `UNRESOLVED`; the owner
or linked coach cannot substitute a silent tie-break.

Packet-quality thresholds are 100% critical privacy/safety/nonmutation/withdrawal pass,
100% typed frame results, 100% complete review records, and 100% explicit disagreement
handling. These are process thresholds, not safety or efficacy evidence.

Review feedback may append `CONFIRM_PROCESS`, `REQUEST_ALLOWED_CLARIFICATION`,
`PROPOSE_SOURCE_CORRECTION`, or `UNRESOLVED`. It cannot edit the frozen packet, resume a
paused protocol, clear safety state, or select/change a real plan. Resume authority stays
with the separate rules in `ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md`.

## Sharing

Private notes are never eligible for analysis. Raw training-note text is not delivered by
default. A later recipient-share flow may include either note type only when the athlete
separately turns memo inclusion on in the same preview. The athlete must select exact
recipient, exact structured fields, purpose, one-time/expiry, preview, and confirmation.
No default recipient, role inference, auto-notification, or blanket journal grant exists.

Memo purpose and file transport are separate choices. `PRIVATE_SELF_ONLY` always stays
zero-signal for analysis even when its owner explicitly includes it in a local backup or
recipient share. `ANALYZABLE_TRAINING_NOTE` analysis requires its own explicit purpose choice;
backup or sharing neither grants nor revokes that analysis choice. Recipient transport grants
no standing access, Formation, plan, safety, reward, telemetry, or other secondary-use authority.

Order 011 currently blocks in-app coach/guardian/friend delivery, so every synthetic
share case ends `HOLD_PENDING_RECIPIENT_CONTRACT`. The athlete may independently show or
send a locally created owner backup; the app does not track or convert that action into
permission.

Pain sharing does not grant plan, journal, shadow, or note access. Reviewer feedback
creates a separate correction proposal and cannot silently change a candidate or plan.

[DRAFT_COMPLETE]
