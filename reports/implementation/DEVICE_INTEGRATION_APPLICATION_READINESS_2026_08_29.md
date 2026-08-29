# DEVICE_INTEGRATION_APPLICATION_READINESS_2026_08_29.md

```yaml
report_status: FUNCTIONS_AND_FAIL_CLOSED_SCHEMA_DEPLOYED_VERIFIED
base_sha: d3919c09c00c2ef010d49966ca0baa67bb2dde6f
branch: codex/garmin-coros-integration-readiness
provider_applications:
  garmin: NOT_SUBMITTED
  coros: NOT_SUBMITTED
public_user_linking: DISABLED
production_ingestion: DISABLED
provider_tokens_stored: false
supabase_functions:
  device_integration_status: DEPLOYED_VERIFIED_200
  coros_oauth_callback: DEPLOYED_VERIFIED_FAIL_CLOSED
  coros_workout_push: DEPLOYED_VERIFIED_503_UNCONFIGURED
remote_migrations:
  0029_plan_backup_public_profiles: APPLIED_HISTORY_REPAIRED_AFTER_EXACT_CATALOG_AUDIT
  0030_device_integration_readiness: APPLIED_VERIFIED
remote_feature_values:
  PLAN_BACKUP: true
  PUBLIC_PROFILE: true
  DEVICE_INTEGRATION: false
```

## 1. What Is Ready Locally

- Owner application-readiness decision and external-integration draft v0.2.
- Public support page and a separate device-integration privacy notice.
- Default-off database feature key, service-only connection mapping, and bounded activity
  inbox with no provider-token columns or raw provider payload.
- Public status endpoint, fail-closed COROS callback, and authenticated/idempotent COROS
  workout receiver.
- Executable contract tests for issue recount, final marker, raw-field dropping, malformed
  batch rejection, digest comparison, RLS/service-role boundary, and truthful public copy.

## 2. Intended Public URLs

The three Supabase URLs below were checked after deployment. The GitHub Pages URLs remain
intended values until this branch is merged and the Pages release is verified.

| Purpose | URL |
|---|---|
| Application URL | `https://hojune0330.github.io/TRAINORACLE/` |
| Support URL | `https://hojune0330.github.io/TRAINORACLE/support.html` |
| Device notice | `https://hojune0330.github.io/TRAINORACLE/legal/device-integrations.html` |
| Service status | `https://texspxlpjungyarkvtkc.supabase.co/functions/v1/device-integration-status` |
| COROS callback | `https://texspxlpjungyarkvtkc.supabase.co/functions/v1/coros-oauth-callback` |
| COROS workout receiver | `https://texspxlpjungyarkvtkc.supabase.co/functions/v1/coros-workout-push` |
| Authorized callback domain | `texspxlpjungyarkvtkc.supabase.co` |

## 3. Requested Provider Scope

### Garmin

- Activity API: user-authorized activity summaries and official activity files.
- Training API: only a workout or training plan explicitly selected by the user.

### COROS

- One-way activity/workout data sync from COROS to TrainOracle.
- Structured workouts and training plans from TrainOracle to COROS after a later release
  gate.
- No Daily Data API, Bluetooth, ANT+, advertising use, resale, medical interpretation, or
  unrelated model training.

## 4. Application Facts Already Verified In The Repository

| Field | Value |
|---|---|
| Product | TrainOracle |
| Legal operator | `인피니트 오퍼튜니티` |
| Brand | `aaclub` |
| Representative/privacy officer | `장호준` |
| Support email | `hojune0330@gmail.com` |
| Business registration | `528-05-02781` |
| Region | South Korea |
| Current scale | Public beta, approximately 0-150 users |

Do not invent an English spelling for the representative's name or a corporate title.
The owner must provide those exact values immediately before submission.

## 5. Verification Observed

- New device-integration contract tests: 10/10 PASS.
- Deliberate raw-note injection: the named normalization test failed; source was restored;
  10/10 then passed again.
- TypeScript: PASS using the installed repository version.
- Unit tests: 1,762/1,762 PASS in default timezone.
- KST unit tests: 1,762/1,762 PASS.
- Hosted-release environment tests: 11/11 PASS.
- Production build: PASS.
- Supabase function deployment: three functions reported deployed by project ref
  `texspxlpjungyarkvtkc`.
- External endpoint probes: status 200, empty callback 200, authorization-attempt callback
  409, unconfigured push 503.
- Remote migration dry-run: 0029 and 0030 were both pending in migration history.
- Direct remote catalog audit: all three 0029 tables, exact columns, RLS flags, grants,
  indexes, constraints, 12 policies, seven trigger events, and
  `public_profile_sharing_enabled()` match the local 0029 contract.
- Remote feature values observed during the same audit: `PLAN_BACKUP=true`,
  `PUBLIC_PROFILE=true`, and no `DEVICE_INTEGRATION` row.
- Applying 0029 again failed safely on the already-existing first policy. No 0030 statement
  was applied. This proves the remaining 0029 defect is migration-history drift, not a
  missing schema.
- After owner approval, 0029 was recorded as applied without rerunning its SQL. A fresh
  dry-run then listed only 0030, and 0030 was applied successfully.
- Final remote migration history matches local versions 0001 through 0030.
- Final 0030 catalog audit: both new tables have RLS enabled, ordinary `anon` and
  `authenticated` grants are empty, the ingest RPC is security-definer and executable
  only by `service_role`, and both new tables contain zero rows.
- Final feature values: `PLAN_BACKUP=true`, `PUBLIC_PROFILE=true`, and
  `DEVICE_INTEGRATION=false`.

This is code, contract, deployed fail-closed endpoint, and remote catalog evidence. It is
not provider approval, linked-account evidence, received-activity evidence, or sent-workout
evidence.

## 6. Remaining Ordered Gates

1. Merge and deploy public support/notice pages; verify their public URLs.
2. Prepare exact COROS logo sizes without changing brand artwork.
3. Use the owner-approved legal operator, representative, contact email, agreement
   acceptance, and CAPTCHA authorization without inventing any missing form value.
4. Submit Garmin and COROS applications once each and preserve visible receipt IDs/URLs.
5. After provider approval, design encrypted token storage and complete an internal test
   account round trip before any public link UI is added.

[REPORT_COMPLETE]
