# TrainOracle 계정 공개 베타 출시 게이트

```yaml
doc_id: trainoracle-account-public-release-gate
date: 2026-07-26
product: TrainOracle
service_provider_working_name: aaclub
service_operator_target: FREE_BETA_UP_TO_200
service_operator_scope_decision: ACCOUNT_FIRST_SYNC_LATER
current_status: SECURITY_AND_PRIVACY_REVIEW_REOPENED_ORIGIN_0058_AND_OPERATIONS_FACTS_OPEN
contact_path: TrainOracle in-app feedback board
owner_preparation_approved_at: 2026-08-14
legal_clearance_claimed: false
```

## 결정된 방향

일반 사용자가 계정을 만들 수 있는 공개 베타를 먼저 목표로 한다. 계정 공개가
안정된 뒤 동기화를 별도 기능으로 연다. 로그인만으로 일지를 업로드하지 않으며,
사용자가 온라인 보관 목적을 각각 선택해야 한다. 2026-10-05 승인 범위의 계정
정본은 건강정보와 직접 작성한 글을 서버에서 암호화하여 보관·복구하며 서비스가
기술적으로 복호화할 수 있다. 종단간 암호화라고 표시하지 않는다. 비밀 글의
분석·공유와 원문 외부 AI 전송은 금지하고, 이 변경으로 코치·외부 제공자 기능을 열지 않는다.

## 2026-10-05 목적별 동의·열람 권리 게이트

- 0057은 가입 확인과 별개인 건강정보·메모 보관 동의를 버전
  `2026-10-05`로 기록한다. 기존 동의를 승계하지 않고, 모든 기존 자료도 새
  일반 동기화/복구에는 새 동의를 요구한다. 거부·철회 시 기기 일지·훈련 기능은 유지한다.
- 동의 수정은 expected user/session/revision을 확인하며, 철회 이후 예전
  허용 요청 재전송은 실패한다. 최종 저장 trigger는 게이트 검사 후 도착한 쓰기도 다시 확인한다.
- `account_storage_operation_reviews`는 **빈 상태**로 생성된다.
  실제 처리업체·국가·연락처·이전 항목/목적/방법/시기·근거·거부 영향,
  보안 로그 및 사업자 백업의 보유/만료/삭제 조건을 확인하고 고지한 증거의
  reference, reviewed_at, purpose_version을 DB 소유자의 별도 승인 작업으로
  기록하기 전에는 새 보관 동의를 승인하거나 건강정보를 저장할 수 없다.
  클라이언트 설정·합성 시험·이 문서는 그 증거가 아니다. 애플리케이션 역할은
  이 테이블과 동의 이력을 직접 수정할 수 없다.
- 운영 승인 차단은 가입, 철회, 삭제 요청, 본인 열람 권리를 차단하는 근거가 아니다.
  별도 `account-data-rights` 수동 내보내기는 현재 본인 세션만 검증하며
  동의/운영 승인과 독립적이다. 자동 복구·새 저장·AI·공유 호출은 없다.
  서버 암호화 일지·계획은 읽을 수 있는 사본으로, 기존 기기 암호화 메모와
  별도 제공자 암호문은 보유 형태 그대로 제공한다. 키가 없거나 만료·삭제된
  자료는 복구를 보장하지 않는다.
- 기기 동기화 OFF는 해당 기기 전송만 중단한다. 0058에서 서버 동의 철회는
  건강·글 혼합 목적 자료 18개 저장소와 관련 일지 식별/완료 outbox를 같은
  잠금·트랜잭션으로 삭제한다. 부분 목적 철회도 분리 불가능한 자료 전체를 삭제한다.
  본인 권리 조회는 계속 가능하며 삭제한 자료는 빈 결과다. 기기 파일·프로필·인증·
  독립 구매/포인트 원장은 보관 동의 철회의 삭제 대상이 아니다.
- 탈퇴 요청도 목적 소거를 수행하며 나머지 계정 정리는 즉시 대상이 된다.
  30일은 탈퇴의 일괄 보유 근거가 아니다. 본문 없는 최소 동의/소거 원장의
  별도 근거·상한 기간·정리 기한과 사업자 백업의 기한·재시도·복원 시 재소거가
  미확정이므로 전체 준수/전체 삭제 완료와 온라인 공개는 NO-GO다.
