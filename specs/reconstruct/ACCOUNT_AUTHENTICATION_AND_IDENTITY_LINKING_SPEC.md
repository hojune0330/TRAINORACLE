# ACCOUNT_AUTHENTICATION_AND_IDENTITY_LINKING_SPEC.md

```yaml
document_metadata:
  doc_id: trainoracle-account-authentication-identity-linking-spec
  spec_id: ACCOUNT_AUTHENTICATION_AND_IDENTITY_LINKING_SPEC
  title: TrainOracle 간편 인증 및 향후 계정 연결 계약
  version: 0.3
  round: RT3_EMAIL_CONFIRMATION_LINK_RUNTIME_ALIGNMENT_DRAFT
  status: DRAFT_FOR_REVIEW
  owner: COACH_HOJUNE
  service_provider_working_name: aaclub
  open_issues_total: 8
  canonical_blocking_count: 4
  executed_tests_total: 0
  runtime_evidence: none
```

---

## 1. 목적과 현재 권위

이 문서는 TrainOracle 첫 공개 계정에 사용할 최소 인증 계약을 정의한다. 소유자가
승인한 1차 범위는 카카오, Google, 이메일 비밀번호 없는 인증이다. 세 방식은 모두
Supabase Auth로 통과하며 TrainOracle은 비밀번호를 직접 받거나 저장하지 않는다.

현재 무료 Supabase 기본 메일 서비스는 수정 가능한 6자리 코드 템플릿이 아니라
확인 링크를 보낸다. 따라서 커스텀 SMTP 또는 Send Email Hook이 별도로 수용되기
전까지 앱도 확인 링크 흐름을 사실대로 보여준다. 화면만 6자리 코드라고 주장하거나,
기본 확인 링크를 OTP 코드처럼 취급하면 안 된다.

이 문서는 구현 초안의 기준이지만 canonical 승격, 운영 제공자 설정 완료, 공개
출시 승인 또는 런타임 증거를 주장하지 않는다. 계정 공개 스위치는
`docs/ACCOUNT_PUBLIC_RELEASE_GATE.md`의 G1~G9가 실제 증거로 닫힌 뒤에만 연다.

## 2. 1차 제공 범위

```yaml
first_wave_authentication:
  identity_runtime: SUPABASE_AUTH
  methods:
    - KAKAO_OAUTH
    - GOOGLE_OAUTH
    - EMAIL_CONFIRMATION_LINK
  password_login: FORBIDDEN
  custom_auth_server: FORBIDDEN
  custom_cross_provider_account_merge: FORBIDDEN
  phone_sms: IMPLEMENTED_BEHIND_SEPARATE_CLOSED_GATE
  toss_identity_or_login: DEFERRED
  naver_login: DEFERRED
  apple_login: DEFERRED_UNTIL_APP_STORE_PHASE
  athletetime_sso: DEFERRED_OPTIONAL_IDENTITY_LINK
```

카카오·Google·이메일 버튼은 같은 계정 화면에서 제공한다. 화면에 보이는 제공자는
공개 전에 실제 제공자 콘솔과 Supabase에서 모두 활성화하고 실측해야 한다. 설정되지
않은 제공자 버튼을 공개한 채 사용자에게 내부 오류를 보여주면 안 된다.

### 2.1 휴대전화 OTP 후속 경로

휴대전화 로그인은 국내 `010` 번호를 `+8210...` E.164 형식으로 정규화한 뒤
Supabase Phone OTP를 사용한다. 같은 번호의 하이픈·공백·국가번호 표기는 하나의
식별자로 취급한다. 전체 번호는 계정 화면이나 제품 분석 이벤트에 노출하지 않고
마지막 네 자리만 마스킹해 보여준다.

이 경로는 코드가 준비돼도 아래 두 배포 값과 서버 제공자 설정이 모두 확인될
때까지 버튼을 보여주지 않는다.

```yaml
phone_auth_release_gate:
  VITE_PHONE_AUTH_ENABLED: true
  VITE_PHONE_AUTH_OPERATIONS_APPROVED: true
  VITE_KILL_PHONE_AUTH: false
  sms_provider_configured: required
  captcha_or_equivalent_abuse_control: required
  rate_limit_and_cost_alert: required
  korean_sender_compliance_review: required
  first_public_release_dependency: false
```

SMS 공급자는 신원 확인 코드 전달만 담당한다. 전화번호를 훈련 분석, 코치 공유,
마케팅 동의 또는 계정 자동 병합 근거로 사용하지 않는다. 60초 이내 재발송을 막고,
실패 문구로 기존 계정 존재 여부를 구분해 주지 않는다.

## 3. 사용자 흐름

