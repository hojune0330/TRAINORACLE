# ACCOUNT_STORAGE_PREKEY_RELEASE_RUNBOOK.md

## 상태와 적용 범위

- 상태: PRE_KEY_RELEASE_PREPARATION. 운영 적용·복구키 보관은 미실행.
- 대상: PR #322의 계정 중심 일지·계획·꾸미기 저장과 SQL 0032~0037.
- 이번 승인: 로컬 개발, 합성 데이터 검수, PR 갱신, CI, 독립 검토 및 운영 절차 준비.
- 제외: 실제 운영 키 생성·등록, 운영 DB 변경, 기능 활성화, 병합에 따른 공개 배포.
- 이 문서는 오너 승인이나 운영 실행 증거를 대신하지 않는다.

## 1. 복구키 전에 끝낼 준비

| 순서 | 산출물 | 완료 판단 |
|---|---|---|
| 1 | 저장·복구 코드 및 대용량 개선 | 원본·현재 포인터·미전송본 보존, 전체 검사 결과 기록 |
| 2 | 이력 조회 UI | 진행률·중단·재시도, 현재 계획 유지, 모바일 좁은 화면 확인 |
| 3 | 독립 DB 연결 시험 | 서로 다른 실제 연결의 경합·CAS·동일 요청 재전송 증거 |
| 4 | PR와 CI | 원격 head와 로컬 SHA 일치, 해당 SHA 검사 결과 |
| 5 | 독립 리뷰 | 검수 대상 SHA/변경 범위, 발견·수정·잔여 한계 |
| 6 | 운영 인수 자료 | 아래 적용·중단·복구 순서, 민감정보 없는 실행 영수증 양식 |

시험용 메모·기록·키만 사용한다. 테스트용 두 연결은 실제 운영 계정 두 개나
실기기 검증이 아니다. 실행하지 못한 시험은 준비와 실행을 분리해 표시한다.

## 2. 운영 변경 전에 확인할 것

1. 최종 PR SHA, 현재 main, CI·검수 대상이 같은지 확인한다. 다른 작업자가
   main을 바꿨으면 새 diff를 검토한다. PR #320을 이 통합 작업과 따로 배포하지 않는다.
2. 승인된 Supabase 프로젝트와 실제 migration ledger를 읽어 비교한다.
   로컬 링크나 과거 보고서만으로 적용 여부를 단정하지 않는다.
3. 순서대로 필요한 migration만 적용할 계획을 작성한다:
   `0032_multi_adjusted_plan_snapshots.sql`, `0033_account_journal_revision_foundation.sql`,
   `0034_account_journal_history_and_trash.sql`, `0035_account_journal_gateway_cutover.sql`,
   `0036_account_journal_retention_worker.sql`, `0037_account_plan_collection.sql`.
   앞선 migration과의 의존 관계도 실제 ledger에서 확인한다.
4. 서버 `ACCOUNT_JOURNAL_V2`와 프런트 `VITE_FEATURE_ACCOUNT_JOURNAL`은 활성화하지
   않는다. SQL의 초기값이나 화면 숨김만으로 실제 서버 차단을 가정하지 않는다.
5. 운영 DB와 필요한 키 버전·서명 키의 복구 사본을 각각 승인된 보관처에서
   확인한다. 키가 없는 DB 백업은 원문 복구 수단이 아니다. 키 값은 이 문서,
   채팅, 명령 인자, 스크린샷, PR, CI 로그에 넣지 않는다.
6. 요청/응답 원문을 수집하는 프록시·오류 추적·플랫폼 로그 설정도 확인한다.

## 3. 적용 순서: 배치와 활성화는 별개

1. 위 체크를 완료하고 정확한 운영 변경 권한을 확인한다.
2. 기능을 비활성 상태로 유지한 채 승인된 migration chain을 적용한다.
   기존 테이블·암호문·키를 삭제하거나 구형 writer를 재개하지 않는다.
3. 기존 `account-journal`과 새 `account-plan-collection` 함수를 같은 검수 SHA로
   배치한다. 새 함수는 `auth.getUser(token)`으로 인증하고 사용자 JWT의 RPC를
   사용한다. service-role로 사용자 권한 검사를 우회하지 않는다.
4. 두 함수의 `verify_jwt=false`는 플랫폼 검사를 함수 내부의 명시적 사용자
   검증으로 대체하는 설정이다. 익명 허용이 아니다. 실제 Edge 환경에서
   익명/만료 토큰 401, 기능 비활성의 접근 거절, CORS·no-store를 확인한다.
   클라이언트가 확인한 세션의 토큰을 요청 Authorization에 고정해야 한다.
   SDK의 두 번째 세션 조회에 맡기지 않는다. 계획 부품 stage의 의도 ownerId도
   서버 인증 주체와 일치해야 하며, 계정 전환 뒤 응답 무시만으로 이를 대체하지 않는다.
