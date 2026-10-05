# 계정·동기화 배포 설정 (서비스 운영자용)

계정 기능은 **계정 출시 승인, 공개 연결 정보, 공개 약관 정보가 모두 있어야만
켜집니다.** Google·이메일·카카오·휴대전화는 다시 각자의 출시·중단 값으로
분리된다. 키를 먼저 등록해도 계정과 제공자 승인이 없으면 앱은 로컬 전용 또는
해당 제공자가 숨겨진 상태로 유지된다.

> 공개 승인 전에 `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md`의 필수 항목을 모두
> 실제 증거로 확인해야 합니다. 변수는 그 확인을 대신하지 않습니다.

## 1. 시험 Supabase 프로젝트 만들기 (무료)

1. https://supabase.com → GitHub 계정으로 가입 → `New project`
2. 운영 DB와 구분되는 이름(예: `trainoracle-beta-staging`)과 무료 플랜을 선택
3. 선택한 Region과 프로젝트 ref를 시험 영수증에 기록
4. 생성 후 `Project Settings → API`에서 두 값을 복사:
   - `Project URL` (예: `https://abcdefgh.supabase.co`)
   - legacy `anon` JWT 또는 새 `sb_publishable_...` 키만 사용한다. `service_role` JWT와
     `sb_secret_...`은 프론트 변수에 절대 넣지 않으며 출시 검사도 이를 거절한다.

## 2. 현재 마이그레이션 전체 적용

SQL Editor에 일부 파일만 복사하지 않는다. 저장소 루트에서 Supabase CLI로
시험 프로젝트를 연결한 뒤 저장소의 모든 마이그레이션을 순서대로 적용한다.

```bash
npx supabase login
npx supabase link --project-ref <시험-project-ref>
npx supabase db push --linked --include-all
npx supabase migration list --linked
```

마지막 명령에서 로컬·원격 목록이 모두 일치하고, 현재 마지막인
`0056_remaining_auth_surface_gates.sql`까지 표시돼야 한다.
명령 시각, 시험 프로젝트 ref, Region, 적용 목록과 성공 결과를
`reports/operations/`의 시험 영수증에 남긴다. 비밀번호·access token·anon key는
영수증이나 Git에 기록하지 않는다.

0051~0056 운영 반영은 `ACCOUNT`, `PUBLIC_PROFILE`, `DEVICE_INTEGRATION`과 라운지
서버 스위치를 먼저 끈 뒤
순서대로 진행한다. 0051이 기존
가입 RPC를 `CLIENT_UPDATE_REQUIRED`로 fail-closed하고 구형 무인자 삭제 RPC 권한을
닫고, 0052가 탈퇴·차단 계정의 COROS 수집을 막고, 0053이 허용되지 않은 AMR과
비밀번호 자격 증명 보유 계정, 폐기된 `session_id`를 막는 것을 확인한다. 0053이
추가하는 `AUTH_OAUTH`와 `AUTH_PASSWORDLESS`는 기본적으로 닫혀 있다. 실제 확인을
마친 인증 종류만 서버에서 연다. 0054는 공개 프로필과 개인 프로필 조회를 현재
계정 상태에 묶고, 0055는 가입 확정 쓰기를 인증을 완료한 정확한 `session_id`에
묶는다. 0056은 공개 프로필 중단 스위치의 직접 RPC 우회, 보호자 관계 유무 조회,
지원하지 않는 인증 방식의 라운지 입장을 닫는다. 이 순서를 모두 적용한 뒤 새
클라이언트를 배포하고
서비스 워커 갱신을 안내한다.
시험·실계정 왕복과 전용 origin을 확인하기 전에는 `ACCOUNT`를 다시 열지 않는다.
구 캐시 클라이언트의 가입·삭제 실패는 이 전환 중 의도한 안전 동작이다.

## 3. 이메일 확인 링크와 PKCE 시험

브라우저 클라이언트는 OAuth 세션 토큰을 URL에 두지 않는 PKCE 방식으로 고정한다.
이 변경은 이메일 확인 링크의 형식도 바꾸므로, `Authentication → Email Templates`의
`Confirm signup`과 `Magic link` 템플릿을 fragment의 token hash 방식으로 바꾸고 앱의 same-origin
콜백에서 `verifyOtp({ token_hash, type: "email" })`를 실행해야 한다.

