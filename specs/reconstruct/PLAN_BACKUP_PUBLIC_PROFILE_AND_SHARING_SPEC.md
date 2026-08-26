# PLAN_BACKUP_PUBLIC_PROFILE_AND_SHARING_SPEC.md

```yaml
doc_id: PLAN_BACKUP_PUBLIC_PROFILE_AND_SHARING_SPEC
spec_id: TO-PLAN-PUBLIC-SHARING
title: Plan Backup, Public Profile, and Friend Sharing Contract
version: 0.1
round: RT1_IMPLEMENTATION_ALIGNMENT
status: RECONSTRUCTED_DRAFT_FOR_REVIEW
owner: TrainOracle
open_issues_total: 5
canonical_blocking_count: 3
```

## 1. Purpose

This contract separates three product capabilities that must not be confused:

1. private account backup of a validated active training plan;
2. an athlete-controlled public profile;
3. a bounded plan-summary card that the athlete can share with friends.

Coach/support connections remain governed by the existing support and plan-proposal contracts. A public profile or friend link never grants coaching authority, journal access, or plan mutation authority.

## 2. Owner Decisions

| Decision | Rule |
|---|---|
| Plan server persistence | A locally validated v3 active plan may be backed up to the signed-in athlete account. |
| Restore | Server restore is allowed only when the current account has no valid local active plan. |
| Archive | An archived local plan must not be restored as active. Local archive intent remains authoritative if the network request fails. |
| Public default | Profile and plan cards are private by default. |
| Athlete control | The athlete may create, publish, unpublish, and share their own profile and bounded plan card. |
| Public plan detail | Detailed prescriptions, session instructions, pace targets, rationale payloads, journals, pain, mood, sleep, and memo text are forbidden from the public card. |
| Friend sharing | Native device sharing or a copied profile URL may be used. Sharing does not create a relationship or authority record. |
| Minor accounts | An eligible signed-in athlete uses the same explicit opt-in controls; no public state may be inferred from age or account creation. |

## 3. Private Plan Backup Contract

```yaml
source:
  schema: planBetaStateV3Schema
  accepted_version: 3
  validation_required_before_upload: true

ownership:
  local_account_must_match_authenticated_user: true
  cross_account_restore: forbidden

write:
  automatic_after_local_save: true
  automatic_after_progress_change: true
  local_save_must_not_fail_when_network_backup_fails: true

restore:
  only_when_no_valid_local_active_plan: true
  archived_plan_restore: forbidden

server_gate:
  client_flag: PLAN_BACKUP
  server_feature: PLAN_BACKUP
```

The server backup is not a new generated plan, medical prescription, coach proposal, or canonical promotion. It is a private account copy of the already validated local plan state.

## 4. Public Profile Contract

The public profile contains only:

- a unique lowercase handle;
- a display name chosen by the athlete;
- one allowlisted introduction tag;
- an explicit `is_public` value.

Free-form profile biography is forbidden. Email, phone, birth date, account UUID, journals, private notes, pain, mood, body state, records, and account provider must not be rendered on the public page.

Turning public visibility off must make the profile and its cards unavailable to anonymous viewers without deleting the athlete's private account.

```yaml
server_gate:
  client_flag: PUBLIC_PROFILE
  server_feature: PUBLIC_PROFILE
  must_not_enable:
    - SHARING
    - PLAN_PROPOSALS
```

## 5. Public Plan Card Contract

The public plan card is an allowlisted projection. Exactly these semantic fields may be published:

- title;
- event label;
- frame length in days;
- quality-session count;
- completed-session count;
- total-session count;
- a short progress badge label.

The card must not contain or derive a public representation of:

- detailed prescriptions or notation;
- pace targets or performance records;
- energy-system rationale details;
- journal values;
- pain, symptom, mood, sleep, or body-state values;
- memo, comment, or evidence text;
- D9 reason codes or safety snapshots.

## 6. Safety and Authority Boundaries

- Public sharing cannot clear or alter D9 state.
- A friend cannot activate, modify, or recommend an athlete plan through a public link.
- A public profile is not proof of identity, age, qualification, affiliation, or performance.
- A shared completion count is self-recorded product data, not a verified competition result.
- Server or client sharing kill switches must hide public content without requiring data deletion first.
- `PLAN_BACKUP` must not open coach plan proposals, and `PUBLIC_PROFILE` must not open coach/guardian sharing.

## 7. Failure Behaviour

| Failure | Required outcome |
|---|---|
| Plan backup unavailable | Keep the validated local plan and retry on a later plan view or progress update. |
| Server restore malformed | Reject it and leave local state unchanged. |
| Archive request fails | Preserve the local archive marker and never restore that plan as active. |
| Late backup finishes after archive | The backup must not clear `archived_at` or make that plan restorable. |
| Handle conflict | Keep the previous profile and ask the athlete to choose another handle. |
| Share cancelled | Keep visibility unchanged and report cancellation without claiming success. |
| Sharing server gate closed | Anonymous profile and card reads return no public data. |

## 8. Open Issues

| Issue ID | Description | Status | Canonical blocking |
|---|---|---|---|
| OI-PPPS-RUNTIME-001 | Apply migration and verify private plan backup on the trial Supabase project. | OPEN | YES |
| OI-PPPS-PUBLIC-RLS-001 | Verify anonymous public read and immediate hide after unpublish. | OPEN | YES |
| OI-PPPS-DELETE-001 | Verify account deletion cascades through plan backups, profiles, and cards. | OPEN | YES |
| OI-PPPS-ABUSE-001 | Define handle/report/rate-limit operations before broad public discovery. | OPEN | NO |
| OI-PPPS-HISTORY-001 | Decide whether archived plan history should be restorable as history, never active state. | OPEN | NO |

[DRAFT_COMPLETE]