- 신규 법률 문서는 시행 예정 버전이다. 적용일/변경 고지 및 운영 사실 확정 후에만
  게시·적용한다. 현재 실행되지 않은 배포·DB 적용·실계정 검증을 완료로 표시하지 않는다.

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
추가한 현재 마이그레이션 0051~0058을
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
| G3 운영자 정보 | 인피니트 오퍼튜니티/aaclub, 주소·개인정보 문의 연락처 | OWNER_CONFIRMED_2026_10_05_PUBLIC_DOCUMENT_CODE_PRESENT |
| G4 미성년자 | 가입 전 나이 확인, 만 14세 미만 외부 인증 미호출, 서버 프로필 차단 실측 | PARTIAL_STAGING_SERVER_REHEARSAL_PASS_EXTERNAL_CALL_OPEN |
| G5 보유·탈퇴 | 목적 자료 원자 소거·잔여 계정 즉시 정리 대상, 최소 원장 근거/기한·실제 성공/재시도·백업 만료 | CODE_CANDIDATE_RUNTIME_LEDGER_BASIS_AND_BACKUP_TERMS_OPEN |
| G6 처리업체 | 실제 Supabase 프로젝트 지역과 처리위탁 고지 확정 | OPEN |
| G7 DB 안전 | 시험 DB에 현재 전체 마이그레이션(최소 0058) 실행, RLS·입장 RPC·사용자별 정책 실측 | REOPENED_0051_TO_0058_STAGING_AND_PRODUCTION_OPEN |
| G8 교차 계정 시험 | 두 계정 격리, 두 기기 동기화, 삭제·복구·재로그인 시험 | PARTIAL_STAGING_TWO_USERS_RLS_PASS_UI_HARNESS_READY_TWO_BROWSER_OPEN |
| G9 가입 동의 | 가입 방침 확인·약관 동의와 선택 보관 목적 분리, 2026-10-05 실제 재확인 | CODE_READY_NEW_VERSION_RUNTIME_OPEN |
| G10 배포 스위치 | G7·G12·G13·G14·G15와 실제 환경을 확인한 뒤 계정만 공개하고 동기화·공유는 계속 닫음 | REOPENED_BLOCKED_BY_G7_G12_G13_G14_G15_AND_RELEASE_ACK |
| G11 휴대전화 선택 출시 | SMS 공급자·한국 발신 조건·CAPTCHA·요율 제한·비용 경보·실수신 왕복 | CODE_READY_PROVIDER_OPEN |
| G12 전용 origin | 지속 로그인 토큰과 계정별 로컬 데이터를 다른 Pages 프로젝트와 공유하지 않는 전용 도메인·서브도메인 | OPEN_GITHUB_PAGES_SHARED_ORIGIN |
| G13 이메일 남용 방지 | Hosted Auth CAPTCHA·발송 요율 제한·사용자/IP 기준 감시·custom SMTP 쿼터와 비용·평판 경보 실측 | OPEN_PROVIDER_ABUSE_CONTROLS |
| G14 인증 표면 제한 | 미사용 OAuth·익명·SSO를 Hosted Auth에서 끄고, 비밀번호 가입·로그인 세션과 비밀번호 자격 증명 보유 계정이 0053에서 거부되는지 실측 | OPEN_HOSTED_AUTH_ALLOWLIST_AND_PASSWORD_PROBE |
| G15 목적 동의·철회 | 0058 전체 적용, 두 브라우저 철회/재시도·재동의 이전작업 거절·실제 병렬 경합·수동 권리열람/삭제 검증 | LOCAL_CANDIDATE_ONLY_RUNTIME_OPEN |
| G16 운영 사실 | 실제 위탁/국외 처리/로그/백업 조건 고지와 검토 증거 DB 등록 | CLOSED_EMPTY_REVIEW_TABLE |

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
| 일지 동기화 | 별도 건강정보·글 목적 동의 및 서버 운영 검토 후 사용자가 선택, 기기 스위치 OFF는 서버 삭제가 아님 |
| 나만의 메모 | 기기 보관 또는 선택한 계정 암호화 보관, 서버 복호화 가능, 코치·분석 제외 |
| 훈련 메모 | 선택한 계정 보관 범위에 포함될 수 있음. 이번 변경은 공유·외부 AI를 열지 않음 |
| 삭제 기록 | 일지 ID와 삭제 시각만 서버에 저장, 본문·날짜·수치 제외 |
| 로컬 사용 | 가입 화면은 로그인·온라인 기록을 권장하고 별도 로컬 선택 버튼은 제공하지 않음. 로그인하지 않은 상태에서도 기존 화면(뒤로 가기)으로 앱 사용은 가능 |

## 아직 확정하면 안 되는 값

- 운영사업자는 인피니트 오퍼튜니티, 브랜드는 aaclub이며 동일 등록 사업자라는 소유자 확인을 받았다. 공개 문서의 주소·문의 정보를 유지했다. 사업자 등록 증명서 실사는 수행하지 않았다.
- 시험 Supabase 지역은 서울(`ap-northeast-2`)로 확인됐지만 공개 고지는 미확정
- 목적 소거 및 잔여 계정 정리 작업의 실제 성공·실패 재시도·최소 원장 근거/상한·백업 만료 결과
- 만 14세 미만 외부 인증 미호출과 서버 프로필 차단의 실제 시험 결과
- 운영 DB 마이그레이션 및 실제 두 기기 동기화 결과

## 공개 전 실행 순서

1. 운영과 분리된 시험 Supabase에 현재 마이그레이션 전체(최소 0058)를 적용하고 영수증을 남긴다. `account-data-rights`와 revision 헤더를 전달하는 일지/계획 Edge도 배포하고 전용 origin의 허용 목록·세션 검증을 확인한다.
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

### 프론트가 서버보다 먼저 공개되는 순서 실수 방지

계정을 여는 hosted 빌드는 `validate-hosted-release-env.mjs`에서
`VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED=true` 및
`VITE_ACCOUNT_STORAGE_PRIVACY_MIGRATION=0058_storage_withdrawal_erasure`를
명시하지 않으면 거절한다. 계정을 끈 로컬 전용 빌드와 `VITE_KILL_ACCOUNT=true`인
빌드는 이 확인을 요구하지 않으며, 이 값이 신규 저장을 켜지도 않는다.

두 값은 마이그레이션 적용·Edge 배포·전용 origin·실제 시험을 **증명하지 않는**
공개 배포 순서 확인 표시다. 담당자가 위 증거를 직접 확인한 후에만 설정한다.
서버 저장은 이와 별개로 0057의 검토 기록과 사용자별 현재 목적 동의를 계속 검증한다.
이번 작업은 운영 승인 값을 설정하거나 `.github/workflows/`를 수정하지 않았다.
현재 workflow는 두 새 값을 전달하지 않으므로 계정 open 배포가 차단되는 것이
의도된 미완료 상태다. 실제 운영 확인과 별도 승인된 변수 전달 없이는 계정 배포 NO-GO다.

서버 `account-data-rights`는 동의·운영 검토와 독립된 본인 세션 전용 수동 조회지만,
앱 전체 `ACCOUNT` kill 설정으로 계정 UI 자체를 숨긴 빌드에서는 다운로드 버튼도
표시되지 않는다. 그런 사고 대응 중에도 신원 확인된 열람·삭제 요청을 처리할 운영
경로를 유지해야 하며, endpoint가 있다는 이유로 화면 접근까지 검증됐다고 표시하지 않는다.

