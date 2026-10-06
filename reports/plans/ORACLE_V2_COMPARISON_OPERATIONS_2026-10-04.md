# Oracle V2 계정 친구 비교 운영 인수

```yaml
date: 2026-10-04
scope: authenticated_profile_preferences_comparison
status: LOCAL_IMPLEMENTATION_AND_FOCUSED_PROOF_READY
public_activation: false
production_verification: NOT_PERFORMED
this_change: DOCUMENTATION_ONLY
```

## 1. 범위와 승인 경계

이 문서는 승인된 계정 친구 응답 비교의 적용 순서와 중지 절차만 다룬다.
문서 작성은 배포, 키 등록, DB 변경, 공개 활성화 승인이 아니다.
아래 운영 SQL은 승인된 대상 환경에서 운영자가 실행할 절차이며 이번 작업에서는 실행하지 않았다.
실제 키, 토큰, 계정 ID, 프로젝트 주소, 개인 응답은 포함하지 않는다.

- 상위 계약: [Oracle V2 구현 계약](../../specs/reconstruct/ORACLE_V2_IMPLEMENTATION_CONTRACT.md).
- 비교 권한: 두 소유자의 독립 동의, 선택 문항, 동일 문항·계산 버전, 현재 저장본 revision, 기간과 살아 있는 세션.
- 외부 공유: 비교 동의와 별도이며 양측 허용 문항의 교집합만 사람이 읽는 사실로 반환한다.
- 공개 프로필, 기존 공개 비교 snapshot, 수동 비교의 로컬 동의는 이 권한을 대체하지 않는다.
- 기존 공개 비교 migration 0031과 공개 프로필 정책은 변경하지 않는다.
- 새 친구 검색 디렉터리는 없다. 링크·코드로 한 수신자를 연결하며 실명 확인을 주장하지 않는다.
- 원문 메모, 숫자로 바꾼 미응답, 궁합 백분율은 비교에 포함하지 않는다.

## 2. 적용 산출물과 순서

### Migration 기준

이 checkout의 기존 migration 이력이 0001부터
`0050_oracle_half_distance.sql`까지 순서대로 적용되어 있는지 먼저 확인한다.
특히 0033/0034의 계정 문서·이력 기반, 0035의 attested gateway,
0047의 현재 법적 동의 버전 등 기존 의존성을 생략하지 않는다.
이미 적용한 파일을 다시 실행하거나 이력을 임의로 맞추지 않는다.

2026-10-05 릴리스 정합화: main 인증 강화 0051~0056과 목적별 저장 동의 0057을 보존한다.
이전 Oracle 후보 0051~0054, 이후 0057~0060은 충돌을 피하도록 0058~0061로 이동했다.
2026-10-06 main 26c86a9a 통합: main의 저장 철회·파기 0058을 보존하고,
아직 적용하지 않은 Oracle 후보만 0059~0062로 이동했다. 운영 migration 이력은 변경하지 않았다.
[실행 도구와 사전 점검](../../supabase/operations/ORACLE_V2_RELEASE.md)을 먼저 따른다.
이후 추가 migration은 반드시 다음 순서로 적용한다.

| 순서 | 정확한 파일 | 역할 |
|---|---|---|
| 1 | [0059_running_profile_account_storage.sql](../../supabase/migrations/0059_running_profile_account_storage.sql) | 기존 암호화 계정 경로의 RUNNING_PROFILE 종류와 지원 확인 |
| 2 | [0060_oracle_v2_account_compatibility.sql](../../supabase/migrations/0060_oracle_v2_account_compatibility.sql) | V2 지원 확인 |
| 3 | [0061_oracle_v2_explicit_restart.sql](../../supabase/migrations/0061_oracle_v2_explicit_restart.sql) | 삭제 후 명시적 새 시작; 과거 답 복원 아님 |
| 4 | [0062_oracle_profile_comparison_grants.sql](../../supabase/migrations/0062_oracle_profile_comparison_grants.sql) | 초대, 양측 비교/외부 공유 grant, 철회, 별도 서명 검증 |

