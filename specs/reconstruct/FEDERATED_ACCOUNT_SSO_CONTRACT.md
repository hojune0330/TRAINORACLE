# FEDERATED_ACCOUNT_SSO_CONTRACT.md

```yaml
document_metadata:
  doc_id: trainoracle-federated-account-sso-contract
  spec_id: FEDERATED_ACCOUNT_SSO_CONTRACT
  title: Federated Account SSO Contract
  version: 0.1
  round: RT1_RECONSTRUCTED
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  created_from:
    - CODEX_WORK_ORDER_006.md Task C
    - ACCOUNT_FEDERATION_DECISION.md
    - ATHLETETIME_INTEGRATION_REVIEW.md
  open_issues_total: 5
  canonical_blocking_count: 4
  executed_tests_total: 0
  runtime_evidence: none
```

---

> **상태 정렬 (2026-07-14):** 제품 방향은 AthleteTime으로 계속하기 연합 계정 연결이다. 다만 AthleteTime OAuth 제공자, 등록된 클라이언트, 동의 화면, redirect, 토큰 교환은 검증·구현되지 않았다. 아래 OAuth 흐름은 목표 계약이며 현재 동작하는 로그인 기능이 아니다.

---

## 1. Purpose

This document expands the accepted account federation decision into a draft
SSO contract for "Continue with AthleteTime." It defines the expected
TrainOracle-facing protocol boundary only. It does not implement AthleteTime
code, TrainOracle auth code, token exchange, or runtime tests.

The account model remains: AthleteTime is the identity provider, TrainOracle is
a separate service with its own user table, storage, consent, journal, and
safety data boundary.

---

## 2. Authority Boundary

SSO is identity authority only.

```yaml
sso_authority:
  is_identity_authority: true
  is_safety_authority: false
  can_clear_D9_or_Safety_Gate: false
  can_override_RVE: false
  can_override_Plan_Safety_Gate: false
  can_export_trainoracle_journal_to_athletetime: false
  can_import_athletetime_password_hash: false
```

Logging in with AthleteTime must not change D9, Safety Gate, RVE, Plan
Generator, coach authority, or medical clearance state.

---

## 3. Authorization Flow

The draft protocol follows OAuth 2.0 Authorization Code semantics.

```yaml
authorization_request:
  method: GET
  endpoint: "{ATHLETETIME_ORIGIN}/oauth/authorize"
  required_query:
    client_id: trainoracle
    redirect_uri: registered_trainoracle_callback
    response_type: code
    scope: openid profile trainoracle_link
    state: cryptographically_random
    nonce: cryptographically_random
  optional_query:
    code_challenge: pkce_s256_challenge
    code_challenge_method: S256
```

Required authorization behavior:

| Step | Rule |
|---|---|
| Existing AthleteTime session | May skip credential prompt but must not skip TrainOracle consent if consent is absent or expired. |
| No AthleteTime account | May route to AthleteTime signup, then return to authorization. |
| Consent denied | Must redirect back with an error and must not create a TrainOracle user. |
| Minor unresolved | Must block or route to guardian-consent flow; see `OI-FAS-GUARDIAN-CONSENT-BINDING-001`. |

---

## 4. Redirect And CSRF Validation

```yaml
redirect_validation:
  exact_redirect_uri_match_required: true
  wildcard_redirect_uri: forbidden
  http_redirect_uri_in_production: forbidden
  localhost_allowed_only_for_dev: true

state_validation:
  generated_by_trainoracle: true
  stored_server_side_or_http_only_equivalent: required
  one_time_use: true
  minimum_entropy_bits: 128
  mismatch_behavior: reject_and_do_not_create_session

nonce_validation:
  generated_by_trainoracle: true
  bound_to_authorization_request: true
  copied_into_id_token: required
  mismatch_behavior: reject_and_do_not_create_session
```

The callback handler must verify `state` before exchanging code, and must
verify `nonce` inside the returned ID token before creating a TrainOracle
session.

---

## 5. Token Exchange

```yaml
token_request:
  method: POST
  endpoint: "{ATHLETETIME_ORIGIN}/api/oauth/token"
  content_type: application/x-www-form-urlencoded
  required_body:
    grant_type: authorization_code
    code: authorization_code_from_callback
    redirect_uri: same_registered_redirect_uri
    client_id: trainoracle
  confidential_client_body:
    client_secret: required_only_if_server_side_confidential_client
  pkce_body:
    code_verifier: required_when_code_challenge_was_used
```

```yaml
token_response:
  required:
    id_token: signed_jwt
    token_type: Bearer
    expires_in: number_seconds
  optional:
    refresh_token: opaque_token
    refresh_expires_in: number_seconds
```

The token endpoint must not return an AthleteTime password hash, raw email by
default, raw profile bio, private notes, or TrainOracle journal data.

---

## 6. ID Token Claims

Minimum accepted claim set:

```yaml
id_token_claims:
  iss: required_athletetime_issuer
  aud: trainoracle
  sub: required_athletetime_user_id
  exp: required_unix_timestamp
  iat: required_unix_timestamp
  nonce: required_original_nonce
  nickname: optional_string
  specialty: optional_string
  region: optional_string
```

