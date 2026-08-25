# TrainOracle 계정 공개 베타 출시 게이트

```yaml
doc_id: trainoracle-account-public-release-gate
date: 2026-07-26
product: TrainOracle
service_provider_working_name: aaclub
service_operator_target: FREE_BETA_UP_TO_200
service_operator_scope_decision: ACCOUNT_FIRST_SYNC_LATER
current_status: OWNER_APPROVED_PREPARATION_GATES_OPEN
contact_path: TrainOracle in-app feedback board
owner_preparation_approved_at: 2026-08-14
legal_clearance_claimed: false
```

## 결정된 방향

일반 사용자가 계정을 만들 수 있는 공개 베타를 먼저 목표로 한다. 계정 공개가
안정된 뒤 동기화를 별도 기능으로 연다. 로그인만으로 일지를 업로드하지 않으며,
사용자가 동기화를 직접 켜야 한다. 나만의 메모는 기기에서 암호화하고 서버에는
암호문만 저장한다. 훈련 메모만 동기화와 선택 공유에 사용할 수 있다.

1차 인증은 Supabase Auth의 카카오, Google, 이메일 6자리 코드만 제공한다.
TrainOracle은 비밀번호를 만들거나 저장하지 않는다. 만 14세 미만에게는 온라인
계정을 제공하지 않으며, 계정 없이 로컬 일지와 훈련 계획을 계속 사용할 수 있다.
전화·문자, 토스, 네이버, Apple, AthleteTime SSO는 이번 공개의 선행조건이 아니다.
휴대전화 OTP 화면과 코드는 별도 닫힌 게이트로 준비하지만, SMS 공급자·CAPTCHA·
비용 경보를 실측하기 전에는 공개 버튼이 나타나지 않는다.

이 문서는 공개 승인서가 아니다. 아래 게이트가 모두 실제 증거로 확인되기
전에는 `TRAINORACLE_ACCOUNT_PUBLIC_ENABLED=true`를 설정하지 않는다.

## 2026-08-14 소유자 승인 기록

소유자는 계정 공개를 위한 법률·운영 준비 작업의 진행을 승인했다. 이 승인은
누락된 운영자 사실이나 실제 시험 증거를 대신하지 않으며, 변호사 검토 완료나
법률 준수 확정으로 기록하지 않는다. 따라서 공개 문서 초안·배포 연결·시험은
진행하되 G1~G9가 실제 증거로 닫히기 전까지 계정 공개 스위치는 계속 잠근다.

## 필수 게이트

| Gate | 완료 조건 | 현재 |
|---|---|---|
| G1 개인정보처리방침 | 공개 URL, 수집 항목·목적·보유 기간·삭제·문의 절차 확정 | OPEN |
| G2 이용약관 | 공개 URL과 적용 버전 확정 | OPEN |
| G3 운영자 정보 | aaclub의 법적 표기, 주소, 개인정보 문의 연락처 확정 | OPEN |
| G4 미성년자 | 가입 전 나이 확인, 만 14세 미만 외부 인증 미호출, 서버 프로필 차단 실측 | PARTIAL_CODE_TEST_OPEN |
| G5 보유·탈퇴 | 즉시 접근 차단·30일 삭제 경로 구현과 실제 정리 영수증 | CODE_READY_TEST_OPEN |
| G6 처리업체 | 실제 Supabase 프로젝트 지역과 처리위탁 고지 확정 | OPEN |
| G7 DB 안전 | 시험 DB에 0001~0028 실행, RLS 활성, 사용자별 정책 실측 | PARTIAL_TRIAL_0001_0026_ONLY |
| G8 교차 계정 시험 | 두 계정 격리, 두 기기 동기화, 삭제·복구·재로그인 시험 | OPEN |
| G9 가입 동의 | 가입 전에 방침·약관 링크와 버전 동의를 저장하는 UI·계약 | PARTIAL_CODE_TEST_OPEN |
| G10 배포 스위치 | G1~G9 증거 검수 후 저장소 변수를 `true`로 변경 | LOCKED |
| G11 휴대전화 선택 출시 | SMS 공급자·한국 발신 조건·CAPTCHA·요율 제한·비용 경보·실수신 왕복 | CODE_READY_PROVIDER_OPEN |

G8에는 같은 브라우저에서 계정을 바꿨을 때 이전 사용자의 로컬 일지가 보이지
않고 새 계정으로 업로드되지 않는 시험을 반드시 포함한다. 현재는 잘못된
계정으로의 업로드만 차단됐고, 로컬 화면 격리는 아직 OPEN이다.

