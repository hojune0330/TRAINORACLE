# Connected Data server preflight — 2026-10-30

## 범위와 결론

- 실행 ID: `dot-r3-execution-20261030T121900Z`.
- 제품 기준: `e959d7bb34e460d7f957f58bda87aba5af02ffde`, 작업 branch `feat/connected-record-flow-20261030`.
- 원격 대상: `texspxlpjungyarkvtkc`의 `account-journal`. 프로젝트 이름/지역은 코디네이터의 앞선 metadata 조회에서 `trainoracle-beta-staging` / `ap-northeast-2`; 이번 담당 조회는 배포 소스와 지정 DB 함수 정의만이다.
- **기존 JOURNAL V3 파일 저장을 위해 재적용할 SQL 차이는 발견하지 못했다.** 권한·동의 함수 9개, collection 서명 함수의 현재 본문이 로컬과 일치한다. journal 서명 함수는 0058까지의 해당 함수 상태와 일치한다.
- **배포된 Edge v16에는 실제 호환성 차이 두 가지가 있다:** 동의 revision 헤더 미허용/미전달, strict FileObservation validator의 `dataLineage` 부재.
- 기존 v16 handler의 작업 범위를 유지하는 최소 후보를 제품 디렉터리 밖에 준비했다. **합성 Node 검사 11/11 통과 후 승인된 최소 후보를 account-journal v17로 적용했고, 배포 후 8개 파일 해시 일치를 확인했다.** DB·플래그·키·권한·다른 함수는 변경하지 않았다.
- 제품 파일, 다른 담당자의 변경, 실제 건강 자료, 사용자 동의/검토 값, raw session, 환경 비밀값을 조회하거나 변경하지 않았다.

## 직접 확인한 배포본과 복구 자료

배포 함수 ID `71f53158-11c6-4b2d-9ceb-783f63f21b4b`, ACTIVE **v16**, `verify_jwt=false`, updatedAt `1791003795892`.

- 원격 bundle SHA256: `8edca27bb207450f29d8daa8e8c0215b76142edf4958f826702f0ab366e3f4fb`.
- 2회차 원격 재조회: **2026-10-30 12:44:33 UTC**. ID/version/bundle SHA/8개 파일 정규화 SHA 모두 1회차와 일치했다. 이는 두 조회 사이에 배포본이 같았다는 증거이며 이후 다른 작성자가 배포하지 않을 보장은 아니다.
- 로컬 artifact root: `D:/admin/Documents/ChatGPT/트레인 오라클/tools/rea-aside/execution-dot-r3-20261030/account-journal-preflight`.
- 원본: `deployed-v16/supabase/functions/` 8개 파일.
- 원본 식별 및 개별 SHA: `deployed-v16-manifest.json`.
- 최소 후보: `candidate/supabase/functions/` 8개 파일.
- 후보 식별 및 개별 SHA: `candidate-manifest.json`.
- SQL 비교 증거: `sql-function-comparison.json`.
- 검사: `candidate.compatibility.test.mjs`.
- 배포 영수증과 사후 대조: `deployment-receipt.json`. `candidate-manifest.json`은 승인 당시 prepared-only 상태의 불변 증거로 보존한다.

## 승인된 최소 배포 결과

- 승인 후보 manifest SHA256: `b7e13c43469ccf6bf02b38bbd6a01d502d59ea170c6a2a61a1e02f0a14d95f48`.
- 적용 직전 **2026-10-30 12:48:55 UTC**: 원격 v16, bundle SHA, verify_jwt=false, 8개 소스 SHA가 복구본과 모두 동일함을 재확인했다.
- 배포 결과: **account-journal v17 ACTIVE**, 동일 함수 ID, verify_jwt=false 유지.
- v17 platform bundle SHA256: `e1c906d439613b615d13fe48b88bbfc4bdf1eeac997431dbd596aaa355a2f065`.
- 사후 **2026-10-30 12:49:30 UTC** get_edge_function: **8개 파일의 LF UTF8 SHA256 모두 승인 후보와 일치**.
- 공개 endpoint 무인증 GET: **405 METHOD_NOT_ALLOWED**, Allow `POST, OPTIONS`, Cache-Control `no-store`.
- 공개 endpoint 무인증 POST `{"action":"status"}`: **401 AUTH_REQUIRED**, Cache-Control `no-store`.
- 런타임 allowed-origins 실제값을 읽지 않았으므로 live CORS 204는 검사/주장하지 않는다. CORS 검증은 위 후보의 합성 exact-origin 허용·위조 헤더 거부 검사로 한정한다.
- 개인 TCX/계정 저장·재조회·일지·분석 왕복은 명시적 제외 범위이며 실행하지 않았다.

