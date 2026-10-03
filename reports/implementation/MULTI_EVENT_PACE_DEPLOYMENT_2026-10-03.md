# 다종목 기록 페이스 배포 기록

## 승인 및 소스

- 사용자 배포 승인: 2026-10-03, "배포해".
- 기능 PR: #347, merge source `1a57f88c1ed0cfdf734f2553d6773455fba6fc24`.
- 이전 Pages: `958ba28d062133eb8a7372d6be3c6dbcbb02d4ad`.
- 운영 프로젝트: `texspxlpjungyarkvtkc`.

## 운영 서버 완료

1. 읽기 전용 사전 점검 모든 항목 true. 사용자 데이터나 키 테이블 조회 없음.
2. 변경 대상 DB 함수 3개의 정의와 owner/ACL/config를 로컬 복구 자료로 보관했다. 기존 두 Edge Function도 공식 CLI로 별도 폴더에 내려받았다.
3. `0049_athlete_record_pace_revision.sql`, `0050_oracle_half_distance.sql`만 각각 transaction으로 적용했다. 과거 migration 공백을 일괄 재생하지 않았다.
4. 사후 점검 4개 true. 원래 함수 3개의 owner/ACL/security/config 변경 없음. 적용 성공 후 두 버전만 ledger에 기록했다.
5. `account-plan-collection` version 12 ACTIVE, `account-journal` version 13 ACTIVE. 기존 `verify_jwt=false`와 handler의 사용자 인증 방식을 유지했다.

복구 자료는 해당 작업트리의 무시되는 `app/test-results/pace-release/` 아래에 있다. 개인 자료나 secret은 포함하지 않는다. 함수 변경은 추가 호환 방식이므로 되돌릴 때도 신규 자료를 거부하는 구형 validator로 단순 교체하지 않는다.

## 사이트와 검사 구분

- 현재 공개 번들의 VITE 설정 41개를 재사용했다. 공개 anon/publishable 키 역할과 프로젝트를 확인했으며 비밀 저장소는 읽지 않았다. 호스팅 설정 검사, TypeScript, 프로덕션 빌드 통과.
- 전체 CI run `37098150421`의 contract-tests는 통과했으나 app-quality는 4파일 62건 실패했다. 성공으로 표기하지 않는다. app-browser는 실행되지 않았다.
- 42건은 기존 계획 내보내기 시험을 온라인 신규 페이스 승인 경로로 만들던 fixture 문제다. 게스트에서 역사적 계획을 만든 뒤 계정 내보내기 화면에 제공하도록 바꿔 42/42 통과했다. 실제 내보내기와 기록 보호 규칙을 완화하지 않았다.
- 12건은 고정 시간 RP 훈련에 명시 페이스를 제공하지 않은 fixture 문제다. 합성 직접 입력을 추가했고, 누락/고정시간 덮어쓰기 거부를 포함해 387/387 통과했다. 훈련량과 회복을 수정하지 않았다.
- 나머지 8건은 새 기록 선택 UI 및 계정 확인 fixture 누락이었다. 두 파일 13/13 및 앱 타입 검사 통과. 미확인 계정 기록 저장 거부를 먼저 확인한 후 서버 확인 상태에서만 저장되도록 시험했다. 목표 기록은 실제 기록으로 바꾸지 않았다.
- 전체 CI가 green이라고 주장하지 않으며, 과거 main의 app-browser 실패와 이번 fixture 실패를 구분한다. 브랜치 보호 규칙 우회나 CI 삭제는 하지 않았다.

## 최종 공개 확인

PENDING: Pages 게시, 공개 receipt/hash 대조, 새 익명 브라우저의 합성 기록 기반 계획 생성/재열기.
실제 사용자 로그인 저장 왕복은 별도 미확인 범위다.

[DEPLOYMENT_RECORD]