두 템플릿, 신규·기존 사용자, 새 탭, 만료·재전송을 실제 공개 origin에서 확인하기
전까지 아래 값은 `false`로 유지한다.

```text
VITE_EMAIL_AUTH_ENABLED=false
VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED=false
```

코드와 템플릿을 함께 확인한 뒤 두 값을 `true`로 바꾼다. 둘 중 하나가 없거나
`VITE_KILL_EMAIL_AUTH=true`이면 이메일 버튼은 표시하지 않는다. 배포 변수는 이
운영 확인을 대신하지 않는다.

새 탭에서 링크를 열었을 때는 사용자가 **링크를 직접 요청한 자기 이메일**을 다시
입력하게 하고, `verifyOtp`가 돌려준 정규화 이메일과 정확히 같을 때만 가입을
마무리한다. 다른 이메일이면 새 로컬 세션을 즉시 로그아웃하고 가입 임시 상태를
지운다. 이 시험에는 A 계정이 요청한 링크를 B 브라우저에서 여는 전달 공격을 포함한다.

화면의 재전송 타이머는 보안 통제가 아니다. 공개 anon key로 `/auth/v1/otp`를 직접
호출할 수 있으므로 Hosted Auth의 CAPTCHA와 서버 요율 제한을 켜고, custom SMTP의
발송 쿼터·비용·반송·스팸 평판 경보를 실제로 확인한다. 이 운영 증거가 없으면 이메일
게이트는 계속 `false`로 둔다.

0053의 현재 정책은 **현재 로그인 방법만** 보는 것이 아니라 비밀번호 자격 증명을
가진 계정 전체를 차단한다. 이후 Google이나 magic link로 로그인해도 동일하다. 전용
시험 프로젝트에서 신규·기존 magic link, Google, 직접 비밀번호 가입 계정의 JWT
`amr`과 서버 판정을 실제로 대조하고, 미사용 OAuth·익명·SSO provider가 꺼진 것을
확인하기 전에는 계정 게이트를 열지 않는다. 해시 값 자체는 영수증·로그에 복사하지
않고 존재 여부와 허용·거부 결과만 기록한다.

공개 Auth API를 직접 호출해도 계정 입장으로 이어지지 않도록 서버 운영 스위치를
별도로 관리한다. Google·Kakao는 `AUTH_OAUTH`, 이메일 링크·SMS 등 비밀번호 없는
인증은 `AUTH_PASSWORDLESS`다. 현재 JWT의 OAuth AMR은 Google과 Kakao를 확실히
구분하지 못하므로 둘 중 하나만 사고가 나도 `AUTH_OAUTH` 전체를 닫는다. 두 스위치는
Hosted 설정과 실제 왕복을 확인한 뒤에만 열고, `ACCOUNT`는 그 다음에 연다.

## 4. 카카오 간편 로그인

1. https://developers.kakao.com 에서 aaclub 운영 계정으로 TrainOracle 앱을 만든다.
2. 카카오 로그인을 활성화하고 동의항목은 공개 정책에 적힌 최소 식별 범위만 선택한다.
3. Supabase `Authentication → Providers → Kakao` 화면에 표시된 callback URL을
   카카오 Redirect URI에 정확히 등록한다.
4. 카카오 REST API key와 client secret을 Supabase provider 설정에만 입력한다.
   채팅, Git, 문서, 프론트 환경변수에는 기록하지 않는다.
5. Supabase `Authentication → URL Configuration`에 시험 URL과 TrainOracle 전용
   origin을 등록한다. `https://hojune0330.github.io/TRAINORACLE/`은 다른 Pages
   프로젝트와 저장소 origin을 공유하므로 계정 redirect로 등록하거나 다시 열지 않는다.

화면에 카카오 버튼을 공개하기 전에 신규 가입, 기존 로그인, 취소, callback 실패를
실제 브라우저에서 확인한다.

## 5. Google 간편 로그인

1. https://console.cloud.google.com → 프로젝트 생성 → `APIs & Services → Credentials`
2. `OAuth client ID` 생성 (Web application)
   - Authorized redirect URI: `https://<프로젝트ref>.supabase.co/auth/v1/callback`
     (Supabase `Authentication → Providers → Google` 화면에 정확한 값이 표시됨)
3. 발급된 Client ID / Secret을 Supabase `Providers → Google`에 입력하고 Enable
4. Supabase `Authentication → URL Configuration`:
   - Site URL: `https://<TrainOracle 전용 host>/`
   - Redirect URLs에도 같은 주소 추가
   - 새 origin 왕복 확인 뒤 기존 `https://hojune0330.github.io/TRAINORACLE/`은 Site URL과
     Redirect URLs 허용 목록에서 제거

