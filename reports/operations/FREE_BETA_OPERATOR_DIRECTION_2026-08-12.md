# TrainOracle Free Beta Operator Direction

```yaml
document_id: FREE_BETA_OPERATOR_DIRECTION_2026-08-12
date: 2026-08-12
status: ACTIVE_PRODUCT_DIRECTION
service_phase: FREE_BETA_UP_TO_200
runtime_change_authority: false
automatic_prescription_authority: false
payments_authority: false
```

## Purpose

This is the working direction for the first free beta. It makes the current product
intent easy to apply without treating a draft research contract as a live product rule.

## Product Direction

- The service operator decides when each product feature is opened or paused.
- There is no separate external-expert approval chain for this free-beta phase.
- Legal requirements for consent, guardian confirmation, privacy notices, and deletion
  still apply. They are implementation and service-operation requirements, not an
  external-product-approval ceremony.
- An incident pauses only the affected feature. The local journal remains available
  whenever possible.
- Automated prescription, numeric training-dose decisions, and activation of draft
  training templates remain off until a separate service-operator decision.

## Feature-Specific Response

| Incident area | Pause first | Keep available |
|---|---|---|
| private memo or another person's data exposure | sharing and sync | local journal and local backup |
| sync failure or suspected server data damage | sync | local journal and local backup |
| incorrect plan generation | plan proposal and plan activation | existing active plan and journal |
| guardian-confirmation bypass | affected minor account sync and sharing | minor's local journal |
| decoration or statistics defect | affected screen | logging and journal reading |

Use the existing feature controls and record the date, issue, fix, and reason for
reopening in `reports/operations/BETA_FEATURE_INCIDENT_LOG.md`.

## Current Release Boundary

| Capability | Current state | Notes |
|---|---|---|
| local journal, archive, backup, decoration | available | no account required |
| FAQ and in-app feedback route | available | feedback posting remains feature-gated |
| account sign-in and cloud sync | code-ready, not public | requires real service configuration and service notices |
| coach/support sharing and plan proposals | code-ready, not public | athlete confirmation remains required before activation |
| experimental fatigue view | not public | never a medical or safety decision |
| automatic prescription and numeric dose generation | not public | needs a later separate decision |
| payment, subscription, and ads | not public | first 200-person beta remains free |

## Next Low-Risk Work

1. Keep the free-beta FAQ aligned with the actual feature flags.
2. Exercise local save, reload, backup, restore, and plan retry paths on small mobile
   layouts before any account feature is opened.
3. Prepare the service configuration and mandatory notices for account release without
   placing credentials in source control.
4. Open account, sync, sharing, and product analytics independently, not as one switch.

## Explicitly Deferred Decisions

- Training intensity thresholds, numeric pace or workload prescriptions, and automatic
  selection among detailed templates.
- Whether an experimental combined fatigue view should be publicly available.
- Payments, subscription pricing, advertising, Garmin direct connection, and coach
  qualification verification.

[DIRECTION_COMPLETE]
