# V6_DATABASE_APPLY_READINESS_2026-09-08.md

## 새 계획 서버 저장: 실제 확인과 적용 준비

```yaml
version: "1.0"
status: LOCAL_SQL_REHEARSAL_PASSED_LIVE_DDL_PENDING
source_head: 4bb3e00521beb10a99dbe26daf134865fd97c6ac
live_data_rows_read: false
live_database_writes: false
new_training_activation: false
```

## 1. 이번에 직접 확인한 운영 DB

Supabase project `texspxlpjungyarkvtkc`, main PRODUCTION에서 2026-09-08 Chrome SQL Editor로
`begin read only`와 `rollback` 사이의 메타데이터 SELECT만 실행했다.
사용자 일지·계획 내용·개인 프로필 행이나 키는 읽지 않았다. SQL Editor의 비공개 질의
편집 상태는 생겼지만 DB 데이터/설정 변경은 하지 않았다.

| 확인 항목 | 관측 |
|---|---|
| 형식 제약 | `saved_training_plans_schema_version_check`: `schema_version = 3` |
| V6 전용 제약 | 조회한 전체 제약 5개 중 없음 |
| RLS | true |
| 소유자 정책 | SELECT/INSERT/UPDATE/DELETE 4개, PLAN_BACKUP 및 account_network_access_allowed 조건 |
| 쓰기 보호 | saved_training_plan_feature_guard가 INSERT/DELETE/UPDATE에 연결됨 |
| 로그인 역할 | authenticated의 SELECT/INSERT/UPDATE/DELETE 허용 |
| 익명 조회 | has_table_privilege(anon, saved_training_plans, SELECT) = false |
| 운영 기능 | service_feature_enabled(PLAN_BACKUP) = true |
| 소유자 함수 | auth.uid() 일치, 가입/생년/법적 동의/탈퇴 미요청 및 athlete_support_access_allowed 조건 |

이제 0032 필요성은 단순 이력 부재 추측이 아니다. 실제 V3 전용 제약 때문에 V6가 거부된다.
다만 실제 인증 사용자 두 명으로 수행한 네트워크 왕복 시험은 아직 아니다.

## 2. 실제 로컬 SQL 실행

[독립 시험 패키지](../../supabase/tests/local-postgres/README.md)는 PGlite 0.5.8 메모리 DB에서
실제 0001~0031 마이그레이션을 실행한 뒤 V6 거부를 재현하고 실제 0032를 실행한다.
Supabase의 인증 테이블/JWT 함수만 합성 경계이며 서비스 정책·트리거는 원본 SQL이다.

`npm test`: 7개 시험 PASS, FAIL 0, SKIP 0. Node test runner의 7개 시험이지
내부 반복 단언 수를 추가 합산한 수치가 아니다.

1. 0031의 V6 거부 -> 0032 적용 -> V3 보존 및 V6 envelope 저장/조회.
2. 필수 키 누락, 여분 키, 타입 오류, 행 식별자 불일치, 미지원 버전 거부.
3. B의 A 조회·수정·삭제·삽입·upsert 차단, A/B 각자 기록 허용.
4. 중복 무시 시 원본 보존, 보관 상태 필터 분리.
5. 익명 역할 접근 거부.
6. PLAN_BACKUP 끄면 읽기/쓰기 차단, 기존 저장 행 유지.
7. 동일 소유자의 직접 UPDATE/conflict-UPDATE는 현재 DB가 허용함을 별도 확인.

독립 검수는 최초 6개 시험을 재실행하고 위 7번의 한계를 재현했다. P1 없음/P2 1건으로
"클라이언트 duplicate-ignore를 DB 불변성 보장으로 확대 해석하지 말 것"을 지적했다.
이를 README·별도 시험·본 보고서에 반영하고 부모가 7개 전부 재실행했다.
현 §21.42의 불변 저장은 앱의 저장 경로가 지켜야 하는 동작이며 DB의 직접 수정까지
차단한다고 주장하지 않는다. 내용 지문은 DB에서 재계산하지 않는다. 서버 불변성 강제는
현재 적용 준비와 구분한 후속 강화 항목이다.

CI contract-tests에 이 독립 패키지 설치와 SQL 시험을 연결했다. 설치는 npm registry를
사용하며 설치 후 시험은 외부 DB·인증정보·실사용 데이터에 접근하지 않는다.

SQL 검사는 봉투 형태만 검증한다. 합성 selection={}은 수행 가능한 처방이 아니며,
내용 지문·근거·상세 계획 의미 검증은 클라이언트 읽기 계약과 별개다.
운영 OAuth/PostgREST·동시성·화면 복원 성공으로 확대 해석하지 않는다.

## 3. 적용 절차와 복구 경계

1. 운영 적용 직전 [읽기 전용 점검 SQL](../../supabase/tests/saved_plans_v6_readonly_preflight.sql)로
   기존 관측과 차이가 없는지 확인한다. V6 제약이 이미 생겼으면 0032를 중복 실행하지 않는다.
2. 오너의 정확한 운영 변경 승인을 받은 뒤 [0032 원본](../../supabase/migrations/0032_multi_adjusted_plan_snapshots.sql)을
   단일 트랜잭션으로 실행한다. 기존 행 삭제, RLS 변경, 공개 권한 추가, 기능 플래그 변경은 없다.
3. 같은 메타데이터를 재조회해 V3/V6 허용과 새 envelope 제약, 기존 RLS/정책/트리거 보존을 확인한다.
4. SQL Editor 적용이라면 CLI 이력 자동 등록을 가정하지 않는다. 운영 적용 영수증과 마이그레이션 이력
   정합화 방식을 남긴다. 확인 없이 이력 테이블에 승인 흔적을 발명하지 않는다.
5. 승인된 합성 A/B 시험 계정으로 API 저장/복원과 접근 거부를 검증한다. 로컬 SQL 시험으로 대신하지 않는다.

DDL 트랜잭션이 실패하면 rollback하고 기능 완료로 보고하지 않는다. 적용 후 V6 기록이 생긴 경우
V3 전용 제약을 되돌리려고 V6 행을 삭제하면 안 된다. 읽기/쓰기 장애 시 원인을 분리하고,
필요한 기능 일시 중단은 영향과 승인 범위를 확인한 뒤 수행한다. 기존 데이터를 보존한다.

## 4. 현재 인계

운영 DB 변경 승인은 이번 작업 중 구체적으로 요청했다. 답변 전에는 실행하지 않는다.
계정 격리 로컬 SQL 준비는 완료, 운영 DDL·실제 두 계정 API·복원 화면 시험은 미완료다.
이 문서는 새 훈련 구성이나 전체 배치의 내용 채택을 승인하지 않는다.

[DRAFT_COMPLETE]
