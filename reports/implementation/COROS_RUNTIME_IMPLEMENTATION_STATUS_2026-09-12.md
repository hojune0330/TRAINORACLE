# COROS_RUNTIME_IMPLEMENTATION_STATUS_2026-09-12.md

```yaml
status: IMPLEMENTATION_IN_PROGRESS_NOT_LIVE
owner: COACH_HOJUNE
base_sha: 87e78be6553c30cf5c8163e9871567f41907d402
email_work: EXCLUDED_BY_OWNER
production_database_changed: false
provider_credentials_accessed: false
real_health_data_accessed: false
provider_request_sent: false
canonical_promotion: false
```

## 범위와 근거

오너는 남은 COROS 연동 개발을 승인했으며 메일 작업은 제외했다.
원문은 제공된 COROS API Reference V2.1.1 75쪽 PDF다. 기존 신청 준비 스펙의
제한은 COROS 개발에 한해 최신 승인으로 보완했으며 Garmin 승인을 확대하지 않았다.
기존 공개 앱과 바로가기 기능은 그대로 유지한다.

## 구현 구역

| 구역 | 산출물 | 실제 완료 범위 |
|---|---|---|
| 일일 데이터 수신 | coros-daily.mjs / handler | 허용 필드·결측·날짜·body 상한·성공 응답 조건 |
| 암호화 저장 | coros-daily-storage.mjs | AES-256-GCM, 계정/연결/세대/날짜 AAD, HMAC 중복 식별, 고정 HTTPS Supabase repository |
| 일일 DB | migration 0038 | 암호화 버전 저장, 전체 배치 트랜잭션, 계정·세대·동의 검사 |
| 연결 해제 | disconnect_coros_connection RPC | 내 연결만 철회, 연결 세대 변경, 늦은 쓰기 차단 |
| OAuth | coros-oauth.mjs | 공식 URL/form/응답 검증, 일회용 state 수명주기, 저장소 주입 경계. 실제 계정 연결과 구분 |
| 훈련 전송 준비 | coros-workout-export.mjs | Step/Repetition·거리/시간/회복·명시적 m/s 구간·단일/일정 요청·deletedIds 검증. 실제 송신과 구분 |

일일 자료는 동일 내용이면 합산하지 않는다. 같은 날짜의 다른 내용은 새 pending
버전으로 보존한다. provider 수정 순서가 없으므로 도착 시각만으로 최신을 고르지 않는다.
DB에는 값 원문이 아닌 암호문을 저장한다. 제공자 ID와 사용자 메모를 암호화 전
임의 필드로 추가할 수 없도록 정규화 결과를 다시 검증한다.

키 회전 시 HMAC 식별자도 달라질 수 있다. 키 교체는 중복 식별 전환 검토가
필요하며, 이 초안만으로 과거/새 키 데이터를 동일 측정값으로 자동 승격하지 않는다.

## 검수와 증거

- 최종 COROS 모듈 시험: `node --test supabase/tests/coros-*.test.mjs` 51/51 통과.
- 최종 로컬 PostgreSQL(PGlite) 회귀 시험: `supabase/tests/local-postgres`의 `npm test` 157/157 통과.
- HTTP → 정규화 → 실제 암호화 → 실제 SQL 삽입/재전송/철회 시험 통과.
- SQL scope 배열 NULL 취급 결함을 독립 검수에서 발견했다. 회귀 시험을 수정 전
  실행해 실패를 확인한 뒤 `IS NOT TRUE`로 교정하고 재실행해 통과했다.
- PGlite는 단일 세션이다. 행 잠금과 직렬 순서 검사는 다중 연결 경합 실증이 아니다.
- 공급자 verifier는 합성 함수다. 실제 COROS 서명 검증 성공으로 보고하지 않는다.
- CI에 COROS 모듈 검사를 추가. DB 시험은 기존 local-postgres glob에 포함된다.
- 저장 모듈과 export에 독립 소스 검수 완료. export 실패 응답에 data가 있어도
  수신 승인 범위나 삭제 지시로 채택하지 않도록 교정했다.
- OAuth 독립 검수에서 인증정보 포함 요청의 기본 redirect-follow 정책을 발견했다.
  교환·갱신·철회 요청 모두 `redirect: "error"`로 고정하고 회귀 시험을 추가했다.
- `git diff --check` 통과. 앱 화면이나 운영 DB는 이번 구역에서 변경하지 않았다.
- `Length`는 원문 56쪽에서 정수로 규정하므로 소수 시간을 반올림하지 않고 거절한다.
  `TotalTime`과 명시적 m/s 구간의 소수는 보존한다. 페이스나 역치 추정은 하지 않는다.

## 실제 서비스 연결까지 남은 통합

1. 공급자 client/secret과 암호화 키를 서버 secret 경로에 등록.
2. V2.1.1에서 빠진 signature 계산·body 포함 여부·nonce/시간 정책 확정.
3. OAuth 일회용 state 저장, 토큰 암호화 영속화, HTTP endpoint와 현재 계정 UI 연결.
4. 일일 verifier와 구현된 DB adapter를 운영 설정에 연결. 원격 철회와 로컬 철회 상태를 구분.
5. 활동 확인함과 기존 일지의 명시적 조정 UI 연결. 출처 수용 없이 통계에 넣지 않음.
6. 선택된 실제 계획을 전송 구조로 매핑하고, 사용자 확인·중복 송신 제어·실패 복구 연결.
7. 실제 시험 계정 동의, 수신/전송/해제 검증 후 공개 활성화.

메일 작업은 하지 않는다. signature 확인이 없는 동안 수신 verifier를 임의의
해시나 고정 true로 교체하지 않는다. 인증키가 없는 상태에서 연결 버튼을
성공처럼 동작시키지 않는다. 아직 배포 가능한 전체 COROS 서비스가 아니다.

[DRAFT_COMPLETE]
