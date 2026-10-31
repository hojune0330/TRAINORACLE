# COROS MCP OAuth lifecycle 독립 구현

이 폴더에는 `coros-mcp-oauth.mjs`, `coros-mcp-oauth.test.mjs`, `README.md`만 있습니다. 기존 공유파일은 수정하지 않습니다. 실제 외부 등록, 로그인, 토큰 발급, 배포는 하지 않았습니다.

## 범위 및 의존성

- 기존 `supabase/functions/_shared/coros-mcp.mjs`의 리전·discovery 검증, PKCE, authorization URL, code token request 구현을 직접 import해 재사용합니다.
- import 경로는 현재 두 세션의 디렉터리 배치에 종속됩니다. 프로젝트에 편입할 때 같은 모듈에 대한 상대경로만 조정해야 합니다. 파일을 복사해 중복 구현하지 않았습니다.
- 이번 작업은 코드 구현과 합성시험입니다. 공식 사이트 최신 상태를 추가 조사하거나 실제 COROS 응답과의 호환성을 확인하지 않았습니다. 기존 검증 규칙을 약화하지 않았습니다.
- Node 26.5.0에서 실행했습니다. production Deno/Supabase 런타임·번들러 검증은 별도로 필요합니다.

## 구현된 orchestration

1. `begin({accountId, region, redirectUri})`: 명시된 US/EU/CN 리전과 서버 설정 HTTPS redirect 허용목록을 검사합니다. 세대를 예약한 뒤 같은 리전의 protected-resource 및 authorization metadata를 제한된 GET으로 검증하고, 그 뒤에만 public-client DCR을 실행합니다. PKCE verifier와 state 거래 전체는 저장소에 보관하고, 호출자에는 정제 상태와 authorization URL만 반환합니다. 기본 `enabled:false`입니다.
2. `complete({accountId, region, clientId, redirectUri, generation, state, code})`: account + region + client + redirect + generation + state와 TTL을 원자적으로 검사하고, 토큰 교환 **전에 한 번만 consume**합니다. 실패·시간초과 후 동일 code/state를 다시 사용하지 않습니다. 사용자 거절은 `code` 없이 `error`로 전달하며 원문 오류를 반환하지 않습니다.
3. `refresh(accountId)`: 원자적 operation lease로 프로세스 간 동시 refresh를 한 개로 제한합니다. 회전 refresh token을 교체하고, 정상 응답에서 생략한 refresh token/scope는 기존 값을 유지합니다. 초기 scope는 명시적인 정확한 `mcp.tools`만 허용합니다. refresh도 권한 확장을 거절합니다.
4. `disconnect(accountId)`: 먼저 로컬 세대 증가와 credential/거래 삭제를 commit합니다. 그 뒤 검증된 metadata가 revocation endpoint를 광고한 경우 refresh/access token을 각각 best-effort revoke합니다. 미광고는 `unsupported`, 실패는 `failed`입니다. `accepted`는 HTTP 성공을 뜻하며 제공자 측 폐기 완료의 증명이 아닙니다.
5. code/refresh 응답의 commit에는 동일 generation, operation ID, 상태 및 lease TTL을 다시 검사합니다. disconnect 뒤 도착한 유효 토큰은 저장하지 않고 best-effort revoke합니다. 이전 거래가 새 연결을 덮어쓰거나 실패 처리로 지우지 못합니다.
6. `status(accountId)`와 성공 응답에는 provider, generation, region, connected, pending, reauthRequired만 있습니다. begin에만 authorizationUrl, disconnect에만 revocation 결과가 추가됩니다. access/refresh token, client_secret, verifier, 원시 provider 응답은 HTTP용 반환값에 없습니다. 모듈은 로그를 생성하지 않습니다.

`connected`는 연결 상태이지 토큰의 남은 유효시간이나 MCP tool 준비 완료를 보장하는 값이 아닙니다. HTTP 응답은 서버가 전달받은 정제 결과에 한정해야 하며 저장소 record나 claim을 직렬화하면 안 됩니다. OAuth에서 브라우저로 전달해야 하는 state와 public client ID는 authorization URL에 포함됩니다. PKCE verifier와 서버 거래 record는 포함되지 않습니다. authorization URL과 callback query도 접근 로그·분석 로그에서 제거해야 합니다.

### 보수적인 응답 규칙

