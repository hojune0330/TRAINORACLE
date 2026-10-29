# 운동 데이터 연동 재점검 및 1차 구현 재시도

- 확인일: 2026-10-29 KST
- 앱 원본: `1ef3a325834aa5111a63a8c068d0d904838278c7`
- 모바일 조회 기준: `35d8e23c61174044f0e9908f56c045debe8a5a1c`
- 상태: 서버 전용 읽기 프로토콜 기반 구현. 실제 OAuth 연결·건강 데이터 수신·앱 공개 완료가 아님.
- 운영 DB/feature/기존 일지/훈련계획/도메인 분석/모바일 서명·권한은 변경하지 않음.

## 1. 메일과 공개 문서를 구분한 현황

### Garmin

새 회사메일의 2026-10-16 21:13:55 KST 회신, 티켓 229441을 직접 읽었다.
프로그램 개편 중 신규 API 접근 요청 심사·승인이 잠정 중단됐고 재개일은 제시할 수
없다는 안내다. 승인 메일이 아니다. 받은 편지함과 Garmin 전체 검색(스팸/휴지통 포함)
결과에서 이보다 새로운 관련 회신은 확인되지 않았다. 메일 원문·추적값·인증값은 복제하지 않는다.

그러나 10월 29일 공개 문서와 실제 신규 신청 화면은 Personal/Business Starter/Enterprise를
안내했다. 과거 회신만으로 현재도 신청 불가라고 단정하지 않는다.

- Personal API: 본인 Garmin Connect에서 개인 키를 발급해 토큰을 생성하는 경로.
  여러 TrainOracle 사용자를 위한 사업자 연동의 대체로 사용하지 않는다.
- Starter: Activity/Training 등, Push 전용, 과거 자료 미포함, 사용자 수 제한.
- Enterprise: Push 또는 Ping/Pull, 과거 자료·사용자 수·상업 조건은 계약별.
- 신규 Starter 신청서를 열어 필수항목만 점검했다. 전송하지 않았다.
  사업장 주소·우편번호, 법적 대표 직함 표기, 12개월 예상 연동 사용자 구간,
  실제 사업모델·제3자 데이터 처리 설명의 확인이 필요하다.

공식 근거:
- https://developer.garmin.com/gc-developer-program/overview/
- https://developer.garmin.com/gc-developer-program/personal/personal-api/
- https://www.garmin.com/en-US/forms/StarterGarminConnectDeveloperAccess/

### COROS

기존 개인메일의 2026-10-11 KST 회신을 직접 읽었다. 8월 29일 Partner 신청은 유효하며
재신청 불필요, 자격증명 발급 일정 미정, 현 단계 추가 신원서류 불필요라는 답변이다.
같은 회신은 사용자별 OAuth MCP로 승인 없이 운동/FIT 읽기와 훈련·일정 쓰기가 가능하며
다중 사용자 서비스에서 LLM 없이 호출할 수 있다고 안내했다.

공식 공개 문서도 승인 없는 MCP 경로를 안내한다. 사용자별 권한은 그 사용자 데이터만
대상이며 웹훅은 없다. Partner API 승인·웹훅·양방향 활동 동기화와 구분한다.
공개 도구 안내의 훈련 생성 지원은 실제 계정의 도구 발견·스키마·실행 성공 증거가 아니다.

공개 GET만으로 다음을 재확인했다. 인증·활동 데이터 요청은 하지 않았다.
- 공통 MCP URL HTTP 401 → 미국 리전 보호자원 metadata 안내.
- 미국 리전 보호자원/authorization metadata 모두 HTTP 200.
- S256, code, public token auth `none`, `mcp.tools`, registration endpoint 광고.
- 관측 리전은 모든 사용자 리전이 아니다. 자동으로 미국에 고정하지 않는다.

공식 근거:
- https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP
- https://github.com/coroslab/COROS-MCP
- https://github.com/coroslab/COROS-MCP/blob/main/docs/en/tools.md
- https://modelcontextprotocol.io/specification/2025-03-26/basic/transports