1. 사용자가 카카오, Google, 이메일 중 하나를 고른다.
2. 외부 인증을 시작하기 전에 생년월일과 필수 약관 전체 동의를 확인한다.
3. 만 14세 미만이면 외부 인증 요청을 보내지 않고 로컬 사용으로 되돌린다.
4. 만 14세 이상이면 선택한 인증을 시작한다.
5. OAuth 또는 이메일 확인 링크 성공 뒤 서버에 생년월일과 동의 문서 버전만 저장한다.
6. 서버 가입 확정이 실패하면 동기화·공유 설정을 열지 않는다.
7. 가입이 끝나도 일지 업로드는 자동 시작하지 않는다. 동기화는 별도 명시적 선택이다.
8. 새 기기에서는 서버 프로필의 최신 동의 상태를 다시 확인한 뒤에만 동기화 설정을 연다.

각 화면은 한 가지 질문만 한다. 첫 화면은 인증 방법, 다음 화면은 나이·약관,
이메일 경로의 마지막 화면은 확인 이메일을 열도록 안내한다. 사용자는 모든 단계에서 계정 없이
로컬 일지와 훈련 계획을 계속 사용할 수 있다.

## 4. 만 14세 경계

```yaml
under_14_policy:
  age_reference_timezone: Asia/Seoul
  public_online_account_offered: false
  pre_authentication_check_required: true
  client_only_check_sufficient: false
  server_profile_insert_gate_required: true
  local_journal_available: true
  local_training_plan_available: true
  raw_local_data_auto_upload: false
```

14번째 생일 당일부터 온라인 계정 대상이다. 그 전날까지는 대상이 아니다. 이 정책은
운동 처방의 안전성 판단이 아니라 온라인 개인정보 계정의 출시 범위 결정이다.
청소년의 로컬 훈련계획 생성이나 일지 사용을 막는 근거로 확대 해석하면 안 된다.

과거 보호자 확인 기반 계정 문서와 DB 구조는 기존 기록 및 향후 검토 자료로 남긴다.
그러나 이번 1차 공개 흐름은 보호자 동의를 받아 만 14세 미만 계정을 만드는 경로를
제공하지 않는다. 감사·삭제 처리를 위해 보존된 과거 프로필도 만 14세 미만인 동안은
서버 일지 동기화와 공유 권한을 받지 않는다.

## 5. 동의와 최소 저장

가입 전에 공개 HTTPS 개인정보 처리방침·이용약관 링크와 적용 버전을 보여준다.
서버에는 생년월일, 두 문서의 버전, 서버 동의 시각만 저장한다. URL 전체나 화면
문구 복제본을 프로필에 저장하지 않는다. 문서 버전이 바뀌면 이전 기기의 완료
표식만으로 가입을 이어가지 않는다.

OAuth 왕복을 위해 생년월일과 문서 버전을 같은 탭의 `sessionStorage`에 최대 15분
보관할 수 있다. 가입 성공 또는 유효성 실패 시 즉시 지운다. 장기 완료 표식에는
생년월일을 넣지 않는다.

이메일 확인 링크가 새 탭이나 새 창에서 열려 `sessionStorage`를 읽지 못하면,
인증된 사용자를 실패 화면이나 동기화 화면으로 보내지 않는다. 생년월일과 현재
필수 약관을 한 번 더 확인하는 가입 마무리 화면을 제공하고, 서버 프로필 저장이
성공한 뒤에만 완료 표식과 동기화 설정을 연다. 이를 피하려고 생년월일을 URL,
`localStorage`, OAuth state 또는 장기 쿠키로 옮기면 안 된다.

## 6. 데이터와 안전 권한

인증 제공자는 신원 확인만 담당한다. 카카오, Google, 이메일, 향후 AthleteTime 중
어떤 제공자도 D9, RVE, Safety Gate, Plan Generator, 코치 권한 또는 의료 판단을
변경할 수 없다.

```yaml
authentication_authority:
  can_identify_account_session: true
  can_clear_D9: false
  can_override_RVE: false
  can_override_plan_safety_gate: false
  can_change_training_load: false
  can_upload_local_journal_automatically: false
  can_receive_raw_memo_or_symptom_clause: false
```

원문 메모, 통증 서술, 증상 문구는 인증 요청, OAuth state, URL query, 제품 분석 이벤트,
가입 감사 로그에 넣지 않는다. 기존 로컬 우선 저장과 메모 암호화 경계를 유지한다.

## 7. 계정 중복과 연결

1차 버전은 서로 다른 제공자 계정을 TrainOracle이 임의로 합치지 않는다. 이메일이
같아 보인다는 이유만으로 두 사용자 레코드를 합치거나 기존 일지를 옮기면 안 된다.
Supabase의 실제 identity-linking 동작은 시험 프로젝트에서 두 제공자 조합별로
확인하고, 결과가 불명확하면 사용자 지원 검토 상태로 멈춘다.

AthleteTime은 첫 출시의 identity root가 아니다. 향후 선택 제공자로 연결할 때에도
TrainOracle 자체 사용자 ID, 동의, 삭제, 일지, 안전 데이터 경계는 독립적으로
유지한다. `FEDERATED_ACCOUNT_SSO_CONTRACT.md`는 그 미래 경로의 참고 초안이다.

### 7.1 같은 기기에서 계정을 바꾸는 경우

