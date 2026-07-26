-- TRAINORACLE 삭제 기록(tombstone) 서버 테이블 + RLS
-- 실행 위치: Supabase Dashboard → SQL Editor (0001 이후 1회)
--
-- 왜 서버에 올리는가:
--   tombstone이 기기 로컬에만 있으면 기기 간 삭제가 새지 않는다.
--   A기기에서 일지를 지워도, tombstone이 없는 B기기가 자기 사본을 밀어
--   올리면 그 일지는 되살아난다. 사용자는 분명히 지웠는데 다른 기기를
--   열면 돌아와 있는 것 — 삭제권 위반이다.
--
-- 저장 비용 (실측 기준 추정):
--   행당 uuid(16B) + entry_id(~22B) + timestamptz(8B) + 행 헤더(~24B)
--   + PK 인덱스(~40B) ≈ 110 B.
--   사용자당 500건 상한이므로 최대 ~54 KB/사용자.
--   비교: journal_entries 행은 jsonb 본문 때문에 보통 0.5~1.5 KB다.
--   즉 tombstone 1행은 일지 1행의 1/10 미만이고, **삭제된 일지 행을
--   대체**하므로 순증이 아니라 순감이다. 용량 우려는 실증되지 않는다.
--
-- 개인정보:
--   본문·날짜·수치를 담지 않는다. entry_id와 삭제 시각뿐이다.
--   "무엇을 지웠는지"가 아니라 "이 id는 지워졌다"만 남긴다(최소 수집).
--   지운 기록의 내용을 삭제 기록부에 다시 적으면 삭제한 의미가 없다.

create table if not exists public.journal_tombstones (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  entry_id   text        not null,
  deleted_at text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.journal_tombstones enable row level security;

-- 여러 번 붙여넣어도 안전하게 — `create policy`는 `if not exists`를 지원하지
-- 않아 두 번째 실행에서 42710 에러로 멈춘다. 사람이 손으로 붙여넣는 절차라
-- 두 번 실행되는 일은 실제로 일어난다. 그때 "이미 있는데 에러가 났다"를 보고
-- 소유자가 판단을 못 하게 만드는 대신, 지우고 다시 만든다.
-- (drop → create 사이에 RLS가 꺼지는 순간은 없다. RLS는 위에서 이미 켜졌고,
--  정책이 없는 상태는 "아무도 접근 못 함"이라 열리는 쪽이 아니다.)
drop policy if exists "own tombstones select" on public.journal_tombstones;
drop policy if exists "own tombstones insert" on public.journal_tombstones;
drop policy if exists "own tombstones update" on public.journal_tombstones;
drop policy if exists "own tombstones delete" on public.journal_tombstones;

-- 본인 행만 접근 (DB 레벨 격리 — 클라이언트 버그가 있어도 타인 데이터 접근 불가)
create policy "own tombstones select" on public.journal_tombstones
  for select using (auth.uid() = user_id);

create policy "own tombstones insert" on public.journal_tombstones
  for insert with check (auth.uid() = user_id);

create policy "own tombstones update" on public.journal_tombstones
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 사용자가 삭제 기록 자체를 지울 수 있어야 한다.
-- 이게 없으면 "지웠다는 사실"이 영구히 남아 삭제권이 반쪽이 된다.
create policy "own tombstones delete" on public.journal_tombstones
  for delete using (auth.uid() = user_id);
