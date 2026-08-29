# OWNER_DECISION_DEVICE_INTEGRATION_APPLICATION_2026_08_29.md

```yaml
decision_id: TO-DECISION-DEVICE-INTEGRATION-2026-08-29
owner: COACH_HOJUNE
decision_status: APPROVED_FOR_APPLICATION_READINESS
approved_at: 2026-08-29
approved_scope:
  - Garmin Connect Developer Program application preparation and submission
  - COROS API application preparation and submission
  - public support and device-integration notice pages
  - fail-closed Supabase endpoint and schema readiness
not_approved_by_this_decision:
  - public user linking
  - production activity ingestion
  - provider token storage before an accepted encryption design
  - imported activity use in analysis or training-plan generation
  - automatic outbound workout publication
  - canonical spec promotion
  - legal or privacy expert approval
```

## 1. Decision

TrainOracle may apply for Garmin and COROS official developer access and may build the
minimum public pages, database boundaries, and fail-closed server endpoints required to
make those applications truthful and technically reviewable.

This decision does not activate automatic device linking for users. Provider approval,
issued credentials, provider-specific terms, explicit user consent, token protection,
disconnect deletion behavior, and runtime evidence remain separate gates.

## 2. Product Boundary

- Imported activity must enter a pending user-confirmation state.
- Unconfirmed activity must not affect analysis, statistics, safety disposition, or a
  generated training plan.
- Raw athlete notes, symptom clauses, location tracks, provider tokens, and complete
  provider payloads must not be written to ordinary logs or audit records.
- Device data cannot clear `D9_ACTIVE`, `D9_UNKNOWN`, RVE, or Safety Gate blocks.
- Outbound workouts, when separately approved, must be selected by the user and must not
  bypass TrainOracle safety gates.
- Online device linking remains unavailable to users under 14 while the current online
  account gate is in force.

## 3. Application-Readiness Meaning

`APPLICATION_READINESS` means that a reviewer can reach the support, status, callback,
and receiver URLs and that those endpoints fail closed while credentials are absent or
the feature switch is off. It is not evidence that a real Garmin or COROS account has
been linked, that activity has been received, or that a workout has been sent.

## 4. Final Human Gates

The product owner must confirm the exact representative spelling/title, contact details,
agreement acceptance, and CAPTCHA immediately before each external application is
submitted. A provider's approval does not replace TrainOracle's own legal, privacy,
security, or runtime acceptance gates.

[DECISION_COMPLETE]
