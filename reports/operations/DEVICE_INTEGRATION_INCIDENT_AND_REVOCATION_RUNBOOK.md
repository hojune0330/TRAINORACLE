# DEVICE_INTEGRATION_INCIDENT_AND_REVOCATION_RUNBOOK.md

```yaml
runbook_status: APPLICATION_READINESS_DRAFT
runtime_activation: false
owner_contact: hojune0330@gmail.com
feature_key: DEVICE_INTEGRATION
```

## 1. Trigger Conditions

Use this runbook for a suspected provider-secret leak, unauthorized activity receipt,
wrong-user mapping, webhook replay, failed disconnect, unexpected raw payload logging, or
provider/security notice.

## 2. Immediate Containment

1. Set `DEVICE_INTEGRATION` to false in `service_feature_controls` and record a structured
   change reason. Do not wait for root-cause confirmation.
2. Revoke or rotate the affected provider credential in the official provider portal and
   Supabase secret manager. Never paste the credential into an issue, chat, or log.
3. Confirm the public status endpoint still exposes no user or secret data.
4. Preserve only bounded technical evidence: timestamps, request IDs, affected provider,
   structured reason codes, and counts. Do not copy raw activity, GPS tracks, notes, or
   tokens into the incident record.

## 3. User And Provider Revocation

- Stop future processing before reporting a disconnect as complete.
- Mark the connection revoked and delete pending inbox rows for the affected connection.
- Provider tokens require a separately accepted encrypted-token implementation and must be
  revoked and deleted there when it exists.
- If deletion fails, retain an operator-visible failure state and continue blocking the
  feature.

## 4. Notification Gate

The privacy officer evaluates legal and provider notification duties immediately. Where
the accepted COROS agreement requires incident notice within 24 hours, use the official
COROS contact channel within that deadline. This draft does not decide legal reportability
or replace named privacy/legal review.

## 5. Reopening

Do not re-enable device integration until the defect is fixed, credentials are rotated,
remote privileges and logs are reviewed, regression tests pass, and the owner records a
new activation decision. Provider approval alone is not reopening authority.

[RUNBOOK_COMPLETE]