0059~0061의 기존 함수 anchor 검사 실패는 중지 사유다. 임의 문자열 치환이나
검사 제거로 통과시키지 않는다. 다른 checkout의 번호가 같은 migration을 섞지 않는다.
새 환경은 저장소 migration 전체를 정식 순서로 적용한다.
아래 PGlite 시험의 일부 migration 제외 목록을 배포 목록으로 사용하지 않는다.

### 서버/클라이언트 배포 단위

1. 기능 노출을 닫고 비교 전용 제어를 OFF로 유지한다. 적용 대상과 이력, 변경 묶음을 기록한다.
2. 위 migration을 적용한다. 0062는 `oracle_profile_comparison_controls.enabled=false`로 시작하며 키를 만들지 않는다.
3. 계정 저장 담당자의 V2 호환 `account-journal` 함수와 생성 validator를 함께 준비한다.
   DB 지원 확인만 새롭고 실제 validator가 오래된 조합은 허용하지 않는다.
4. 새 `supabase/functions/oracle-profile-comparison/index.ts`, 전용 handler/validator 및
   그 import 의존 파일을 같은 후보로 배포한다. 기존 계정 crypto/keyring 모듈도 배포 패키지에 필요하다.
5. 환경 설정과 비교 전용 서명 키의 양 끝 일치를 확인한다. 키 값은 로그나 증거물에 남기지 않는다.
6. OFF 상태의 거절과 직접 RPC/table 접근 거절을 확인한다. 승인된 비공개 시험 환경에서만 전용 제어를 켠다.
7. 부모 UI 포함 같은 클라이언트 후보로 두 합성 계정 여정을 확인한다. 공개는 별도의 전체 Oracle V2 출시 조건 이후다.

`supabase/config.toml`의 `[functions.oracle-profile-comparison]`은 `verify_jwt=false`다.
이는 무인증 허용이 아니다. 함수가 전달받은 정확한 bearer에
`getUser(token)` 및 `getClaims(token)`을 적용하고, DB가 현재 JWT/session과 HMAC 증명을 다시 확인한다.
클라이언트 요청을 service-role 권한으로 실행하지 않는다.

## 3. 기존 키와 새 키

| 이름/위치 | 기존/신규 | 용도와 조치 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 기존 서버 설정 | 승인된 대상의 user-JWT client 구성. service-role 키로 대체 금지 |
| `TRAINORACLE_JOURNAL_ALLOWED_ORIGINS` | 기존 서버 설정 | 쉼표로 구분한 정확한 origin 허용 목록. wildcard/경로 포함 값 금지 |
| `TRAINORACLE_JOURNAL_KEYRING_JSON` | 기존 암호화 키링 | 저장된 현재 RUNNING_PROFILE 문서를 복호화. 새 키로 임의 교체 금지 |
| `TRAINORACLE_JOURNAL_ATTESTATION_JSON` | 기존 journal 서명 키 | 계정 저장 함수용. 비교 함수의 별도 서명 키로 재사용 금지 |
| `TRAINORACLE_PROFILE_COMPARISON_ATTESTATION_JSON` | **신규 서버 전용** | 비교 gateway HMAC-SHA256 서명 |
| `public.oracle_profile_comparison_keys` | **신규 DB 전용** | 같은 비교 서명 키를 검증하는 key_id/secret/enabled 행 |

키링 형식은 `{activeKeyId, keys: {keyId: base64_32_bytes}}`다.
이미 저장된 ciphertext의 keyId에 대응하는 복호화 키들을 유지한다.
비교 전용 키 형식은 정확히 `{keyId, key: base64_32_bytes}`이며 독립적으로 만든
32바이트 난수 키를 승인된 secret 전달 경로로만 공급한다.
DB의 `secret`은 base64 문자열 자체가 아니라 디코딩된 32바이트다.

운영 도구의 parameter binding으로 등록할 SQL 형식:

