# COROS_PARTNER_V211_EXECUTION_2026-09-12.md

```yaml
status: OWNER_AUTHORIZED_REFERENCE_RECEIVED_SIGNATURE_DETAILS_REQUIRED
owner: COACH_HOJUNE
reviewed_at: 2026-09-12
provider_reference_version: V2.1.1
reference_original_obtained: true
production_changed: false
credentials_received: false
health_data_received: false
workout_sent: false
canonical_promotion: false
```

## 승인과 현재 상태

오너는 COROS 연동 진행을 승인했다. 메일은 §5.5 일일 건강 데이터 수신,
§6.3 개별 훈련 생성/수정 전송, §6.1 deletedIds를 안내한다. 메일의 문서
링크 URL은 대화에 포함되지 않았다. 공식 Partner API 안내는 확인했지만
V2.1.1 원문 필드·서명·응답 계약을 대신하지 않는다.

Gmail에서 정확한 버전을 검색했으나 두 번 모두 인증 재시도 응답을 받아
원문을 읽지 못했다. 비밀값이나 건강 데이터는 요청하지 않았다.

## 실제 코드 감사

| 파일 | 확인 결과 | 필요한 작업 |
|---|---|---|
| supabase/functions/coros-oauth-callback/index.ts | 안내 화면. code/state 접근은 409 | 로그인 사용자와 묶인 일회용 state, 만료·재사용 차단, 서버 토큰 교환 |
| supabase/functions/coros-workout-push/index.ts | COROS에서 받는 운동 기록 수신부. 워치로 보내는 기능 아님 | V2.1.1 인증·수신 응답과 대조 후 유지/패치 |
| supabase/functions/_shared/coros.mjs | 제한된 활동 필드 정규화, secret 비교 | 일일 데이터에 그대로 재사용 금지. 단위·날짜·결측 별도 검토 |
| supabase/migrations/0030_device_integration_readiness.sql | 연결·활동 확인함, 계정별 ID, 기능 기본 비활성 | 일일 데이터 저장·수정·삭제, 서버 암호화 토큰, 동의 범위 추가 |

기존 client/secret 헤더 비교를 새 메일의 'signature verification'과 같다고
단정하지 않는다. 임의 HMAC 알고리즘, 서명 헤더, canonical string을 만들지 않는다.
수신 코드의 request.text() 이전 스트림 크기 제한도 후속 보안 검사 대상이다.

## 실행 순서와 완료 관문

1. V2.1.1 원문 확보: OAuth URL/스코프, 서명 입력·알고리즘·헤더,
   retry/ack, daily 단위·시간대·수정 의미, Workout 구조, deletedIds 의미를 표로 고정.
2. 스펙 패치: EXTERNAL_RECORD_INTEGRATION_SPEC, PHYSIO_SOURCE_TRUST,
   분석 출처 계약에 Partner 경로와 일일 데이터 사용 목적을 반영.
   기존 MCP 준비 문서와 신청 영수증은 과거 증거로 보존.
3. 서버 인증: 계정 결합 state, 토큰 암호화 저장/갱신/철회,
   동의 버전 및 연결 세대 검증. 브라우저·로그에는 토큰을 남기지 않음.
4. Daily 수신: 별도 HTTPS POST 함수, bounded body, 서명 검증 후
   계정·동의 확인. 최근 3일 재전송은 추가 합산하지 않고 제공자 날짜/버전으로 처리.
   역순 수정, 연결 해제 이후 늦은 응답, 계정 변경, 재연결을 검사.
5. 데이터 활용: 수면·안정시 심박·HRV·걸음·칼로리의 단위/측정·추정 출처를 보존.
   결측은 0이 아님. 기존 주관 RPE·메모를 덮어쓰지 않음.
   정상 건강 수치로 D9 위험을 해제하지 않음. 일일 데이터는 운동 횟수에 합산하지 않음.
