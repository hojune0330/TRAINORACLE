# Formation Formal Approval Roster

```yaml
roster_id: TRAINORACLE_FORMATION_FORMAL_APPROVAL_ROSTER_V1
status: HANDOFF_READY_NO_HUMAN_REVIEWS_CAPTURED
source_main_sha: a6857bcdcd9f2989799c505f52773256ce492e14
actual_approver_count: 0
enrolled_key_count: 0
all_authority: false
runtime_authority: false
policy_acceptance: false
```

This is an assignment and response sheet, not an approval record. A role label, account,
team membership, document author, agent review, or repository permission grants no
authority. Every reviewer identity and key below is intentionally unassigned until a
real person completes the enrollment procedure in
`EVIDENCE_MANIFEST_AND_SIGNATURE_CONTRACT.md`.

## Owner-readable status

Allowed human response states are `APPROVE`, `APPROVE_WITH_REQUIRED_CHANGES`, `REJECT`,
and `NOT_REVIEWED`. Only a verified signature over the final evidence manifest can
change a row from `NOT_REVIEWED`.

| Order | Exact decision requested | Required real-person roles | Qualification evidence required | Current response | Identity | Key |
|---|---|---|---|---|---|---|
| WO010 | Strictly accept the bounded research packet for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `FABLE_INDEPENDENT_REVIEW` | Owner mandate; independent human review scope, conflict clearance, and current evidence-review competence | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |
| WO011 | Accept the privacy/governance packet for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `QUALIFIED_PRIVACY_REVIEWER` | Owner mandate; launch-jurisdiction youth/privacy competence, independence and current practice evidence | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |
| WO012 | Accept the coach ruleset and exposure contract for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `COACH_OWNER` | Owner mandate; current scoped coaching responsibility and relevant coaching competence | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |
| WO013 | Accept the calendar/version/sync contract for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `FABLE_INDEPENDENT_REVIEW` | Owner mandate; independence and documented technical review scope | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |
| WO014 | Accept the athlete-visible shadow protocol for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `COACH_OWNER`; `ATHLETE_REVIEW_PARTICIPANT`; `FABLE_INDEPENDENT_REVIEW` | Owner and coach evidence above; participant consent/assent and age-appropriate recruitment record; independent review evidence | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |
| WO015 | Accept the product projection and explanation contract for WO016 | `TOTAL_RESPONSIBILITY_HOLDER`; `COACH_OWNER`; `ATHLETE_REVIEW_PARTICIPANT`; `ACCESSIBILITY_REVIEWER`; `QUALIFIED_PRIVACY_REVIEWER` | Prior evidence plus current accessibility testing competence and declared review method | `NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED` |

The exact signed decision enums remain those in
`FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md`. A natural-language response is intake
only; it is not a strict acceptance record.

`FABLE_INDEPENDENT_REVIEW` is a legacy V1 enum label. It means a separate verified human
independent reviewer; the Fable AI/agent, document author, or persona can never occupy
that role. Renaming the enum requires a later versioned acceptance-schema decision.

## Prohibited inferences

- An AI/persona review is not an independent human review.
- Silence, attendance, merge, authorship, payment, account ownership, or an unchecked
  conflict declaration is not consent or approval.
- A qualification claim without issuer/date/scope/evidence reference is insufficient.
- The current V1 gate requires a different verified person and key for every required
  role within one order. A future multi-role exception needs an owner-approved V2 schema;
  one signature never satisfies two roles.
- `APPROVE_WITH_REQUIRED_CHANGES` is not acceptance. Re-review follows the final changes.
- No row authorizes runtime, prescription, safety clearance, sharing, or production use.

## Intake and conflict review

For each proposed reviewer, record legal/verified identity in the restricted trust store,
public roster ID, role, qualification evidence reference, evidence issuer/date/scope,
employment/financial/personal/design authorship relationships, recusal decision, reviewer
of that decision, and expiry. The reviewer cannot decide their own conflict outcome.
Unresolved, expired, self-reviewed, or concealed conflicts produce `NOT_REVIEWED`.

## Response lifecycle

1. Enroll identity and a dedicated Ed25519 public key under the signature contract.
2. Freeze a merged-`main` source SHA and non-circular evidence manifest.
3. Give the reviewer the exact packet, remaining risks, and decision question.
4. Capture one response per role. Required changes create a new evidence revision.
5. Verify signature, qualification, conflict status, key validity, scope, and timestamp.
6. Revoke compromised/departed keys immediately. A new decision explicitly supersedes
   the prior record; history remains append-only and no old signature is rewritten.

[DRAFT_COMPLETE]
