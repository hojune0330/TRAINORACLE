# OPERATING_DASHBOARD_OBSERVATION_2026-09-08.md

## 운영 대시보드 읽기 전용 확인

- 상태: READ_ONLY_EXTERNAL_OBSERVATION
- 확인일: 2026-09-08
- 대상: Supabase project `texspxlpjungyarkvtkc`
- 방법: 기존 로그인 세션으로 Chrome의 공식 대시보드 확인
- 변경: 설정 변경, SQL 실행, 메일 발송, 사용자 데이터 조회 없음

## 확인한 사실

1. 조직 표시가 `trainoracle-beta FREE`다. 프로젝트 이름은 `trainoracle-beta-staging`이지만 분기는 `main PRODUCTION`으로 표시된다. 이름만 보고 시험 전용 DB라고 판단하지 않는다.
2. Authentication / Email Templates에 `Set up custom SMTP to edit templates`와 기본 템플릿 발송 안내가 표시된다. 사용자 지정 SMTP가 설정되지 않은 상태를 직접 확인했다. 공개 이메일 가입 준비가 끝났다고 보고할 수 없다.
3. Database / Migrations 목록의 최신 번호는 `0031`이며 `0001`까지 나열된다. 이 목록에 `0032` 적용 이력은 없다. 이는 이력 관측이며, 수동 SQL로 동일 변경이 적용되지 않았다는 증명은 아니다. 실제 제약 조건 대조 및 계정 격리 왕복 시험은 별도다.

확인 화면:
- https://supabase.com/dashboard/project/texspxlpjungyarkvtkc/auth/templates
- https://supabase.com/dashboard/project/texspxlpjungyarkvtkc/database/migrations

## 운영에 미치는 영향과 다음 절차

- 이메일: 발신 도메인과 DNS 관리 가능 여부, 발송 서비스 비용 한도를 정한 뒤 SMTP를 설정한다. 기존 이메일/Google 우선 방향을 다시 승인받는 문제가 아니라 외부 운영 설정을 채우는 작업이다. 실제 외부 수신자 수신 시험까지 해야 완료다.
- 계획 저장: 로컬 `0032`의 변경 내용과 실제 DB 제약을 먼저 대조한다. 이력에 없다는 이유만으로 같은 DDL을 즉시 중복 실행하지 않는다. 승인된 DB 변경 절차와 복구 준비 후 적용하며 서로 다른 계정의 읽기·쓰기 차단, V6 저장·복원 시험을 남긴다.
- 비용: FREE 표시는 현재 구독 관측일 뿐 사용량이나 향후 무료 운영 보장이 아니다. 유료 계약 전에 월 비용과 상한을 보여준다는 승인 원칙을 유지한다.
- COROS: 이번 대시보드 확인과 무관하다. OAuth 연결이나 실제 운동 데이터 수신을 완료했다고 표시하지 않는다.

이 문서는 이전 로컬 검토의 미확인 항목 일부를 외부 관측으로 보완한다. 사용자 데이터, 토큰, 키, SMTP 비밀번호는 포함하지 않는다.

[DRAFT_COMPLETE]