### WHOOP

공식 v2 API의 `read:workout` 읽기 경로를 구현 대상으로 선택했다. 개발자 대시보드는
로그인 화면이었고 저장된 WHOOP 로그인 후보는 없었다. 회원 로그인·앱 등록·OAuth
자격증명 존재는 미확인이다. Sandbox 테스트와 공개 확장 심사는 구분한다.

공식 근거:
- https://developer.whoop.com/docs/developing/overview/
- https://developer.whoop.com/docs/developing/app-approval/
- https://api.prod.whoop.com/developer/doc/openapi.json
- https://developer.whoop.com/docs/developing/pagination/

### Apple Health / Samsung Health / Health Connect

현재 웹 UI의 건강앱 파일 안내는 SDK 자동연동이 아니다. 조회한 모바일 원본 트리에는
문서 저장 브리지만 있었으며 건강 브리지 파일은 확인되지 않았다. 이번 변경에
네이티브 브리지를 구현하거나 capability/서명/스토어 설정을 바꾸지 않았다.

- Apple: iOS HealthKit 네이티브 브리지, 타입별 동의, entitlement·안내문, 기기 조회 필요.
  빈 조회만으로 읽기 권한 거부 또는 데이터 부재를 확정하면 안 된다.
- Samsung: 우선 Android Health Connect로 Samsung Health가 실제 공유한 운동을 읽는
  경로를 검토한다. Samsung 전용 데이터 SDK는 개발자 모드의 읽기 시험과 일반 배포
  파트너 승인이 별개다. 개발자 모드는 일반 배포의 우회가 아니다.
- Health Connect: 네이티브 SDK/manifest·런타임 권한 필요. 기본 과거 읽기 제한과
  이력/백그라운드 추가 권한을 구분한다. 원본 앱이 기록하지 않은 자료는 만들지 않는다.

공식 근거:
- https://developer.apple.com/documentation/healthkit/setting-up-healthkit
- https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data
- https://developer.android.com/health-and-fitness/health-connect/read-data
- https://developer.android.com/health-and-fitness/health-connect/publish
- https://developer.samsung.com/health/data/process.html

## 2. 실제 코드 변경

### COROS MCP

`supabase/functions/_shared/coros-mcp.mjs`
- Partner V2.1.1 `coros-oauth.mjs`와 별도 namespace. 기존 코드를 대체하지 않음.
- US/EU/CN 공식 issuer/resource/endpoint 고정과 metadata 검증.
- 무작위 state·PKCE S256, 인증 URL·resource-bound code exchange 요청 builder.
- 서버 전용, 기본 OFF, owner/연결 세대 검사 콜백, 늦은 응답 거절.
- MCP 2025-03-26 초기화·session·tools/list 페이지네이션·JSON/SSE 수신.
- 로컬 허용 도구는 활동 목록/상세/랩 세 개뿐. 쓰기·건강·프로필·FIT 다운로드 차단.
- tokenProvider·fetch·body 시간제한, 크기 제한, redirect 금지, 정제 오류.
- 결과는 `UNREVIEWED_PROVIDER_RESULT`로 반환할 뿐 정규화·저장·화면·분석에 연결하지 않음.
- provider scope `mcp.tools` 자체는 읽기 전용 권한을 보장하지 않음. 로컬 호출 제한을
  제공자 권한 축소로 잘못 표현하지 않음.

### WHOOP

`supabase/functions/_shared/whoop-readonly.mjs`
- 서버 전용 v2 GET 목록 한 페이지와 개별 운동 UUID 조회.
- 자격증명 콜백에 정확한 `read:workout` scope만 허용.
- 공식 호스트 고정, redirect 금지, 자격증명부터 본문까지 deadline/크기 제한.
- 오류 원문·토큰·cause를 외부 오류로 전달하지 않음.
- UUID, 운동 start/end, 수정 시각, 종목, timezone, score 상태와 선택적 거리만 allowlist.
- user_id·심박·메모·위치 제외. 없는 거리/미채점 거리를 0으로 만들지 않음.
- `next_token`을 다음 호출 `nextToken`으로 명시적으로 반환. `single_page_only`로 표시.
- 호출자의 인증·owner/connection-epoch 검증은 통합 계층의 미완료 책임.