5. 필요한 설정 이름: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `TRAINORACLE_JOURNAL_ALLOWED_ORIGINS`, `TRAINORACLE_JOURNAL_KEYRING_JSON`,
   `TRAINORACLE_JOURNAL_ATTESTATION_JSON`. 값은 승인된 비밀 관리 경로로만 주입한다.
6. 실제 계정 A/B, 별도 브라우저/기기로 사용자 구분·응답 유실·재접속·이력·
   수정/삭제 경합·복원·계정 전환을 확인한다. 동의 취소 후 접근 거절도 확인한다.
7. 복구 시험과 운영 검수 후 제한 범위부터 공개한다. 계정별 출시 제한을
   전역 플래그만으로 구현했다고 가정하지 않는다. 실제 제한 수단이 없으면
   공개 전에 별도 판단한다.
8. 30일 만료 작업은 대상과 비대상을 먼저 확인하고 별도 운영 일정으로 설정한다.
   계획 원본·미해결 충돌·중복 방지 영수증을 단순 오래됐다는 이유로 삭제하지 않는다.
9. 최종 프런트 빌드·배포 SHA와 공개 화면, 실제 저장/재조회까지 확인한 뒤에만
   사용자에게 배포 완료라고 보고한다.

## 4. 장애 시 중단과 복구

| 상황 | 즉시 할 일 | 하면 안 되는 일 |
|---|---|---|
| 키 누락·잘못된 키 | 새 저장 중지, 설정 버전 확인, 기존 키 보관처 확인 | 다른 키로 같은 key ID 재사용 |
| 저장 응답 유실 | 같은 operation ID의 영수증 조회 및 같은 내용 재시도 | 실패로 단정하고 새 계획 덮어쓰기 |
| 서로 다른 기기 수정 | 서버 revision 확인, 양쪽 원본 보존·사용자 선택 | savedAt으로 한쪽 자동 폐기 |
| 부분 전송 | 현재 포인터 유지, 남은 부품 재확인 후 원자 commit | 전송된 부품을 곧바로 현재 계획 표시 |
| 이력 조회 실패/중단 | 현재 계획 유지, 재시도·중단 상태 표시 | 빈 이력이나 완전한 백업으로 표시 |
| 구형 기기 미전송본 | 암호화 보존, 온라인 이력 보관 또는 명시적 서버 선택 | 이전 완료 전 삭제·가짜 ACK |
| 앱/함수 결함 | 서버 쓰기 제한, 프런트 안내, 새 초안 보존 | 구형 덮어쓰기 경로 다시 열기 |
| DB 복원 필요 | 외부 연동을 끈 격리 환경에 DB+키+영수증+삭제 표식 복원 | 운영 DB를 확인 없이 과거 상태로 덮기 |

기능 중단은 서버 승인 경로에서도 적용해야 한다. 프런트 숨김만으로 API 쓰기가
중단되지 않는다. 자동 rollback SQL이나 키 삭제 명령은 제공하지 않는다.
서버 전체 비활성화가 조회에도 미치는 영향은 실제 환경에서 확인하고 안내한다.

## 5. 증거 양식

키·JWT·일지 원문 없이 다음만 기록한다:

```text
source_sha:
pr_url:
environment: LOCAL_SYNTHETIC | ISOLATED_DB | PRODUCTION
executed_at:
operator_or_reviewer:
migration_ids_verified:
function_versions_verified:
feature_state_before_after:
case_name:
expected_outcome:
observed_outcome:
pass_fail_not_executed:
remaining_action:
```

## 6. 문서 연결

- [승인된 저장 계획](ACCOUNT_CANONICAL_STORAGE_IMPLEMENTATION_PLAN.md)
- [일지 gateway 기존 운영 절차](DEPLOYMENT_ACCOUNT_JOURNAL_DRAFT_RUNBOOK.md)
- [계획 분리 저장 통합 보고](reports/implementation/ACCOUNT_PLAN_COLLECTION_INTEGRATION_2026-09-08.md)
- [일곱 작업의 과거 실행 기록](reports/implementation/ACCOUNT_STORAGE_SEVEN_TASK_DELIVERY_2026-09-08.md)

과거 보고의 당시 미완료 표현은 역사적 기록이다. 최신 코드와 이번 후속 보고를
함께 읽되 과거 실패·중단 증거를 지우거나 현재 완료로 바꿔 적지 않는다.

[DRAFT_COMPLETE]