GitHub Pages 프로젝트 경로의 코드 배포에서는 계정·Google·이메일 게이트를 닫는다.
경로가 달라도 `hojune0330.github.io`의 localStorage와 IndexedDB는 공유되므로 전용
origin을 대신할 수 없다.

전환할 때는 기존 Supabase refresh/session을 운영 절차로 전면 폐기하고, 구 Pages
origin에 남은 `trainoracle.auth.v1`과 PKCE verifier를 새 로컬 전용 번들이 지우는지
확인한다. 이 정리는 일지·계획을 삭제하지 않는다. 다만 동일 origin의 다른 프로젝트가
이미 읽었을 가능성까지 되돌릴 수는 없으므로 서버 세션 폐기와 기존 redirect 제거를
반드시 함께 수행한다.

Google 설정을 건너뛰면 `VITE_GOOGLE_AUTH_ENABLED=false`를 유지한다. 공개 화면에
Google 버튼이 보이는 배포에서는 제공자 설정과 신규·기존 로그인 왕복 시험을
마친 뒤 `VITE_GOOGLE_AUTH_ENABLED=true`로 연다. 사고 시에는 Hosted Supabase에서
Google provider를 먼저 끄고, 그다음 `VITE_KILL_GOOGLE_AUTH=true`를 넣은 새 번들을
배포한다. 프론트 변수만 바꿔서는 이미 배포된 번들이나 Auth API 직접 호출을 즉시
막지 못한다.

## 6. 시험 앱에서 계정만 확인

시험 중에도 동기화·공유·계획·분석 플래그는 계속 끈다. 계정 화면만 켠
로컬 빌드에서 카카오·Google·이메일 OTP, 만 14세 경계와 외부 인증 미호출,
로그아웃, 삭제 요청과 실패 경로를 확인한다. 시험 DB 적용만으로 공개
사이트의 계정 기능을 켜지 않는다.

## 7. CI 워크플로 확인

`.github/workflows/ci.yml`의 `deploy-pages` 잡은 계정 설정과 기능별 공개·중단
스위치를 배포 빌드에 주입해야 합니다. 아래는 Google·이메일 분리 게이트까지
포함한 목표 매핑이며, 실제 워크플로 또는 수동 빌드가 이 값을 주입하는지 배포
직전에 대조한다. 계정만 시험할 때는
동기화·공유·계획·분석을 모두 `false`로 유지합니다.

```yaml
      - name: Build hosted app
        working-directory: app
        env:
          VITE_ACCOUNT_PUBLIC_ENABLED: ${{ vars.TRAINORACLE_ACCOUNT_PUBLIC_ENABLED }}
          VITE_GOOGLE_AUTH_ENABLED: ${{ vars.TRAINORACLE_GOOGLE_AUTH_ENABLED }}
          VITE_EMAIL_AUTH_ENABLED: ${{ vars.TRAINORACLE_EMAIL_AUTH_ENABLED }}
          VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED: ${{ vars.TRAINORACLE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED }}
          VITE_FEATURE_SYNC: ${{ vars.TRAINORACLE_FEATURE_SYNC }}
          VITE_FEATURE_SHARING: ${{ vars.TRAINORACLE_FEATURE_SHARING }}
          VITE_FEATURE_PLAN_PROPOSALS: ${{ vars.TRAINORACLE_FEATURE_PLAN_PROPOSALS }}
          VITE_FEATURE_PLAN_BACKUP: ${{ vars.TRAINORACLE_FEATURE_PLAN_BACKUP }}
          VITE_FEATURE_PUBLIC_PROFILE: ${{ vars.TRAINORACLE_FEATURE_PUBLIC_PROFILE }}
          VITE_FEATURE_PRODUCT_ANALYTICS: ${{ vars.TRAINORACLE_FEATURE_PRODUCT_ANALYTICS }}
          VITE_FEATURE_FEEDBACK_BOARD: ${{ vars.TRAINORACLE_FEATURE_FEEDBACK_BOARD }}
          VITE_KILL_ACCOUNT: ${{ vars.TRAINORACLE_KILL_ACCOUNT }}
          VITE_KILL_GOOGLE_AUTH: ${{ vars.TRAINORACLE_KILL_GOOGLE_AUTH }}
          VITE_KILL_EMAIL_AUTH: ${{ vars.TRAINORACLE_KILL_EMAIL_AUTH }}
          VITE_KILL_FEEDBACK_BOARD: ${{ vars.TRAINORACLE_KILL_FEEDBACK_BOARD }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_PRIVACY_POLICY_URL: ${{ vars.TRAINORACLE_PRIVACY_POLICY_URL }}
          VITE_PRIVACY_POLICY_VERSION: ${{ vars.TRAINORACLE_PRIVACY_POLICY_VERSION }}
          VITE_TERMS_OF_SERVICE_URL: ${{ vars.TRAINORACLE_TERMS_OF_SERVICE_URL }}
          VITE_TERMS_OF_SERVICE_VERSION: ${{ vars.TRAINORACLE_TERMS_OF_SERVICE_VERSION }}
        run: |
          npm ci
          npm run build
```