```sql
insert into public.oracle_profile_comparison_keys (key_id, secret, enabled)
values ($1, decode($2, 'base64'), true);
```

`$1`과 `$2`는 운영 도구에서 전달할 파라미터이지 문서에 채워 넣을 값이 아니다.
기존 key_id를 덮어쓰기보다 새 key_id를 사용한다.
키를 명령줄 인자, 파일 커밋, 브라우저 번들, `VITE_*` 값, 요청 로그에 넣지 않는다.
소유자·세션·90초 증명 만료가 서명에 포함되며 프로토콜 domain은
`trainoracle.profile-comparison.gateway.v1`이다.

일반 키 교체는 새 DB 검증 키 등록 → 함수의 새 key_id로 전환 →
기존 요청/인스턴스 전환 확인 → 이전 비교 키 비활성화 순서다.
DB가 허용하는 증명 유효 범위는 최대 120초다. 유출 의심 시에는 유예하지 말고
해당 키를 즉시 중지하되, 새 안전한 키가 준비되기 전에는 사용자 철회도 서명 관문을 통과하지 못함을 기록한다.
이 작업 때문에 계정 암호화 키를 폐기하거나 계정 데이터 읽기를 훼손하지 않는다.

## 4. 환경 및 기능 제어

비교 전용 `VITE_ORACLE_*` 또는 전용 Edge 환경변수 feature flag는 현재 없다.
클라이언트 표시만 숨기는 것은 서버 권한 차단이 아니다.

| 관문 | 실제 설정 | 운영 의미 |
|---|---|---|
| 기존 계정 클라이언트 | `VITE_ACCOUNT_PUBLIC_ENABLED=true`, `VITE_KILL_ACCOUNT!=true` | 계정 구성 관문이며 이번 비교 공개 승인 아님 |
| 기존 계정 연결 정보 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | 승인된 HTTPS 대상; 비밀 서명 키 아님 |
| 기존 법적 동의 구성 | `VITE_PRIVACY_POLICY_URL`, `VITE_TERMS_OF_SERVICE_URL`, 각 `*_VERSION=2026-08-26` | URL은 HTTPS, 서버 법적 동의 버전과 일치 필요 |
| 기존 계정 저장 UI 관문 | `VITE_FEATURE_ACCOUNT_JOURNAL=true`, `VITE_KILL_ACCOUNT_JOURNAL!=true` | 기존 저장 경로용; 비교 전용 서버 grant 아님 |
| 기존 서버 기능 | `service_feature_enabled('ACCOUNT')`, `('ACCOUNT_JOURNAL_V2')`, `('SHARING')` 모두 true | 공유 범위가 다른 기능에도 영향. 비교를 위해 일괄 변경 금지 |
| 비교 전용 서버 제어 | `oracle_profile_comparison_controls.enabled` | 기본 false. 승인된 환경에서 마지막으로 활성화 |

Vite 값 변경은 새 클라이언트 빌드에 반영된다. 이미 열린 클라이언트까지 즉시 중지하는 장치는 아니다.
법적 동의 버전은 이 checkout의 상수와 SQL을 기준으로 적었다.
실행 시점의 계약이 바뀌면 재검토하며 사용자의 동의 행을 임의 갱신하지 않는다.

관리 권한으로 값 자체를 확인하되 secret 열은 조회하지 않는다:

```sql
select singleton, enabled from public.oracle_profile_comparison_controls;
select key_id, enabled from public.oracle_profile_comparison_keys;
select feature_key, enabled from public.service_feature_controls
where feature_key in ('ACCOUNT', 'ACCOUNT_JOURNAL_V2', 'SHARING');
```

승인된 시험 환경의 마지막 활성화:

```sql
update public.oracle_profile_comparison_controls
set enabled = true where singleton = true;
```

이 singleton은 사용자별 rollout allowlist가 아니다.
공유 환경에서 true로 바꾸면 기존 자격 관문을 만족하는 다른 계정도 접근할 수 있다.
두 계정 비공개 시험은 격리된 시험 환경에서 수행한다.