로그인 전 만든 일지는 특정 계정 소유로 추정하지 않고 `UNBOUND_DEVICE_DATA`로
취급한다. 사용자가 동기화 대상을 명시적으로 선택하기 전에는 어느 계정에도
자동 업로드하지 않는다. 한 계정에 귀속된 로컬 일지는 다른 계정 세션의 화면,
분석 입력 또는 업로드 큐에 나타나면 안 된다.

계정 전환을 이유로 일지·휴지통·삭제 기록을 자동 삭제하지 않는다. 대신 원래
계정으로 다시 로그인, 소유자 백업, 명시적 기기 데이터 가져오기 중 하나로
복구할 수 있어야 한다. 이 구획과 복구 경로가 구현되지 않은 현재 상태에서는
서버 RLS 시험이 통과해도 `TWO_ACCOUNT_LOCAL_DATA_ISOLATION`을 충족하지 않는다.

## 8. 실패와 복구

- 제공자 시작 실패: 선택 화면으로 돌아가며 로컬 데이터가 안전하다고 알린다.
- 이메일 링크 오류·만료: 이메일을 지우지 않고 확인 메일을 다시 받을 수 있게 한다.
- 이메일 링크가 새 탭에서 열림: 나이·약관을 다시 확인하고 서버 저장 뒤 가입을 끝낸다.
- OAuth 성공 후 프로필 확정 실패: 로그인 상태만으로 동기화 화면을 열지 않는다.
- 새 기기의 로컬 완료 표식 부재: 서버의 프로필·약관 버전을 확인하고 실패 시 닫힌다.
- 약관 버전 변경: 임시 가입 정보를 폐기하고 새 버전 확인부터 다시 시작한다.
- 계정 기능 중단: 서버 `ACCOUNT` 스위치와 배포 kill switch를 닫아도 로컬 앱은 유지한다.

## 9. 공개 전 필수 증거

```yaml
required_release_evidence:
  - KAKAO_NEW_AND_RETURNING_LOGIN
  - GOOGLE_NEW_AND_RETURNING_LOGIN
  - EMAIL_CONFIRMATION_LINK_NEW_AND_RETURNING_LOGIN
  - EMAIL_LINK_NEW_TAB_PROFILE_FINALIZATION
  - PHONE_OTP_NEW_AND_RETURNING_LOGIN_WHEN_RELEASED
  - OAUTH_RETURN_TO_ACCOUNT_SCREEN
  - EXACT_14TH_BIRTHDAY_BOUNDARY
  - UNDER_14_NO_EXTERNAL_AUTH_REQUEST
  - UNDER_14_SERVER_PROFILE_REJECTION
  - LEGAL_VERSION_MISMATCH_REJECTION
  - PROFILE_FINALIZATION_FAILURE_BLOCKS_SYNC
  - LOGOUT_AND_ACCOUNT_DELETION
  - TWO_ACCOUNT_LOCAL_DATA_ISOLATION
```

테스트 코드의 PASS만으로 제공자 콘솔 설정이나 실서비스 OAuth 왕복을 증명할 수 없다.
시험 프로젝트와 실제 공개 origin에서 별도의 실행 영수증이 필요하다.

## 10. Open Issues

| issue_id | title | status | canonical_blocking | notes |
|---|---|---|---:|---|
| OI-AAIL-PUBLIC-LEGAL-DOCS-001 | 공개 약관·방침 URL 및 버전 미확정 | OPEN | YES | G1/G2와 연결 |
| OI-AAIL-PROVIDER-CONSOLES-001 | 카카오·Google 운영 제공자 설정과 왕복 증거 없음 | OPEN | YES | 비밀값은 Git 저장 금지 |
| OI-AAIL-SUPABASE-OPERATIONS-001 | 운영 Supabase 지역·마이그레이션·RLS 증거 없음 | OPEN | YES | 0001~0028 적용 필요 |
| OI-AAIL-CROSS-ACCOUNT-ISOLATION-001 | 두 계정·두 기기 격리 실측 없음 | OPEN | YES | G8과 연결 |
| OI-AAIL-IDENTITY-LINKING-001 | 제공자 간 동일 사용자 연결 정책 미수용 | OPEN | NO | 임의 병합 금지 유지 |
| OI-AAIL-ATHLETETIME-FUTURE-001 | AthleteTime 선택 연동 시점·프로토콜 미확정 | OPEN | NO | 첫 공개 차단 아님 |
| OI-AAIL-PHONE-PROVIDER-001 | 한국 수신 가능한 SMS 공급자·발신자·비용 미확정 | OPEN | NO | 전화 로그인 공개 때만 차단 |
| OI-AAIL-PHONE-ABUSE-001 | CAPTCHA·재전송 제한·비용 경보 실측 없음 | OPEN | NO | 운영 승인 값은 계속 false |

## 11. Non-Claims

이 문서는 카카오·Google·휴대전화 운영 설정 완료, Supabase 운영 마이그레이션 적용,
공개 계정 출시, 런타임 OAuth·이메일 링크·OTP PASS, canonical 승격 또는 open issue 종결을
주장하지 않는다.

[DRAFT_COMPLETE]
