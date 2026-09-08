# ACCOUNT_STORAGE_SEVEN_TASK_DELIVERY_2026-09-08.md

## 오너용 현재 상태

- 새 저장·복구 코드를 실제 작성 화면, 계획 화면, 꾸미기에 연결하고 통합 검사 중이다.
- 운영 DB 적용 요청은 실행 권한 심사에서 차단됐다. **운영 DB 변경·키 등록·기능 공개는 아직 하지 않았다.**
- 운영 적용은 대상 프로젝트와 0032~0036의 영향을 명시하여 승인을 요청했다. 제품 방향의 재승인을 요구한 것이 아니다.
- 복구용 키 백업을 어디에 보관할지도 확인 중이다. 키 값은 대화·Git·검사 로그에 남기지 않는다.
- PR #320의 계정·동의 A-B-A 취소 결함을 추가 발견하여 수정했다. 선행 PR만 먼저 배포하지 않고 수정이 포함된 통합본을 검수한다.
- 로컬 검사 통과, GitHub 푸시, 병합, 공개 배포, 실제 계정 왕복은 각각 다른 단계다. 아래 기록이 없는 단계를 완료로 해석하지 않는다.

## Scope

Owner approved continuing all seven account-storage tasks in order. This report is
a delivery checkpoint, not canonical promotion or production evidence.

Base checkpoint: `30ad218005c594004340e54f14bf1865b881d577`, PR #322, based on PR #320.
The base checkpoint passed contract-tests, app-quality and app-browser. Deployment
was skipped because it was a draft PR. New changes require fresh checks.

## Task Register

| Task | Work | Implementation | Live verification |
|---|---|---|---|
| 1 | Four-form autosave, conflict comparison and recovery | IMPLEMENTED; FINAL_INTEGRATION_CHECK | NOT_RUN |
| 2 | Watch-file confirmation and backup restore to account | IMPLEMENTED; REVIEWED_CAS_TESTED | NOT_RUN |
| 3 | Trusted gateway, legacy cutover, occurrence and reward atomicity | IMPLEMENTED; LOCAL_SQL_TESTED | NOT_RUN |
| 4 | Current plan pointer, progress and original evidence | BOUNDED_IMPLEMENTATION; LONG_HISTORY_INCOMPLETE | NOT_RUN |
| 5 | Decoration and private-text recovery | IMPLEMENTED; NATIVE_BROWSER_TESTED | NOT_RUN |
| 6 | Migrations, secrets, retention scheduler and recovery drill | PREPARED; EXACT_OPERATION_PERMISSION_PENDING | NOT_APPLIED |
| 7 | Two-account/device checks, PR dependency, CI, merge and deployment | LOCAL_CHECKS; PR_INTEGRATION_PENDING | NOT_DEPLOYED |

## Current Evidence

- Browser observation: project `texspxlpjungyarkvtkc`, named
  `trainoracle-beta-staging`, branch `main PRODUCTION`; the displayed last migration
  is `0031 friend_oracle_comparison`. This is not evidence that 0032-0036 are applied.
- Dashboard displayed no scheduled backup. No plan upgrade or paid backup was purchased.
- GitHub secret-name inventory was read without values. It contains the existing
  Supabase URL/service-role/anon-key names, not a deployment access-token secret.
- New retention-worker PGlite tests: 2 passed. They exercise synthetic PostgreSQL
  rows and role restrictions, not the live cron scheduler or production backup.
- Conflict worker: native browser conflict checks 14 passed, including two tabs,
  old records, archive bounds and reload access. Local encrypted conflict archives
  are not yet proof of server backup of every losing local version.
- Official Supabase CLI 2.117.0 authenticated successfully. Linked project matches
  `texspxlpjungyarkvtkc`; no token-file or secret-value inspection was used.
- Official `db push --dry-run` confirms exactly 0032-0036 are pending. It made no
  database changes. Metadata query confirms pgcrypto installed, pg_cron absent.
- Secret-name inventory confirms the new encryption keyring and HMAC signing
  configuration are absent. No key material has been generated or installed.
- Import/restore worker: 117 default and 117 KST checks passed. Independent
  integration review then found missing durable MIGRATION intent, which could
  award restored current-day journals. Fix is in progress; no release claim.
- First integrated unit run: 3271 passed, 14 failed across 8 files. A focused
  rerun of six timing-sensitive plan files passed all 188 checks with two workers.
  Two old quick-form completion assertions conflict with the new ACK-only flow;
  those tests and decoration regressions remain under review.
- Shared server ACCOUNT_STATE validator build/check plus two boundary tests pass;
  deployment environment checks pass 12/12. Emitted server code excludes browser
  account/session and storage clients. These are not Edge deployment evidence.
- Final frozen 0035 plus handler/crypto/SQL suite passed 112/112. The separate
  operator rollback smoke also passed in PGlite and verified no synthetic users,
  profiles, documents or feature changes remained afterward.
- Actual `supabase db push --yes` was rejected by the execution permission
  reviewer BEFORE process creation. No DDL was applied. The owner was asked for
  explicit authorization for project `texspxlpjungyarkvtkc`, migrations 0032-0036,
  explaining table/access-control changes and that this command neither deletes
  existing journals nor schedules cleanup nor activates the frontend feature.
- Supabase functions inventory contains device-integration-status,
  coros-oauth-callback and coros-workout-push; account-journal is not deployed.