- discovery는 기존 정확한 리전·endpoint 검증 외에 authorization_code/refresh_token 지원 광고를 요구합니다. revocation endpoint가 광고되면 고정 리전 주소와 정확히 같아야 합니다. 미광고 주소를 추측해서 호출하지 않습니다.
- DCR 응답은 요청한 redirect, grants, response type, `token_endpoint_auth_method:none`을 정확히 확인합니다. client_secret 필드가 있으면 저장하지 않고 거절합니다. confidential-client 전환·임의 endpoint·기본 US fallback은 없습니다.
- token_type은 Bearer, access token은 제한된 비어 있지 않은 ASCII, expires_in은 1~2,592,000 정수 초, scope는 정확히 `mcp.tools`여야 합니다. 초기 scope 생략은 OAuth의 허용 가능성과 별개로 보수적으로 거절합니다. refresh scope 생략만 기존 grant로 해석합니다.
- fetch마다 redirect 금지, cookie 제외, no-store, timeout 1~30,000ms, stream byte 제한(기본 64KiB), content-type/UTF-8/JSON 검사가 있습니다. 네트워크·body가 AbortSignal을 무시해도 호출 대기는 종료됩니다. 오류는 고정 코드 허용목록만 남기고 cause/원문을 전달하지 않습니다. 자동 HTTP 재시도는 없습니다.
- `mcp.tools`가 읽기 전용을 보장하지는 않습니다. 기존 read client의 tool allowlist, 앱 안전 게이트, 필드 정규화·최소 수집·보관 검토를 유지해야 합니다. 이 OAuth 모듈은 수입/폴링/쓰기/GPX 기능을 활성화하지 않습니다.

## 주입 저장소 계약: 실제 DB·암호화 구현이 아님

생성자에 `store.atomic(accountId, callback)`을 주입합니다. callback은 동기 함수이며 `null` 또는 mutable record를 받아 `{record, result}`를 반환합니다. store는 record를 원자적으로 저장하고 result만 호출자에게 돌려주어야 합니다.

필수 운영 계약:

- provider/account별 모든 서버·worker·배포 인스턴스에서 SERIALIZABLE 수준 또는 동등한 원자성. 단일 프로세스 mutex만으로 대체하면 안 됩니다.
- callback의 모든 변경은 commit 또는 전부 rollback. callback throw 시 일부 변경이 기록되거나 공유 객체에 새면 안 됩니다. 반환값은 commit 성공 뒤 전달합니다.
- 누락 row 생성도 동시 실행에 안전해야 합니다. generation은 영속 정수이며 disconnect 이후 0으로 초기화하거나 record를 단순 삭제하면 안 됩니다. 삭제 복구·백업 복원에서도 stale 응답이 유효해지지 않도록 별도 account epoch가 필요할 수 있습니다.
- credential, PKCE verifier, pending 거래를 암호화 저장하고 provider/account를 AAD로 바인딩해야 합니다. KMS/키 회전/권한 분리/보관기간/감사/백업의 비밀정보 제거를 구현해야 합니다. DCR은 public client만 받으므로 client_secret은 저장하지 않습니다.
- record는 내부 신뢰 데이터입니다. 클라이언트가 직접 쓰거나 다른 account record를 읽을 수 없어야 합니다. DB 오류·record·callback result 내부의 비밀값을 로그로 남기지 않아야 합니다. DB 트랜잭션 자체에도 별도 deadline이 필요합니다.
- `now`는 신뢰할 수 있고 worker 간 시간 편차가 제한된 시계여야 합니다. 시험만 가짜 시계를 씁니다. 운영 TTL을 DB clock과 정렬하고 skew 정책을 결정해야 합니다.
- callback에는 네트워크 I/O가 없습니다. 교환 전 consume / 응답 후 조건부 commit 두 트랜잭션 사이에 HTTP를 실행합니다. 테스트의 Map+queue store는 rollback/복제 모사를 위한 **평문 메모리 시험 대역**일 뿐, 실제 암호화·DB 구현이 아닙니다.

record에는 generation/status/region/client/pending/credential/operation이 있습니다. `credential`은 accessToken, refreshToken, scope, expiresAt이고 `pending`에는 verifier/state 및 모든 binding이 있습니다. 이 구조는 공개 API 스키마가 아닙니다. 기존 read client's tokenProvider를 연결하려면 같은 세대·계정 검사를 하는 별도 내부 전용 credential adapter가 필요하며, 이 모듈은 token을 반환하는 공개 API를 제공하지 않습니다.