## 5. 부모 연결과 초대 UX

부모 `OracleProfileV2`는 현재 저장본, 서버 CAS revision, 비동기 계산된 documentId가
준비되고 미저장 응답 초안이 없을 때 연결 비교를 연다.

```tsx
<OracleConnectedComparison
  ownerId={owner}
  documentId={documentId}
  documentRevision={store.revision}
  ownProfile={current}
  onBack={() => setFriendMode("choose")}
/>
```

`documentRevision`은 `ownProfile.revision`과 다르다.
선택 prop `invitationCode`로 코드를 전달할 수 있으며 생략 시 fragment를 읽는다.
`#oracle-compare-invite=<code>`는 부모 화면이 열릴 때 connected 모드를 초기화한다.
실제 앱 진입/로그인 복귀가 이 fragment를 보존하는지는 대상 환경 여정에서 확인한다.
링크 도착이나 화면 열림만으로 초대 수락, 비교 동의, 외부 공유 동의를 호출하지 않는다.
owner/comparison/document UUID는 API 내부 값이며 사용자가 입력하는 정상 경로가 아니다.

초대는 32바이트 난수에서 만든 43자 URL-safe 코드이며 DB에는 SHA-256 해시만 남긴다.
받은 사람이 로그인하고 명시적으로 수락해야 수신자 계정이 고정된다.
생성자가 자기 링크를 다시 열면 상태만 읽고 자신을 수신자로 만들지 않는다.
이미 다른 계정에 연결된 코드는 세 번째 계정이 재사용할 수 없다.
오늘까지는 한국시간 당일 23:59:59.999, 7일은 선택 시점부터 정확히 7일이다.
서버는 만료되었거나 생성 시점보다 7일을 초과하는 초대를 거절한다.

## 6. 두 합성 계정 검증

### 지금 재현 가능한 로컬 명령

아래 명령은 설치된 이 checkout의 의존성을 사용한다.
DB 주소·Supabase 토큰·실제 키가 필요 없고 외부 계정이나 서버에 연결하지 않는다.
누락 의존성이 있으면 별도 의존성 설치 절차를 따르며 production 설정을 대신 넣지 않는다.

```powershell
Set-Location -LiteralPath 'D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-multi-event-pace-release-20261002\app'
node scripts/build-oracle-profile-comparison-validator.mjs --check
Set-Location -LiteralPath '..\supabase\tests\local-postgres'
node --test oracle-profile-comparison.test.mjs
```

생성 validator가 오래되었다면 같은 후보의 source를 확인하고
`node scripts/build-oracle-profile-comparison-validator.mjs`로 다시 생성한 뒤
`--check`와 서버 검증을 재실행한다. 검사 옵션 없이 생성하면 산출물이 바뀐다.

시험 파일은 메모리 PGlite에 A/B 합성 계정·세션·암호화 현재 프로필을 만들고,
침입 대조군 C도 만든다. 실제 SQL, HMAC, 암호화/복호화, handler를 실행하지만
Supabase Auth와 Edge HTTP 배포는 합성 어댑터로 대체한다.
현재 로컬 harness는 main 목적 동의 0057과 저장 철회·파기 0058을 포함하여 실제 0001~0062 SQL을 제외 없이 로드한다.
OAuth 세션과 2026-10-05 법적 동의, 사용자별 health/text 목적 동의를 실제 RPC로 준비한다.
운영 검토 행은 폐기되는 PGlite DB에서만 합성 자료로 생성하며 운영 증거가 아니다.
운영에서 보류된 0039/0041~0044의 자동 적용을 뜻하지 않으며 실제 JWT 로그인 검증의 증거도 아니다.

주요 두 계정 경로:

