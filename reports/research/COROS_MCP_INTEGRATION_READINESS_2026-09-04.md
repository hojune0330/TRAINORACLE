# COROS_MCP_INTEGRATION_READINESS_2026-09-04.md

```yaml
doc_id: trainoracle-coros-mcp-integration-readiness-20260904
title: COROS 공식 MCP 연동 조사와 개발 준비
version: "1.0"
status: RESEARCH_AND_IMPLEMENTATION_READINESS_DRAFT
owner: COACH_HOJUNE
reviewed_at: "2026-09-04"
repository_base: 296a84533a9f1f9c7247110dfb08f57331023689
provider_account_accessed: false
oauth_client_registered: false
token_issued_or_stored: false
health_data_requested: false
workout_sent: false
runtime_modified: false
production_modified: false
issue_closure: false
canonical_promotion: false
```

## 1. 결론

**COROS 연동을 사업자 API 승인 대기 하나로 묶어 둘 필요는 없어졌다.**
COROS가 자체 앱을 위한 사용자별 OAuth 2.0 + MCP 경로를 공식 안내한다.
다만 이것은 TrainOracle의 연결 구현, 실제 사용자 인증, 데이터 활용 계약까지
완료됐다는 뜻이 아니다. 조회부터 준비하고, 계획 전송은 실제 지원 도구를 확인한
뒤 별도 단계로 진행하는 것이 가장 빠르고 정직하다.

사용자가 전달한 파트너팀 이메일은 새로운 안내의 근거로 참조했다. 메일 전체,
개인 연락처, 메일 추적 링크는 이 문서에 복제하지 않았다. 다음 공개 자료와 대조했다.

## 2. 공식 자료와 서로 다른 상태