원본은 connector가 반환한 공개 코드/환경변수 참조만 보관했다. 키의 실제 값이나 사용자의 기록은 포함하지 않는다. 원본 파일을 LF로 정규화하여 저장한 뒤 8개 파일의 SHA256을 모두 다시 확인했다. 플랫폼 bundle SHA는 플랫폼 포장물의 식별자이며 아래 소스 SHA와 같은 계산 대상이 아니다.

## 정확한 최소 Edge 변경

| 파일 | v16 원본 SHA256 (LF UTF8) | 후보 SHA256 (LF UTF8) | 처리 |
|---|---|---|---|
| `account-journal/index.ts` | `362c5694a8e725fb3550d44e34154b2d04b7558d0c4abb3666c7c2367a512e65` | `9763a2d8735f8ac28b1877e15ec45938ed74757e115264f3ee7e03b99ec7fcaa` | 변경 |
| `_shared/account-journal-comparison-original.mjs` | `27af5258d4f29bef82f10d01374ed83f46678504274e540c1fa2b5cd300e8800` | `27af5258d4f29bef82f10d01374ed83f46678504274e540c1fa2b5cd300e8800` | 유지 |
| `_shared/account-journal-crypto.mjs` | `cf6998d1e486f21eb2ae08fb544ef3387c6ee41a75e8bef0f68f3db90d70b8b2` | `cf6998d1e486f21eb2ae08fb544ef3387c6ee41a75e8bef0f68f3db90d70b8b2` | 유지 |
| `_shared/account-journal-handler.mjs` | `d3e18ef7af8bce4fc664898c08a2ba7db14c27c13191640be0f639b2e9e9201d` | `b9271d5f19167f07a66118cc7d0091ed57da37f7b61292a2bb0a3a79ce35d74d` | 변경 |
| `_shared/account-journal-record-validator.mjs` | `26d8ff2f5a8e6ae29436280ddc75d497c491cb715879240fdfc2b4d7febcbfba` | `b1bdb3fe97197e9e88371d902409aaac1f60ae6a9472d4edad0e070d6da6951f` | 변경 |
| `_shared/account-plan-collection-handler.mjs` | `38cdd500f647687b75292900de4b7d9df7767703264883d053bdae9c74198ed6` | `300279f7bbfb9be1e4de344f71561de9a053cba9face732487500ffebcb3b3f3` | 변경 |
| `_shared/account-plan-collection-validator.mjs` | `3f0038b2561833b33e0546d3e73803bf1ae7a3e55cfb3811cca75d69091b63d5` | `3f0038b2561833b33e0546d3e73803bf1ae7a3e55cfb3811cca75d69091b63d5` | 유지 |
| `_shared/account-state-validator.mjs` | `fb00a343bab30b7f1b66b8f1b0d212ec3ecc7d5a2829b376fc12f2fc868da2ca` | `fb00a343bab30b7f1b66b8f1b0d212ec3ecc7d5a2829b376fc12f2fc868da2ca` | 유지 |

변경 내용:

1. `account-journal/index.ts:24`: 이미 검증에 쓰는 호출자 Bearer token과 함께 요청의 `x-trainoracle-storage-revision`을 Supabase client headers에 전달한다. 키/SDK/역할 변경 없음. 로컬 제품의 같은 수정은 `supabase/functions/account-journal/index.ts:24–25`.
2. v16 `account-journal-handler.mjs:395,397`: 해당 revision 헤더만 CORS allowlist에 추가한다. 현재 제품 동일 목적 코드 위치는 `supabase/functions/_shared/account-journal-handler.mjs:420,422`.
3. v16 `account-plan-collection-handler.mjs:118,120`: dependency의 같은 CORS 헤더를 추가한다. 이것은 별도 `account-plan-collection` Edge를 배포하는 작업이 아니다.
4. `account-journal-record-validator.mjs`: 기준 제품에 이미 생성되어 있는 현재 validator로 교체한다. 직접 수정/새 재생성은 하지 않았다. `app/src/domain/import/file-observation.ts:37–41`의 optional lineage를 받아 기존 lineage 없는 V3도 계속 읽는다. v16 validator는 strict object이며 `dataLineage` 필드가 없다.
5. v16 crypto, state validator, plan validator, comparison-original은 그대로 유지한다. current main의 전체 handler를 가져오지 않는다.

의존 그래프: entrypoint → journal handler / plan collection repository; journal handler → crypto / journal record validator / state validator / comparison-original; comparison-original → crypto / plan collection handler / plan validator / journal record validator. 위 8개가 실제 회수된 bundle의 전체 파일이다. SDK import는 원본의 `npm:@supabase/supabase-js@2.109.0`을 유지한다.