1. 기본 OFF에서 초대 생성 거절 → 시험 fixture에서만 활성화.
2. A 초대 생성 → B 인증 수락. 아직 grant는 0개이며 비교는 거절된다.
3. A만 비교 동의 → 거절. B도 직접 동의 → 공통 문항 중 숫자 답만 비교.
4. 외부 공유는 기본 거절. A만 공유 동의해도 거절. B까지 동의하면 허용 문항 교집합만 출력.
5. B 외부 공유 철회 → export 거절, 비교는 유지. B 비교 철회 → 비교도 거절.
6. 원본 revision 변경/삭제, 만료, 세션 제거, 차단 계정, 제3자, 응답 직전 철회는 fail-closed.

화면/클라이언트의 집중 검증 명령:

```powershell
Set-Location -LiteralPath 'D:\admin\Documents\ChatGPT\트레인 오라클\TRAINORACLE-multi-event-pace-release-20261002\app'
node node_modules/vitest/vitest.mjs run src/domain/account/oracle-profile-comparison-contract.test.ts src/domain/account/oracle-profile-comparison-api.test.ts src/screens/OracleConnectedComparison.test.tsx
node node_modules/vitest/vitest.mjs run --config vitest.config.kst.ts src/domain/account/oracle-profile-comparison-contract.test.ts src/domain/account/oracle-profile-comparison-api.test.ts src/screens/OracleConnectedComparison.test.tsx
node node_modules/typescript/bin/tsc --noEmit
```

### 실제 인증 경로의 비공개 인수

배포 승인을 받은 격리된 환경에서 두 시험 계정을 각각 별도 브라우저 세션으로 연다.
두 계정은 이메일 확인, 비익명, 현재 법적 동의, beta 등록, 만 14세 이상,
삭제/차단 요청 없음과 유효 세션이라는 기존 자격을 만족해야 한다.
시험 통과를 위해 production의 auth/동의 행을 직접 수정하지 않는다.

A/B 모두 러닝 응답을 저장하고 저장 성공·현재본·CAS revision이 준비된 뒤 시작한다.
A는 초대 만들기 → 문항 → 오늘/7일 → 검토 → 링크 생성,
B는 받은 링크 → 로그인 → 초대 받기 → 문항 검토 → 비교 동의를 수행한다.
A도 수락 확인 후 별도로 비교 동의한다. 상대 이름이나 실명 디렉터리는 제공되지 않는다.
이후 위 3~6단계와 새 탭/재로그인/저장본 수정 후 차단을 확인한다.
자동 수락·자동 동의가 없고, 권한 실패가 수동 비교 성공으로 대체되지 않아야 한다.
이 실제 인증 여정은 아직 완료 증거가 없으며 로컬 합성 시험으로 대체 표시하지 않는다.

## 7. 중지와 롤백

일반 비교 중지의 첫 조치:

```sql
update public.oracle_profile_comparison_controls
set enabled = false where singleton = true;
```

- 이후 새 초대·수락·동의·조회·공유는 차단된다. 전용 OFF만으로 기존 grant가 삭제되거나 철회되지는 않는다.
- `revoke`와 `revokeExternal`은 feature gate보다 먼저 처리된다. 정상 auth/session,
  gateway 서명 키와 함수는 계속 필요하다. 일반 중지 때 함수/키를 먼저 없애지 않는다.
- 철회 UI 접근 경로를 남긴 채 신규 비교 노출을 닫는다. 앱 전체 계정 kill을 비교 전용 rollback처럼 쓰지 않는다.
- migration을 역적용하거나 grant/withdrawal 행, 저장 프로필, 기존 암호화 키를 삭제하지 않는다.
- V2 읽기와 구버전 거절을 유지한다. 오래된 쓰기 validator로 되돌려 V2 자료를 재해석하지 않는다.
- 재활성화하면 미철회·미만료 grant가 다시 유효할 수 있다. 강제 재동의가 필요한 사고는 OFF만으로 해결됐다고 기록하지 않는다.
  기존 grant 전체 무효화는 영향 확인과 별도 승인된 복구 절차가 필요하다.