Explicitly excluded by default:

```yaml
excluded_default_claims:
  - email
  - password_hash
  - phone_number
  - address
  - birthdate_unless_guardian_flow_requires_it
  - profile_bio
  - instagram
  - raw_training_log
  - raw_journal_memo
  - pain_or_injury_detail
```

If a later accepted guardian-consent flow requires birthdate or age-band
signals, that addition must be scoped and versioned separately.

---

## 7. TrainOracle User Linking

```yaml
trainoracle_user_link:
  sourceProvider: athletetime
  externalSubject: id_token.sub
  createUserIfMissing: true
  required_local_fields:
    - toUserId
    - athleteTimeSubject
    - displayName
    - linkedAt
    - consentVersion
  optional_copied_fields:
    - specialty
    - region
```

TrainOracle must own its own user, consent, journal, and safety records.
AthleteTime identity is a login root, not the storage location for TrainOracle
journals, pain data, safety reason codes, or memo text.

---

## 8. Consent Screen And Audit

The AthleteTime consent screen must show, at minimum:

| Required display item | Rule |
|---|---|
| Receiving service | Must say TrainOracle. |
| Provided fields | Must list nickname, specialty, and region if requested. |
| Excluded data | Must state that training journal, pain, memo, and password are not shared. |
| Withdrawal path | Must explain where the user can revoke linking. |
| Minor handling | Must block or route when guardian consent is unresolved. |

Draft consent storage:

```yaml
oauth_consents:
  user_id: athletetime_user_id
  client_id: trainoracle
  scopes: array
  consent_version: required_string
  granted_at: required_timestamp
  revoked_at: optional_timestamp
  revoke_reason_code: optional_string
```

TrainOracle-side audit:

```yaml
trainoracle_link_audit:
  toUserId: required_string
  provider: athletetime
  providerSubject: required_string
  linkedAt: required_timestamp
  consentVersion: required_string
  rawIdTokenStored: false
  rawJournalMemoStored: false
  safetyDispositionChanged: false
```

---

## 9. Token Lifetime, Refresh, And Revocation

Recommended draft defaults:

```yaml
token_lifetime_defaults:
  id_token_max_age_minutes: 10
  trainoracle_session_max_age_days: 7
  refresh_token_allowed: optional
  refresh_token_rotation_required: true_when_refresh_is_used
```

Revocation propagation:

| Event | Required TrainOracle behavior |
|---|---|
| AthleteTime consent revoked | Stop new token exchange and require re-consent before next link refresh. |
| TrainOracle unlink requested | Remove active TrainOracle link session and stop future AthleteTime refresh for that account. |
| AthleteTime account deleted | Disable future SSO for the linked subject; server journal deletion follows TrainOracle account deletion policy. |
| Token validation failure | Reject login and do not create or refresh a TrainOracle session. |

Revocation must not erase local device journals unless the user separately
chooses local deletion on that device.

---

## 10. Minor-Athlete Handling

`ACCOUNT_FEDERATION_DECISION.md` places the 14세 미만 handling point at the
AthleteTime signup or identity root. That model is preserved, but still
unresolved.

```yaml
minor_athlete_policy:
  under_14_without_guardian_consent: block_or_human_review
  silent_account_creation: forbidden
  guardian_private_note_storage_in_trainoracle_audit: forbidden
  linked_issue: OI-ERI-GUARDIAN-CONSENT-001
```

No production SSO flow for minor athletes may be claimed until guardian consent
requirements are accepted and implemented in the appropriate service boundary.

---

## 11. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-FAS-ATHLETIME-OAUTH-ENDPOINTS-001 | AthleteTime OAuth authorize/token implementation not accepted | OPEN | YES | This contract specifies requirements only; AthleteTime repository code is out of scope. |
| OI-FAS-REDIRECT-URI-REGISTRY-001 | Production redirect URI and client registration not accepted | OPEN | YES | Exact production callback origins and client registration records must be accepted before runtime login. |
| OI-FAS-GUARDIAN-CONSENT-BINDING-001 | Minor-athlete guardian consent flow unresolved | OPEN | YES | Linked to `OI-ERI-GUARDIAN-CONSENT-001`; under-14 flow must block or route until resolved. |
| OI-FAS-CONSENT-REVOCATION-BINDING-001 | Consent revocation propagation not runtime-bound | OPEN | YES | Revocation behavior is specified, but endpoint binding and runtime evidence are not present. |
| OI-FAS-CONSENT-COPY-001 | Final consent-screen copy and consent version not accepted | OPEN | NO | Required display fields are defined, but final Korean copy and version label remain owner decision. |

---

## 12. Non-Claims

This draft does not claim:

- AthleteTime OAuth endpoints are implemented.
- TrainOracle login is implemented.
- Any runtime test has passed.
- Any open issue is closed.
- Any canonical promotion is granted.
- AthleteTime receives TrainOracle journal, pain, memo, or safety data.
- SSO can clear D9, RVE, Safety Gate, or human review.

[DRAFT_COMPLETE]