휴대전화 로그인은 위 계정 공개 순서와 별개로 G11을 통과한 뒤
`TRAINORACLE_PHONE_AUTH_ENABLED=true`와
`TRAINORACLE_PHONE_AUTH_OPERATIONS_APPROVED=true`를 함께 설정한다. 둘 중 하나라도
없으면 버튼은 보이지 않는다.

## 2026-10-05 로컬 후보 검증 기록

기준 HEAD는 `fb6991c2eb0b6f33c14a6a7c542655cd5f8c06d8`이며 이 기록은 그 위의
변경 후보에 대한 로컬 검증이다. 운영 DB·배포·실사용자 왕복 증거가 아니다.
Node `v24.11.1`에서 아래를 확인했다.

- `storage-consent.test.mjs`: PGlite 전체 0001~0057 적용 후 9/9 통과.
  가입 동의와 보관 동의 분리, 타인·다른 세션·옛 버전, 단일 목적 불충분,
  철회·오래된 재시도·retention 삭제, 운영 검토 닫힘·직접 조회 차단,
  예외적인 본인 권리 조회, 탈퇴와 최종 저장 거절을 포함한다.
- `account-data-rights-handler.test.mjs`: 합성 암호문·본인 재확인·no-store,
  타인·폐기 세션·외부 origin, 저장 입력·과대 본문 거절 3/3 통과.
- 저장 최종 검사 / 오래된 revision 검사 / 권리 열람 소유자 검사를 각각
  실행 메모리 안에서 제거하자 해당 이름의 시험이 실패했다. migration 파일
  SHA-256 `A6C2B18322796EDEEB8078F3199AEC99629EC718E2CFF1C044166D6C3113DE4B`
  불변 확인 후 정상 9/9를 재실행했다. 실제 파일에 결함을 남기지 않았다.
- `consent-checked-fetch`, `account-data-rights`, `StorageConsentPanel`,
  `AccountDataRightsPanel`, `verified-account-scope`, `BetaAccountSettings`,
  `AccountNetworkSettings`, `AccountSyncPanel`, `Account.session-exit`의
  계약 시험 9파일 59건 통과. 첫 실행의 구문구 selector 3건을 새 접근성 이름에
  맞췄으며, forks worker 시작 timeout 1건은 단일 threads worker 재검사에서
  해당 화면과 Sync 14/14 통과로 재확인했다. 실행 실패를 통과로 계산하지 않았다.
- 최신 `tsc --noEmit`: exit 0. 배포 환경 검사 25/25 통과: 계정 open 승인 누락,
  false, 옛 migration 값 거절 및 정확한 승인 대조군·계정 OFF 통과 포함.
- 위 작성자 검사의 `git diff --check`는 추적 파일 대상이었다. root의 추가
  staged 검사에서 새 0057 파일 끝의 빈 줄을 발견해 제거했다. SQL 구문은
  변경하지 않았고 최종 파일 SHA-256은
  `F62AF313C41EF7CB5CDBC04608523113669900E525F37E295F98FD8985034FB6`이다.
  최종 파일의 정상 PGlite 재검사와 account-off build는 후속 실행 기록으로
  구분한다. 커밋·원격 저장 상태는 공통 실행 문서를 참조한다.
  운영 DB·배포·운영 승인 값 설정은 하지 않았다.

실제 PostgreSQL 두 연결의 철회/탈퇴와 쓰기 경합, 시험 및 운영 Supabase 최신
마이그레이션·Edge 적용, 전용 origin, 실계정 두 브라우저 화면 격리·권리 행사,
실제 정리 작업의 성공·재시도·백업 만료, 위탁/국외 처리 조건은 여전히 OPEN이다.
SQL의 같은 잠금과 순차 시험은 실제 병렬 스케줄의 증거를 대신하지 않는다.
독립 소스 재검토에서 전송 직전 철회 hold·운영 검토 철회·탈퇴 잠금 경계의
지적 3건은 보완 확인했지만, 전체 hosted release gate는 이번에 실행하지 않았다.

## 0058 추가 후보: 철회 목적 소거와 늦은 작업

`d7f719f68c63ec1c468830677e6de72fc2dfc893` 위의 추가 후보이며 0057은 수정하지 않았다.
0058은 실제 목적 철회와 같은 계정 잠금·트랜잭션에서 혼합 암호문, 교체본, 휴지통,
연동 자료 및 목적 파생 저장소를 소거한다. 기기 파일, 독립 계정 프로필, 구매·보상
원장을 목적 철회로 지우지 않는다. 최소 receipt는 본문 없이 남으며 `backup_status=PENDING`은
백업 삭제 완료가 아니다. 그 원장의 별도 보존 근거·기한 및 백업 정리 상한은 아직
승인되지 않았으므로 계정/건강 보관 공개 NO-GO다.

새 탈퇴 요청은 목적 소거와 잔여 정리 대상 등록을 즉시 수행하며 30일 보유를
법정 허용 기간으로 주장하지 않는다. 0057에서 실제 철회한 기존 receipt는 목적 소거로
보완한다. 그러나 **0057 이전 동의 receipt 없이 이미 존재하던 탈퇴 요청**을 위해
가짜 동의·세션 이벤트를 만들지 않는다. 해당 기존 미완료 요청의 운영 catalog/집계,
기존 삭제 요청 근거, 별도 보존 예외 및 정리 결과를 확인하기 전 공개는 NO-GO다.
그 기존 요청 전체 정리나 Auth 계정·백업 삭제 완료를 이번 코드의 성과로 계산하지 않는다.

기기 작업은 Edge가 처음 관측한 connection ID/owner/epoch를 복사하고 SQL의 계정 잠금과
connection 행 잠금 뒤 재검증한다. 철회 전 관측한 in-flight/queue 작업은 재동의·재연결로
살아나지 않는다. 반면 제공업체에서 오래전에 발생했으나 **재연결 뒤 처음 수신한 retry**는
새 연결로 관측될 수 있어, 이 코드만으로 과거 이벤트와 새 이벤트를 구분하지 못한다.
임의 활동 시각 cutoff나 새 history import 정책은 만들지 않았다. G15 및
`DEVICE_INTEGRATION`은 OFF를 유지하며, 제공업체 재전송/가져오기 정책의 별도 검증이 필요하다.