## 8. GitHub 저장소에 키와 출시 변수 등록

저장소 `Settings → Secrets and variables → Actions → New repository secret`:

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | 1번의 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 1번의 anon public 키 |

그다음 `Variables` 탭에서 아래 저장소 변수를 등록합니다.

| 이름 | 준비 중 값 | 공개 승인 후 값 |
|---|---|---|
| `TRAINORACLE_ACCOUNT_PUBLIC_ENABLED` | `false` 또는 미등록 | `true` |
| `TRAINORACLE_GOOGLE_AUTH_ENABLED` | `false` 또는 미등록 | 제공자 왕복 확인 뒤 `true` |
| `TRAINORACLE_EMAIL_AUTH_ENABLED` | `false` 또는 미등록 | PKCE 콜백·템플릿 확인 뒤 `true` |
| `TRAINORACLE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED` | `false` 또는 미등록 | 신규·기존·새 탭·만료 확인 뒤 `true` |
| `TRAINORACLE_PRIVACY_POLICY_URL` | 미등록 | 공개 HTTPS 개인정보 처리방침 URL |
| `TRAINORACLE_PRIVACY_POLICY_VERSION` | 미등록 | 실제 게시본 버전 |
| `TRAINORACLE_TERMS_OF_SERVICE_URL` | 미등록 | 공개 HTTPS 이용약관 URL |
| `TRAINORACLE_TERMS_OF_SERVICE_VERSION` | 미등록 | 실제 게시본 버전 |
| `TRAINORACLE_FEATURE_SYNC` | `false` 또는 미등록 | 계정 안정화 뒤 별도 결정 |
| `TRAINORACLE_FEATURE_SHARING` | `false` 또는 미등록 | 동기화 안정화 뒤 별도 결정 |
| `TRAINORACLE_FEATURE_PLAN_PROPOSALS` | `false` 또는 미등록 | 공유 안정화 뒤 별도 결정 |
| `TRAINORACLE_FEATURE_PLAN_BACKUP` | `false` 또는 미등록 | 자동 계획 보관 승인 뒤 `true` |
| `TRAINORACLE_FEATURE_PUBLIC_PROFILE` | `false` 또는 미등록 | 공개 프로필·친구 공유 승인 뒤 `true` |
| `TRAINORACLE_FEATURE_PRODUCT_ANALYTICS` | `false` 또는 미등록 | 별도 동의·삭제 시험 뒤 별도 결정 |
| `TRAINORACLE_FEATURE_FEEDBACK_BOARD` | `false` 또는 미등록 | 문의판 시험 뒤 `true` |
| `TRAINORACLE_KILL_ACCOUNT` | `false` 또는 미등록 | 서버 차단 뒤 계정 UI를 닫는 새 번들에 `true` |
| `TRAINORACLE_KILL_GOOGLE_AUTH` | `false` 또는 미등록 | Hosted provider 차단 뒤 Google UI를 닫는 새 번들에 `true` |
| `TRAINORACLE_KILL_EMAIL_AUTH` | `false` 또는 미등록 | Hosted email 차단 뒤 이메일 UI를 닫는 새 번들에 `true` |
| `TRAINORACLE_KILL_PLAN_BACKUP` | `false` 또는 미등록 | 계획 온라인 보관만 즉시 닫을 때 `true` |
| `TRAINORACLE_KILL_PUBLIC_PROFILE` | `false` 또는 미등록 | 공개 프로필·친구 공유만 즉시 닫을 때 `true` |
| `TRAINORACLE_KILL_FEEDBACK_BOARD` | `false` 또는 미등록 | 문의판만 즉시 닫을 때 `true` |

