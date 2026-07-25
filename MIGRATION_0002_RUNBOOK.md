# 마이그레이션 0002 실행 절차 (삭제 기록 테이블)

작성일: 2026-07-25 · 소유자 결정: **1. 실행**

---

## 0. 먼저 알려드릴 것 — 제가 대신 실행할 수 없습니다

이건 변명이 아니라 사실 보고입니다. 확인한 내용:

| 확인 항목 | 결과 |
|---|---|
| `app/.env` 파일 | **없음** |
| `SUPABASE_*` 환경변수 | **없음** |
| `gh secret list` (GitHub Actions 시크릿) | **HTTP 403** — 권한 없음 |
| `supabase` CLI | **미설치** |
| `psql` | **미설치** |

즉 이 샌드박스에는 **Supabase 프로젝트에 접속할 자격 증명이 전혀 없습니다.**
없는 게 정상입니다 — DB 접속 키를 코드 저장소에 넣으면 그게 더 큰 문제입니다.

제가 할 수 있는 것: **SQL을 정확히 준비하고, 붙여넣기 절차와 검증 쿼리를 만들어 두는 것.**
아래 절차는 **약 2분**이면 끝납니다.

---

## 1. 실행 절차 (2분)

### 1-1. Supabase SQL Editor 열기

1. https://supabase.com/dashboard 접속 → TRAINORACLE 프로젝트 선택
2. 왼쪽 메뉴 **SQL Editor** → **New query**

### 1-2. 아래를 그대로 붙여넣고 실행 (Run 또는 Ctrl+Enter)

```sql
create table if not exists public.journal_tombstones (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  entry_id   text        not null,
  deleted_at text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.journal_tombstones enable row level security;

drop policy if exists "own tombstones select" on public.journal_tombstones;
drop policy if exists "own tombstones insert" on public.journal_tombstones;
drop policy if exists "own tombstones update" on public.journal_tombstones;
drop policy if exists "own tombstones delete" on public.journal_tombstones;

create policy "own tombstones select" on public.journal_tombstones
  for select using (auth.uid() = user_id);

create policy "own tombstones insert" on public.journal_tombstones
  for insert with check (auth.uid() = user_id);

create policy "own tombstones update" on public.journal_tombstones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tombstones delete" on public.journal_tombstones
  for delete using (auth.uid() = user_id);
```

> **두 번 실행해도 안전합니다.** `if not exists` + `drop policy if exists`로
> 만들어 뒀습니다. 실수로 두 번 눌러도 에러가 나지 않습니다.

**"Success. No rows returned"** 가 나오면 성공입니다.

---

## 2. 검증 쿼리 — 실행했다고 믿지 말고 확인하기

같은 SQL Editor에 붙여넣고 실행하세요.

### 2-1. 테이블이 생겼는지 + 컬럼이 맞는지

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'journal_tombstones'
order by ordinal_position;
```

**기대 결과 — 정확히 4행:**

| column_name | data_type | is_nullable |
|---|---|---|
| user_id | uuid | NO |
| entry_id | text | NO |
| deleted_at | text | NO |
| created_at | timestamp with time zone | NO |

### 2-2. RLS가 켜져 있는지 ← **가장 중요**

```sql
select relname, relrowsecurity
from pg_class
where relname = 'journal_tombstones';
```

**기대 결과: `relrowsecurity = true`**

`false`면 **중단하세요.** 다른 사람 삭제 기록이 읽힐 수 있는 상태입니다.
`alter table public.journal_tombstones enable row level security;` 를 다시 실행하고
이 쿼리를 다시 확인하세요.

### 2-3. 정책 4개가 다 있는지

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'journal_tombstones'
order by policyname;
```

**기대 결과 — 정확히 4행:**

| policyname | cmd |
|---|---|
| own tombstones delete | DELETE |
| own tombstones insert | INSERT |
| own tombstones select | SELECT |
| own tombstones update | UPDATE |

4개보다 적으면 1-2의 SQL을 다시 실행하세요.

---

## 3. 실행하지 않으면 어떻게 되나 (안 해도 앱은 안 깨집니다)

| | 0002 실행 안 함 | 0002 실행함 |
|---|---|---|
| 계정 기능 꺼진 상태 (지금 배포판) | 영향 없음 | 영향 없음 |
| 한 기기만 쓰는 경우 | 정상 동작 | 정상 동작 |
| 여러 기기 + 동기화 | **A에서 지운 일지가 B에서 되살아날 수 있음** | 삭제가 기기 간에 전파됨 |
| 동기화 결과 메시지 | "동기화가 끝났어요. 다만 다른 기기의 삭제 기록은 가져오지 못했어요." | "동기화가 끝났어요." |

코드는 이 테이블이 없어도 **동기화를 막지 않도록** 만들어 놨습니다
(`sync.ts` 1-b 단계, 비차단). 다만 실패를 숨기지 않고 위 문구로 알립니다.

**결론: 지금 배포판(계정 기능 OFF)에는 급하지 않지만, 계정 기능을 켜기 전에는 반드시 필요합니다.**

---

## 4. 실행 후 알려주실 것

아래 한 줄만 주시면 됩니다.

- ✅ "0002 실행 완료, RLS true, 정책 4개 확인" → 제가 이 문서에 완료 표시를 하고 launch 문서 수치를 갱신합니다
- ❌ 에러 메시지 (그대로 복사) → 원인을 찾아 SQL을 수정합니다

---

## 5. 상태

| 항목 | 상태 |
|---|---|
| SQL 파일 | ✅ `supabase/migrations/0002_journal_tombstones.sql` (멱등 처리 완료) |
| 앱 코드 (pull/push/전파) | ✅ 구현 + 테스트 완료 |
| 미실행 환경 안전장치 | ✅ 비차단 + 사실대로 안내 |
| **실제 DB 실행** | ⬜ **소유자 작업 대기** |
