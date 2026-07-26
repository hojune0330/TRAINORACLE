# 계정·동기화 배포 설정 (소유자용, 약 15분)

계정 기능은 **출시 승인 변수 1개와 환경변수 2개가 모두 있어야만 켜집니다.**
키를 먼저 등록해도 출시 승인 변수가 `true`가 아니면 앱은 로컬 전용으로 유지됩니다.

> 공개 승인 전에 `docs/ACCOUNT_PUBLIC_RELEASE_GATE.md`의 필수 항목을 모두
> 실제 증거로 확인해야 합니다. 변수는 그 확인을 대신하지 않습니다.

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

## 5. CI 워크플로 확인

`.github/workflows/ci.yml`의 `deploy-pages` 잡은 아래 세 값을 배포 빌드에
주입하도록 준비되어 있습니다.

```yaml
      - name: Build hosted app
        working-directory: app
        env:
          VITE_ACCOUNT_PUBLIC_ENABLED: ${{ vars.TRAINORACLE_ACCOUNT_PUBLIC_ENABLED }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: |
          npm ci
          npm run build
```

## 6. GitHub 저장소에 키와 출시 변수 등록

저장소 `Settings → Secrets and variables → Actions → New repository secret`:

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | 1번의 Project URL |
| `VITE_SUPABASE_ANON_KEY` | 1번의 anon public 키 |

그다음 `Variables` 탭에서 아래 저장소 변수를 등록합니다.

| 이름 | 준비 중 값 | 공개 승인 후 값 |
|---|---|---|
| `TRAINORACLE_ACCOUNT_PUBLIC_ENABLED` | `false` 또는 미등록 | `true` |

키만 등록한 상태에서는 계정 기능이 노출되지 않습니다. 공개 게이트를 모두
확인한 뒤 위 변수만 `true`로 바꾸고 main을 다시 배포합니다.

## 7. 로컬 개발에서 켜보기 (선택)

`app/.env.local` 파일 생성 (git에 올라가지 않음):

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ACCOUNT_PUBLIC_ENABLED=true
```

## 끄고 싶을 때

`TRAINORACLE_ACCOUNT_PUBLIC_ENABLED`를 `false`로 바꾸거나 삭제한 뒤
재배포하면 계정 진입점이 사라지고 로컬 전용 앱으로 돌아갑니다.