6. 수신 URL 배포·검증 후 COROS에 전달: 도달 가능하다는 것과 인증된
   실제 payload 수신 성공을 구분. client/secret은 승인된 서버 secret 입력 경로로만 등록.
7. 사용자 연결 시험: 승인된 시험 사용자 1명 OAuth → 운동/일일 데이터 수신 →
   확인함 → 분석 출처 확인 → 연결 해제. 민감 원문 없는 결과만 증거로 저장.
8. 훈련 전송: 사용자 확인한 세션만 송신. 거리/시간/반복/세트/휴식/강도
   변환을 원문 스키마와 대조. 표현 불가능하면 거짓 근사 변환 대신 전송 불가 이유 표시.
   timeout 이후 무조건 재생성하지 않고 provider ID와 요청 버전으로 재조정.
9. 일정 수정: deletedIds가 삭제하는 범위 확인. COROS 삭제 결과가
   TrainOracle 일지·수행 기록 삭제로 전파되지 않음. 삭제/전송 경합 시험.
10. 공개: 단위·서명 변조·계정 격리·동의 철회·중복/역순·모바일 OAuth 복귀
    검사 후 PR 검수, 배포, 실제 연결 상태 확인. 전체 앱 연결 승인을
    개별 사용자의 건강 데이터 동의로 대신하지 않는다.

## 수신 URL 후보와 발송 문안

후보 경로: `/functions/v1/coros-daily-push`.
아직 함수가 배포된 것이 아니므로 이 경로를 준비 완료 URL로 보내지 않는다.

배포 검증 후 기존 파트너 메일에 회신할 문안:

> Thank you for the V2.1.1 update. We would like to enable Daily Data Push
> for TrainOracle. Our verified HTTPS receiving URL is [VERIFIED_URL].
> Please enable the integration and advise the secure process for issuing
> the client and secret credentials. We will validate the V2.1.1 signature
> and user authorization before accepting data. Please also confirm the
> retry/update semantics for daily records and the scope of deletedIds.

미발송 문안이며, URL 자리표시자 상태로 보내지 않는다.

## 현재 필요한 것

- 문서 파일 확보 완료. 아래 미명시 규격은 COROS 확인 필요.
- 검증된 수신 URL 전달 후 COROS에서 발급하는 client/secret.

두 항목은 구현 승인과 별개인 외부 입력이다. 앞선 바로가기 구현의
미커밋 변경은 그대로 보존하고 이번 문서와 혼합 배포하지 않는다.

## V2.1.1 원문 수령 후 확인

사용자가 제공한 75쪽 PDF를 수령했다. 앞부분의 링크 미확보/Gmail 실패는
수령 전 경과이며 현재 문서 미확보 상태를 의미하지 않는다.

| 페이지 | 확인된 규격 | 구현상 처리 |
|---|---|---|
| 4 | OAuth code 30분·1회, accessToken 기본 30일, form-urlencoded | 서버 인증 교환과 state 만료는 별도로 유지 |
| 44~49, §5.5 | POST, URL signature/nonce/timestamp, client/secret 검증, 최근 3일 batchDailyList | 기존 workout 인증만으로 수신 허용하지 않음 |
| 46~48 | openId → dailyList → happenDay(yyyyMMdd), 수면 시작/끝 문자열, calorie(kcal), step, 선택적 rhr, hrvList, ppgHrv, sleepAvgHr | 일일 단위 모델 별도. 누락 rhr=0 금지. HRV 원자료와 overnight 평균 구분 |
| 49 | result 문자열 0000 외 응답이면 배치 재전송 | 부분 저장 후 실패에도 멱등성 필요. 잘못된 데이터의 반복 재시도 처리 확인 |
| 59~60 | deletedIds 설명은 정수지만 실제 예시는 배열 | 배열로 대조하고 삭제 범위 확인. 일지 삭제로 전파하지 않음 |
| 62~64, §6.3 | POST https://open.coros.com/coros/tp/workout/push, token/openId/data(form), data는 단일 Workout JSON 문자열 | 일정 전송과 구분. result=0000 성공, 나머지 실패 |