Node 24.19.0 합성 검사 기록(운영 DB 연결 없음):

- 0058 최초 후보의 유지된 전체 Supabase 계약: 296/296 통과. 이후 workout epoch 및
  CORS preflight 보완을 했으므로 이 숫자를 최종 후보 전체 재실행으로 표시하지 않는다.
- 보완 후 0058·전송 경계·일지/계획 Edge 영향 4파일: 128/128 통과.
- 소거 누락, 늦은 revision 재사용, private context 위조, workout epoch 검사 누락을
  각각 실행 메모리에 주입하자 해당 이름의 시험이 실패했다. 정상 9/9 재통과와
  0058 SHA-256 `78c72cb9317801af033aea9d5607d4f3ddc8149722cb769fa8031074bef3a683`
  불변을 확인했다. 실제 migration 파일을 변조하거나 DB에 적용하지 않았다.
- 기존 service-role retention DELETE 예외의 정상 동작, end-user GUC 위조 거절,
  임의 탈퇴 취소·기한 연장 권한 거절, 철회 후 수동 권리 조회의 빈 결과를 포함한다.
- activation receipt의 실제 CASCADE 소거 fixture 추가 후에도 SQL 9/9 및 결함4 검출/
  정상 원상 확인을 반복했다. migration SHA는 위와 같다. 두 CORS 검사 및 Edge의
  connection snapshot을 메모리에서 훼손한 추가 결함3도 지정 이름으로 검출했고,
  정상 전송 경계 4/4와 shared source SHA 불변을 확인했다.
- 앱 최초 영향 22파일 302/302 통과 뒤, 기존 IDB 작업의 pin이 없을 때 재동의 값을
  빌릴 수 있는 조기 반환 경로를 추가 보완했다. 그 최종 변경의 영향 5파일 195/195
  통과를 별도로 기록하며 302건을 보완 후 전체 재검사라고 표시하지 않는다.
- native IndexedDB/Web Crypto 브라우저 2/2 통과: 철회 전 dirty 초안의 reload 후
  queue, 기존 pending 작업의 pin 유실 후 read/list 없는 queue 모두 원문 보존과
  옛 작업 재승인 차단을 확인했다. 메모리 결함2를 지정 assertion 실패로 검출한 뒤
  정상 2/2 재통과 및 buffer/API/service 파일 SHA 불변을 확인했다.
- 신규 delete/restore의 revision=3 정상 pin과 불확실한 응답의 동일 operation 재시도는
  별도 lifecycle 브라우저 3/3 통과했다. 외부 요청을 차단한 localhost:4381의
  합성 HTTP/인증 경계이며 실제 Supabase 브라우저 왕복으로 계산하지 않는다.
- 첫 native 실행은 cold module 로딩 중 beforeEach 30초 timeout 1건, 최초 lifecycle
  실행은 낡은 feature-return 치환 fixture 실패 3건이었다. CLI 준비 시간 90초,
  feature 표현식만 치환하고 실제 privacy pause를 보존하는 fixture로 각각 재검사했다.
  assertion을 완화하지 않았으며 이 실패들을 통과 건수에 합산하지 않았다.
- app/e2e `tsc --noEmit` 모두 exit 0, server validator 3종 생성물 `--check` 통과.
  hosted release 환경 검사 25/25 통과(0058 승인 누락 기본 거절·OFF 정상 대조군 포함).
  OFF 환경을 상속해 잘못 닫히던 executable-negative fixture는 그 합성 child의
  KILL_ACCOUNT=false만 명시하여 원래 open-invalid-key 거절 검사를 되살렸다.
- Node 24.19.0 runtime 검사 → 공개 배포 환경 확인 → `tsc --noEmit` → Vite production
  build가 exit 0으로 완료됐다. 빌드 child에는 OS 실행 경로만 allowlist로 상속하고
  `NODE_ENV=production`, `VITE_ACCOUNT_PUBLIC_ENABLED=false`, `VITE_KILL_ACCOUNT=true`를
  지정했다. 승인 flag·Supabase 연결 값은 넣지 않았고 env 파일을 읽지 않았다.
  Vite는 source node_modules에 쓰지 않도록 `--configLoader runner`를 사용했다.
  폰트 런타임 해석·혼합 dynamic/static import·큰 chunk 경고는 남았으며 화면 검증이나
  account-open 배포 성공으로 계산하지 않는다. 검사 후 localhost:4381 listener가
  없음을 확인했고 별도 서버를 남기지 않았다.

실제 PostgreSQL 두 연결 경합, 운영 최신 migration/Edge, 전용 origin, 기존 미완료
탈퇴 정리, 최소 원장·백업 기한·완료 증빙은 위 로컬 합성 검사와 별개로 미검증이다.

### 610c 전체 CI와 후속 fixture 검증

