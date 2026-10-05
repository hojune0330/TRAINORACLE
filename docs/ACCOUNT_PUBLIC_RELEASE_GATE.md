# TrainOracle 계정 공개 베타 출시 게이트

```yaml
doc_id: trainoracle-account-public-release-gate
date: 2026-07-26
product: TrainOracle
service_provider_working_name: aaclub
service_operator_target: FREE_BETA_UP_TO_200
service_operator_scope_decision: ACCOUNT_FIRST_SYNC_LATER
current_status: SECURITY_REVIEW_REOPENED_DEDICATED_ORIGIN_AND_0056_RUNTIME_OPEN
contact_path: TrainOracle in-app feedback board
owner_preparation_approved_at: 2026-08-14
legal_clearance_claimed: false
```

## 결정된 방향

일반 사용자가 계정을 만들 수 있는 공개 베타를 먼저 목표로 한다. 계정 공개가
안정된 뒤 동기화를 별도 기능으로 연다. 로그인만으로 일지를 업로드하지 않으며,
사용자가 동기화를 직접 켜야 한다. 나만의 메모는 기기에서 암호화하고 서버에는
암호문만 저장한다. 훈련 메모만 동기화와 선택 공유에 사용할 수 있다.

1차 공개 인증은 Supabase Auth의 Google과 이메일 확인 링크만 제공한다.
TrainOracle은 비밀번호를 만들거나 저장하지 않는다. 만 14세 미만에게는 온라인
계정을 제공하지 않으며, 계정 없이 로컬 일지와 훈련 계획을 계속 사용할 수 있다.
카카오, 전화·문자, 토스, 네이버, Apple, AthleteTime SSO는 이번 공개의 선행조건이 아니다.
휴대전화 OTP 화면과 코드는 별도 닫힌 게이트로 준비하지만, SMS 공급자·CAPTCHA·
비용 경보를 실측하기 전에는 공개 버튼이 나타나지 않는다.

## 2026-10-03 보안 재검토

GitHub Pages의 프로젝트 경로는 별도 보안 origin이 아니다. 같은
`https://hojune0330.github.io` 아래의 다른 프로젝트도 TrainOracle의 localStorage와
IndexedDB에 있는 지속 로그인 토큰, 기기 일지, 훈련 계획, 건강성 입력을 읽을 수
있으므로, 민감 계정 기능을 다시 공개하기 전에
TrainOracle 전용 도메인 또는 전용 서브도메인으로 옮겨야 한다. 별도 origin이
확정되지 않은 동안 Google·이메일 공개 게이트는 닫힌 상태를 유지한다.

또한 서버 입장 판정·expected-user 바인딩·COROS 수집 차단·허용 인증 방식 검사를
추가한 현재 마이그레이션 0051~0056을
시험·운영 DB에 적용하고 새 클라이언트와의 왕복을 확인해야 한다. 과거 공개 기록은
당시의 영수증이며, 이 재검토에서 새로 열린 게이트를 대신하지 않는다.

이 문서는 법률 준수 확정서가 아니다. 2026-08-26 소유자는 실제 이메일·Google
왕복과 서버 계정 확정을 확인한 뒤 **계정 생성·로그인만** 공개하도록 승인했다.
동기화·공유·Kakao·휴대전화는 아래 미완료 게이트와 별개 승인 전까지 계속 닫는다.

## 2026-08-26 계정 공개 실행 기록

- 앱 기준 커밋: `bac0c82aca0f5f7a20df4f599468d0990ab9277b`
- 이메일 확인 링크 신규 가입과 재로그인: PASS
- 같은 Google 계정 로그인: PASS
- Google OAuth 외부 앱: 공개 홈페이지·방침·약관 연결, `프로덕션 단계`
- 동일 이메일 중복 방지: Supabase 사용자 1명, identity `email`, `google` 2개
- 법률 동의 저장: 개인정보처리방침·이용약관 버전 `2026-08-26`
- 서버 기능: `ACCOUNT=true`, `SYNC=false`, `SHARING=false`
- 상세 증거: `reports/operations/ACCOUNT_EMAIL_GOOGLE_RUNTIME_RECEIPT_2026-08-26.md`