## 경쟁·장애 경계와 한계

- refresh 중 다른 요청은 BUSY입니다. lease가 만료되었거나 refresh 결과가 모호하면 기존 refresh token을 재사용하지 않고 credential을 지우고 재승인을 요구합니다. 자동 재시도 때문에 회전 토큰 계열을 망가뜨리지 않기 위한 가용성보다 안전 우선의 선택입니다.
- registering/exchanging 중 process crash는 원격 결과를 복원하지 않습니다. 명시적 disconnect 후 다시 연결하는 복구 정책이 필요합니다. 만료 pending은 complete에서 삭제됩니다. 서버의 별도 정리 작업과 오래된 operation 탐지·UI가 남아 있습니다.
- DCR을 보낸 직후 disconnect/crash가 발생하면 원격에 등록 client가 남을 수 있습니다. client 삭제/관리 endpoint를 추측하거나 사용하지 않습니다. 외부 상태까지 포함한 원자적 commit을 주장하지 않습니다.
- 로컬 timeout 이후 제공자가 토큰을 발급했으나 응답을 얻지 못하면 그 토큰을 revoke할 방법이 없습니다. malformed/scope 불일치 응답에서 token 필드를 믿어 후속 요청하지 않으므로 원격 token이 남을 수도 있습니다. 로컬에는 저장하지 않습니다. 운영에서는 provider 만료 정책·승인 취소 안내·보안 이벤트 및 재승인 정책을 검토해야 합니다.
- 유효한 늦은 응답을 얻은 경우 revoke는 best effort입니다. process crash·전원 중단에도 폐기를 보장하려면 암호화 revocation outbox/worker와 idempotency 정책이 별도로 필요합니다. 현재는 outbox/분산 job 구현이 아닙니다.
- disconnect는 이미 제공자로 전송된 요청을 되돌리지 않습니다. 현재 구현은 로컬 재연결 방지와 확인 가능한 늦은 credential 폐기에 집중합니다.
- timeout은 각 fetch에 적용되며 begin 전체는 discovery 2회 + DCR 1회, disconnect는 revoke 최대 2회가 직렬 실행됩니다. 원자 저장소 호출에는 이 HTTP timeout이 적용되지 않습니다. 전체 요청/서버 deadline과 provider rate-limit·DCR 등록 수 제한은 endpoint에서 추가해야 합니다.

## 남은 DB / endpoint / UI 작업

- **DB**: 실제 트랜잭션 adapter와 schema/migration, 암호화 credential store, KMS 연동, generation 보존, TTL 청소, revoke outbox, 접근 제어, 감사·비밀정보 redaction, 장애 복구/다중 인스턴스 시험.
- **Endpoint**: 인증된 session에서 accountId를 도출하고 사용자 입력 accountId를 신뢰하지 않기. CSRF/origin/재인증/명시 동의/속도 제한/기능 gate를 추가하기. begin URL은 해당 소유자에게만 전달하기. callback query의 중복 키, code+error 동시 전달, issuer 혼동을 차단하고 trusted session/route의 region·client·redirect·generation으로 complete binding을 구성하기. HTTP caller가 임의 account/client/generation을 정하는 공개 endpoint로 이 메서드를 그대로 노출하면 안 됩니다. callback 이후 깨끗한 URL로 redirect하고 cache-control no-store/referrer-policy no-referrer를 설정하기.
- **UI**: 명시적 지역 선택, 권한 설명·동의, 새 연결/거절/만료/BUSY/재승인/disconnect 상태, revoke 실패·미지원 안내, 중복 연결 방지. 실제 사용자 로그인 시험은 별도 승인을 받아 수행해야 합니다.
- **통합·운영**: 기존 기능 flag/승인 조건을 유지한 채 read client와 내부 token provider를 결합하기. MCP initialize/tools discovery/읽기 tool allowlist 검증, 데이터 정규화·동의·삭제·retention, 별도 Partner API 승인 경계 유지, Deno 배포·CORS·에러 매핑/관측성 검증. 실제 COROS 계정/리전/등록 응답/rotation/revocation 호환성은 미검증입니다.

## 합성시험

실행:

```powershell
node --test 'C:\Users\admin\.aside\u\0\sessions\2026-10-29_khtPg4xXRnhG5Hek\tmp\coros\coros-mcp-oauth.test.mjs'
```

