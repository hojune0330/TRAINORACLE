# Garmin 자동 저장 장애 수정 및 운영 반영 — 2026-11-11

## 장애와 동작

Garmin Starter 수신의 durationInSeconds는 타이머·이동·경과 시간 가운데 무엇인지 확인되지 않아 기존 코드는 UNKNOWN으로 보존했다. 그러나 자동 저장은 UNKNOWN을 무조건 검토 대상으로 보내 자동 저장을 사실상 막았다.

자동 저장에 한해 UNKNOWN 시간은 일지에서 빈값과 MISSING 출처로 저장한다. 원본의 초 단위 값과 UNKNOWN 의미는 기존 암호화된 Garmin 상세에 유지하며, 페이스나 강도를 추정하지 않는다. 수동·복합 운동, 동의·철회·계정 범위·중복 및 충돌 검사는 유지한다. 기존 수동 확인 투영은 바꾸지 않았다.

새 수정본이 들어와도 이전 검토 표시가 남아 재검사를 막는 문제는 동일 계정·연결·세대·운동의 미저장 PENDING 새 revision만 재검사하도록 했다. 과거 전체 행을 수정하지 않는다.

## 적용 및 근거

- 운영 Supabase migration: 20261111132837 garmin_revision_recheck. 활성 트리거 및 SECURITY INVOKER, anon/authenticated 직접 실행 권한 없음 확인.
- 운영 Edge garmin-integration: v9 → v10 ACTIVE, verify_jwt=true, bundle SHA256 45c73cc4caefe2315cff87b90a52f2c75ddf24a602f6dec0df85704c9b9b2ab4. 적용 전 v9 SHA를 다시 확인했으며 22개 파일 중 autosave.mjs, service.mjs 두 개만 변경됨을 적용 후 비교했다.
- 통합 검사: node --test server/garmin-integration/service.test.mjs 56/56 통과, exit 0. 합성 Starter PUSH→큐→자동 저장→암호화 일지 복호화→원본 상세 재조회 포함. 거리 10km, 일지 시간 MISSING, 페이스 미기록, 원본 3600초 UNKNOWN 확인.
- cron trainoracle-garmin-minute 활성. 최근 cron 실행 상태는 succeeded이나 이는 예약 호출의 성공이며 Garmin 수신 성공을 뜻하지 않는다.
- 운영에서 연결·받은 운동·수신 작업의 전체 행 수는 각각 0. 실제 사용자 OAuth 및 운동 수신·일지 반영 검증은 아직 없다.
- 공개 앱 현재 source b4c7e26a17fa813ea1d4a9d408022501916697b4. 최근 로그인 우선 연결 및 주간 비교 화면은 로컬 변경이며 미배포다.
- 주간 비교 후보는 합성 도메인 smoke 8개가 통과했으나 Vitest/tsc가 시작 지연으로 완료되지 않아 UI 및 타입 검증 미완료.
- 운영에서 이미 부여된 migration 버전의 SQL을 supabase/migrations/20261111132837_garmin_revision_recheck.sql에 그대로 복원했다. 과거 다른 migration의 로컬/원격 타임스탬프 차이는 별도 상태이므로 일괄 migration push 금지.

## 미완료

실제 계정에서 Garmin 연결과 신규 운동 1건의 수신→원본→일지 확인이 필요하다. 제공자 Health API 권한·수면/심박 수신, Apple·Android 실제 기기 연동, COROS, 원본 파일 전체 암호화 보존, 최종 웹 UI 검사·공개는 별도 미완료다. 실제 건강 정보·토큰·비밀번호는 이 기록에 포함하지 않았다.