현재 화면은 결과를 메모리에만 두며 blur/숨김, 로컬 철회, source 변경 시 지운다.
결과 표시는 최대 30초 또는 서버 validUntil 중 이른 시점까지다.
다른 계정의 철회는 다음 서버 확인에서 차단하며 이미 표시된 결과를 실시간 push로 지우는 구현은 아니다.
이미 복사/다운로드된 사실을 회수한다고 약속하지 않는다.

저장 목적 철회는 이후의 DB 원본 읽기와 변경을 거절한다. 비교는 일지 쓰기와
같은 사용자 잠금을 획득한 뒤 양측의 현재 목적 동의·운영 검토·인증 채널을
다시 검사하며, 결과 응답 전에도 재검증한다. 그러나 DB가 암호문을 이미 Edge에
전달한 뒤 철회가 완료되면, 진행 중인 복호화·계산 자체가 즉시 중단된다고
보장하지 않는다. 이후 검증에서 철회된 결과를 거절하는 것과 처리의 즉시 중단은
다른 경계다. 이미 전달된 자료의 진행 중 처리 정책과 실제 두 PostgreSQL 연결의
경합 검증은 공개 전 운영 검토에서 확인한다. 현재 로컬 순차 시험으로 이 조건을
완료 처리하지 않는다.

키 유출 사고에는 해당 비교 키를 비활성화하고 전용 제어도 OFF로 둔다.
새 안전한 키/함수 경로를 복구한 뒤 철회를 재확인한다.
키 무효화와 계정 원자료 삭제를 혼동하지 않는다.

## 8. 증거와 인수 조건

이 문서 작성 전 집중 구현 검증 결과:

| 검증 | 관측된 결과 | 한계 |
|---|---|---|
| SQL + handler + crypto 합성 시험 | 10건 통과 | Auth/HTTP 배포 및 전체 migration 재현 아님 |
| 화면/계약/API | 12건, 기본/KST 각각 통과 | 실제 두 사용자 로그인 아님 |
| TypeScript / 생성 validator 일치 | 통과 | 대상 배포의 파일 일치 증거 아님 |
| 수신자 제한 결함 주입 | 해당 이름의 테스트 실패, 복원 후 재통과 | 전체 위협 모델 증명 아님 |
| 브라우저 320/375/1280px 초대 흐름 | 넘침·UUID 노출 없음, 최소 44px 버튼 | synthetic API 사용; 전체 접근성/실계정 인수 아님 |

이번 문서 변경은 링크/경로·명령·설정 이름의 정합성만 확인한다.
전체 CI, 운영 배포, 실제 인증된 두 계정 여정 완료를 주장하지 않는다.
최종 실행자는 후보 commit/파일 집합, 적용 migration 번호, 비밀 없는 key_id,
환경의 제어 상태, 집중 검사 결과, 실제 인증 여정 결과, rollback 확인을 기록한다.
토큰·서명 원문·초대 코드·ciphertext·프로필 응답·메모를 로그/캡처/인수 문서에 남기지 않는다.
현재의 운영 인수 준비와 상위 계약의 전체 공개 승인은 별개다.

### 코드 근거

- [부모 연결](../../app/src/screens/OracleProfileV2.tsx), [연결 비교 화면](../../app/src/screens/OracleConnectedComparison.tsx)
- [클라이언트 API](../../app/src/domain/account/oracle-profile-comparison-api.ts), [입출력 계약](../../app/src/domain/account/oracle-profile-comparison-contract.ts)
- [Edge 진입점](../../supabase/functions/oracle-profile-comparison/index.ts), [gateway handler](../../supabase/functions/_shared/oracle-profile-comparison-handler.mjs)
- [계정 환경 구성](../../app/src/domain/account/config.ts), [계정 저장 UI 관문](../../app/src/domain/account/account-journal-api.ts)
- [합성 DB 시험](../../supabase/tests/local-postgres/oracle-profile-comparison.test.mjs), [validator 생성/검사](../../app/scripts/build-oracle-profile-comparison-validator.mjs)
