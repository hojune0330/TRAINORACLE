# WHOOP OAuth 서버 프로토콜 구현

작성·공식 계약 확인: 2026-10-29. 기존 TrainOracle 소스는 읽기만 했으며 수정하지 않았다. 지정된 이 폴더의 신규 세 파일만 작성했다.

## 범위와 근거

- OAuth 안내: https://developer.whoop.com/docs/developing/oauth
- API 레퍼런스: https://developer.whoop.com/api
- 공식 OpenAPI JSON: https://api.prod.whoop.com/developer/doc/openapi.json
- refresh 폼 예제: https://developer.whoop.com/docs/tutorials/refresh-token-postman
- 최소 권한 지침: https://developer.whoop.com/docs/developing/getting-started

실제로 읽은 OAuth 문서는 authorization/token URL, state 왕복 검증, `offline`을 요청해야 refresh token이 발급된다는 점, 갱신 시 기존 access/refresh token 모두 무효화됨을 명시한다. 공식 OpenAPI의 서버는 `https://api.prod.whoop.com/developer`, 철회 경로는 `DELETE /v2/user/access`, 성공은 본문 없는 204이다.

문서 간 state 길이 문구에 차이가 있다. OAuth 안내는 8자로 표현하고 Postman 예제는 최소 8자라고 설명한다. 여기서는 보안상 32바이트 난수의 64자리 hex state를 사용한다. 실제 공급자 서버와 이 길이로 왕복 검증한 것은 아니다. 공식 문서는 OAuth 라이브러리 사용을 권장한다. 이 파일은 외부 의존성 없는 격리 프로토콜 구현이며 공급자 인증이나 보안 심사를 대신하지 않는다. PKCE 지원은 공식 확인을 하지 않아 임의 추가하지 않았다. 운영 전 지원 여부를 별도 확인해야 한다.

## 파일·실행

- `whoop-oauth.mjs`: Web Crypto·fetch 기반 서버 전용 모듈, 의존성 설치 불필요.
- `whoop-oauth.test.mjs`: Node 내장 test/assert 및 메모리 저장소를 이용한 합성 시험.
- `README.md`: 주입 계약과 운영 연결 한계.

권장 실행 환경: Web Crypto 전역과 fetch/Response/ReadableStream이 있는 Node 22 이상 또는 호환 서버 런타임. Node 시험 명령:

```sh
node --test whoop-oauth.test.mjs
```

초기 합성 결과는 57개 통과였다. 독립 리뷰 2건 수정 및 회귀시험 6개 추가 후 63개, 빈 redirect 구분자 회귀시험 2개 추가 후 현재 결과: **65개 통과, 실패 0개, 생략 0개**. 각 수정 전에 해당 신규 회귀시험이 모두 실패함도 확인했다. 검수 상세는 이 문서 하단에 기록한다. 실 WHOOP HTTP 요청, 실제 secret/token 조회, 건강자료 조회, 개발자 앱 등록·배포는 하지 않았다. 문서와 공개 OpenAPI만 조회했다.

## 주입과 공개 메서드

```js
import { createWhoopOAuth } from './whoop-oauth.mjs';
const oauth = createWhoopOAuth({
  clientId: configuredPublicClientId,
  getClientSecret: ({ signal }) => serverSecretVault.read({ signal }),
  redirectAllowlist: ['https://your-domain.example/oauth/whoop/callback'],
  store: productionStore,
  fetchImpl: serverFetch,
});
```

이 예제의 변수들은 실제로 구현하거나 등록한 것이 아닌 주입 지점이다. dependency는 요청 body/query로부터 받으면 안 된다. 서버가 고정한 callback URL만 사용한다.

1. `beginAuthorization({accountId, sessionBinding, redirectUri, offline=false})`
   - `{authorizationUrl, expiresAt}`만 반환한다. URL의 state는 OAuth 왕복용 비밀값이므로 접속·분석 로그에서 제거한다.
   - 기본 scope는 `read:workout` 하나다. 백그라운드 수집이 필요하면 사용자가 동의하는 단계에서 `offline:true`를 명시하여 `read:workout offline`으로 요청한다.