`610c63142574463654e3f1e560f44d187d79a904`의
[CI 37268459905](https://github.com/hojune0330/TRAINORACLE/actions/runs/37268459905)는
`contract-tests` 성공, `app-quality` 실패, `app-browser`/`deploy-pages` 미실행이다.
앱 unit 결과는 6,623 통과·1 실패·33 skipped(총 6,657)이며 전체 CI 통과가 아니다.
유일 실패는 `plan-next-account.contract.test.tsx`의
`selects the next frame through one account transaction and retains the exact predecessor`다.

기존 fixture는 localStorage 전체가 그대로여야 한다고 기대했지만, 새 동의 경계는
해당 작업의 본문 없는 revision pin 한 쌍을 저장한다. 후속 시험 수정은 실제 서버
commit의 operation ID와 합성 계정에 결속된 정확한 키·값 `0`만 기대 목록에 추가한다.
prefix 단위로 검사를 제외하지 않으며 그 밖의 localStorage 전체 동일, 이전 계획의
원문 동일, 현재 프레임 계보 및 단일 서버 commit 단언을 유지한다. 생산 코드와
0057/0058 migration, workflow 및 공개 승인 flag는 변경하지 않았다.

Node 24.19.0 단일 파일 5/5 통과 후, 실행 메모리에서만 계획 본문 복사 결함을
주입하자 위 시험이 정확한 이름으로 실패했다(다른 4건은 지정 범위 밖이라 skipped).
임시 설정 제거 후 정상 5/5 재통과했고 transfer 소스 SHA-256
`01bf4fcffe2ec1e7e31b6a70c59e35bd0325da7f095ad670d1c96775027d8ddf` 불변을 확인했다.
샌드박스의 의존성 junction 해석 오류로 끝난 최초 두 실행은 시험 통과에 포함하지
않았다. 같은 단일 명령의 권한 검토 후 기존 읽기전용 의존성으로 재검사했으며,
검사용 새 설치나 원본 소스 변경은 없었다. 이 기록은 후속 후보의 focused 검증이며
새 커밋의 전체 CI·배포·실서비스 검증은 별도로 확인해야 한다. 위 공개 NO-GO는 유지한다.

`1778087cb8bbd3f18b01c5fc38ccab59af92e417`의 CI 37272008420 attempt 1은
변경하지 않은 CatalogConditionReview 시험의 5초 제한 초과로 실패했다. 같은 소스의
단독 기본 시간제한 검사에서는 19/19 통과했고, 승인된 app-quality job만 한 번 재실행했다.
attempt 2에서는 UTC/KST 각각 일반군 6,624 통과·33 skipped와 중량군 113 통과·2 skipped,
release 환경 25/25, device integration 11/11 및 공유 record/state 검증기 99/99·2/2가
통과했다. 이후 이번 fixture의 `server.commits[0]`에 TS2532가 발생하여 타입 검사에서
실패했으므로 전체 CI 성공이나 Pages 배포로 표시하지 않는다. 브라우저·게시 단계는
skipped이며 서버 계약 성공은 attempt 1 결과를 재사용했다.

후속 후보는 commit 존재의 명시적 가드만 추가했다. 단언·timeout·생산 코드는 그대로이며,
Node 24.19.0 focused 5/5와 app/e2e 두 `tsc --noEmit` 모두 exit 0으로 확인했다.
이 수정 후 새 커밋 CI는 별도이며, 운영 배포 요청을 실제 DB·Edge 적용·origin 확정·
처리/백업 조건 검증 완료로 대신하지 않는다.

### 6db 전체 CI와 화면 시험 탐색 범위 보완

`6db151f67657b9a54cbc441326464171f559b18f`의
[CI 37281353900](https://github.com/hojune0330/TRAINORACLE/actions/runs/37281353900)는
`contract-tests` 성공, `app-quality` 실패, `app-browser`/`deploy-pages` skipped다.
UTC 일반군 6,624 통과·33 skipped와 중량군 113 통과·2 skipped 뒤,
KST 일반군은 6,622 통과·2 실패·33 skipped였다. 이후 KST 중량군·타입 검사·
브라우저·게시 검사는 실행되지 않았다. 따라서 공개 배포 환경 guard도 이 실행에서
평가되지 않았으며 자동 Pages 배포 증거는 없다.

실패는 `CatalogConditionReview.contract.test.tsx`의 날짜 변경 후 재검토 시험과
`PlanBeta.instant.contract.test.tsx`의 목표 기록 명시 적용 시험에서 각각 기본 5초를
초과한 것이다. 두 파일은 기준 `fb6991c2`부터 `6db151f`까지 동일했다. 로컬 계측에서
달력 전체의 버튼 접근성 이름을 반복 계산하는 전역 탐색 비용을 확인했다. 카탈로그
시험의 전역 role 탐색은 11회 약 2.17초였으며, 정확한 표시 버튼 탐색으로 좁힌 뒤
2회 약 0.15초로 줄었다. 이는 합성 DOM 로컬 관측이며 제품 응답 시간의 측정은 아니다.

후속 수정은 이 두 시험에서만 명명된 영역 또는 정확한 표시 버튼으로 탐색을 좁힌다.
표시 여부·역할·접근성 이름, 날짜 재검토 전후 disabled/enabled, 적용 전 무저장,
훈련 구성 동일, 실제 명시 선택·저장·목표 참조 단언을 유지한다. 제품 코드, 훈련 규칙,
timeout, CI 설정, migration 및 배포 승인 flag는 바꾸지 않는다.

- Node 24.19.0, 유지된 UTC/KST 설정과 forks 1개로 두 파일 전체를 직렬 실행하여
  각각 29/29 통과·0 skipped를 확인했다. app 및 e2e `tsc --noEmit`은 모두 exit 0이다.
- 실행 메모리에서만 재검토 전 시작 버튼 차단을 없애자 카탈로그 시험의
  `toBeDisabled`가 실패했다. 목표 적용 콜백에 이전 계획을 전달하자 목표 시험의
  저장된 goal reference 개수 단언이 실패했다. 두 결함은 timeout이 아닌 지정 단언에서
  검출되었고, 정상 소스의 위 전체 재검사도 통과했다.
- 두 생산 파일의 전후 SHA-256은 각각
  `407cd301279954402d955040e4cb1dfb35a78ee3a8916223169ac82d0147f805` 및
  `c4e4f65dc52426301871439c0ea9c6982991bcf7548932829b7f8b509e26f353`로 동일했다.
  로컬 threads 시도의 worker 시작 실패(시험 0건)는 통과에 포함하지 않는다.

이 기록은 수정 후보의 영향 검사다. 새 exact-head 전체 CI와 실제 게시 결과는 별도로
확인한다. 계정-OFF 정적 화면 게시와 온라인 계정보관·DB/Edge 적용·운영 보유 조건의
승인은 구분하며, 위 온라인 출시 NO-GO를 로컬 시험 통과로 해제하지 않는다.

### 5457 필수 CI와 합성 계정 브라우저 fixture 정합성

`5457e74a044d55b8b98bcc4c80a0b02817b4d355`의
[CI 37288189659](https://github.com/hojune0330/TRAINORACLE/actions/runs/37288189659)는
`contract-tests`와 `app-quality`가 성공했다. UTC/KST 각각 일반군 6,624 통과·33 skipped,
중량군 113 통과·2 skipped이며 app/e2e 타입 검사와 production build도 성공했다.
`app-browser`는 모바일 계정 fixture 6건에서 `Feature flag route no longer matches`로
실패했다. `deploy-pages`는 skipped이고 배포 환경 guard는 실행되지 않았다.

후속 후보는 합성 브라우저 fixture 두 파일만 현재 계약에 맞춘다.

- 모바일 fixture는 기능 flag 표현식만 켜고 새 owner별 전송 중단 조건은 그대로 둔다.
  기존 6개와 추가 owner/철회/다른 계정/복귀/해제 대조군 1개가 로컬에서 7/7 통과했다.
  실행 메모리에서 중단 조건만 제거하면 새 시험의 `paused`와 `returned` 단언이 실패했다.
  정상 대조군 1/1 재통과 후 생산 API SHA-256
  `6370dfe6dcb4887661f15628198d84c271d7b8205849d622dbb2d85b695a1130` 불변을 확인했다.
- 파일 분석 fixture는 가짜 publishable key 형식, 현 약관 버전, 검증된 사용자와
  현 동의 RPC의 합성 응답을 준비한다. 잘못된 owner와 알 수 없는 RPC는 계속 거절한다.
  별도 자가신고 경기 기록은 실제 계정 서비스의 ACK를 통해 준비하고 파일 기록과는
  분리한다. 저장 원본 `222.25`와 비교 차이 `77.75` 단언을 유지하면서 표시만 기존
  한 자리 반올림 `222.3`에 맞췄다. 새 기기 복구·원본 계획 불변·ACK 없는 분석 배제와
  TCX/CSV/JSON/GPX 및 접근성 시나리오를 포함한 해당 파일 9/9가 로컬 통과했다.

설치된 Node 24.19.0/TypeScript의 e2e `tsc --noEmit`은 exit 0이었다. 서버 SQL,
제품 코드, CI workflow, 공개 승인 flag는 이 후속 수정에서 바꾸지 않았다.

이와 별개로 선검사한 기존 `form-input-autosave`는 로컬 12 통과·2 실패다. 두 실패는
두 탭 시나리오의 첫 winner 입력 저장 poll이며 아직 loser CAS 단계에 도달하지 않았다.
form 시험·fixture·제품 훅은 기준 `fb6991c2`부터 변경되지 않았다. foreground 전환이나
초기화 대기로 통과하지 않았고 설치 Chromium 대조에서도 재현됐다. 합성 단계 진단에서
동일 owner와 활성 preview를 확인했으며 한 실행에서는 native IndexedDB ownerKeys
readonly 완료가 24,712ms 지연됐다. 이를 제품 결함 없음이나 단순 flake로 확정하지 않는다.
모든 임시 form 진단/대기 변경은 제거했고 시간 제한·기존 단언·생산 코드는 변경하지 않았다.

위 검사는 localhost에서 계정 실험 경로를 합성으로 켠 검사이며, 공개 shared-origin의
계정-OFF 실행 상태나 운영 DB 적용을 뜻하지 않는다. 기존 workflow가 요구하는
`contract-tests`, `app-quality`, `app-browser` 세 단계는 후속 exact head에서 모두
성공해야 한다. 로컬 통과나 미실행을 필수 CI 성공으로 대신하지 않으며, 새 정적 게시와
실제 receipt/index/bundle 확인 전에는 배포 완료로 표시하지 않는다. 온라인 NO-GO는 유지한다.

### 7e26469f 필수 CI와 두 탭 저장소 탐침 반복 수정

`7e26469fde487000ea8aeb606e07bbf864d4d027`의
[CI 37296891719](https://github.com/hojune0330/TRAINORACLE/actions/runs/37296891719)는
`contract-tests`와 `app-quality`가 성공했으나 `app-browser`에서 기존 form 14건 중
12건 통과·2건 실패였다. 두 실패는 위와 같은 첫 winner 저장 poll이며, 모바일 계정
fixture 7건은 통과했다. `deploy-pages`는 skipped, 배포 환경 guard는 미실행이다.

후속 합성 native 브라우저 계측으로 실제 원인을 확인했다. 꾸미기 작성 화면이 모든
`storage` 이벤트마다 일지를 다시 읽고, 그 읽기의 `journalStorage()` 가용성 검사가
`__to_probe__`를 쓰고 지웠다. 두 탭이 이 내부 신호를 서로 다시 읽으며 이벤트가
1·2·4배로 늘어나 한 탭에서 131,072회까지 관측됐고 첫 저장 5초 단언이 실패했다.
두 탭 모두 visible이었으며 이 증거에는 원문·키 값이 없다. IndexedDB 요청/완료 지연은
관측 증상이었고, 이후 실행되는 operation revision pin을 원인으로 확정하지 않는다.

최소 수정은 `JournalDecorationPreview`의 두 storage listener에서 이 정확한 내부
탐침 키만 제외한다. 저장소 쓰기 가능성 검사는 삭제·캐시하지 않는다. 다른 모든 키,
`clear()`의 null 키, 일반 storage 이벤트, 실제 일지·꾸미기·계정·scope 이벤트와
unmount 해제를 유지한다. 동의 revision, CAS, 암호화, IndexedDB 완료 경계는 바꾸지 않는다.

- 같은 두 복구 시험은 수정 후 통과했고 probe 신호는 초기 8회 이후 증폭되지 않았다.
  계측과 임시 준비 대기를 모두 제거한 원래 form 파일 14건도 14/14 통과했다(48.5초).
- 화면 갱신과 저장소 가용성 계약 두 파일 20/20 통과. 메모리에서 필터만 제거하면
  `ignores only the internal storage probe while retaining data, consent, clear and account refresh events`
  시험의 무조회 단언이 4회 조회를 검출하여 실패했다. 정상 소스 20/20 재통과를 확인했다.
- Native/단위 시험은 설치된 Node 24.19.0과 합성 로컬 저장소를 사용했다. 실제 계정,
  외부 provider, 운영 DB/Edge와 개인정보 자료는 사용하지 않았다. 모든 진단용 출력은
  후보 코드에서 제거했고 원래 e2e 파일·시간 제한·기존 단언은 불변이다.
- 설치된 TypeScript의 app `tsc --noEmit`은 exit 0이다. 변경 없는 e2e 타입·전체 앱
  로컬 모음·production build는 중복 실행하지 않고 새 exact-head 필수 CI에서 확인한다.

이는 후속 후보의 로컬 영향 검사이며 새 exact-head 필수 CI 성공 또는 게시 완료가 아니다.
필수 세 job 성공 후에만 기존 effective 계정-OFF 상태를 유지하는 정적 배포를 준비한다.
온라인 보관·0057/0058 운영 적용·Edge 배포·백업·기존 삭제 요청 관문은 여전히 별도 NO-GO다.

### 7f10e684 이후 일반 브라우저 게이트 정합성 보완

정확한 `7f10e684275119be4e334975b0a88957ac4e0b77`의 CI
`37303156679`는 contract-tests/app-quality 성공, app-browser 실패,
deploy-pages skipped다. 원래 app-browser 최종 로그는 desktop 시나리오
75 failed / 159 passed / 28 skipped이며 후행 세 프로젝트가 완료됐다는 뜻이 아니다.
기존 화면 이름·접힌 설명·명시적 기록 선택·draft/수락 경계와 현재 코드/명세를
대조하여 해당 시험만 보완한다. 기존 개인정보·원본 수치·계획 저장·포커스·44px·
확대·모션 감소·취소·실패·재접속 단언은 유지한다.

빌드 산출물에 없는 dev-only MEP/catalog/역사 LT fixture는 동일한 필수
full-suite의 두 번째 loopback Vite lane으로 분리한다. fixture 서버는 .env를 읽지
않고 배포/인증 flag·비밀값 없이 실제 모듈 그래프를 사용한다. 현재 LT catalog
계획을 과거 pilot으로 변조하지 않는다. 현재 서비스 진입과 기존 승인된 과거 LT
편집 경계를 각각 확인하며 fixture의 저장 callback은 항상 거절한다.

- 목록 대조: local 및 CI의 원래 1,048 case/project = built936 + fixture112,
  중복·누락·추가 skip0. 원래 네 프로젝트, generic 60초, local retry0/CI retry2 유지.
- 실행기의 두 lane과 네 프로젝트씩 모두 성공하고 두 서버가 종료돼야 exit0이다.
  narrowing 인수는 거절하고 실패·시작 오류·중단·cleanup 오류는 nonzero다.
  필수 runner 단위14/14와 e2e TypeScript는 통과했다. UUID별 lane/project 출력으로
  이전 검증 증거를 덮어쓰거나 Playwright가 기존 증거 폴더를 지우지 않게 한다.
- root의 개인 페이스/기록/일지/목적 흐름 여섯 spec은 92/92 case/project 통과했다.
  다른 검증 묶음과 중복 합산하거나 최신 전체 hosted 성공으로 보고하지 않는다.
- 별도 실제 표시 결함: catalog에 반복·회복 상세가 있어도 기존 V1/V2 MAIN 비교가
  envelope만 읽고 '구체적 구성 미지정'·'쉬운 훈련 시간만 다름'이라고 단정했다.
  catalog를 기존 비교 미지원으로 명시하고 실제 일정의 상세 읽기로 안내한다.
  훈련 생성·dose·활성화 권한·기존 저장 내용·PACE 비교는 변경하지 않는다.
  새5계약의 수정 전 실패, 수정 후 원래 포함31/31, 기존 UI 포함38/38,
  새 account-OFF 빌드와 원래 candidate-purpose 네 프로젝트 통과를 확인했다.

- 마지막 youth 전환/저장 시험은 현재 `flow-stage-enter` 및 reduced-motion none을
  정확히 검사한다. 미저장 계획의 나가기 confirm을 명시적으로 확인한 후 합성 일지를
  저장하며, 성공 안내/체크 표시와 실제 journal 1건·거리8·계획 저장 없음까지 확인한다.
  네 프로젝트에서 6 PASS/원래 모바일 전용6 skip, e2e 타입·차이 검사가 통과했다.
  확인창을 없애거나 새 skip·시간 제한·재시도를 추가하지 않았다.
- 지원표는 정상 배율 전체행 100% 가시성, 200% 실제 글자 확대와 세로 스크롤의
  모든 텍스트 100% 읽기·누락 없음·가로 넘침 없음·44px를 유지한 네 프로젝트4/4다.
- 제품 비교와 fixture/실행기는 서로 작성하지 않은 담당자의 소스 교차검토에서
  범위 GO였다. 최종 exact commit blob 및 필수 CI와 운영 게시 증거는 별도 확인한다.

이 기록은 후속 로컬 후보의 검사이며 exact-head 전체 CI나 Pages 게시 완료가 아니다.
새 커밋의 필수 contract-tests/app-quality/app-browser 성공 후에만 기존 effective
계정-OFF 정적 배포를 진행한다. 운영 0057/0058·Edge·건강정보 보관·provider·
백업 파기와 실제 회원 왕복은 별도 NO-GO로 유지한다.

### ae0f9780 이후 AM/PM 브라우저 범위 보완

정확한 `ae0f97808e953475206006230e702c44227a28c7`의 CI
`37336486111`은 contract-tests/app-quality 성공, app-browser 실패,
deploy-pages skipped다. 첫 built desktop은 204 PASS/28 기존 SKIP/2 FAIL이며,
나머지 7개 프로젝트를 완료한 결과가 아니다. 실패한 두 AM/PM 시나리오는 앞선
focused 소비자 시험에 포함되지 않았으므로 같은 사례의 로컬 성공 후 CI 실패로
설명하지 않는다.

두 실패는 계산 카탈로그의 실제 제목 대신 옛 `오후 회복 운동` 문구를 찾은 것과,
날짜 전체를 반환하는 도우미에서 PM MAIN이 아닌 첫 AM 회복 목록을 읽은 것이다.
보완은 `launch-ready.spec.ts` 한 파일에서 정확한 세션으로 탐색을 좁힌다.
9일 전체 AM/PM 각 1개·하루 MAIN 상한, REC/RPE 표시, PM MAIN의 실제
준비/본운동/정리와 회복량·방식·실행 안내를 검사한다. 후보에서 읽은 제목과 수치,
각 구간 내용이 수락 및 reload 후에도 동일하고 저장 문자열도 불변인지 확인한다.
현재 catalog 처방에 과거 RPE-only 설명을 강제하지 않는다. 훈련 생성·수치·권한,
공통 도우미·CI·시간 제한·재시도·skip은 변경하지 않았다.

- 별도 새 production 산출물에서 원래 두 실패를 동일 위치까지 재현했다.
  수정 후 두 시나리오 × 원래 네 프로젝트는 8 PASS/0 FAIL/0 SKIP였다.
  이 산출물은 CI에서 내려받은 동일 파일이 아니라 기준 소스로 별도 만든 것이다.
- 합성 DOM의 본운동에서 회복 표기만 제거하자 같은 이름의 evening 시험이
  회복량/방식 단언에서 실패했다. 임시 주입 제거 후 정상 8/8을 재확인했다.
  단순 화살표는 운동끼리도 생길 수 있으므로 회복 증거로 사용하지 않는다.
- 설치된 TypeScript e2e 검사와 `git diff --check`는 exit 0이었다.
  제품 파일과 기존 산출물은 수정하지 않았고 자체 preview 프로세스는 종료했다.

이것은 두 사례의 로컬 영향 검사이며 전체 CI·게시 완료가 아니다. 새 exact head의
세 필수 job이 성공한 뒤에만 공식 validator를 통과한 계정-OFF 정적 빌드를 게시한다.
기존 다른 작업자의 `previews/` 자료를 보존하고 실제 index/entry/receipt를 확인한다.
온라인 계정·건강/일지 보관·0057/0058·Edge·백업 및 실계정 왕복은 여전히 별도다.

### c21994ce 이후 좁은 홈 화면 회귀 보완

정확한 `c21994ce875214c5f5b03854636bcb1893fa1f11`의 CI
`37346766925`는 contract-tests/app-quality 성공, app-browser 실패,
deploy-pages skipped다. built desktop206 PASS/28 기존 SKIP, mobile222 PASS/12
기존 SKIP 후 touch-narrow223 PASS/10 기존 SKIP/1 FAIL이며, reduced-motion과
fixture 네 프로젝트는 시작하지 않았다. WELCOME 높이는 세 시도 모두1287px로
기존1250px 상한을 넘었다. 전체 CI 성공으로 표시하지 않는다.

동일 제품 소스의 로컬320px에서는1235px였고, 같은 화면에15px 폭을 예약하면
1287px를 재현했다. 최초 두 행동의 합계276.03px가 가용263px에서 두 행으로
줄바꿈되어52px 늘어났다. 실제 Pretendard 웹폰트는 양쪽 모두 로드됐다.
CI의 실제 Linux scrollbar 좌표를 취득하지 않았으므로 운영체제 차이라는
설명은 재현에 기반한 추론이며 직접 CI 화면 증거와 구분한다.

- 380px 이하 홈의 좌우 여백16px와 첫 행동의 열 간격8px만 기존 토큰으로
  조정한다. 글꼴·문구·44px·행 간격·줄바꿈 허용·원래 높이 상한은 유지한다.
- 새15px 폭 예약 회귀는 수정 전1287 >1250으로 최초/retry1/retry2 동일하게
  실패했다. 수정 후 일반320px/예약15px 모두1235px로 기존 상한을 충족했다.
- 원래 WELCOME·기존 홈 확대/복귀·기존 빈 홈 터치·새 회귀의 네 프로젝트
  집중 검증은12 PASS/0 FAIL/원래4 SKIP이며 모두 첫 시도 통과했다.
  새 회귀는 첫 두 버튼의44px·같은 행 배치와 보통/200%의 가시 포커스·Tab
  이동을 확인한다. 200%에서는 보이는 전체 행동의 라벨 동일·44px·내부 잘림
  없음·스크롤 후 전체 가시성(ratio1)을 별도로 순회 확인한다.
- 새200% 검사 초안의 nearest-scroll은 타일 경계를0.25px 잘린 위치에 맞췄다.
  실제 좌표를 확인하고 읽기 순회만 center-scroll로 교정했다. 원래 시험,
  ratio1·문구·시간 제한·재시도·skip·제품 코드의 추가 변경은 없다.
- 시각 기준/기존 홈 단위18/18, 새 격리 production build와 app/e2e 형 검사,
  diff 검사는 통과했다. 기존 산출물과 실패 증거는 보존하고 자체 서버를 종료했다.
- 최종 CSS blob `5d57a7dc852b3946728ecd5ca2f6212a6b78e2c8`, 시험 blob
  `7005fbda62ca68019afe0d60375b14c72e825b7d`에 검증을 결속한다.

이는 제한된 로컬 영향 검사이며 새 exact-head 전체 CI나 공개 게시 완료가 아니다.
workflow·온라인 계정·동의·DB·Edge·훈련/저장 로직은 변경하지 않았다.
필수 세 job 성공, 공식 계정-OFF 빌드 검증, 기존 previews 보존 및 실제 공개
index/entry/receipt 대조가 이후 게시 조건이다.

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