G8 전체와 G5의 실제 삭제 작업은 아직 닫지 않는다. 이번 공개는 이 잔여 위험을
숨기지 않은 소유자 승인 **계정 전용 베타**이며, 로그인만으로 기기 데이터를 서버에
보내지 않는다.

## 2026-08-14 소유자 승인 기록

소유자는 계정 공개를 위한 법률·운영 준비 작업의 진행을 승인했다. 이 승인은
누락된 운영자 사실이나 실제 시험 증거를 대신하지 않으며, 변호사 검토 완료나
법률 준수 확정으로 기록하지 않는다. 따라서 공개 문서 초안·배포 연결·시험은
진행했다. 이후 2026-08-26 소유자가 잔여 위험을 확인하고 계정 생성·로그인만
공개하는 제한 베타를 별도로 승인했다. 이 후속 승인은 동기화·공유나 미완료 게이트를
PASS로 바꾸지 않는다.

## 필수 게이트

| Gate | 완료 조건 | 현재 |
|---|---|---|
| G1 개인정보처리방침 | 공개 URL, 수집 항목·목적·보유 기간·삭제·문의 절차 확정 | OPEN |
| G2 이용약관 | 공개 URL과 적용 버전 확정 | OPEN |
| G3 운영자 정보 | aaclub의 법적 표기, 주소, 개인정보 문의 연락처 확정 | OPEN |
| G4 미성년자 | 가입 전 나이 확인, 만 14세 미만 외부 인증 미호출, 서버 프로필 차단 실측 | PARTIAL_STAGING_SERVER_REHEARSAL_PASS_EXTERNAL_CALL_OPEN |
| G5 보유·탈퇴 | 즉시 접근 차단·30일 삭제 경로 구현과 실제 정리 영수증 | CODE_READY_TEST_OPEN |
| G6 처리업체 | 실제 Supabase 프로젝트 지역과 처리위탁 고지 확정 | OPEN |
| G7 DB 안전 | 시험 DB에 현재 전체 마이그레이션(최소 0056) 실행, RLS·입장 RPC·사용자별 정책 실측 | REOPENED_0051_TO_0056_STAGING_AND_PRODUCTION_OPEN |
| G8 교차 계정 시험 | 두 계정 격리, 두 기기 동기화, 삭제·복구·재로그인 시험 | PARTIAL_STAGING_TWO_USERS_RLS_PASS_UI_HARNESS_READY_TWO_BROWSER_OPEN |
| G9 가입 동의 | 가입 전에 방침·약관 링크와 버전 동의를 저장하는 UI·계약 | RUNTIME_PASS_VERSION_2026_08_26 |
| G10 배포 스위치 | G7·G12·G13·G14와 실제 환경을 확인한 뒤 계정만 공개하고 동기화·공유는 계속 닫음 | REOPENED_BLOCKED_BY_G7_G12_G13_G14 |
| G11 휴대전화 선택 출시 | SMS 공급자·한국 발신 조건·CAPTCHA·요율 제한·비용 경보·실수신 왕복 | CODE_READY_PROVIDER_OPEN |
| G12 전용 origin | 지속 로그인 토큰과 계정별 로컬 데이터를 다른 Pages 프로젝트와 공유하지 않는 전용 도메인·서브도메인 | OPEN_GITHUB_PAGES_SHARED_ORIGIN |
| G13 이메일 남용 방지 | Hosted Auth CAPTCHA·발송 요율 제한·사용자/IP 기준 감시·custom SMTP 쿼터와 비용·평판 경보 실측 | OPEN_PROVIDER_ABUSE_CONTROLS |
| G14 인증 표면 제한 | 미사용 OAuth·익명·SSO를 Hosted Auth에서 끄고, 비밀번호 가입·로그인 세션과 비밀번호 자격 증명 보유 계정이 0053에서 거부되는지 실측 | OPEN_HOSTED_AUTH_ALLOWLIST_AND_PASSWORD_PROBE |

