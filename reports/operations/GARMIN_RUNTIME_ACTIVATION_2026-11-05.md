# Garmin 운영 연결 체크포인트 — 2026-11-05

Garmin 회사 앱 승인은 확인됐습니다. 남은 병목은 제공자 승인 대기가 아니라 회사 운영 설정과 실제 사용자 연결입니다. AI 사용 허용은 Activity 승인과 별개입니다.

## 실제 적용

- 회사 Render workspace에 trainoracle-device-gateway 생성. 사용자의 월 US$7 승인을 받아 Singapore 상시 실행 0.5 CPU / 512 MB로 전환. 자동 배포 OFF. 기존 Supabase Seoul DB 재사용; 새 DB/디스크 없음.
- 서버 소스 6bef177462e2693fa71dfef4a9f51fcdf60d973c, deploy dep-dblscb6i0phs7389a0jg: live. API plan 0.5c-512mb, 공개 /healthz HTTP 200 및 동일 sourceRevision 확인. 현재 PREPARATORY_DISABLED, accountGateway DISABLED.
- 주소: https://trainoracle-device-gateway.onrender.com/healthz
- 기존 DB에 아래 정확한 변경 적용. 원본 migration 파일은 불변이며 MCP가 만든 원격 버전과 구분합니다. 전체 db push로 재적용하지 않습니다.

| 소스 migration | 원격 기록 버전 | 확인 |
|---|---|---|
| 20261104103908_garmin_integration_runtime.sql | 20261104230724 | 9개 테이블 RLS 및 anon/authenticated 직접 SELECT 차단 |
| 20261104145316_account_legal_version_20261104.sql | 20261104230957 | 기존 6개 함수의 법률 버전 비교 12곳만 11/04로 변경 |
| 20261104231500_garmin_credential_maintenance.sql | 20261104232641 | maintenance RPC는 service_role만 실행, trigger 2개 확인 |

저장 목적 동의 버전은 2026-10-05이며 기존 사용자 동의를 대신 기록하지 않았습니다. 개인정보 원문이나 자격증명 값은 이 문서에 없습니다.

## 구현·검사

- 회사 Cloudflare edge가 Garmin source IP를 확인하고 본문/경로/시간/nonce에 서명; Node가 검증한 뒤 기존 암호화 큐로 전달하는 코드 완료. 합성 focused 12/12.
- 무인 토큰 갱신, 후계 토큰 암호화 선저장, 만료 토큰 원격해제, 동의 철회/운영 중지/동시 연결해제 경합 수정. service/deployment 47/47, worker 5/5. 독립 읽기 검수에서 발견한 3개 경합을 반례 검사로 해소.
- 기존 공개 파일 가져오기/세부자료 보존 구현은 유지. 위 검사는 실제 Garmin 계정 수신 증거가 아닙니다.
- 새 ingress 검사와 단일 Worker artifact freshness 검사를 기존 CI에 연결.
- 첫 Linux CI 41934036934에서 Garmin 검사 51/52 PASS 및 worker 종료 fixture의 타이밍 경합 1건 확인. 제품 코드 변경 없이 완료된 응답 시점에 즉시 종료하도록 fixture 수정, local worker 5/5 재통과. 후속 6bef177 Linux CI 41935651037의 contract-tests와 app-quality는 success로 확인. 전체 단위/브라우저 검사는 진행 중이며 전체 CI 통과로 주장하지 않음.
- 정식 DOMAIN publisher에 기본 OFF를 유지하는 명시적 canonical 공개 모드 구현. 집중 19/19 및 실제 source validator 확인. 실제 GitHub dispatch에서 발견한 YAML off 불리언 문제를 문자열 인용으로 수정하고 회귀 검사 반영. 이전 실패 41935266490을 성공으로 바꾸지 않습니다.
- 정식 DOMAIN 게시 41935697999는 build/deploy 모두 success. 공개 https://trainoracle.io/trainoracle-domain-receipt.json 에서 sourceSha 6bef177462e2693fa71dfef4a9f51fcdf60d973c, accountMode off 확인. 공개 privacy.html의 Render 생성/수신 비활성 및 Cloudflare 미생성 문구 확인. 이 도메인 배포는 실제 계정 연결이나 전체 원본 CI 성공 증거가 아님.

