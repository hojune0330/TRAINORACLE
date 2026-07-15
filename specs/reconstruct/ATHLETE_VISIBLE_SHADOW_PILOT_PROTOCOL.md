# Athlete-Visible Shadow Pilot Protocol

```yaml
spec_id: ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL
version: 0.1
status: READINESS_DRAFT_BLOCKED_ON_011_012_013_AND_NAMED_REVIEW
runtime_authority: false
participant_enrollment: false
hidden_shadow: forbidden
```

## Meaning

Shadow is a disclosed sandbox comparison created after source facts are frozen. It
cannot write the real calendar, accepted plan, notification, or coach instruction.
Three frames (28.5 local-civil days) is a proposal, not an accepted duration.

## Lifecycle

The closed lifecycle enum is `DRAFT | OFFERED | REFUSED | SEPARATELY_CONSENTED |
BASELINE_PENDING | FRAME_1 | FRAME_2 | FRAME_3 | FINAL_REVIEW |
COMPLETED_PENDING_DISPOSITION | PAUSED | WITHDRAWN | ABORTED`.

Normal transitions are `DRAFT -> OFFERED`, `OFFERED -> REFUSED` or
`OFFERED -> SEPARATELY_CONSENTED`, `SEPARATELY_CONSENTED -> BASELINE_PENDING`,
`BASELINE_PENDING -> FRAME_1 -> FRAME_2 -> FRAME_3 -> FINAL_REVIEW`, and
`FINAL_REVIEW -> COMPLETED_PENDING_DISPOSITION`. `REFUSED`, `WITHDRAWN`, and `ABORTED`
are terminal. `COMPLETED_PENDING_DISPOSITION` freezes processing and accepts only the
separate disposition field defined below; it does not transition into an executing
state.

Any enrolled nonterminal state may transition to `PAUSED`, `WITHDRAWN`, or `ABORTED`
when its declared rule applies. A pause record stores the exact prior state. A valid
append-only resume decision may return only to that prior state; it cannot skip a frame
or checkpoint. Every state displays `비교용 · 실제 계획에 반영되지 않음`.

Each frame ends with `CANDIDATE`, `NO_CANDIDATE`, `BLOCKED`, or `INSUFFICIENT_DATA`
plus separate human review. Completion means the comparison step was recorded, not
safety, efficacy, prediction accuracy, plan completion, or coach approval.

## Baseline

The baseline is a reproducibility checkpoint, not a performance target or a statement
about what is normal, safe, or effective. Before frame 1, one immutable baseline packet
must freeze:

- exact athlete-scope, frame, local time-zone, source-cutoff, and consent identities;
- exact source, provenance, rule-registry, classifier, safety-epoch, and schema versions;
- observed/missing/conflicting fields without zero filling or imputation; and
- packet digest and creation time.

Private-note content, presence, metadata, or a note-derived positive clearance signal is
never part of the packet. A missing, stale, conflicting, or version-mismatched baseline
leaves the lifecycle at `BASELINE_PENDING`; it cannot silently inherit a prior baseline.

## Monitoring Cadence

This proposal has four scheduled checkpoints: baseline review before frame 1, then one
checkpoint after each of the three frame closes. A frame checkpoint freezes the typed
result first and then obtains the two independent review records defined in
`HUMAN_REVIEW_AND_SHARING_WORKFLOW.md`. The next frame may be observed only after the
previous checkpoint is complete. An incomplete checkpoint becomes `PAUSED`, and no next
frame is observed until the accepted resume path records a valid resume decision.

Consent withdrawal, safety-review state, adverse report, privacy/security event, source
or version invalidation, and reviewer conflict are event-driven checks and do not wait
for frame close. Shadow is not emergency or continuous health monitoring. A missed
scheduled checkpoint pauses progress; it never backfills, compresses, or awards a mark.

## Participation

`SHADOW_PILOT_DATA_USE` is separate opt-in with no preselection or bundling. Before
enrollment the athlete must understand purpose, exact structured data, private/raw-note
exclusion, simulation status, zero real-plan effect, proposed duration, human reviewers,
and pause/withdraw/delete paths.

Refusal preserves the full base journal and creates no reward, visibility, or feature
penalty. Withdrawal stops new optional processing at the action boundary; deletion and
retention stay pending Order 011. Youth guardian consent and athlete assent are separate;
athlete refusal stops optional shadow under the owner guardrail.

Enrollment requires a four-part comprehension check. The athlete must correctly confirm
that this is a simulation, it cannot change the real plan, only the disclosed structured
categories are eligible, and participation can be paused or withdrawn. Fewer than four
correct confirmations returns to explanation; it never creates consent or shadow state.

## Progress And Acknowledgment