G8에는 같은 브라우저에서 계정을 바꿨을 때 이전 사용자의 로컬 일지가 보이지
않고 새 계정으로 업로드되지 않는 시험을 반드시 포함한다. 현재는 잘못된
계정으로의 업로드 차단과 계정별 로컬 저장 구현, 스테이징 A/B 서버 RLS 교차 시험은
통과했다. 실계정 화면 격리를 반복 실행할 수 있는 Playwright 하네스도 준비했지만,
서로 다른 브라우저 두 개에서의 화면 격리와 재로그인 왕복은 아직 OPEN이다.

G4의 현재 제품 결정은 보호자 동의 계정이 아니라 만 14세 미만 온라인 계정 미제공이다.
클라이언트의 가입 전 차단과 DB 프로필 trigger는 시험 Supabase에 적용됐고,
rollback-only 합성 시험에서 만 14세 미만 프로필 차단을 확인했다. 하지만 실제
로그인 제공자 요청이 가입 전 차단되는지는 확인하지 않았으므로 G4는 닫지 않는다.
G9도 버전 저장 스키마는 시험 DB에 적용됐지만 실제 공개 문서와 가입 전 표시 순서의
브라우저 실측이 없어 닫지 않는다.

G13은 화면의 재전송 대기 시간만으로 닫을 수 없다. 공개 anon key를 사용하면 앱 UI를
거치지 않고 Auth 이메일 발송 API를 호출할 수 있다. Hosted Supabase에서 CAPTCHA와
서버 요율 제한을 켜고, custom SMTP의 일·시간 쿼터, 비용·반송·스팸 평판 경보를 실제로
확인하기 전까지 이메일 로그인을 공개하지 않는다.

0053은 JWT의 AMR뿐 아니라 `auth.users.encrypted_password` 존재 여부도 서버에서
확인한다. Supabase의 `email/signup` 표시는 비밀번호 가입 확인과 비밀번호 없는 첫
이메일 가입을 구분하지 못하기 때문이다. 앱은 비밀번호를 제공하지 않으며, 공개
Auth API로 비밀번호 사용자를 만들어도 TrainOracle 입장·데이터 접근은 거부한다.
OAuth AMR만으로 Google과 다른 OAuth 제공자를 구분할 수 없으므로, G14에서 미사용
Hosted provider가 실제로 꺼져 있는지도 별도로 확인한다.
비밀번호 해시가 한 번이라도 생긴 계정은 이후 Google이나 진짜 magic link로 다시
인증해도 입장을 허용하지 않는 것이 현재 정책이다. 공개 전 전용 시험 프로젝트에서
신규 magic link, 기존 magic link, Google, 직접 비밀번호 가입 네 계정의 실제 AMR과
해시 존재 판정을 비교한다. 합성 DB의 빈 문자열 가정만으로 G14를 닫지 않는다.
또한 `AUTH_OAUTH`와 `AUTH_PASSWORDLESS` 서버 스위치는 기본값이 `false`다. 실제
Hosted Auth 왕복을 확인한 인증 종류만 서버에서 연 뒤 `ACCOUNT`를 마지막에 연다.
브라우저의 provider별 값은 화면 노출 제어이고, 이 두 서버 스위치가 공개 Auth API
직접 호출 뒤의 계정 입장을 막는 경계다. OAuth AMR만으로 현재 Google·Kakao 중 어느
제공자로 로그인했는지 확실히 구분할 수 없으므로 제공자 하나의 사고라도
`AUTH_OAUTH=false`로 OAuth 전체를 보수적으로 닫는다.

## 현재 확인된 데이터 범위