현재 앱은 `app/src/domain/account/account-journal-api.ts:212–215`에서 이 revision 헤더를 보낸다. v16은 OPTIONS에서 이를 403으로 거부한다. 브라우저 밖에서 OPTIONS를 생략해도 원본 entrypoint는 RPC에 revision을 전달하지 않는다. 운영 DB의 `enforce_account_storage_consent`는 아래와 같이 최신 revision을 요구한다. 이 실패는 이번에 사용자 계정으로 실행한 결과가 아니라 직접 회수한 양쪽 코드의 경로 비교다.

## DB 본문 정합

실행한 쿼리는 `pg_proc`/`pg_namespace`에서 지정 이름의 `pg_get_functiondef`만 SELECT했다. 사용자 테이블을 SELECT하거나 함수를 호출하지 않았다. 비교 단위는 함수의 dollar-quoted 본문, CRLF→LF 정규화 후 정확한 문자열과 SHA256이다. DDL 표시 형식/ACL 전체를 다시 비교한 검사는 아니며, ACL/RLS/trigger 존재 정보는 코디네이터의 앞선 catalog 조회와 구분한다.

| 함수 | 현재 로컬 정의 | 본문 비교 |
|---|---|---|
| `account_admission_access_allowed(uuid)` | `supabase/migrations/0057_purpose_scoped_storage_consent.sql:47` | 일치 |
| `account_journal_lifecycle_owner()` | `supabase/migrations/0034_account_journal_history_and_trash.sql:78` | 일치 |
| `account_network_access_allowed(uuid)` | `supabase/migrations/0057_purpose_scoped_storage_consent.sql:120` | 일치 |
| `account_storage_subject_allowed(uuid)` | `supabase/migrations/0057_purpose_scoped_storage_consent.sql:89` | 일치 |
| `current_jwt_auth_method_allowed()` | `supabase/migrations/0053_supported_auth_method_gate.sql:65` | 일치 |
| `current_jwt_session_active()` | `supabase/migrations/0053_supported_auth_method_gate.sql:34` | 일치 |
| `enforce_account_storage_consent()` | `supabase/migrations/0058_storage_withdrawal_erasure.sql:280` | 일치 |
| `get_account_storage_consent(uuid)` | `supabase/migrations/0058_storage_withdrawal_erasure.sql:316` | 일치 |
| `set_account_storage_consent(uuid,uuid,bigint,text,boolean,boolean)` | `supabase/migrations/0057_purpose_scoped_storage_consent.sql:371` | 일치 |
| `mutate_account_plan_collection_attested(text,text,text)` | `0044_plan_successor_guard_binding.sql:5` + `0046_account_storage_staging_limits.sql:184`의 명시 replacement | 현재와 정확히 일치 |
| `mutate_account_journal_attested(text,text,text)` | `0035_account_journal_gateway_cutover.sql:142` + `0045_calendar_decoration_account_storage.sql:50` + `0049_athlete_record_pace_revision.sql:32`의 명시 replacement | 0058까지 해당 함수의 최종 상태와 정확히 일치 |

- journal 재구성/운영 본문 SHA: `4cbc1dc6732242838d590a2b9ca9f32ab05e8303dcfc65030cf129ba14de5896`.
- plan collection 재구성/운영 본문 SHA: `3c67b02fdd209eb56950deb3f544c4904910a8f10f41aa637a5eb1b272f3c56f`.
- SQL을 실행해 재구성하지 않았다. migration 안의 명시된 문자열 치환을 메모리에서 재현하고 운영 본문과 비교했다.
- `0058_storage_withdrawal_erasure.sql:280–315`의 운영 함수가 `request.headers`의 revision을 검사하는 상태가 실제로 일치한다.
- 운영 journal 서명 함수에는 0059 running profile, 0060 Oracle V2 probe, 0061 restart, 0064 minigame 확장이 없다. 이 기능은 이번 V3 파일 저장 후보에 포함하지 않는다. **이를 이유로 해당 migration 묶음을 일괄 적용하지 않는다.**
- ledger의 0052 누락만으로 스키마 부재나 구형 ingest 함수 부재를 판단하지 않는다. 이 preflight는 provider ingestion을 적용/변경하지 않는다.

## 후보 검사 결과

명령(artifact root에서):

```text
node --test candidate.compatibility.test.mjs
```

**11 passed / 0 failed.** 실제 후보 파일을 import한 Node Request/Response handler와 합성 메모리 repository, 합성 암호화 키만 사용했다.

- 원본 v16의 기존 V3 저장→재조회.
- 후보의 기존 V3 저장→재조회.
- lineage가 있는 V3: 원본 거부 재현, 후보 저장→재조회→같은 operation 재시도 시 내용/receipt 보존.
- 잘못된 lineage source 참조 거부.
- 저장된 lineage의 origin을 correction으로 바꾸려는 시도 거부.
- 기존 FILE_ANALYSIS_WRITE 차단 유지.
- 다른 owner의 접근 거부.
- V4 저장 및 profile/Oracle/minigame 신규 작업 미활성.
- journal/plan dependency의 정확한 revision CORS 허용 및 알 수 없는 헤더 거부.
- 실제 후보 TypeScript entrypoint를 변환해 주입된 가짜 SDK로 실행: 검증된 호출자 token 및 정확한 revision 전달.