Allowed: `비교 준비 중`, `1/3 비교 기록 완료`, `잠시 멈춤`, `참여 종료`.
Forbidden: pass, success, safe, effective, improved, compliant, good athlete, or plan
completion. A frame mark is information, not money or collection reward. Journal
stickers may acknowledge writing, rest, pain, or injury reporting equally. Consent,
continued participation, distance, speed, load, pain silence, and obedience are never
reward conditions; withdrawal removes no existing sticker.

## Stop Rules

Immediate `ABORTED`: real-plan/calendar write; automatic network share/notification;
private-note signal; scope/version/consent mismatch; hidden/bundled enrollment; misleading
real-instruction copy; exposed audit detail; security incident.

`PAUSED`: active/unknown safety review, stale/missing source, reviewer unavailable or
conflicted, athlete pause, guardian dispute, distress/adverse report. Coach override
cannot silently resume. Adverse records contain only minimum structured code/time/action,
not diagnosis, causal claim, or narrative.

Stop severity is process-based, not a medical diagnosis:

- `S0_DATA_OR_REVIEW`: missing/stale/conflicting source, missed checkpoint, or reviewer
  unavailable pauses processing.
- `S1_SAFETY_OR_DISTRESS`: active/unknown safety review, athlete distress, or an adverse
  report pauses processing and shows non-diagnostic human-support guidance. It does not
  notify a recipient automatically.
- `S2_CRITICAL_PROTOCOL`: attempted real-plan mutation, private-data exposure, hidden or
  bundled enrollment, unauthorized delivery, security incident, repeated adverse event
  after an unresolved pause, urgent-support report, or coercive/misleading operation
  aborts the protocol.
- `S3_PARTICIPANT_EXIT`: withdrawal ends optional processing without penalty.

Resume requires a new append-only resume decision. The athlete may request it, but active
consent, exact current versions, resolved pause cause, conflict-free independent review,
and owner authorization must all be present. A safety-related pause also requires the
accepted human-review release path. The linked coach alone, a guardian alone, favorable
data, silence, or elapsed time cannot resume. Invalid resume attempts are rejected and
recorded without athlete payload. `ABORTED` and `WITHDRAWN` never resume.

## Uncertainty

Every non-candidate result uses one or more closed reasons:
`MISSING_SOURCE`, `STALE_SOURCE`, `CONFLICTING_SOURCE`, `UNVERIFIED_SOURCE`,
`CONSENT_RESTRICTED`, `SAFETY_REVIEW_REQUIRED`, `VERSION_MISMATCH`, or
`REVIEW_UNAVAILABLE`. Unknown values are not imputed and do not inherit a favorable
prior value. Uncertainty yields `INSUFFICIENT_DATA`, `BLOCKED`, or `PAUSED`; it never
creates a candidate by fallback or a progress claim.

## Usefulness And Feasibility

The proposed process gate requires all of the following:

- comprehension check `4/4` before enrollment;
- simulation/no-plan-effect disclosure visible at `100%` of protocol states;
- a typed result, including a typed no-result, for `100%` of observed frames;
- complete locked review records and explicit disagreement handling for `100%` of
  reviewed frames;
- zero real-plan/calendar writes, unauthorized deliveries, private-note signals, hidden
  enrollment, withdrawal penalties, or silent resumes; and
- withdrawal stopping new optional processing at the same action boundary.

Athlete and coach feedback asks only whether the comparison was understandable,
reviewable, confusing, or easy to distinguish from the real plan. Results are reported
descriptively. With one proposed participant and three frames, no percentage, agreement
rate, or favorable answer proves usefulness, safety, effectiveness, or prediction.

## Post-Pilot Disposition

After final review, new processing stops and the packet enters
`COMPLETED_PENDING_DISPOSITION`. The owner records exactly one non-executing outcome:
`REJECT_PROTOCOL`, `REVISE_AND_REPEAT_SYNTHETIC`, or
`ELIGIBLE_FOR_SEPARATE_PILOT_DECISION`. None activates runtime, changes the real plan, or
promotes a rule.

Shadow artifacts remain `FROZEN_NO_FURTHER_PROCESSING` until Order 011 supplies an
accepted retention/deletion disposition. A deletion request becomes
`DELETE_REQUESTED_PENDING_GOVERNANCE`; it is not falsely reported complete. The base
local journal remains governed separately. Any later pilot or runtime requires a new
owner decision with accepted prerequisite SHAs and cannot reuse this consent.

## Current Blockers

Orders 011-013 are unaccepted, no named athlete participant or independent reviewer
exists, duration is unaccepted, and no runtime or deletion policy exists. Synthetic
scenario design is the maximum current authority.

[DRAFT_COMPLETE]