## 아직 완료되지 않은 운영 단계

1. Cloudflare에는 Chrome으로 로그인 완료. Worker 배포 토큰 생성은 자동 승인 검토에서 별도 허용을 요구함. 토큰 없이 동일 코드를 배포하는 공식 Pages Direct Upload 대안 준비 완료: trainoracle-garmin-ingress.pages.dev, 실제 Worker 바이트 보존 ZIP. 새 Pages 공개 프로젝트 생성 역시 별도 명시 허용을 요구하여 사용자에게 생성·배포 범위를 확인 중. 다른 제품 토큰 재사용, placeholder 배포, 프로젝트 생성 및 코드 업로드는 하지 않음.
2. 기존 journal keyring은 Supabase Edge secrets에 존재하며 기존 암호문이 이를 참조함. 보호된 재사용 사본은 찾지 못했고 대시보드 digest를 원문 SHA-256으로 단정하지 않음. server/journal-keyring-transfer의 봉인 이관 후보 6파일 완료, focused 7/7 및 독립 읽기 검수. 기존 원문·과거 AES 키 보존, 수신자/서비스/프로젝트/원문과 암호문 digest 고정, 짧은 발급 유효기간, 고정된 암호문으로 재시작 지원. 실제 비밀 읽기·이관·외부 함수 배포·서버 시작 명령 교체는 아직 없음. Node 일지 서명키는 기존 Edge 행을 유지하면서 새 keyId로 추가 등록 가능.
3. 보호된 Garmin/DB runtime 키와 실제 승인 profile, 회사 수신 서명 비밀, 운영 허용 설정, 정확한 Origin을 연결한 뒤 활성화해야 함.
4. 휴면 문제는 사용자 승인 후 월 US$7 상시 실행 전환 및 live 확인으로 해소. 실제 Garmin 30초 ACK는 아직 운영 연결 후 확인해야 하며 건강 응답만으로 인증하지 않음.
5. 정식 trainoracle.io는 별도 TRAINORACLE-DOMAIN publisher 사용. legacy source Pages의 account-held는 유지. 계정 공개 모드는 실제 DOMAIN 흐름에서 준비하며 현재 공개 계정은 OFF.
6. 본인 OAuth, 새 Garmin 운동 수신, 일지 확정 저장/재조회/중복 전달/연결 해제의 실계정 왕복은 아직 없음.

## Pages 배포 후보

- ZIP: tmp/garmin-pages-artifact-20261105/trainoracle-garmin-ingress-pages.zip (9,232 bytes)
- ZIP SHA-256: ba84dcb2f9c7c0b920dce0fa7b347468ef410e5e15d1faf22d45972361944270
- 원본 Worker 및 ZIP 내부 _worker.js SHA-256: 9cb501f4d4419c8a5248638fde6286ddac9b6679b3763d7e41494f938aa855f8
- 파일은 _worker.js와 _routes.json만 포함. secret·사용자 자료 없음. builder focused 4/4, bundle freshness, 독립 .NET ZIP 판독 및 읽기 검수 통과.
- Pages 운영 설정에서 Fail closed 및 Production 전용 ingress URL을 적용해야 함. 현재는 미생성·미업로드이며 실제 Cloudflare 수락/런타임 메타데이터 검증도 아직 없음.

## 모바일 별도 결과

Android 41861179734는 completed/success. iOS 41862014174는 hosted runner 미배정으로 completed/failure이며 컴파일이 시작되지 않았음. 실기기 건강 권한/수신 증거가 아니며 Garmin 운영 연결의 선행조건으로 두지 않음.

이 체크포인트 작성만으로 백그라운드 작업이나 모니터링이 예약되지는 않습니다.
