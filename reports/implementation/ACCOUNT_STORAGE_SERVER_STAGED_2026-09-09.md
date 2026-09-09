# ACCOUNT_STORAGE_SERVER_STAGED_2026-09-09.md

## 상태

- 상태: SERVER_AND_SCHEMA_DEPLOYED_FEATURE_OFF_KEY_INPUT_PENDING
- 배포 소스: 65de82e84e78699bb1f6a5023b235d27308f7151
- 대상: Supabase texspxlpjungyarkvtkc
- 사용자에게 온라인 저장 기능을 공개한 상태가 아니다.
- 기존 작업 파일과 생성된 테스트 이미지는 변경하거나 정리하지 않았다.

## 실제 수행

1. Management API 읽기 쿼리로 ACCOUNT_JOURNAL_V2=false, 마지막 마이그레이션 0031, gateway key table 미존재를 확인했다.
2. TRAINORACLE_JOURNAL_ALLOWED_ORIGINS를 https://hojune0330.github.io 로 설정했다. 다른 비밀값은 조회하지 않았다.
3. 공식 Supabase CLI 2.117.0의 functions deploy --use-api로 account-journal 및 account-plan-collection만 배포했다.
4. 두 함수 모두 version 1, ACTIVE를 확인했다. ACTIVE는 함수 배포 상태이며 제품 기능 공개 상태와 다르다.
5. 각 함수에 합성 요청 4종을 실행했다. 익명 POST=401, 잘못된 토큰 POST=401, 미허용 출처 POST=403, 허용 출처 OPTIONS=204. 총 8/8 일치, 모든 응답 Cache-Control=no-store.
6. 실제 암호화 백업을 별도 loopback PostgreSQL에 복원했다. 53개 테이블의 행 수가 백업과 일치했고, 0032~0037 변경을 모두 적용한 뒤 허용된 ACCOUNT_JOURNAL_V2 기본 플래그 1건 외 기존 테이블 행 수가 보존됨을 확인했다.
7. 공식 Supabase CLI로 운영 DB에 0032~0037을 순서대로 적용했다. 적용 후 최신 버전 0037, ACCOUNT=true, ACCOUNT_JOURNAL_V2=false, 서명 키 0건, 신규 일지·계획 저장 0건을 집계로 확인했다.
8. 운영 DB의 신규 보호 테이블 10개 모두 RLS 활성, 익명 조회 및 인증 브라우저 직접 쓰기 차단, 고아 일지 0건, 예약 정리 함수의 익명·일반 사용자 실행 차단을 확인했다. pg_cron은 미설치 상태로 자동 정리 스케줄은 아직 실행되지 않는다.
9. 계정 상태 검증 2/2, 일지 레코드 검증 81/81, 온라인 일지 기능을 편성한 프론트엔드 빌드를 합성 Supabase 설정으로 실행해 통과했다. 이 빌드는 실제 계정지 왕복 증거는 아니다.

## 배포 순서의 제한적 변경

기존 실행 문서의 DB 변경 후 함수 배포 순서와 달리, 이번에는 실제 기능 OFF를 먼저 확인하고 함수만 준비 배포했다. 두 진입점은 시작 시 DB 마이그레이션을 실행하지 않으며 요청별 인증 및 기능 게이트를 사용한다. 유효 사용자로 기능 OFF를 검증한 시험은 아직 수행하지 않았다. 이 결과를 정상 저장이나 계정 격리 검증으로 대체하면 안 된다.

## 백업 및 복원

- 암호화 백업 생성, 복호화 스트림 무결성 비교, pg_restore 목록 검사는 이전 단계에서 완료했다.
- 실제 격리 DB 복원과 대기 마이그레이션 시험을 완료했다. 암호는 메모리에서만 사용하고 종료 시 폐기했다.
- 복원 범위는 public/auth/supabase_migrations이며 전체 Supabase 플랫폼 및 Storage 객체 복원은 아니다.
- 복원 시험은 별도 loopback PostgreSQL에서만 수행한다. 시험용 복원 데이터는 접근 제한 폴더에 존재할 수 있으며 암호화 백업과 구분한다.
- 비밀번호, 키, 사용자 원문 데이터는 이 보고서와 Git에 기록하지 않는다.

## 다음 실행 순서

1. 보관된 attestation JSON과 DB 비밀번호를 로컬 비공개 창으로 한 번만 받아 DB account_journal_gateway_keys에 매개변수 쿼리로 등록한다. 키는 파일·Git·콘솔·SQL 문자열에 남기지 않는다.
2. 실제 서명 요청으로 Edge 서버와 DB 키가 일치하는지 검증한다.
3. 0035의 레거시 유예 기간은 2026-09-09 운영 적용 시점부터 흐르므로, 활성화 및 이전 일정에서 이를 추적한다.
4. 실제 계정 저장/조회, 사용자 간 격리, 기기 간 조회 및 실패 후 재시도를 검증한다.
5. 검수 후 기능 활성화와 프론트엔드 병합/배포를 수행하고 공개 화면에서 확인한다.

## 미수행

DB 서명 키 등록, 기능 활성화, 실제 계정 왕복 시험, PR 병합, 프론트엔드 배포는 아직 완료되지 않았다. 함수 ACTIVE나 스키마 적용을 온라인 저장 기능 공개로 기록하지 않는다.

[DRAFT_COMPLETE]