2. `completeAuthorization({accountId, sessionBinding, redirectUri, state, code})`
   - 거절 응답은 `code` 대신 `error`로 전달한다. provider의 `error_description`은 전달하거나 표시하지 않는다.
   - 반환은 `{provider:'whoop',connected:true,scopes:['read:workout'],offline,expiresAt}`이며 토큰·secret이 없다.
3. `refresh({accountId})`
   - offline 동의가 없으면 실패한다. form-urlencoded POST, `grant_type=refresh_token`, `scope=offline`, client credentials 및 기존 refresh token을 보낸다.
   - 응답의 새 access/refresh token 모두를 원자적으로 교체한다. 새 토큰 누락·기존 값 재사용·권한 확대는 오류이며 이전 refresh token을 새 응답에 덧붙이는 fallback은 없다.
   - 반환은 토큰 없는 연결 DTO이다. 자동 refresh나 재시도는 하지 않는다.
4. `revoke({accountId})`
   - access token을 Authorization Bearer 헤더로 보내고 정확히 204 및 빈 본문을 확인한 후 로컬 연결을 삭제한다.
   - `{provider:'whoop',connected:false,providerRevoked:boolean}`을 반환한다. 원래 미연결이면 공급자 요청 없이 세대만 올리고 `providerRevoked:false`다.
   - 401을 이미 철회됨이라고 추정하지 않는다. 실패하면 성공으로 표시하거나 로컬 토큰을 삭제하지 않는다.
5. `getReadonlyCredentials({accountId})`
   - **서버 내부 전용**: `{accessToken,scopes:['read:workout']}`. 브라우저 응답·앱 상태·로그에 절대 직렬화하지 않는다. secret/refresh token은 반환하지 않는다.
   - 만료된 연결은 `REAUTH_REQUIRED`. refresh/재동의가 필요하며 자동 수행하지 않는다.

## 필수 인증 경계

모듈은 HTTP 인증기가 아니다. 모든 accountId는 신뢰된 로그인 세션에서 추출하고, 호출자가 그 계정의 연동을 시작·갱신·철회할 권한이 있는지 서버에서 검증해야 한다. 요청 본문의 accountId를 신뢰하면 안 된다. `sessionBinding`은 서버가 검증한 로그인 세션의 안정적인 불투명 식별자로 넣고, 브라우저가 선택하는 값으로 사용하지 않는다. 이를 accountId와 함께 해시하여 state에 묶는다. 동의 시작과 callback에서 동일한 로그인 세션을 요구한다. 로그인 변경·세션 만료 시 새 동의 흐름을 시작한다.

callback handler는 중복 state/code/error 파라미터, code와 error 동시 존재, 예상하지 않은 callback origin/path를 파싱 단계에서 거절해야 한다. callback 응답에는 `Cache-Control: no-store`, 적절한 Referrer-Policy를 적용하고 완료 후 깨끗한 앱 URL로 이동한다. code, state, URL query를 로그·analytics·에러 트래커로 전송하지 않는다. 새 HTTP handler를 제공한 것은 아니다.

## 필수 저장소 계약

합성 테스트의 Map 저장소는 시험용일 뿐이다. 아래 계약을 구현하는 암호화된 서버 저장소가 없으면 운영 보안 특성이 성립하지 않는다. 모든 함수는 전달된 AbortSignal을 지원하고, **이미 취소된 작업의 늦은 쓰기를 커밋하지 않도록 원자적 abort/fencing 검사**를 해야 한다. 모듈은 악의적이거나 abort를 무시하는 저장소의 부작용을 되돌릴 수 없다.