### 공급자 확인이 필요한 문서 공백

1. signature 계산 알고리즘, 입력 정렬/구분자/인코딩, body 포함 여부,
   client/secret 전달 위치, timestamp 단위/허용 오차, nonce 재전송 규칙,
   검증용 입력과 정답 예시가 필요하다. 전체 텍스트 검색에서 계산식이 발견되지
   않았으며 §5.5 입력 설명의 45쪽은 렌더링으로도 제목 외 빈 페이지임을 확인했다.
2. 수면 문자열에 시간대가 없다. 사용자 현지 날짜/시간대와 DST 기준을 확인하기
   전에는 서버 시간대로 변환하거나 수면 시간을 추정해 분석하지 않는다.
3. HRV 원자료의 정확한 통계 정의·단위와 overnight ppgHrv 정의를 확인한다.
4. 최근 3일 데이터의 수정 순서를 나타내는 revision 필드가 명시되지 않았다.
   수신 시각이 늦다는 이유로 최신 측정이라고 단정하지 않는다.
5. 48쪽 샘플은 하루 수면이 여러 날에 걸친 예시를 포함한다. 샘플을 정상 범위
   또는 실제 생리 데이터로 채택하지 않는다.
6. 표지 파일명의 September 2026과 변경 이력의 V2.1.1 May 2026은 별도 값으로
   보존하며 문서 갱신일과 API 변경일을 동일시하지 않는다.

현재 단계에서 서명 검증을 생략한 운영 수신 URL은 배포하지 않는다.
서명 공백은 사용자 승인을 다시 요구하는 문제가 아니라 공급자 명세 확인 항목이다.

## 출처

## 첫 구현과 실행 증거

추가 코드:
- `supabase/functions/_shared/coros-daily.mjs`: 허용 필드 정규화, 날짜/수치 검사,
  중복 identity 배제, 스트림 body 크기 제한. 수면 시간대/지속시간은 미확정으로 보존.
- `supabase/functions/_shared/coros-daily-handler.mjs`: 인증 전 저장 방지,
  중복 서명 query 거절, 배치 전체 commit 확인 후에만 0000 응답, 오류 원문 비노출.
- `supabase/tests/coros-daily*.test.mjs`: 합성 데이터 11개 테스트 통과.

실행: `node --test supabase/tests/coros-daily.test.mjs supabase/tests/coros-daily-handler.test.mjs`
결과: 11 pass, 0 fail. 실제 COROS 서명 검증·DB 계정 격리 시험은 아니다.

1MiB body, 50명, 1인 3일, 일당 HRV 1440개 제한은 임시 로컬 방어 정책이다.
제공자가 보장한 최대 배치 크기로 표시하지 않으며 운영 전 합의가 필요하다.
같은 batch 내 중복은 거절하지만 서로 다른 요청의 중복/역순 처리는
DB adapter의 후속 작업이다. parser를 중복 동기화 완성으로 집계하지 않는다.

아직 생산용 Deno endpoint, 실제 signature adapter, transactional DB adapter,
OAuth 교환 및 훈련 송신은 연결하지 않았다. 서명 body 포함 여부에 따라 현재
handler의 검증 인터페이스도 수정될 수 있다. 실제 수신 URL은 아직 미배포다.

Gmail 원문 검색을 다시 시도했으나 인증 재시도 응답이 반복되어 메일은 미발송이다.
다음 COROS 질문에는 서명 검증 예제, client/secret 위치, timestamp 단위/오차,
nonce 재전송 정책, 수면 시간대, 수정 순서, 최대 배치 크기를 포함한다.

## 출처 목록

- 사용자 제공 COROS Partner Development Team 업데이트 메일 (원문 링크 미제공).
- https://support.coros.com/hc/en-us/articles/53181766856724-Partner-API-Access
- reports/research/COROS_MCP_INTEGRATION_READINESS_2026-09-04.md

[DRAFT_COMPLETE]
