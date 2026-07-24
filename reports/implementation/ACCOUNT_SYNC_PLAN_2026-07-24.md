# 계정·동기화(회원가입/간편 로그인) 기획 + 구현 기록

```yaml
source_model: FABLE
work_id: FABLE-ACCOUNT-SYNC-2026-07-24
base_main_sha: e624778e4b0ba3fac552130e90546f3512676278
mode: SOLO_WORK (코덱스 중단 상태, 소유자 단독 작업 지시)
status: IMPLEMENTED_PENDING_REVIEW
```

## 0. 목표

지금 앱은 "이 기기 안에서만" 존재한다. 실서비스가 되려면:
1. **회원가입/로그인** — 이메일 + 간편 로그인(Google)
2. **일지 백업·동기화** — 기기를 바꾸거나 잃어도 일지가 살아있게
3. **정적 배포 유지** — 현재 GitHub Pages 파이프라인을 깨지 않고

## 1. 아키텍처 결정

| 선택지 | 판단 |
|---|---|
| 자체 백엔드 서버 | ❌ 운영 부담(서버비·보안 패치·CI 확장), 현 파이프라인 파괴 |
| Firebase | 가능하나 SQL/RLS 통제력 낮음 |
| **Supabase (채택)** | ✅ 정적 SPA에서 바로 사용, 이메일 OTP + Google OAuth 내장, Postgres RLS로 "본인 데이터만" DB 레벨 강제, 무료 티어로 베타 운영 가능 |

**핵심 안전장치 — feature flag**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
환경변수가 **없으면 계정 기능 전체가 렌더링되지 않고** 앱은 지금과 100% 동일하게
동작한다. 기존 사용자·기존 테스트·기존 배포에 회귀 0.

## 2. 데이터·프라이버시 경계 (기존 원칙 유지)

- **로컬 우선(local-first)**: 저장은 항상 localStorage 먼저. 서버는 백업 사본.
- **옵트인 동의**: 로그인해도 자동 업로드 없음. "동기화 켜기"를 명시적으로
  눌러야 시작 (`trainoracle.sync.consent.v1`).
- **메모 원문 기본 제외**: 업로드 페이로드는 기본적으로 `safe-export` 계열
  투영(메모/노트 원문 제거)을 쓴다. "메모도 함께 백업" 토글을 **켠 경우에만**
  원문 포함 — 기본값 OFF (안전 기본값 원칙).
- **DB 레벨 격리**: RLS `user_id = auth.uid()` — 클라이언트 버그가 있어도
  타인 데이터 접근 불가.
- 의료 판단·코칭 승인 기능 아님 — 이 작업은 저장/인증 계층만 다룬다.

## 3. 동기화 규칙 (결정적, 테스트 가능)

- 단위: `JournalEntry` (이미 전역 고유 `id` + `savedAt` ISO 보유)
- **머지 = id 기준 LWW(Last-Write-Wins by `savedAt`)**:
  - 같은 id가 양쪽에 있으면 `savedAt`이 큰 쪽 승리 (동률이면 로컬 승리)
  - 한쪽에만 있으면 그대로 보존 (삭제 전파는 이번 범위 밖 — tombstone은 후속)
- 순서: pull → merge → localStorage 반영 → push(merge 결과 전체 upsert)
- 실패 시: 로컬 데이터는 절대 손실되지 않는다 (fail-closed: 병합 결과가
  스키마 파싱을 통과한 항목만 기록).

## 4. 구현 산출물

| 파일 | 역할 |
|---|---|
| `app/src/domain/account/config.ts` | feature flag + env 읽기 |
| `app/src/domain/account/supabase-client.ts` | 클라이언트 lazy 싱글턴 |
| `app/src/domain/account/auth.ts` | 이메일 OTP·Google OAuth·로그아웃·세션 구독 래퍼 |
| `app/src/domain/account/sync.ts` | 순수 머지 함수 + pull/push + 동의 상태 저장 |
| `app/src/screens/Account.tsx` | 계정 화면 (로그인/동의/지금 동기화/로그아웃) |
| `AppShell.tsx` / `Home.tsx` | 홈 헤더에 계정 진입점 (flag OFF면 미노출) |
| `supabase/migrations/0001_journal_sync.sql` | 테이블 + RLS |
| `docs/SUPABASE_SETUP.md` | 소유자용 배포 설정 절차 |
| 테스트 | 머지 LWW 계약, 동의 저장, flag OFF 무영향 |

## 5. 배포 절차 (소유자 승인 후)

1. supabase.com 프로젝트 생성(무료) → SQL 마이그레이션 1개 실행
2. Auth에서 Google provider 활성화(클라이언트 ID/시크릿)
3. GitHub 저장소 Secrets에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
4. CI 빌드 스텝에 env 주입 (이 PR에 포함) → main 병합 시 자동 반영

키가 없으면 3·4를 생략해도 앱은 지금처럼 동작한다 — 되돌릴 필요조차 없음.