- `withAccountLock({accountId,signal}, work)`
  - work() 결과를 반환하고 종료까지 계정 단위 독점권을 유지하며, callback의 resolve/reject 어느 쪽에서도 finally로 잠금을 해제해야 한다. 중복 호출하면 안 된다.
  - 모듈은 잠금 callback 내부에서도 작업과 AbortSignal을 race한다. secret/fetch가 취소를 무시하고 영구 pending이어도 deadline의 abort로 callback이 종료되어 저장소의 잠금 해제 경로에 도달한다. 잠금 획득 자체 또는 잠금 해제를 무시하는 저장소까지 강제로 복구하지는 못한다.
  - 여러 프로세스·인스턴스에도 적용되는 분산 잠금/직렬화가 필요하다. 잠금 획득 대기도 취소 가능해야 한다. 갱신과 철회·재연결이 서로 충돌하지 않게 한다. 잠금 만료에는 fencing token 또는 동일 수준의 보호가 필요하다.
- `putState({stateHash,record,signal}) -> true | false`
  - stateHash는 SHA-256 hex다. 충돌 시 덮어쓰지 않는 원자적 insert-only를 수행한다.
  - record: `{accountId,bindingHash,redirectUri,offline,epoch,issuedAt,expiresAt}`. 원문 state/sessionBinding은 저장하지 않는다.
  - 기본 TTL은 5분이며 설정 상한은 10분이다. TTL 청소, 계정별 pending-state 수 제한, 요청 rate limit은 운영 저장소/handler에서 제공해야 한다.
- `consumeState({stateHash,accountId,bindingHash,redirectUri,now,signal}) -> record | null`
  - 같은 hash 및 계정·세션 해시·redirect가 일치하고 `expiresAt > now`일 때만, 원자적으로 한 번 삭제하며 record를 반환한다. 불일치는 반환하지 않는다.
  - 원자적 DELETE ... RETURNING/트랜잭션 같은 방식이 필요하다. 먼저 SELECT하고 별도 DELETE하면 replay 방지가 성립하지 않는다.
  - 모듈도 반환 metadata·TTL·세대를 재검사한다. 거절 및 실패한 code exchange도 state를 소비한다. 재시도는 새 consent부터 한다.
- `loadConnection({accountId,signal}) -> {epoch,connection}`
  - 처음에도 `{epoch:0,connection:null}`을 반환한다. 연결을 지워도 epoch는 남기는 tombstone이다.
  - connection: `{accessToken,refreshToken,scopes,expiresAt,offline}`. offline=false이면 refreshToken은 null이다.
  - scopes는 `['read:workout']` 또는 `['read:workout','offline']`이다.
- `saveConnection({accountId,expectedEpoch,nextEpoch,connection,signal}) -> boolean`
  - 현재 epoch가 expectedEpoch와 같고 nextEpoch가 정확히 +1일 때만 원자적 CAS로 토큰 전체 또는 null을 저장한다.
  - 성공은 true, 충돌은 false. 계정별 epoch는 절대 초기화하지 않는다. 이를 통해 오래된 consent가 연결/철회 뒤 다시 살아나지 못한다.

토큰과 secret은 암호화 at rest, RLS/서비스 역할 경계, KMS/secret vault, 접근 감사·보존 기간이 필요하다. 저장소 adapter의 원문 예외도 저장하거나 노출하지 않는다. 토큰을 메모리에서 물리적으로 영구 소거하는 것은 JS 문자열 특성상 보장하지 못한다.

## 기존 whoop-readonly와의 연결

읽기 확인한 파일:
`C:\Users\admin\.aside\u\0\sessions\2026-10-29_FstEX1IKB2i6o61D\tmp\source\hojune0330-TRAINORACLE-1ef3a32\supabase\functions\_shared\whoop-readonly.mjs`

해당 모듈이 기대하는 exact DTO `{accessToken,scopes:['read:workout']}`와 일치한다. offline scope가 저장되어 있어도 읽기 어댑터에는 노출하지 않는다.

