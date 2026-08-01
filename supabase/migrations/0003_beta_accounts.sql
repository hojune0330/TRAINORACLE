create table if not exists public.user_private_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  birth_date date not null check (birth_date <= current_date),
  analytics_opt_in boolean not null default false,
  deletion_requested_at timestamptz,
  delete_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (deletion_requested_at is null and delete_by is null)
    or (deletion_requested_at is not null and delete_by = deletion_requested_at + interval '30 days')
  )
);

create table if not exists public.guardian_confirmations (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('ACCOUNT_SYNC', 'FIRST_LINK', 'SHARE_EXPANSION', 'SEASON_RENEWAL')),
  confirmed_at timestamptz not null,
  season_ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.encrypted_private_notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id text not null,
  encrypted_payload jsonb not null,
  saved_at timestamptz not null,
  primary key (user_id, entry_id)
);

create table if not exists public.support_connections (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  supporter_id uuid not null references auth.users (id) on delete cascade,
  qualification_label text not null default '자격 미확인' check (qualification_label = '자격 미확인'),
  shared_fields text[] not null default array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE'],
  guardian_confirmation_id uuid references public.guardian_confirmations (id),
  season_ends_on date not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (athlete_id, supporter_id, season_ends_on),
  check (not ('PRIVATE_MEMO' = any(shared_fields)))
);

create table if not exists public.plan_proposals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  proposed_by uuid not null references auth.users (id) on delete cascade,
  active_plan_id text not null,
  proposed_plan_id text not null,
  proposal_payload jsonb not null,
  status text not null check (status in ('DRAFT', 'WARNING_REVIEWED', 'ACTIVE', 'USER_ACCEPTED_WITH_WARNING', 'REJECTED')),
  warning_reason text,
  conservative_alternative text,
  first_warning_reviewed_at timestamptz,
  warning_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'USER_ACCEPTED_WITH_WARNING'
    or (warning_reason is not null and first_warning_reviewed_at is not null and warning_acknowledged_at is not null)
  )
);

create table if not exists public.product_analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null check (event_name in (
    'APP_OPENED',
    'JOURNAL_STARTED',
    'JOURNAL_SAVED',
    'ARCHIVE_OPENED',
    'PLAN_PROPOSAL_REVIEWED',
    'SYNC_SUCCEEDED',
    'SYNC_FAILED'
  )),
  occurred_at timestamptz not null,
  expires_at timestamptz not null check (expires_at = occurred_at + interval '30 days')
);

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  access_blocked_at timestamptz not null default now(),
  delete_by timestamptz not null default now() + interval '30 days',
  status text not null default 'REQUESTED' check (status in ('REQUESTED', 'PROCESSING', 'DELETED')),
  check (access_blocked_at = requested_at),
  check (delete_by = requested_at + interval '30 days')
);

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_user
    and exists (
      select 1
      from public.user_private_profiles profile
      where profile.user_id = target_user
        and profile.deletion_requested_at is null
        and (
          profile.birth_date <= current_date - interval '14 years'
          or exists (
            select 1
            from public.guardian_confirmations confirmation
            where confirmation.child_user_id = target_user
              and confirmation.scope = 'ACCOUNT_SYNC'
          )
        )
    )
    and not exists (
      select 1
      from public.account_deletion_requests request
      where request.user_id = target_user
    );
$$;

create or replace function public.block_account_after_deletion_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_private_profiles
  set deletion_requested_at = new.requested_at,
      delete_by = new.delete_by,
      updated_at = now()
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists block_account_after_deletion_request on public.account_deletion_requests;
create trigger block_account_after_deletion_request
after insert on public.account_deletion_requests
for each row execute function public.block_account_after_deletion_request();

alter table public.user_private_profiles enable row level security;
alter table public.guardian_confirmations enable row level security;
alter table public.encrypted_private_notes enable row level security;
alter table public.support_connections enable row level security;
alter table public.plan_proposals enable row level security;
alter table public.product_analytics_events enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy "own private profile select" on public.user_private_profiles
  for select using (auth.uid() = user_id);
create policy "own private profile insert" on public.user_private_profiles
  for insert with check (auth.uid() = user_id);
create policy "own private profile update" on public.user_private_profiles
  for update using (auth.uid() = user_id and deletion_requested_at is null)
  with check (auth.uid() = user_id and deletion_requested_at is null);

create policy "child guardian confirmations select" on public.guardian_confirmations
  for select using (auth.uid() = child_user_id);

create policy "own private notes select" on public.encrypted_private_notes
  for select using (public.account_network_access_allowed(user_id));
