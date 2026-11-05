# Garmin 백엔드 간소화 — 2026-11-05

## 목표와 변경

사용자 승인: 전체 구조 변경 가능, 가장 간단한 운영, 토큰 직접 관리 제거,
기존 데이터 보존, 최소 검증. 기존 DB·배포 권한을 이어서 사용했다.

새 실행 경로는 Garmin → Cloudflare 출처 검증 → Supabase Edge → 기존 DB다.
인증·암호화·큐·자동 저장·토큰 갱신은 동일 Supabase 프로젝트에서 처리한다.
Render 상시 프로세스와 journal 암호키의 외부 서버 이전이 새 경로의 의존성에서 빠졌다.
기존 Render 서비스는 아직 종료하지 않았으므로 월 비용 절감 완료로 보고하지 않는다.

DB는 앱이 닫힌 동안의 수신, 중복 방지, 계정별 보존, 재시도를 위해 유지한다.
처리 완료한 원본 수신 큐는 기존 코드대로 암호문을 비운다. 출처·센서 상세와
사용자가 편집하는 일지 요약은 역할이 다르므로 함께 보존한다.
일지 저장과 inbox 완료 확인의 단일 트랜잭션, 연결 해제·동의 철회 경계를 유지한다.

## 토큰과 설정

- 임의 운영 승인 유효기간은 선택 항목으로 변경했다. 명시된 기존 기한은 유지한다.
- Garmin 토큰 수명은 응답값을 따른다. access/refresh 중 먼저 만료되는 시점보다
  600초 일찍 갱신하며 운동이 없는 기간에도 due 작업이 실행된다.
- 새 토큰 저장 후 권한 조회의 일시 오류는 저장된 successor로 재시도한다.
  결과를 알 수 없는 refresh 교환을 같은 토큰으로 다시 실행하지 않는다.
- 기존 journal 암호키는 같은 Supabase에 남는다. HKDF로 목적별 키를 파생하고
  기존 root ID를 DB에 고정해 journal 활성키 변경이 Garmin 자료를 고립시키지 않는다.
- Cloudflare 배포 토큰 만료는 실행 중 Worker를 멈추지 않는다. 다음 배포의 인증과
  Garmin 이용자 토큰 갱신은 별개다. 기존 배포 토큰의 기간은 변경하지 않았다.

## 운영 DB 적용

| 로컬 migration | 운영 migration version | 결과 |
|---|---|---|
| 20261105033607_garmin_optional_operating_expiry.sql | 20261105034513 | 적용 |
| 20261105033618_garmin_edge_backend.sql | 20261105034536 | 적용 |
| 20261105033619_garmin_permission_retry.sql | 20261105034543 | 적용 |
| 20261105034859_garmin_edge_platform_auth.sql | 20261105035134 | 적용 |
| 20261105035204_garmin_edge_schedule.sql | 20261105035327 | 적용 |

원격 도구가 적용 시각을 migration version으로 부여했다. 같은 SQL을 재적용하지 않는다.
새 bootstrap·nonce RPC는 service_role에만 실행 권한이 있고 anon/authenticated에는 없다.
새 private 테이블은 RLS와 직접 접근 차단을 유지한다. 보안 advisor의 해당 세 테이블
`RLS enabled, no policies` 알림은 의도적인 직접 접근 차단이며 정책을 임의로 열지 않았다.

## 검증과 배포 경계

실제 Supabase `garmin-integration` 배포는 **version 5, ACTIVE, verify_jwt=true**다.
배포 아티팩트 `ezbr_sha256`은
`fe14e3c4f1aee4b533bdb6554fb3b765ec37844f95b856867a4946b2755626cf`다.
공개 anon JWT를 사용한 `/healthz` 호출은 HTTP 200,
`mode=PREPARATORY_DISABLED`를 반환했다. 초기 gateway 등록 오류는 API key와
플랫폼용 legacy JWT를 구분해 명시적 공개 설정으로 전달하면서 해결했다.
기존 journal 원본키를 읽거나 다른 서버에 내보내지 않고 root 등록 1건,
용도별 DB 검증키 2건, 공개 gateway 설정 1건이 등록된 것을 개수로 확인했다.
Cron 1개가 활성 등록됐고 2026-11-05 13:01·13:02 KST 실행은 `succeeded`였다.
준비 상태에서는 공급자 작업을 호출하지 않으므로 이 결과는 실제 토큰 갱신 증거가 아니다.

- 기한 선택 및 명시적 중지, 토큰 회전·복구·동시성, 암호화·원자 저장 관련 집중 검사 통과.
- Edge 경로·서명 변조·다중 실행 재전송 차단, 플랫폼 JWT와 HMAC의 동시 요구 검사 통과.
- HKDF 목적 분리·root 고정·기존 자료 보존·service-only bootstrap·cron 서명 검사 통과.
- 배포 묶음은 진입점과 필요한 소스만 수집하며 env/tmp/tests/node_modules는 제외한다.
- 10만 합성 표본 약 5MB 1건의 로컬 CPU는 ingress 376ms/process 905ms였다.
  실제 managed Edge의 최대 부하 보장으로 사용하지 않는다.
- 실제 Garmin OAuth·운동 수신은 아직 검증하지 못했다. 확인한 DB 연결 수는 0건이다.
- 프런트엔드 소스·정식 도메인은 이번 백엔드 변경으로 다시 배포하지 않았다.

처음 플랫폼 JWT 해제 배포는 자동 승인 검토에서 거부됐다. 더 안전한
`verify_jwt=true` 유지 방식으로 수정하여 실제 CLI 배포에 성공했다.
전체 배포 묶음의 대화 출력도 거부돼 기존 회사 CLI 인증으로 직접 업로드했다.
개인정보·토큰·암호키 값을 답변, 보고서, 생성된 소스 묶음에 넣지 않았다.

## 아직 필요한 실제 연결

Garmin 앱 client 설정, CF ingress 서명키 연결과 대상 URL 전환, 이용자 OAuth,
새 운동 1건의 수신→보존→일지 표시 확인이 남는다. 기존 Supabase journal secrets는
존재하지만 Garmin profile·ingress 설정은 이름 기준으로 아직 없었다.
브라우저는 Windows의 현재 URL을 도구가 확인하지 못해 이 턴의 컴퓨터 조작이
중단됐다. Chrome 자동 로그인 부재로 단정하지 않는다.