생성 validator는 V4 등을 내부적으로 이해하지만 v16 handler가 `supportedJournalVersions=[2,3]`와 `requireSupported`를 강제한다. 관련 새 작업도 parser에서 거부한다. 이 제한을 실제 후보 검사로 확인했다. 시험 요청은 현재 클라이언트와 같이 `supportsExerciseLogV1:true`도 포함하고 11/11을 재확인했다.

클라이언트의 `app/src/domain/account/account-journal-api.ts:99–115`는 body-part 지원 probe가 성공하지 않으면 지원 상태를 false로 둔다. `:213`은 그때 V2/V3만 요청하며 exercise capability는 true로 보낸다. `account-journal-record-service.ts:625–640`의 hydrate는 이 probe를 기다린 뒤 false 결과 자체로 중단하지 않고 list를 진행한다. 후보의 `journalBodyPartSupport` 400은 이 기존 fallback 경로에 해당한다. V4는 기존 차단을 유지한다. 이 클라이언트 흐름 확인은 소스 검토이며 이번 Node 검사를 전체 브라우저 왕복 증거로 확대하지 않는다.

검사 한계: live DB/RLS/동의·검토 행/실제 key 설정/실기기/실제 사용자 왕복은 검사하지 않았다. 실제 Deno 서비스에서 SDK↔PostgREST의 인증된 전달은 이번 검사에 포함되지 않는다. comparison/original/계획의 전체 회귀는 이 최소 검사의 범위 밖이며, 공유 validator의 내부 규칙 변화 때문에 새 원본 계획 형식은 기존 plan validator에서 계속 거부될 수 있다. 이것을 새 계획 기능 승인으로 해석하지 않는다.

## 적용 전후 조건과 복구

1. 적용 직전에 원격 v16/bundle SHA/8개 소스 SHA가 이 증거와 같은지 다시 확인하고, 코디네이터가 다른 배포 작성자가 없는 시점을 확보한다. 다르면 중단하고 diff를 다시 만든다.
2. 승인 대상은 **이 후보 8개 파일의 account-journal 배포만**이다. verify_jwt 설정, allowed origins, 비밀값, 플래그, review/consent 행, RLS, SQL 권한, migration, OAuth를 함께 바꾸지 않는다.
3. 코드만 교체해도 운영 gate가 열렸다고 판단하지 않는다. 현재 flags/operationsReady/동의 실제 값은 미조회다. 검토 사실을 만들기 위해 review=true를 삽입하지 않는다.
4. 개인 TCX 및 실제 계정 시험은 이번 실행 범위에서 명시적으로 제외됐다. 테스트 자료나 시험 계정을 요청하지 않고, 이 호환성 배포에 시험용 대상 제한이나 origin 변경을 추가하지 않는다. 검증은 합성 검사, 배포본 소스 대조, 인증 없는 응답으로 한정한다.
5. **lineage 기록을 저장하기 전**이라면 회수한 원본 v16 bundle은 코드 복구 기준이 된다. **lineage 기록 저장 후** 원본 validator로 되돌리면 그 기록을 읽지 못할 수 있으므로 원본 8개 전체로 무조건 롤백하지 않는다. 현재 호환 reader를 유지한 forward repair를 우선하고, 데이터/operation receipts/pending buffer를 보존한다.
6. 동의를 false로 만드는 조치는 복구 방법이 아니다. `0058_storage_withdrawal_erasure.sql:94–146`의 실제 erasure 경로가 있다. 키 삭제/교체, 테이블 삭제, RLS 완화, 기존 pending 삭제, V2-only writer 복귀를 하지 않는다.
7. 이번 결과는 배포본·무인증 경계·합성 후보 검사까지다. 재조회한 동일 document/revision, 앱 재진입, 일지/분석 반영을 포함한 실제 사용자 기록 전달을 완료했다고 보고하지 않는다.

## 수행 이력

- 원격 읽기: account-journal bundle 4회(초기, 재확인, 배포 직전, 배포 후), 지정 DB 함수 정의 SELECT 1회.
- 로컬 읽기: 기준/현재 source와 migrations, 관련 검사 fixture.
- 로컬 작성: 이 보고서와 제품 밖 preflight artifact들.
- 실행: artifact의 국소 synthetic Node 검사 11개와 실제 요청 capability를 맞춘 재검사 11개. 승인 후보 account-journal만 1회 배포. 무인증 공개 HTTP 2회.
- 수행하지 않음: 운영 DB 쓰기, migration, 설정/키/권한/플래그 변경, 다른 함수 배포, provider 조회, 사용자 건강/동의 값 조회, PR/push.