```js
// 이미 서버에서 인증·권한 검증된 accountId를 closure로 고정한다.
const reader = createWhoopReadonlyAdapter({
  getCredentials: () => oauth.getReadonlyCredentials({ accountId }),
  fetchImpl: serverFetch,
});
```

기존 모듈을 수정하거나 실제 edge endpoint에 연결하지 않았다. readonly adapter가 넘기는 signal은 위 단순 예시에서 전달되지 않으므로 두 모듈 각각의 자체 deadline만 작동한다. 요청 전체의 일관된 취소가 필요하면 외부 orchestration 취소 계약을 추가해야 한다. 이미 반환된 read access token은 동시에 시작한 철회·refresh로 공급자에서 무효화될 수 있다. 실제 데이터 읽기의 generation 검사, stale 응답 폐기, 재시도 정책은 기존 호출 계층에 연결해야 한다.

## 응답·오류·네트워크 방어

- token endpoint는 정확한 200, bearer token 형식, 정수 expires_in(1초~365일), 정확한 최소 scope 집합을 검증한다. expiresAt은 secret 조회 후 실제 token 요청 직전 시각에 expires_in을 더해 보수적으로 계산한다. 네트워크·본문 수신 지연으로 유효기간을 늘리지 않는다. 본문 파싱 완료 시점에 이미 만료되었으면 REAUTH_REQUIRED로 거절하고 저장하지 않는다. code 교환과 refresh 모두 동일하게 적용한다. 제한된 allowlist connection만 저장하고 공급자의 추가 객체 필드는 버린다. scope 누락은 관대한 추정 대신 오류로 처리한다. 이 엄격성은 실제 공급자 응답으로 추가 호환성 검증해야 한다.
- HTTPS canonical callback만 exact allowlist로 허용한다. 사용자정보·fragment·query 및 custom scheme을 지원하지 않는다. URL.hash/search가 빈 구분자를 빈 문자열로 정규화하므로 원문 uri.includes('#') 및 uri.includes('?')도 검사하여 빈 fragment/query까지 거절한다. WHOOP가 custom scheme을 허용해도 이 서버 구현은 더 좁게 제한한다. native 앱 복귀는 검증된 서버 callback 뒤 별도 검증 경로로 연결해야 한다.
- secret 조회·저장소·잠금·fetch·stream 읽기를 포함한 전체 작업에 기본 10초 deadline, 최대 30초가 있다. 바깥 응답뿐 아니라 잠금 callback도 abort race로 종료하고 abort listener를 정리한다. 중단된 원작업 promise의 늦은 rejection은 race가 관찰한다. 기존 stop 검사·CAS/abort fence와 abort 무시 fetch의 늦은 본문 취소는 유지한다. cleanup cancel의 완료를 기다리지 않아 끝나지 않는 cancel이 응답을 붙잡지 않는다.
- abort race는 외부 의존성 자체를 강제 종료하지 않는다. 잠금을 놓은 뒤에도 원격 요청이 계속 실행될 수 있으므로, 늦은 로컬 커밋을 막는 저장소 fencing과 공급자 상태가 불명확한 갱신의 격리·복구 정책은 여전히 필요하다.
- token 응답은 기본 64KiB, 최대 1MiB; content-length와 실제 stream 둘 다 제한한다. JSON content-type/UTF-8/JSON 구문을 검사한다. 철회 응답은 0바이트를 요구한다.
- redirect:error 외에 status, redirected 및 실제 URL을 확인한다. 임의 공급자 URL이나 return-to URL을 받지 않는다.
- 오류에는 정해진 code/name/message만 있으며 provider body·URL·secret·token·cause를 넣지 않는다. 자체 console 로깅은 없다.

## 운영 연결 전 반드시 남은 것

