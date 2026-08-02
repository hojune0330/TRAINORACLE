# TrainOracle 서버 운영 안전장치 구현 보고서

> 이 문서는 `0018` 구현 당시의 기록이다. 현재 데이터베이스 적용 순서는
> `docs/SUPABASE_SETUP.md`의 `0001`~`0025`이며, 계정 계층 시험 증거는
> `reports/operations/SUPABASE_TRIAL_MIGRATION_RECEIPT_2026-08-02.md`, 문의판
> 추가 시험 증거는 `reports/operations/FEEDBACK_BOARD_TRIAL_RECEIPT_2026-08-03.md`에 있다.

## 한눈에 보기

계정과 동기화 기능을 공개하기 전에 필요한 운영 안전장치를 저장소에 준비했다. 문제가 생기면 전체 서비스를 멈추는 대신 계정, 동기화, 공유, 계획 제안, 제품 분석을 각각 따로 닫을 수 있다. 로컬 일지는 계속 사용할 수 있다.

이번 변경만으로 서버 기능이 켜지지는 않는다. 데이터베이스 변경 `0018_server_operations.sql`은 아직 운영 서버에 적용하지 않으며, 다섯 서버 기능의 기본값도 모두 `꺼짐`이다.

## 구현 내용

### 기능별 긴급 차단

- 서버 기능 키: `ACCOUNT`, `SYNC`, `SHARING`, `PLAN_PROPOSALS`, `PRODUCT_ANALYTICS`
- 알 수 없는 기능 키와 누락된 설정은 항상 꺼진 것으로 처리한다.
- 설정 변경은 서비스 역할만 가능하다.
- 변경 이유, 전후 상태, 변경 시각과 실행자를 별도 감사 기록에 남긴다.
- 앱 사용자의 직접 쓰기는 각 기능이 꺼져 있으면 데이터베이스에서도 거부한다.
- 제품 분석 동의 철회와 기존 분석 자료 삭제는 분석 기능이 꺼져 있어도 가능하다.

### 보존기간 정리

- 30일이 지난 제품 분석 자료와 삭제 예정일이 지난 계정을 정리하는 서비스 전용 함수를 추가했다.
- 동시에 두 번 실행되지 않도록 잠금을 사용하고, 한 번 계산한 기준 시각으로 처리한다.
- 삭제 건수와 워크플로 실행 번호를 `retention_cleanup_runs`에 남긴다.
- GitHub 예약 실행은 저장소 변수 `TRAINORACLE_SERVER_OPERATIONS_ENABLED=true`일 때만 동작한다.
- 운영 서버 주소와 서비스 역할 키가 없으면 실행 전에 실패한다.

### 배포 영수증과 복구

- 정상 배포물에 소스 커밋, 이전 Pages 커밋, 워크플로 번호와 시각을 담은 `trainoracle-deploy-receipt.json`을 포함한다.
- 수동 복구는 `gh-pages` 이력에 존재하는 과거 커밋만 허용한다.
- 복구된 내용은 새 커밋으로 배포하므로 이력을 지우지 않는다.
- 복구 이유와 사고 이슈 번호를 `trainoracle-rollback-receipt.json`과 실행 요약에 남긴다.

## 운영자가 준비할 값

서버 기능을 실제로 열기 전 다음 값이 필요하다.

| 구분 | 값 | 현재 상태 |
|---|---|---|
| 저장소 변수 | `TRAINORACLE_SERVER_OPERATIONS_ENABLED` | 설정하지 않음, 자동 정리 꺼짐 |
| 저장소 비밀 | `TRAINORACLE_SUPABASE_URL` | 설정하지 않음 |
| 저장소 비밀 | `TRAINORACLE_SUPABASE_SERVICE_ROLE_KEY` | 설정하지 않음 |
| 데이터베이스 | `0018_server_operations.sql` 적용 | 미적용 |
| 서버 기능 5종 | 기능별 활성 상태 | 모두 꺼짐 |
| 앱 기능 5종 | 빌드 환경 변수 | 모두 꺼짐 |

서비스 역할 키는 앱 빌드, 브라우저, 로그, PR, 배포 파일에 넣지 않는다.

## 당시 데이터베이스 순서 (역사 기록)

아래 목록은 `0018` 구현 시점의 18개 순서다. 현재 적용 절차의 정본으로
사용하지 않는다. `0018`은 `0015`의 계획 이력, `0016`의 200석 제한,
`0017`의 동기화 버전 계약에 의존하므로 당시에도 중간 번호를 건너뛸 수 없었다.

1. `0001_journal_sync.sql`
2. `0002_journal_tombstones.sql`
3. `0003_beta_accounts.sql`
4. `0004_support_invitations.sql`
5. `0005_support_connection_hardening.sql`
6. `0006_retention_cleanup.sql`
7. `0007_guardian_confirmations.sql`
8. `0008_plan_proposal_actions.sql`
9. `0009_account_deletion_actions.sql`
10. `0010_product_analytics_actions.sql`
11. `0011_product_analytics_consent.sql`
12. `0012_guardian_authority_hardening.sql`
13. `0013_shared_journal_projection.sql`
14. `0014_guardian_invitation_server_expiry.sql`
15. `0015_plan_proposal_atomic_activation.sql`
16. `0016_atomic_beta_capacity.sql`
17. `0017_sync_schema_version.sql`
18. `0018_server_operations.sql`

## 공개 순서

1. 별도 시험 환경에서 데이터베이스 변경을 적용한다.
2. 기능이 모두 꺼졌고 일반 사용자가 설정을 바꿀 수 없는지 확인한다.
3. 계정 삭제와 분석 자료 만료 정리를 시험하고 영수증을 확인한다.
4. 기능 한 가지씩 서버 스위치를 켠 뒤 앱 스위치를 켠다.
5. 문제가 생기면 서버 스위치를 먼저 끄고 운영 기록을 남긴다.
6. 서비스 운영자가 수정 결과를 확인한 기능만 다시 연다.

## 확인한 경계

- 이 작업은 데이터베이스 변경과 GitHub Actions 준비 작업이다.
- 운영 Supabase에는 아무 변경도 적용하지 않았다.
- 예약 정리 워크플로는 활성화하지 않았다.
- 실제 공개 사이트에 복구 워크플로를 실행하지 않았다.
- 계정, 동기화, 공유, 계획 제안, 제품 분석의 공개 권한은 열지 않았다.

## 검증 결과

- 서버 운영 집중 계약 검사: `56/56` 통과
- 앱 단위 검사: `698/698` 통과
- 실제 브라우저 시나리오: `189` 통과, 화면 조건에 따른 정상 건너뜀 `39`, 실패 `0`
- 앱 타입 검사와 브라우저 타입 검사: 통과
- 프로덕션 빌드: 통과
- D9 안전 평가기: `11/11` 통과
- 구현 계약 검사: `125/125` 통과
- 보존기간 응답의 음수·소수 건수 거부: 통과
- 복구 사유 코드와 사고 번호 변조 거부: 통과
- 복구 영수증 경로를 심볼릭 링크로 바꾸는 변조 거부: 통과

이 환경에는 `psql`, Supabase CLI와 Docker가 없어 실제 PostgreSQL 실행 검증은 하지 않았다. 따라서 `0018`은 저장소 계약과 적대적 변조 검사까지 완료한 상태이며, 운영 적용 전에 별도 시험 Supabase에서 트랜잭션·권한·계정 삭제 시나리오를 다시 실행해야 한다. 최종 통과 수와 GitHub Actions 주소는 PR에도 함께 남긴다.