- Key-backup custody location was requested separately. No secret values were
  read, generated, installed, or copied to this report.

## Integration Review Checkpoint

- Second full app run with two workers: 3327 passed, 2 failed (3329 total).
  Both failures expose the account plan service throwing when IndexedDB is
  unavailable while Home renders. This is a real integration defect under repair,
  not an environment exception to subtract from the failure count.
- Additional independent review found same-timestamp/different-body restore CAS,
  four-form final-save retry snapshot instability, and guest reward routing gaps.
  Assigned fixes remain IN_PROGRESS until their new regression checks finish.
- Native record-service checks: 36 passed. Decoration checks: 19 passed.
  Form autosave/recovery checks: 9 passed. These use synthetic authenticated
  contexts and native browser storage, not live Supabase JWTs or two real devices.
- The parent opened the 375px synthetic form conflict screenshot. Both versions
  and recovery actions remain visible without horizontal overflow. A further
  display issue was identified: unanswered numeric sentinels must not appear as
  measured zero. Correcting this is part of the form work, not a completed gate.
- Core implementation suite: 891 passed. D9 evaluator: 11 passed after installing
  its lockfile dependencies. These do not prove the new online storage service
  is deployed or activated.
- A-B-A owner/consent cancellation checks were independently reproduced, fixed,
  and mutation-tested; removing owner cancellation caused 8 failures and removing
  consent cancellation caused 9. The restored focused suite passed 164 checks.

## Reporting Boundary

### Frozen Implementation Checkpoint

- All implementation workers completed their bounded edits and stopped their
  test servers. No production keys or real account data were used.
- Parent production build and app/browser TypeScript checks passed. Browser
  fixture type errors were corrected with explicit journal-kind checks, without
  weakening assertions. Record validator tests passed 81; state validator tests
  passed 2 with a reproducible 626,073-byte generated module.
- Parent reran native browser checks: record service 40, conflict recovery 14,
  decoration 19, and plan service 4, all passed. These are synthetic-transport
  checks using real browser storage, not production authentication evidence.
- The third full unit run, captured during active form changes, had 3346 passes
  and 28 failures. All failures were in LogDetail.account-edit (4) and
  AccountOnlineForms (24). The form worker fixed the missing new-reader mock and
  reran the affected three-file scope: 96/96 in default time and 96/96 in KST.
  Its broader scope passed 166/166 in both zones; native form checks passed 14/14.
  These focused results do not relabel the previous full run as a pass. The final
  frozen revision still requires its own complete CI.
- Import/restore reviewed CAS: 8 files, 130 checks passed. Same-timestamp different
  content mutations were observed failing before the fix. Durable MIGRATION
  intent, frozen absence tokens and private-content-preserving comparison remain.
- Guest reward routing distinguishes confirmed guest from unresolved/failed auth.
  Guest balances are explicitly device-local; failed account reads never fall
  back to that ledger. Focused auth/reward/privacy/UI regression: 62 passed.
- Parent inspected the edited-pending 375px form screenshot. The unchanged
  pending request and newer input are separately explained, with no automatic
  duplicate finalization. Full-page fixed-footer captures are not a keyboard or
  real-device accessibility certification.
- Remaining form-model limitation: sleep input has no independent answered bit,
  so default zero cannot be distinguished from an explicitly selected zero.
  Detailed RPE also lacks a distinct historical skipped-answer flag. No missing
  provenance was invented during restoration.

### Remaining Engineering: Long Plan History

The current PLAN document is bounded at 500,000 UTF-8 bytes, with no eviction.
Measured synthetic fixtures fit V4 8 plans (494,109 bytes), V5 9 (469,378 bytes),
and V6 9 (476,794 bytes). V3 fit 100 small fixtures; this does not guarantee that
all real V3 plans fit. Eighteen detailed frames across 24 weeks are NOT supported
by this single-document storage design. This is engineering work, not a missing
owner product decision, and must not be reported as operational completion.

The selected follow-up design separates immutable plan packets, per-plan progress,
an owner current-plan index, and bounded pages containing history references.
Keep the existing per-document and HTTP limits. Save and validate the immutable
packet first, then atomically compare the previous pointer/index revision and
owner-bound referenced documents before switching the current plan. A failed
switch must preserve the old pointer and leave the new packet as unselected
history. Never emulate this transaction with several unrelated client writes.

Implementation sequence: pure schemas and compatible legacy readers; signed
gateway/DB transition and idempotency; client selection/progress/history service;
copy-and-verify legacy migration without deletion; 18-frame tests, competing
devices, interrupted transitions and new-device restoration. Transported evidence
still does not become independent approval. No partition implementation or new
production migration has been executed at this checkpoint.

### Remaining Operational Work

After engineering review, the outstanding external operations are the exact
0032-0036 DB application already requested, approved secret provisioning and
separate recoverable key custody, account-journal function deployment, backup/key
restoration rehearsal, metadata-only retention scheduling, and real A/B account
and two-device validation. Frontend activation follows those results. Local
synthetic tests and a Pages code deployment cannot substitute for these steps.

No server key values, production journal contents or private notes belong in this
report. Do not log request payloads in CI. Record keys by identifiers only.
Report implementation, verification, push, merge and deployment separately. An
unfinished engineering item is not an ungranted owner approval.

[DRAFT_COMPLETE]
