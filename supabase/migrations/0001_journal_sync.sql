-- TRAINORACLE 일지 동기화 테이블 + RLS
-- 실행 위치: Supabase Dashboard → SQL Editor (프로젝트 생성 직후 1회)

create table if not exists public.journal_entries (
  user_id  uuid        not null references auth.users (id) on delete cascade,
  entry_id text        not null,
  saved_at text        not null,
  entry    jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.journal_entries enable row level security;

-- 본인 행만 읽기/쓰기 (DB 레벨 격리 — 클라이언트 버그가 있어도 타인 데이터 접근 불가)
create policy "own rows select" on public.journal_entries
  for select using (auth.uid() = user_id);

create policy "own rows insert" on public.journal_entries
  for insert with check (auth.uid() = user_id);

create policy "own rows update" on public.journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows delete" on public.journal_entries
  for delete using (auth.uid() = user_id);

create index if not exists journal_entries_user_idx
  on public.journal_entries (user_id, saved_at desc);