1. WHOOP 앱 생성/검토, 승인된 clientId/secret vault 주입, 등록 callback과 allowlist 일치 검증. 이번 작업은 등록하지 않았다.
2. 인증된 시작·callback·refresh·연동 해제 HTTP edge handler, CSRF/Origin/rate limit, 로그 제거, native 복귀, secret 없는 UI 응답.
3. 위 계약의 운영 암호화 DB 및 계정 소유권 정책, 분산 lock/CAS/fencing, TTL 청소와 제한, 저장소 자체 장애 시험.
4. refresh 스케줄러와 모니터링. 공급자 회전 성공과 로컬 저장 사이에는 원격 시스템·DB를 가로지르는 원자성이 없다. timeout/네트워크 단절/저장 실패 시 공급자는 이미 토큰을 회전했을 수 있다. 자동으로 옛 refresh token을 재시도하지 말고, 연결 상태를 별도 '확인 필요'로 격리해 재동의/복구 정책을 적용해야 한다. 이 모듈은 durable recovery queue나 격리 상태를 구현하지 않았다.
5. 철회 실패·만료 토큰의 운영 처리. 현재 코드는 401을 성공으로 간주하지 않는다. 사용자의 연동 해제 즉시 로컬 수집을 중단하는 별도 상태와 공급자 철회 재시도/재인증 안내가 필요하다. 기존 건강자료 보존·삭제는 별도 개인정보 정책이다.
6. 실제 sandbox OAuth 왕복·refresh 회전·revocation·앱 승인 및 모바일 복귀 시험, 배포. 합성 65개 통과는 이 완료를 의미하지 않는다.

## 독립 리뷰 수정 및 회귀시험

2026-10-29, 원래 tmp/whoop 세 파일만 수정했다. 부모 candidate 사본·기존 TrainOracle 소스·공유 파일은 수정하지 않았다.

1. Medium: 바깥 timeout만 반환하고 잠금 callback이 pending으로 남던 문제를 callback 내부 Promise.race(work, abort)로 수정했다. abort 전후 검사, 늦은 fetch body 취소, CAS/abort fence는 유지했다.
2. Low: 교환 완료 시각을 기준으로 expiresAt을 계산하여 지연만큼 수명을 과대평가하던 문제를 요청 직전 시각 기준으로 수정했다. 수신 후 이미 만료된 토큰은 REAUTH_REQUIRED이며 connection을 저장하지 않는다.

추가 시험 6개:
- abort를 무시하는 영구 pending secret 뒤 같은 계정 disconnect 및 reauth 성공.
- abort를 무시하는 영구 pending fetch 뒤 같은 계정 disconnect 및 reauth 성공.
- timeout 후 잠금 해제·재연결 뒤 늦은 fetch 본문 취소 및 새 연결 덮어쓰기 없음.
- authorization code 교환에서 expires_in=1, 본문 수신 중 가짜 시계 +2초이면 거절·저장 없음.
- refresh에서도 동일한 가짜 시계 +2초이면 거절·기존 저장값 불변.
- secret 조회 +3초·네트워크 +2초일 때 요청 직전 시각으로 만료 계산하여 네트워크 지연을 더하지 않음.

수정 전 위 6개가 모두 실패했고, 수정 후 Node v26.5.0에서 당시 전체 **63/63 통과**, 실패·취소·생략 0개였다. 외부 네트워크·실제 secret·실제 개인 건강자료를 사용하지 않는 합성 회귀시험이며 운영 연결 완료 증거는 아니다.

### 빈 redirect fragment/query 구분자 추가 보완

원문 URL에 `#` 또는 `?`가 있는지 직접 검사한다. `new URL('https://example/cb#').hash === ''` 및 빈 query의 동일한 정규화 때문에 기존 getter 검사만으로 놓치던 경우를 막는다. 기존 HTTPS·canonical·exact allowlist 검사는 유지했다.

빈 `#`와 빈 `?` 회귀시험 **2개 모두 수정 전 실패, 수정 후 통과**를 확인했다. 최종 전체 시험은 **65/65 통과, 실패·취소·생략 0개**다. 이 추가 보완도 원래 tmp/whoop의 세 파일만 수정했으며 부모 candidate·기존 소스·공유 파일은 수정하지 않았다.