각 모듈의 합성 시험을 추가했고 `app/package.json`의 기존 device-integration 시험 뒤에
`test:device-providers`를 연결했다. 기존 시험·CI를 제거하거나 축소하지 않았다.

## 3. 검증 범위

- 신규 COROS MCP: 18건 통과.
- 신규 WHOOP: 24건 통과.
- 기존 COROS 모듈: 51건 통과. 위 신규 모듈을 포함한 실행은 93/93.
- 기존 앱 device integration 계약: 11/11 통과.
- 위 관련 합성/계약 검사 합계 104/104. 전체 앱 테스트나 실계정 연동 성공 수치가 아님.
- 두 신규 모듈 `node --check` 통과.
- COROS 로컬 tool gate 결함주입에서 해당 이름 시험 실패 후 원본 복구·재시험.
- WHOOP redirect·scope·원문 노출 결함주입은 각 이름 시험 실패 후 해시 일치 복구·재시험.
- 독립 검토에서 COROS token callback 예외/무기한 대기, stale body 정리,
  비협조 스트림/cancel 대기, metadata 문자열 허용, CR SSE 처리를 발견해 보완했다.
  재검토의 COROS 추가 결함은 미발견. WHOOP의 timeout 이후 늦은 주입형 응답 본문
  미취소를 추가로 발견해 비대기 취소와 회귀시험을 보완했다.
- 로컬 환경은 child pipe 제한 때문에 `--test-isolation=none`으로 실행했다.
  실제 npm 전체 시험/원격 CI/앱 build/네이티브 build/실기기/실 OAuth 왕복은 별도다.

실행 명령(원본 루트):

```powershell
$cases = Get-ChildItem supabase/tests/coros-*.test.mjs
node --test --test-isolation=none @($cases.FullName) supabase/tests/whoop-readonly.test.mjs
# app/에서:
node --test --test-isolation=none scripts/validate-device-integration.test.mjs
```

## 4. 실제 연동까지 남은 작업

모든 공개 사용자 연동은 계속 미완료다. 이번 결과를 연동 성공·공개 승인으로 쓰지 않는다.

- [blocked] COROS 실연동: 등록 client·공식 리전 확인, account-bound 일회용 PKCE state
  저장/콜백, 승인된 암호화 토큰 보관, 사용자 OAuth 동의·철회와 실제 왕복 필요.
  builder를 실제 callback으로 오인하지 않는다. 수동 확인함 DTO·필드 출처 검토도 남았다.
- [blocked] Garmin: 새 Starter 신청의 사실 확인 항목과 제출 확인, 제공자 자격증명/테스트
  계정 승인 필요. Personal API를 일반 서비스 계정 공유키로 쓰지 않는다.
- [blocked] WHOOP: 사용자 로그인·개발 앱 등록·OAuth·암호화 보관과 caller owner/epoch
  연결이 필요. 현재 어댑터만으로 endpoint를 공개하지 않는다.
- [blocked] Apple/Samsung: 건강 네이티브 브리지 자체 구현이 남았다. 이후 서명된
  기기 빌드에서 권한·취소·빈 결과·계정 전환·중복·기존 기록 보존 시험이 필요하다.
- [blocked] 공개 활성화: 사용자 안내·최소수집·삭제/철회·보안 검수·실기기/실계정
  증거 후 별도 결정. 기존 분석 provenance, D9/RVE/안전 게이트는 그대로 유지한다.

공개 상태 endpoint도 10월 29일 조회에서 `publicUserLinking:false`,
`dataIngestion:FAIL_CLOSED`, 2026-08-29 기준 application-pending 응답을 반환했다.
이는 상태 endpoint의 응답 관측이며 전체 운영 DB 설정을 직접 감사한 것은 아니다.