전체 fetch가 주입된 대역이며 인터넷 요청은 없습니다. discovery/DCR 순서, 3개 리전, S256, binding 6종, TTL, 중복/동시 callback, 거절, token/scope 검사, rotation/생략 응답, 인스턴스 간 refresh 경쟁, lease 만료, disconnect 중 늦은 code/refresh/DCR, revoke 실패, 응답 크기·type·redirect·timeout, 오류 redaction, verifier 비노출을 검사합니다. 실제 PostgreSQL 직렬화, KMS 암호화, 제공자 호환성, 브라우저/모바일 UI, 배포/네트워크 보안의 증명은 아닙니다.

최종 실행 결과: Node 26.5.0, 42 tests / 42 pass / 0 fail / 0 skip (합성시험).

## 독립 리뷰 수정 및 RED → GREEN 검증

이번 수정은 같은 폴더의 기존 세 파일에만 적용했습니다. 외부 OAuth, 실제 등록/로그인/배포 및 기존 공유파일 수정은 하지 않았습니다.

### 회귀시험을 먼저 실행

구현을 바꾸기 전에 회귀시험 11개를 추가했습니다. **수정 전: 42개 중 기존 31개 통과, 추가 11개 실패**를 실제 실행해 확인했습니다.

- code exchange / refresh 각각 credential commit과 failOperation DB 호출이 모두 실패하면 revoke가 0회인 문제: 2개 실패.
- refresh claim DB 응답을 지연한 동안 lease 만료, 다른 요청의 lease 정리, disconnect가 발생해도 이전 refresh token HTTP를 전송하는 문제: 3개 실패.
- 빈 fragment `#` 및 빈 query `?`가 붙은 redirect 설정이 생성자 검증을 통과하는 문제: 2개 실패.
- code exchange / refresh 각각 body 지연이 만료시각에 더해지는 문제와 body 완료 때 이미 만료한 토큰을 승인하는 문제: 4개 실패.

### 수정 사항

1. code/refresh 실패 정리는 `Promise.allSettled`로 DB 상태 정리와 알려진 credential revoke를 독립적으로 시작합니다. DB 정리가 reject되어도 revoke를 생략하지 않고, 원래 오류를 정제하여 반환합니다. DB 정리 완료를 기다리는 시간은 저장소 자체 deadline에 여전히 의존하지만 revoke 시작은 이를 기다리지 않습니다. DB 복구·폐기 보장용 outbox를 구현했다는 뜻은 아닙니다.
2. claim에 operation `expiresAt`을 포함하고 token HTTP 직전 원자적으로 generation, operation ID, 상태, lease 일치·만료, region/client 소유권을 다시 검사합니다. DB 응답 반환 자체가 늦을 수 있어 preflight 반환 후에도 lease 만료를 확인합니다. 같은 방어를 code exchange에도 적용했습니다. 검사와 외부 HTTP를 분산 원자 트랜잭션으로 만들지는 않습니다. 최종 소유권 검사 뒤 시작된 in-flight 요청은 disconnect가 되돌릴 수 없으며, 응답 commit의 세대 검사와 알려진 늦은 credential 폐기는 계속 유지됩니다.
3. redirect 설정은 URL 객체의 search/hash 검사뿐 아니라 원문에 `?` 또는 `#`가 있는 경우도 거절합니다. 빈 구분자도 허용하지 않습니다.
4. `expiresAt`은 body 완료시각이 아니라 **token HTTP 요청 직전의 보수적 timestamp + expires_in**으로 계산합니다. body 완료 후 이미 만료했다면 TOKEN_REJECTED로 거절하고, 파싱·검증을 마친 알려진 credential은 실패 정리에서 revoke합니다. DB commit callback에서도 credential 만료를 재확인합니다. HTTP·body 지연만큼 유효기간을 늘리지 않습니다.

**수정 후: 42개 전부 통과, 실패 0, 건너뜀 0.** 위 시험은 가짜 시계와 주입 fetch/평문 메모리 저장소 대역만 사용했습니다. 실제 암호화 DB, 제공자 토큰 수명, 분산 네트워크 원자성 및 COROS OAuth 호환성을 검증한 결과는 아닙니다.

기존 공유파일의 수정 전후 SHA256은 동일합니다: `9E8883A9091F19629D73129B59A749F6B2C67C963A12CA49EF440ECFCB21A1FC`.