| 구분 | 동작 |
|---|---|
| 로그인 식별자 | Supabase Auth의 Google 또는 이메일 확인 링크 |
| 일지 동기화 | 사용자가 `동기화 켜기`를 직접 선택한 뒤 실행 |
| 나만의 메모 | 기기에서 암호화하고 서버에는 암호문만 저장, 코치·분석 제외 |
| 훈련 메모 | 동기화 가능, 사용자가 선택한 공유 범위에서만 코치·지원자에게 표시 |
| 삭제 기록 | 일지 ID와 삭제 시각만 서버에 저장, 본문·날짜·수치 제외 |
| 로컬 사용 | 가입 화면은 로그인·온라인 기록을 권장하고 별도 로컬 선택 버튼은 제공하지 않음. 로그인하지 않은 상태에서도 기존 화면(뒤로 가기)으로 앱 사용은 가능 |

## 아직 확정하면 안 되는 값

- aaclub이 법적 사업자명인지 여부
- 주소와 개인정보 문의용 이메일 또는 전화번호
- 시험 Supabase 지역은 서울(`ap-northeast-2`)로 확인됐지만 공개 고지는 미확정
- 30일 삭제 작업의 실제 시험 실행 결과
- 만 14세 미만 외부 인증 미호출과 서버 프로필 차단의 실제 시험 결과
- 운영 DB 마이그레이션 및 실제 두 기기 동기화 결과

## 공개 전 실행 순서

1. 운영과 분리된 시험 Supabase에 현재 마이그레이션 전체(최소 0056)를 적용하고 영수증을 남긴다.
2. 시험 빌드에서 계정만 켜고 카카오·Google·이메일 로그인, 14세 경계, 전달된 이메일
   링크의 계정 바꿔치기 차단, 직접 비밀번호 가입·로그인의 서버 거부, 로그아웃,
   삭제 요청과 실패 경로를 확인한다.
   동기화·공유·계획·분석은 계속 끈다.
3. G1~G6의 실제 운영 정보를 확정하고 공개 문서를 게시한다.
   공개 배포 변수 `TRAINORACLE_PRIVACY_POLICY_URL`,
   `TRAINORACLE_PRIVACY_POLICY_VERSION`, `TRAINORACLE_TERMS_OF_SERVICE_URL`,
   `TRAINORACLE_TERMS_OF_SERVICE_VERSION`도 같은 승인본으로 등록한다.
4. TrainOracle 전용 origin과 Auth redirect allowlist를 확정하고 G13의 Auth·SMTP
   남용 방지와 G14의 Hosted provider 제한을 실측한 뒤, 서비스 운영자가
   시험 결과와 정확한 배포 SHA를 확인한 뒤 계정 변수만
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
특정 인증 방법만 문제가 생겨도 먼저 서버의 `ACCOUNT`와 해당 인증 종류 스위치를
닫은 다음 Hosted Supabase의 provider 또는 발송 경로를 비활성화한다. 그다음 해당
`TRAINORACLE_KILL_*` 값을 넣은 새 번들을 배포한다.
프론트 kill 값과 UI 숨김만으로는 공개 Auth API 직접 호출이나 기존 정적 번들을
즉시 차단할 수 없다.
인증 사고에서는 `ACCOUNT=false` 뒤 해당 종류의 `AUTH_OAUTH` 또는
`AUTH_PASSWORDLESS`도 닫는다. Hosted provider·발송 경로를 끄고, Supabase의 지원되는
관리 절차로 영향받은 Auth 세션을 폐기한 뒤 `auth.sessions`에 대상 세션이 남지 않은
것을 확인한다. access token 자체는 만료 전까지 남을 수 있지만, 0053은 JWT의
`session_id`가 활성 서버 세션과 일치하지 않으면 계정 RPC와 데이터 접근을 거부한다.
이 확인이 끝날 때까지 `ACCOUNT`를 다시 열지 않는다.
