# TrainOracle 인증 제공자 연결 현황

확인일: 2026-08-25

## 쉽게 보는 현재 상태

| 항목 | 실제 확인 | 판정 |
|---|---|---|
| Supabase 조직 | `trainoracle-beta` | 확인 |
| Supabase 프로젝트 | `trainoracle-beta-staging`, 서울 리전 | 확인 |
| Email provider | Enabled | 연결됨, 6자리 코드 운영 발송은 미검증 |
| Google provider | Enabled | OAuth 키 연결됨, 실제 가입·재로그인 왕복은 미검증 |
| Kakao provider | Disabled | 미연결 |
| Phone provider | Disabled | 미연결 |
| Site URL | `https://hojune0330.github.io/TRAINORACLE/` | 설정 완료 |
| Redirect URLs | `https://hojune0330.github.io/TRAINORACLE/**` | 1개 등록 완료 |
| Database | 최신 원격 migration `0028` | `0027`·`0028` 적용 및 기록 확인 |
| Google Cloud | `TrainOracle Auth` (`trainoracle-auth-20260825`) | 전용 프로젝트·웹 OAuth client 생성 |
| Email template | Hosted 기본 템플릿, custom SMTP 없음 | 현재 6자리 코드 UX와 불일치 |
| 로컬 일지 화면 격리 | 브라우저 전체가 하나의 로컬 저장소를 사용 | 계정 전환 시 이전 일지가 보일 수 있어 G8 차단 유지 |

이 표는 2026-08-25 소유자 승인 아래 시험 Supabase와 Google Cloud에 실제 적용하고
다시 읽어 확인한 결과다. OAuth secret은 Google Cloud에서 Supabase 설정으로 직접
전달했으며 저장소·보고서·터미널 출력에 기록하지 않았다. 계정 공개 변수와 SMS는
켜지 않았다.

## 2026-08-25 실제 적용 결과

1. Supabase Site URL과 공개 앱 redirect wildcard를 위 주소로 등록했다.
2. `0027_account_legal_consent`와 `0028_under_14_online_account_gate`를 순서대로
   적용하고 `supabase_migrations.schema_migrations`에서 두 버전을 확인했다.
3. `user_private_profiles_under_14_gate`가
   `block_under_14_online_profile` 함수에 연결된 것을 확인했다.
4. rollback-only 합성 시험은 계정 A/B의 프로필·일지 격리, 교차 쓰기 거절,
   만 14세 미만 서버 차단을 확인하고 최종 `PASS`를 반환했다.
5. 시험 뒤 합성 사용자는 `0명`, 서버 스위치는 원래 값인
   `ACCOUNT=false,SYNC=false`로 확인됐다.
6. Google Cloud 전용 외부 앱과 `TrainOracle Web` client를 만들고 Supabase Google
   provider를 활성화했다. Google의 `Skip nonce checks`와
   `Allow users without an email`은 모두 끈 상태다.
7. Google 앱은 테스트 상태이며 승인 계정 1개만 test user로 등록했다. 공개 법률
   URL이 없으므로 일반 사용자 게시와 실제 가입·로그아웃·재로그인 왕복은 아직
   완료로 기록하지 않는다.

첫 합성 시험에서는 프로필 직접 UPDATE 권한이 회수된 상태를 시험문이 실패로
오인했다. 시험문을 수정해 `관계 권한 거절`과 `RLS에 의한 0행 수정`을 모두 정상적인
교차 쓰기 차단으로 인정하게 했고, 회귀 테스트 후 원격에서 다시 PASS를 확인했다.

## 확정해 둘 주소

```text
Public app URL
https://hojune0330.github.io/TRAINORACLE/

Google JavaScript origin
https://hojune0330.github.io

Supabase OAuth callback for Google
https://texspxlpjungyarkvtkc.supabase.co/auth/v1/callback

Supabase allowed redirect
https://hojune0330.github.io/TRAINORACLE/**
```

Google의 Authorized redirect URI에는 앱 주소가 아니라 Supabase callback을 넣고,
Supabase URL Configuration에는 앱의 복귀 주소를 넣는다. 두 주소의 역할을 바꾸면
로그인 후 돌아오지 못한다.

## 운영 적용 순서

