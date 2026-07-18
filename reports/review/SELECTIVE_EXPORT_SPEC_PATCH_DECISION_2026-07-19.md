# Selective Export Specification Patch Decision

```yaml
decision_id: TO-OWNER-SELECTIVE-EXPORT-SPEC-PATCH-2026-07-19
decision_class: OWNER_DIRECTION_IMPLEMENTATION
owner: COACH_HOJUNE
status: OWNER_DIRECTION_APPLIED_PENDING_INDEPENDENT_REVIEW
formal_privacy_acceptance: false
in_app_recipient_sharing_authorized: false
server_share_authorized: false
runtime_authority: false
P1_plans_approved: 0/10
```

## Owner Response Verbatim

> 메모를 코치에게나 친구나 다른 사람에게 보여주고 싶기도 하니까 선택사항으로 두자.
> 굳이 이렇게까지 막을 필요가 왜 있나 싶어. 이건 선택한거잖아. 선택하게하면 문제 없어

## Interpretation

The athlete may explicitly include either memo purpose in a local backup or selected
device-share file. Memo inclusion is off by default. The athlete must preview the exact
fields and confirm memo inclusion before the file is created or handed to the operating
system share surface.

File transport is separate from memo analysis purpose. Export or sharing does not grant
analysis consent, coach or guardian standing access, Formation input, plan authority,
safety authority, rewards, telemetry, server sync, or recipient-account access. The app
must not silently upload the file or preselect a recipient.

## Patched Files

- `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md`
- `specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md`
- `reports/review/FORMATION_SPEC_CONFLICT_REGISTER.csv`
- `reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md`
- matching fail-closed validators and contract tests

## Authority Boundary

This patch aligns specifications only. It does not accept privacy or legal compliance,
approve any P1 target plan, authorize in-app recipient sharing or a server share link,
activate Formation, change an athlete plan, enroll participants, or authorize runtime.
The app implementation remains owned by Fable and requires independent review before
the owner decides whether to merge it.

[END_DECISION]
