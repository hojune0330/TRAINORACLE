# PLAN_ACCOUNT_PERSISTENCE_STATUS_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-spec-plan-account-persistence-status-v1
  spec_id: PLAN_ACCOUNT_PERSISTENCE_STATUS_CONTRACT
  title: TrainOracle Plan Account Persistence Status Contract
  version: "1.0"
  round: RT1_IMPLEMENTATION_BOUNDARY
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  open_issues_total: 3
  canonical_blocking_count: 2
  executed_tests_total: 0
  production_execution_allowed: false
  canonical_promotion_allowed: false
  final_marker_required: DRAFT_COMPLETE_AT_END
```

---

## 1. Purpose

This draft defines the athlete-facing truth boundary for an active plan stored on the
current device and, when separately enabled, in the signed-in account. It does not open
account, sync, sharing, plan backup, or public-profile features and does not replace the
account release gate.

---

## 2. Persistence States

| State | Athlete-facing meaning |
|---|---|
| `DEVICE_ONLY` | The active plan is stored on this device only. |
| `CHECKING` | The device plan is usable while account storage is being checked. |
| `SAVING` | The device write succeeded and an account backup is in progress. |
| `SAVED` | The validated active plan is stored on this device and the signed-in account. |
| `FAILED` | The device plan remains usable, but the account backup did not complete. |

`SAVED` may be shown only after the current authenticated account matches the local
account scope and the server upsert succeeds. Feature availability alone is not proof
of account storage.

---

## 3. Required Behaviour

1. Local plan activation and progress storage remain the primary interactive write.
2. Account backup starts only when `PLAN_BACKUP` is enabled and a local account scope
   exists.
3. A failed account backup must not roll back, hide, or corrupt the valid device plan.
4. A failed account backup must be visible and offer an explicit retry.
5. Repeated plan changes may create overlapping requests, but only the newest attempt
   may update the visible persistence state.
6. Plan selection must not start an untracked duplicate backup before the active-plan
   screen owns the persistence state.
7. Restored server payloads must pass the current v3 plan schema before replacing an
   empty device state.
8. Archived plan identifiers remain ineligible for restoration or later backup.

---

## 4. Data Boundary

The plan backup may contain only the validated active plan state already permitted by
the plan schema. Raw journal memo text, `PRIVATE_SELF_ONLY` content or metadata, raw
symptom clauses, email, phone number, name, and provider tokens are forbidden.

Plan backup cannot clear D9 or Safety Gate state, approve a detailed prescription,
increase load, create a coach relationship, publish a profile, or share a diary.

---

## 5. Open Issues

| Issue ID | Canonical blocking | Status | Required evidence |
|---|---:|---|---|
| `OI-PAPS-PRODUCTION-RLS-001` | YES | OPEN | Applied migration receipt plus two-account RLS and deletion lifecycle test |
| `OI-PAPS-TWO-DEVICE-001` | YES | OPEN | Real two-device save, progress, archive, restore and stale-write convergence evidence |
| `OI-PAPS-OFFLINE-RETRY-001` | NO | OPEN | Offline-to-online retry UX and bounded retry policy review |

No issue is closed by this draft or by local tests.

---

## 6. Required Verification

- device-only, saving, saved and failed copy matches the actual state;
- failure exposes a retry without removing the device plan;
- an older request cannot overwrite the status of a newer request;
- account mismatch and malformed payload fail closed;
- archived plans do not reappear;
- account, sync and sharing feature flags remain independently controlled;
- no secret or private memo data is added to the plan payload.

[DRAFT_COMPLETE]
