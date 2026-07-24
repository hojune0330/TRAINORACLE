# 계정·동기화 배포 설정 (소유자용, 약 15분)

계정 기능은 **환경변수 2개가 있어야만 켜집니다.**
설정하지 않으면 앱은 지금과 완전히 동일하게 동작합니다 (되돌릴 것 없음).

## 1. Supabase 프로젝트 만들기 (무료)

1. https://supabase.com → GitHub 계정으로 가입 → `New project`
2. 이름: `trainoracle` / Region: `Northeast Asia (Seoul)` / 무료 플랜
3. 생성 후 `Project Settings → API`에서 두 값을 복사:
   - `Project URL` (예: `https://abcdefgh.supabase.co`)
   - `anon public` 키 (공개용 키 — 프론트에 넣어도 안전, RLS가 지킴)

## 2. 테이블 만들기 (SQL 1개 실행)

Dashboard → `SQL Editor` → New query →
저장소의 `supabase/migrations/0001_journal_sync.sql` 내용 전체 붙여넣기 → Run.

## 3. 이메일 코드 로그인 확인

`Authentication → Providers → Email`이 기본 활성입니다.
`Confirm email` 설정은 그대로 두면 됩니다 (앱은 6자리 OTP 코드 방식 사용).

## 4. Google 간편 로그인 (선택)

1. https://console.cloud.google.com → 프로젝트 생성 → `APIs & Services → Credentials`
2. `OAuth client ID` 생성 (Web application)
   - Authorized redirect URI: `https://<프로젝트ref>.supabase.co/auth/v1/callback`
     (Supabase `Authentication → Providers → Google` 화면에 정확한 값이 표시됨)
3. 발급된 Client ID / Secret을 Supabase `Providers → Google`에 입력하고 Enable
4. Supabase `Authentication → URL Configuration`:
   - Site URL: `https://hojune0330.github.io/TRAINORACLE/`
   - Redirect URLs에도 같은 주소 추가

Google 설정을 건너뛰어도 이메일 코드 로그인은 동작합니다.

## 5. CI 워크플로 패치 (사장님 또는 코덱스가 직접 — 1회)

자동화 봇 토큰은 `.github/workflows/` 수정 권한이 없어 이 변경만 수동 반영이
필요합니다. `.github/workflows/ci.yml`의 `deploy-pages` 잡 → `Build hosted app`
스텝에 `env:` 두 줄을 추가:

```yaml
      - name: Build hosted app
        working-directory: app
        env:
          # 계정·동기화 feature flag — Secrets 미설정이면 빈 값 → 기능 OFF
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: |
          npm ci
          npm run build
```

## 6. GitHub 저장소에 키 등록

저장소 `Settings → Secrets and variables → Actions → New repository secret`:

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | 1번의 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 1번의 anon public 키 |

등록 후 main에 아무 커밋이나 병합되면 CI가 빌드에 키를 주입해 배포합니다.

## 7. 로컬 개발에서 켜보기 (선택)

`app/.env.local` 파일 생성 (git에 올라가지 않음):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 끄고 싶을 때

GitHub Secrets 2개를 지우고 재배포하면 계정 버튼이 사라지고
로컬 전용 앱으로 돌아갑니다. 데이터 마이그레이션 불필요.