키만 등록한 상태에서는 계정 기능이 노출되지 않습니다. 공개 게이트를 모두
확인한 뒤 위 변수만 `true`로 바꾸고 main을 다시 배포합니다.

## 9. 로컬 개발에서 켜보기 (선택)

`app/.env.local` 파일 생성 (git에 올라가지 않음):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ACCOUNT_PUBLIC_ENABLED=true
VITE_GOOGLE_AUTH_ENABLED=true
VITE_EMAIL_AUTH_ENABLED=false
VITE_EMAIL_AUTH_PKCE_OPERATIONS_APPROVED=false
```

## 10. 문의 게시판 운영

문의 게시판은 계정 기능과 별개다. 공개 전에는 시험 프로젝트에서 다음을 모두
확인한다.

- 다른 기기 영수증으로 문의를 읽거나 댓글을 달거나 삭제할 수 없음
- 같은 요청을 다시 보내도 문의·댓글이 중복 생성되지 않음
- 운영자 전용 목록·답변·종료·삭제 함수는 `service_role`만 실행 가능
- 사용자는 자기 문의를 두 번 확인한 뒤 삭제 가능
- 마지막 활동 후 180일이 지난 문의는 예약 정리에서 삭제
- 시간당 전체 60건, 하루 전체 300건, 기기 영수증당 하루 10건 제한

시험이 끝나면 서버의 `FEEDBACK_BOARD`를 연 뒤
`TRAINORACLE_FEATURE_FEEDBACK_BOARD=true`와
`TRAINORACLE_KILL_FEEDBACK_BOARD=false`로 배포한다. 둘 중 하나라도 닫혀 있으면
문의 쓰기 화면은 열리지 않는다. 운영자는 서비스 역할로
`list_feedback_threads_for_operator`, `reply_to_feedback_thread`를 사용한다. 서비스
역할 키는 브라우저·문서·Git에 넣지 않는다. 예약 정리는
`TRAINORACLE_SERVER_OPERATIONS_ENABLED=true`일 때만 실행된다.
운영자 PC에서 문의를 확인하고 답하는 정확한 절차는
`reports/operations/FEEDBACK_BOARD_OPERATOR_RUNBOOK.md`를 따른다.

## 끄고 싶을 때

서버의 `ACCOUNT` 스위치를 먼저 끄고 이유를 기록합니다. 그다음
`TRAINORACLE_KILL_ACCOUNT=true`와
`TRAINORACLE_ACCOUNT_PUBLIC_ENABLED=false`를 적용해 재배포합니다. 이미 열린
앱의 서버 작업을 먼저 차단한 뒤 계정 진입점을 숨기는 순서입니다. 로컬 일지는
계속 사용할 수 있습니다.

인증 방법 하나만 사고가 난 경우에도 프론트 `VITE_KILL_*` 값은 서버 차단 장치가
아닙니다. 서버의 `ACCOUNT`와 해당 인증 종류 스위치를 먼저 닫고 Hosted Supabase의
Google·Kakao provider, 이메일 발송 또는 SMS provider를 비활성화한 뒤 UI kill 값을
넣어 다시 빌드·배포합니다. 정적 번들은
재배포 전까지 바뀌지 않으며, 공개 anon key를 사용한 Auth API 직접 호출은 UI 숨김을
우회할 수 있습니다.
따라서 순서는 `ACCOUNT=false` → 해당 서버 인증 종류(`AUTH_OAUTH` 또는
`AUTH_PASSWORDLESS`) `false` → Hosted provider·발송 경로 중단 → 영향받은 Auth 세션
폐기 → 서버 세션 소멸 확인 → UI kill 배포입니다. Supabase access token은 sign-out
뒤에도 만료 전까지 유효할 수 있으므로 토큰 폐기만 추정하지 않습니다. 0053의
`session_id` 검사로 계정 접근이 실제 거부되는지 확인하고, 그 전에는 `ACCOUNT`를
다시 열지 않습니다.

문의판만 문제가 생기면 서버의 `FEEDBACK_BOARD`를 먼저 닫고
`TRAINORACLE_KILL_FEEDBACK_BOARD=true`로 재배포한다. 이때 로컬 일지와 다른 화면은
계속 사용할 수 있다.