create policy "own private notes insert" on public.encrypted_private_notes
  for insert with check (public.account_network_access_allowed(user_id));
create policy "own private notes update" on public.encrypted_private_notes
  for update using (public.account_network_access_allowed(user_id))
  with check (public.account_network_access_allowed(user_id));
create policy "own private notes delete" on public.encrypted_private_notes
  for delete using (public.account_network_access_allowed(user_id));

create policy "connection participants select" on public.support_connections
  for select using (
    auth.uid() in (athlete_id, supporter_id)
    and revoked_at is null
    and season_ends_on >= current_date
  );
create policy "athlete connection insert" on public.support_connections
  for insert with check (
    public.account_network_access_allowed(athlete_id)
    and auth.uid() = athlete_id
    and athlete_id <> supporter_id
  );
create policy "athlete connection update" on public.support_connections
  for update using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id and not ('PRIVATE_MEMO' = any(shared_fields)));
create policy "athlete connection delete" on public.support_connections
  for delete using (auth.uid() = athlete_id);

create policy "proposal participants select" on public.plan_proposals
  for select using (
    auth.uid() = athlete_id
    or auth.uid() = proposed_by
  );
create policy "proposal participant insert" on public.plan_proposals
  for insert with check (
    public.account_network_access_allowed(athlete_id)
    and (
      auth.uid() = athlete_id
      or exists (
        select 1
        from public.support_connections connection
        where connection.athlete_id = plan_proposals.athlete_id
          and connection.supporter_id = auth.uid()
          and connection.revoked_at is null
          and connection.season_ends_on >= current_date
      )
    )
  );
create policy "athlete proposal update" on public.plan_proposals
  for update using (auth.uid() = athlete_id)
  with check (auth.uid() = athlete_id);

create policy "own analytics select" on public.product_analytics_events
  for select using (auth.uid() = user_id);
create policy "opted in analytics insert" on public.product_analytics_events
  for insert with check (
    public.account_network_access_allowed(user_id)
    and exists (
      select 1
      from public.user_private_profiles profile
      where profile.user_id = auth.uid()
        and profile.analytics_opt_in
        and profile.deletion_requested_at is null
    )
  );
create policy "own analytics delete" on public.product_analytics_events
  for delete using (auth.uid() = user_id);

create policy "own deletion request insert" on public.account_deletion_requests
  for insert with check (auth.uid() = user_id);
create policy "own deletion request select" on public.account_deletion_requests
  for select using (auth.uid() = user_id);

drop policy if exists "own rows select" on public.journal_entries;
drop policy if exists "own rows insert" on public.journal_entries;
drop policy if exists "own rows update" on public.journal_entries;
drop policy if exists "own rows delete" on public.journal_entries;

create policy "journal owner or active supporter select" on public.journal_entries
  for select using (
    public.account_network_access_allowed(user_id)
    or exists (
      select 1
      from public.support_connections connection
      where connection.athlete_id = journal_entries.user_id
        and connection.supporter_id = auth.uid()
        and connection.revoked_at is null
        and connection.season_ends_on >= current_date
    )
  );
create policy "active journal owner insert" on public.journal_entries
  for insert with check (public.account_network_access_allowed(user_id));
create policy "active journal owner update" on public.journal_entries
  for update using (public.account_network_access_allowed(user_id))
  with check (public.account_network_access_allowed(user_id));
create policy "active journal owner delete" on public.journal_entries
  for delete using (public.account_network_access_allowed(user_id));

drop policy if exists "own tombstones select" on public.journal_tombstones;
drop policy if exists "own tombstones insert" on public.journal_tombstones;
drop policy if exists "own tombstones update" on public.journal_tombstones;
drop policy if exists "own tombstones delete" on public.journal_tombstones;

create policy "active tombstone owner select" on public.journal_tombstones
  for select using (public.account_network_access_allowed(user_id));
create policy "active tombstone owner insert" on public.journal_tombstones
  for insert with check (public.account_network_access_allowed(user_id));
create policy "active tombstone owner update" on public.journal_tombstones
  for update using (public.account_network_access_allowed(user_id))
  with check (public.account_network_access_allowed(user_id));
create policy "active tombstone owner delete" on public.journal_tombstones
  for delete using (public.account_network_access_allowed(user_id));

create index if not exists support_connections_athlete_idx
  on public.support_connections (athlete_id, season_ends_on desc);
create index if not exists support_connections_supporter_idx
  on public.support_connections (supporter_id, season_ends_on desc);
create index if not exists plan_proposals_athlete_idx
  on public.plan_proposals (athlete_id, created_at desc);
create index if not exists product_analytics_expiry_idx
  on public.product_analytics_events (expires_at);
