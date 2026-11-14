# Google OAuth credential/admission hotfix — Sol A

Baseline: isolated `TRAINORACLE-auth-hotfix-20261114`, main `0db40114`. No production writes, user-account queries, real JWT/health-payload reads, provider traffic, commits or deployment were performed by A.

## Cause and change

The existing `current_jwt_auth_method_allowed()` rejected every account with a non-empty `auth.users.encrypted_password`, even when the actual authenticated session AMR was purely `oauth`. A linked credential is not the current session's authentication method. The existing Google callback already accepts the verified primary provider, provider list or linked identity; adding `google` to the AMR list would be incorrect.

The additive migration, initially created by the local CLI with timestamp `20261114035349`, is named `20261114035856_oauth_credential_auth_method_fix.sql` to match the actual server-recorded version after root's application. Its SQL bytes are unchanged. It introduces the private `current_jwt_auth_method_status()` and makes the existing boolean helper a wrapper. It preserves the exact supported AMR list, malformed/missing AMR denial, refresh-only denial, active server-session requirement and both operational channel gates. The password-hash ambiguity check now applies only to passwordless origins (`otp`, `magiclink`, `email/signup`). Pure OAuth, with optional refresh marker, is permitted while `AUTH_OAUTH` is enabled regardless of a separately linked password credential. Password, mixed password, recovery, invitation, anonymous and other unapproved methods remain rejected.

Only the exact authentication-failure block in all four existing claim overloads and current admission status is replaced. Known-definition matching fails closed; CRLF/LF differences are normalized for matching. Identity/session binding, age, legal versions, deletion, beta capacity, consent rows, function ownership/security settings and public grants are retained. No flags are enabled and no existing user data is rewritten.

The returned RPC shape is still text. Existing clients treat unfamiliar `AUTH_SESSION_INACTIVE`/`AUTH_CHANNEL_DISABLED` values as generic failures, so server-first deployment remains fail closed. Updated `account-service.ts` distinguishes an inactive session from an operational channel stop, avoiding a misleading repeated Google login instruction. The existing unsupported-method response remains compatible.

## Focused evidence

`tmp/oauth-credential-hotfix-sql.log`: **1/1 pass, exit 0**, using disposable PGlite, actual migrations 0001–0058, the 2026-11-04 legal migration and the additive hotfix. One complete meaningful run covered:

- Before/after reproduction: pure OAuth with a synthetic linked password credential changes from `AUTH_METHOD_UNSUPPORTED` to `ADMITTED_NEW`/`ADMITTED`.
- OAuth plus refresh remains supported; password/mixed password, recovery, invite, anonymous, email change, TOTP, SAML, refresh-only, fabricated `google` AMR, malformed and missing AMR remain denied.
- Closed OAuth/passwordless flags return `AUTH_CHANNEL_DISABLED`; expired/missing server sessions return `AUTH_SESSION_INACTIVE`.
- Ambiguous passwordless signup/OTP/magiclink with a password credential remains denied. Passwordless signup without a hash still requires its operational gate.
- Wrong owner/session, old legal version and private helper grants remain enforced. Account admission does not authorize storage without separate storage consent.

Two earlier setup attempts did not reach hotfix execution: missing local dependency linkage, then an incomplete prerequisite chain missing plan staging. The corrected full prerequisite chain produced the result above. Existing dependencies were reused through a local ignored junction; no install or network was needed. No further tests, frontend test run, typecheck, browser/device run or live login proof is claimed. The added account-service regression fixture was not separately executed under the user's minimal-verification instruction.

Migration SHA256: `ee5231c1a1f3c2764a9ffd240161fbbc0cf0a3ea95ac8d944e7b0bfeef254602`.

## Root's production application receipt

Root reported successful `apply_migration` and read-only metadata confirmation: actual migration version `20261114035856`, name `oauth_credential_auth_method_fix`; private status helper installed; boolean helper uses it; all five existing RPC auth-failure branches use the new status; `AUTH_OAUTH=true`, `AUTH_PASSWORDLESS=false`; authenticated EXECUTE on the private helper remains false. Root reported zero private-user reads. A did not execute this production operation and did not independently reread production. Matching the local filename to the recorded version prevents a later migration push from attempting the same additive DDL under a different timestamp. Only local filename/test reference/manifest/report metadata changed afterward; no new test was run, and the earlier SQL evidence remains applicable to the unchanged SQL bytes. Actual iPhone login completion is not established by installation metadata.

A owns the migration, focused SQL fixture, `account-service.ts` and its contract fixture. B owns the auth/onboarding/gateway/screens portion. Root owns production application and release. Root's attempted extra private account/session predicate query was rejected; this change did not retry or bypass that access decision. The actual failing user's hidden state has not been read or established.