1. [완료] Google Cloud에 TrainOracle 전용 프로젝트를 만든다.
2. [완료] 브랜딩 이름을 `TrainOracle`, 지원 이메일을 운영자 승인 주소로 설정한다.
3. [완료] 웹 OAuth client를 만들고 위 origin과 Supabase callback만 등록한다.
4. [완료] Client ID와 secret은 Supabase Google provider 설정에 직접 넣는다. Git에는 넣지 않는다.
5. [완료] Supabase Site URL과 Redirect URLs를 공개 주소로 바꾼다.
6. custom SMTP를 연결하고 `supabase/templates/magic-link.html`과 같은 6자리 코드 템플릿을 적용한다.
7. Google과 이메일을 각각 신규 가입, 로그아웃, 재로그인까지 실측한다.
8. [완료] `supabase/tests/account_identity_isolation_rehearsal.sql`을 SQL Editor에서 실행해 마지막 PASS와 rollback을 확인한다.
9. 실제 서로 다른 두 계정과 두 브라우저 시험을 별도로 수행한다.
10. 증거를 G4, G7, G8, G9에 연결한 뒤에만 계정 공개를 검토한다.

## 휴대전화 권장 경로

첫 구현은 Supabase Phone OTP를 사용한다. Supabase가 직접 지원하는 공급자는 Twilio,
MessageBird, Vonage 계열이며, 국내 운영 조건이나 비용이 맞지 않으면 Supabase Send SMS
Hook 뒤에 국내 SMS 사업자를 연결하는 2단계 대안을 검토한다.

전화 로그인은 이메일·Google 공개의 선행조건이 아니다. 다음 조건을 모두 확인하기
전까지 `TRAINORACLE_PHONE_AUTH_ENABLED`와
`TRAINORACLE_PHONE_AUTH_OPERATIONS_APPROVED`를 false로 둔다.

- 한국 `010` 번호 실수신
- 발신자 등록과 국내 문자 관련 의무 확인
- CAPTCHA 또는 동등한 봇 방어
- 번호별 60초 재전송 제한과 프로젝트 발송량 제한
- 일일 비용 경보와 긴급 중단 절차
- 신규·재로그인·잘못된 코드·만료 코드 시험
- 전화번호 전체가 화면·분석·로그에 남지 않는지 확인

## 계정 격리 증거의 수준

현재 원격 화면에서 RLS가 켜져 있고 `own ...` 정책들이 존재하는 것은 확인했다.
하지만 이것만으로 G8을 닫지 않는다.

1. rollback-only 합성 SQL: 정책의 교차 읽기·쓰기 차단 확인
2. 실제 계정 2개: OAuth/OTP 세션이 서로 다른 `auth.uid()`를 받는지 확인
3. 브라우저 2개: A의 로컬 일지가 B 화면과 업로드 큐에 나타나지 않는지 확인
4. 로그아웃·재로그인: 이전 사용자의 완료 영수증이 재사용되지 않는지 확인

네 단계가 모두 있어야 `TWO_ACCOUNT_LOCAL_DATA_ISOLATION`을 실제 증거로 기록한다.

### 이번 점검에서 확인한 로컬 격리 결함

현재 `claimSyncBinding`은 A 계정에 묶인 일지를 B 계정으로 올리는 동작을 막는다.
그러나 `journal-store` 자체는 계정별 저장 구획이 없고, 계정 연결을 끊을 때도 일지를
기기에 그대로 남긴다. 따라서 같은 브라우저에서 B로 로그인하면 A가 남긴 로컬 일지가
화면에 보일 수 있다. 서버 RLS가 정상이어도 이 화면 노출은 해결되지 않는다.

이 결함은 이번 전화 로그인 코드와 분리해 G8을 계속 차단한다. 다음 격리 구현은
아래 경계를 동시에 만족해야 하므로 단순히 로컬 저장소를 비우는 방식으로 처리하지 않는다.

- 로그인 전 만든 일지는 사용자의 명시적 선택 전까지 `UNBOUND_DEVICE_DATA`로 유지한다.
- 계정에 귀속된 일지는 다른 계정 화면에서 숨긴다.
- 계정 변경은 이전 계정의 일지·휴지통·삭제 기록을 지우지 않는다.
- 새 계정으로 이전 기기 데이터를 자동 업로드하지 않는다.
- 백업, 명시적 가져오기 또는 다시 원래 계정으로 로그인하는 복구 경로를 제공한다.

실제 계정 2개와 브라우저 2개로 이 경계를 통과하기 전에는 G8을 `PASS`나 `CLOSED`로
바꾸지 않는다.