G4의 현재 제품 결정은 보호자 동의 계정이 아니라 만 14세 미만 온라인 계정 미제공이다.
클라이언트의 가입 전 차단과 DB 프로필 trigger 코드는 준비됐지만, 시험 Supabase에
마이그레이션을 적용하고 실제 제공자 요청이 발생하지 않는지 확인하지 않았으므로
아직 닫지 않는다. G9도 문서 링크·버전 저장 코드는 있지만 실제 공개 문서, 가입 전
표시 순서의 브라우저 실측, 운영 DB 실행 증거가 없어 닫지 않는다.

## 현재 확인된 데이터 범위

| 구분 | 동작 |
|---|---|
| 로그인 식별자 | Supabase Auth의 카카오, Google 또는 이메일 OTP |
| 일지 동기화 | 사용자가 `동기화 켜기`를 직접 선택한 뒤 실행 |
| 나만의 메모 | 기기에서 암호화하고 서버에는 암호문만 저장, 코치·분석 제외 |
| 훈련 메모 | 동기화 가능, 사용자가 선택한 공유 범위에서만 코치·지원자에게 표시 |
| 삭제 기록 | 일지 ID와 삭제 시각만 서버에 저장, 본문·날짜·수치 제외 |
| 로컬 사용 | 계정 없이 계속 사용 가능 |

## 아직 확정하면 안 되는 값

- aaclub이 법적 사업자명인지 여부
- 주소와 개인정보 문의용 이메일 또는 전화번호
- 시험 Supabase 지역은 서울(`ap-northeast-2`)로 확인됐지만 공개 고지는 미확정
- 30일 삭제 작업의 실제 시험 실행 결과
- 만 14세 미만 외부 인증 미호출과 서버 프로필 차단의 실제 시험 결과
- 운영 DB 마이그레이션 및 실제 두 기기 동기화 결과

## 공개 전 실행 순서

1. 운영과 분리된 시험 Supabase에 0001~0028을 적용하고 영수증을 남긴다.
2. 시험 빌드에서 계정만 켜고 카카오·Google·이메일 로그인, 14세 경계, 로그아웃,
   삭제 요청과 실패 경로를 확인한다. 동기화·공유·계획·분석은 계속 끈다.
3. G1~G6의 실제 운영 정보를 확정하고 공개 문서를 게시한다.
   공개 배포 변수 `TRAINORACLE_PRIVACY_POLICY_URL`,
   `TRAINORACLE_PRIVACY_POLICY_VERSION`, `TRAINORACLE_TERMS_OF_SERVICE_URL`,
   `TRAINORACLE_TERMS_OF_SERVICE_VERSION`도 같은 승인본으로 등록한다.
4. 서비스 운영자가 시험 결과와 정확한 배포 SHA를 확인한 뒤 계정 변수만
   `true`로 바꾼다.
5. 계정 공개가 안정된 뒤 서로 다른 두 계정과 두 브라우저로 동기화 G8을
   별도 시험하고, 그 결과를 확인한 뒤 동기화를 연다.
6. main 배포 후 로그인·삭제·로그아웃을 실서비스에서 다시 확인한다.

휴대전화 로그인은 위 계정 공개 순서와 별개로 G11을 통과한 뒤
`TRAINORACLE_PHONE_AUTH_ENABLED=true`와
`TRAINORACLE_PHONE_AUTH_OPERATIONS_APPROVED=true`를 함께 설정한다. 둘 중 하나라도
없으면 버튼은 보이지 않는다.

## 즉시 끄기

문제가 발견되면 서버의 `ACCOUNT` 스위치를 먼저 끄고 이유를 기록한다. 그다음
`TRAINORACLE_KILL_ACCOUNT=true`와
`TRAINORACLE_ACCOUNT_PUBLIC_ENABLED=false`를 적용해 main을 재배포한다. 이렇게
해야 이미 열린 앱도 새 서버 작업을 시작하지 못하고, 새 배포에서는 계정
진입점도 사라진다. 이 조치는 이미 서버에 저장된 데이터의 삭제나 보유 정책을
대신하지 않는다. 자세한 순서는
`reports/operations/BETA_FEATURE_INCIDENT_LOG.md`를 따른다.
SMS만 문제가 생기면 `TRAINORACLE_KILL_PHONE_AUTH=true`로 전화 버튼만 닫고 카카오,
Google, 이메일 경로는 유지한다.