| 자료 | 확인한 내용 | 구현상 해석 |
|---|---|---|
| [Connect Your Data](https://support.coros.com/hc/en-us/articles/53181260265492-Connect-Your-Data) | 개인 AI 연결, 자체 앱 MCP, Partner API 경로를 구분 | 개인용 AI 연결과 TrainOracle 제품 연동을 같은 것으로 보고하지 않는다. |
| [Build on COROS MCP](https://support.coros.com/hc/en-us/articles/53181619102996-Build-on-COROS-MCP) | 2026-09-02 갱신. 별도 신청 없이 각 사용자가 OAuth 승인. 읽기와 계획 쓰기를 안내. 웹훅은 없고 조회 방식 사용 | 자체 앱의 읽기 연동을 준비할 근거는 확보. 전체 서비스용 자동 동기화 조건은 추가 확인. |
| [COROS 공식 MCP 저장소](https://github.com/coroslab/COROS-MCP) | 활동·상세·랩 조회 도구가 명시됨. 계획 상세/생성/수정 도구는 아직 `coming soon` 표기 | 쓰기 기능은 이메일만으로 활성화하지 않는다. 인증 후 실제 도구 목록과 스키마를 확인한다. |
| [Connect Your COROS to AI](https://support.coros.com/hc/en-us/articles/50841795180948-Connect-Your-COROS-to-AI) | 같은 2026-09-02 갱신 페이지에 여전히 읽기 전용이라는 문장이 존재 | 새 안내와 문서 불일치. 출시 불가로 단정하지도, 쓰기 가동 완료로 단정하지도 않는다. |
| [Partner API Access](https://support.coros.com/hc/en-us/articles/53181766856724-Partner-API-Access) | 웹훅, 다중 사용자용 자격증명, 양방향 활동 동기화 등은 별도 파트너 경로 | 기존 사업자 신청은 유지. MCP를 파트너 승인으로 기록하지 않는다. |

이메일의 "22개 데이터 항목"은 고정 저장 스키마나 모든 도구의 운영 보장이 아니다.
제품은 실제로 제공되는 도구/필드 버전을 기록해야 한다. 공식 자료의 FIT 파일 일일
한도와 Partner API 호출 한도를 전체 MCP 조회 한도로 옮겨 쓰지 않는다.

개발자 문서의 활동 조회 설명과 "COROS to your platform requires Partner API"라는
제한 문구도 해석 여지가 있다. 사용자별 조회와 플랫폼의 지속적 보관/동기화 허용
범위를 COROS에 확인한다. 이 문서가 상업 이용 조건 전체를 법률적으로 수용한 것은 아니다.

## 3. 인증 없이 직접 확인한 기술 정보

쿠키, 토큰, 사용자 식별자를 보내지 않고 공개 GET 요청만 수행했다.

| 요청 | 관측 결과 |
|---|---|
| `GET https://mcp.coros.com/mcp` | HTTP 401. `WWW-Authenticate`가 아래 보호 자원 메타데이터 주소를 안내 |
| `GET https://mcpus.coros.com/.well-known/oauth-protected-resource/mcp` | HTTP 200. 자원 `https://mcpus.coros.com/mcp`, 인증 서버 `https://mcpus.coros.com` |
| `GET https://mcpus.coros.com/.well-known/oauth-authorization-server` | HTTP 200. 아래 인증 기능을 광고 |

관측된 공개 메타데이터의 선택 필드:

```json
{
  "issuer": "https://mcpus.coros.com",
  "authorization_endpoint": "https://mcpus.coros.com/oauth2/authorize",
  "token_endpoint": "https://mcpus.coros.com/oauth2/token",
  "registration_endpoint": "https://mcpus.coros.com/connect/register",
  "revocation_endpoint": "https://mcpus.coros.com/oauth2/revoke",
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["openid", "mcp.tools", "offline_access"]
}
```

**광고된 등록 주소를 확인한 것과 실제 등록 성공은 다르다.** 등록 POST, 인증 코드
교환, 갱신/철회 요청, `tools/list`, `tools/call`은 수행하지 않았다. 인증 서버의
전체 grant 목록에 `client_credentials`가 있더라도 이를 선수 동의를 대체하는
방법으로 사용하지 않는다. 범위 이름이 `mcp.tools`라고 해서 읽기 전용 권한이
보장되는 것도 아니다.

이 실행 위치에서 미국 리전의 메타데이터가 관측됐을 뿐, 모든 사용자 계정의 리전을
미국으로 고정하면 안 된다. 공식 리전/issuer를 검증하고 자원과 토큰 대상을 결합한다.
외부 메타데이터의 임의 URL을 서버가 무조건 호출하게 만들지 않는다.

[MCP 인증 규격](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)에
따라 discovery, 인증 서버 검증, PKCE, 자원 대상 확인을 설계한다. 실제 적용할
프로토콜/SDK 버전은 구현 시 고정하며, COROS가 모든 최신 규격을 구현했다고 가정하지 않는다.

## 4. 권장 구조: AI 채팅을 거치지 않는 제품 연동

아래는 공식 조회 경로에 기초한 **TrainOracle 설계 제안**이지 현재 구현 상태가 아니다.

```text
TrainOracle 사용자
  -> COROS 연결 안내와 동의
  -> COROS 본인 OAuth 승인
  -> TrainOracle 서버 MCP 클라이언트
  -> 허용된 활동 조회 도구
  -> 응답 스키마 검증 / 최소 필드 추출 / 출처 부여
  -> 가져온 운동 확인함
  -> 기존 간편 일지에 붙이기 또는 별도 기록
  -> 수용된 필드만 분석 사본에 반영
  -> 사실 요약 / 계획과 실제 비교
```

MCP는 통신 경로로 사용한다. 데이터를 받기 위해 외부 LLM이 선수의 건강 데이터나
메모를 읽도록 만들 필요는 없다. 서버가 정해진 도구를 호출하고 구조화된 값만
기존 분석 코드에 전달하는 방식을 우선한다. ChatGPT에 COROS를 개인 연결하는
행위만으로 TrainOracle 앱의 자동 연동이 구현되지는 않는다.

### 4.1 첫 조회 범위

- 우선 후보: 제공자 활동 ID, 시작 시각/시간대, 운동 종목, 거리, 운동시간의 의미,
  수정 버전 또는 변경 감지 정보. 정확한 응답 필드 이름은 실제 스키마에서 매핑한다.
- 다음 후보: 랩/구간의 거리·시간·회복 구분. 랩 번호만으로 본운동/회복을 추측하지 않는다.
- 심박·수면·HRV 등은 해당 기능, 동의, 품질 판단을 별도로 수용한 뒤 추가한다.
- 초기 호출 목록에서 메모/피드백, 생리 주기, GPS 원본, 전체 FIT, 제공자 AI 분석을
  제외한다. 허용 도구가 불필요한 필드를 함께 반환하면 저장·로그·화면에 도달하기
  전에 폐기한다. 응답 전체를 오류 추적 서비스나 LLM에 보내지 않는다.
- 제공자의 회복률·VO2max·부하 점수는 제공자 추정치다. 기록 측정값, TrainOracle의
  계산 결과, 안전 판정으로 바꿔 이름 붙이지 않는다.

### 4.2 인증과 운영

- 기존 TrainOracle 로그인과 COROS 데이터 접근 승인은 별도다. 사용자-제공자 계정
  연결, 동일 계정 재연결, 잘못된 계정 선택을 검증한다.
- PKCE와 요청별 state/issuer/redirect URI를 결합하고 만료·재사용을 차단한다.
- 토큰은 서버의 암호화 저장 경계에서만 취급한다. 브라우저/일반 테이블/로그/PR에
  두지 않는다. 첫 읽기에 불필요한 offline 권한은 요청하지 않는 방향을 검토한다.
- 초기 UX는 사용자가 누르는 `새 기록 가져오기`. 백그라운드 조회는 허용 주기,
  토큰 갱신, 호출 제한, 철회, 과거 수정 탐지 조건을 확인한 뒤 별도 활성화한다.
- 연결 해제 즉시 작업을 중단하고, 취소된 작업의 늦은 응답도 저장하지 않는다.
  원격 철회 실패를 로컬 연결 해제 성공과 구분한다.
- 한 사용자 계정에 받은 토큰으로 다른 선수의 데이터를 조회하지 않는다.
  친구/코치 공유는 COROS 조회 권한과 별도의 TrainOracle 공유 권한이다.
- 현행 14세 미만 온라인 계정 제한과 청소년 로컬 훈련계획 사용을 혼동하지 않는다.
  이 준비안이 기존 청소년 훈련 사용 승인을 되돌리지는 않는다.

### 4.3 중복과 분석

- 계정 범위 + 제공자 + 제공자 활동 ID + 수정 버전으로 동일성을 관리한다.
  파일 내용 해시나 날짜/거리 유사도만으로 동일 운동을 확정하지 않는다.
- 같은 날 AM/PM, 자정 통과, 트레드밀, 사이클링, 여러 워치, 수정/삭제된 활동,
  재연결 후 재수신, 파일과 API의 중복을 시험한다.
- 날짜별 자동 덮어쓰기는 하지 않는다. 한 활동을 여러 일지에 중복 배분하는 것도
  막는다. 향후 자동 합치기는 이번 수동 확인 계약과 별도 결정이다.
- 사용자의 RPE와 메모는 유지한다. 공급자 값은 사용자가 확인해도 `EXPLICIT`로
  바뀌지 않는다. 출처와 분석 수용 상태를 별도 축으로 관리한다.

## 5. 현재 저장소에서 재사용할 것과 새로 필요한 것

| 실제 파일 | 현재 역할 | 후속 처리 |
|---|---|---|
| `supabase/functions/coros-oauth-callback/index.ts:1` | 안내만 표시, 인증 시도는 409 | 실제 인증 callback은 미구현. 기존 URL 존재를 OAuth 성공으로 보지 않는다. |
| `supabase/functions/coros-workout-push/index.ts` | Partner 방식의 수신 준비 | MCP 조회 클라이언트나 워치로 보내는 기능이 아니다. 별도 transport로 유지한다. |
| `supabase/functions/_shared/coros.mjs:32` | Partner push의 제한된 필드 정규화 | MCP 응답 스키마와 같다고 가정해 재사용하지 않는다. 공통 정규화 이후 계층만 공유 검토. |
| `supabase/migrations/0030_device_integration_readiness.sql` | feature-off, 연결/확인함 경계 | 암호화 토큰 저장·MCP cursor·수정/삭제 처리는 새 설계 필요. |
| `app/src/domain/import/import-draft.ts:129` | 명시적 기존 일지 합치기, revision 확인 | 확인 UX/일지 ID 보존 원칙 재사용. API source identity를 파일 import와 구분. |
| `app/src/domain/field-provenance.ts:128` | 현재 외부 파생값은 분석 불가 | 별도 provider trust 채택 필요. 규칙 ID만 추가해서 열리지도 않고, 그렇게 열어서도 안 된다. |
| `app/src/domain/account/device-training-data-connection.ts:255` | 브라우저 로컬 자료를 로그인 계정 영역에 연결 | 이름의 device는 워치가 아니다. COROS 구현으로 잘못 재계수하지 않는다. |

## 6. 스펙 변경 준비표

이번에는 아래 원본의 승인·상태·이슈를 변경하지 않았다. 변경안은 분석 준비 보고서와
함께 검수한 뒤 패치한다. 과거 신청 영수증/실행 증거는 그대로 보존한다.

| 대상 | 필요한 변경 | 유지할 경계 |
|---|---|---|
| `EXTERNAL_RECORD_INTEGRATION_SPEC.md` §2/§6/§10/§11 | COROS MCP와 Partner API 분리. 모든 COROS 경로에 사업자 승인을 요구하는 문장을 경로별 조건으로 교정 | OAuth 동의, 보안, 공개 활성화 근거, Garmin 승인 조건은 유지 |
| `OI-ERI-COROS-APPROVAL-001` | MCP와 Partner의 조건을 분리하는 수정안 검토 | 메일 수신만으로 CLOSED 처리하지 않음. 행 변경 시 실제 표 재계수 |
| `DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md` 및 새 수용 결정 | 공급자 측정값/파생값/사용자 직접값 구분, 필드별 분석 허용 범위 정의 | 가져온 값을 직접 입력값으로 위장하지 않음 |
| `PHYSIO_SOURCE_TRUST_SPEC.md` | 활동 사실, 측정 품질, 제공자 추정치의 사용 목적을 매핑 | 정상 HRV/회복률로 D9 해제 금지, 공급자 수치의 권한 과장 금지 |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | 가져온 수/확인한 수/분석에 사용한 수와 제외 이유 분리 | 원문 메모, 미기록=0, 에너지 비율 발명 금지 |
| `SPEC_QUICK_PROGRESSIVE_JOURNAL_V2_DECISION.md` §5 | 수용된 provider rule이 생긴 이후의 예외를 정확한 ID/버전으로 연결 | 기존 주관값·메모·계획 링크 보존, 무조건 자동 합치기 금지 |
| `app/public/support.html`, `app/public/legal/device-integrations.html`, 상태 endpoint, 관련 테스트 | 최신 준비 상태와 공개 가능 상태 분리 | 아직 연결되지 않은 사용자를 연결 완료로 표시하지 않음 |

## 7. 실행 단계와 종료 조건

| 순서 | 작업 | 완료 증거 | 현재 상태 |
|---|---|---|---|
| C0 | 공식 문서/공개 인증 정보 확인 | 이 문서 §2~§3 | 준비 조사 완료, 실제 계정 시험 아님 |
| C1 | source/정밀도/활용 범위 계약 패치 | 승인된 차이표, 단위·결측·권한별 fixtures | 미착수 |
| C2 | 서버 MCP client + 합성 제공자 | OAuth 위변조, 계정 격리, 허용 도구, 오류/철회 테스트 | 미착수 |
| C3 | 승인된 시험 계정 1개 연결 | 인증→활동 1건→확인함→해제 실증, 민감값 없는 증거 | 미착수 |
| C4 | 분석 반영 + 간편 일지 보완 | 중복 없이 원본 수치 일치, 출처별 집계, 수정/삭제 재계산 | 미착수 |
| C5 | 소규모 사용자 공개 | 동의·이용범위·운영 검수, 모바일 성공/실패/복귀 시험 | 미착수 |
| C6 | 계획 전송 | 실제 도구 지원, 사용자 확인, 원본 구조 왕복, 중복 전송 방지 | 미착수, 도구 상태 확인 필요 |

조회 기능을 계획 전송 전체 완성까지 기다리게 하지 않는다. 반대로 연결 성공 하나로
분석·적응·계획 전송까지 모두 완료 처리하지 않는다.

## 8. COROS에 보낼 질문 초안

아래 문안은 **미발송**이다. 회사 정보와 고객 데이터를 추가로 전송하지 않았다.

> Thank you for the update. We are preparing TrainOracle's user-authorized integration
> through the official MCP, starting with activity summaries and lap data.
>
> Could you clarify these implementation points?
>
> 1. Is the self-service route intended for a commercial multi-user app where each user
> separately authorizes their own COROS account? What limits apply to server-side polling,
> normalized activity storage, and background refresh?
> 2. Which OAuth client registration and redirect URI procedure should such an app use?
> The public metadata advertises a registration endpoint. Are there region-specific
> requirements, token lifetimes, or refresh/revocation rules we should follow?
> 3. Your developer page announces plan writing, while the public repository still marks
> the plan detail/create/update tools as coming soon. Which capabilities are live today,
> and what schema/version should we target?
> 4. What are the MCP query limits, history window, pagination, and activity edit/deletion
> semantics? Are lap summaries sufficient for stored cross-workout split comparisons?
> 5. We would also like to keep our Partner API application active for future webhook
> and large-scale synchronization requirements. Please advise the next onboarding step.

## 9. 미실시 범위

공개 자료와 인증 메타데이터만 확인했다. 실제 COROS 계정 로그인, 클라이언트 등록,
토큰 저장, 건강 데이터 조회, 메일 발송, 앱 코드 수정, 배포는 하지 않았다.
공개 메타데이터의 존재는 운영 보안 검수나 연결 성공 증거를 대신하지 않는다.

[DRAFT_COMPLETE]
