alter table public.service_feature_controls
  drop constraint if exists service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check
  check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS',
    'PLAN_BACKUP', 'PUBLIC_PROFILE'
  ));

alter table public.service_feature_control_events
  drop constraint if exists service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check
  check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS',
    'PLAN_BACKUP', 'PUBLIC_PROFILE'
  ));

insert into public.service_feature_controls (feature_key, enabled, change_reason)
values
  ('PLAN_BACKUP', false, 'INITIAL_SAFE_DEFAULT'),
  ('PUBLIC_PROFILE', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

create table if not exists public.saved_training_plans (
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null,
  plan_payload jsonb not null,
  schema_version integer not null default 3 check (schema_version = 3),
  saved_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (user_id, plan_id),
  check (length(plan_id) between 16 and 500),
  check (jsonb_typeof(plan_payload) = 'object')
);

create index if not exists saved_training_plans_latest_idx
  on public.saved_training_plans (user_id, saved_at desc)
  where archived_at is null;

create table if not exists public.public_athlete_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  profile_tag text not null default 'TRAINING_CONSISTENTLY' check (profile_tag in (
    'TRAINING_CONSISTENTLY', 'PREPARING_FOR_RACE', 'ENJOYING_RUNNING', 'BUILDING_BASE'
  )),
  is_public boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check (handle = lower(handle)),
  check (handle ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  check (length(display_name) between 1 and 40)
);

create table if not exists public.public_plan_share_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null,
  share_slug text not null unique,
  card_payload jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, plan_id),
  check (share_slug ~ '^[a-z0-9]{12,40}$'),
  check (jsonb_typeof(card_payload) = 'object'),
  check (
    card_payload - array[
      'title', 'eventLabel', 'frameLengthDays', 'qualitySessionCount',
      'completedSessionCount', 'totalSessionCount', 'badgeLabel'
    ] = '{}'::jsonb
  )
);

create index if not exists public_plan_share_cards_profile_idx
  on public.public_plan_share_cards (user_id, updated_at desc)
  where is_public;

alter table public.saved_training_plans enable row level security;
alter table public.public_athlete_profiles enable row level security;
alter table public.public_plan_share_cards enable row level security;

create or replace function public.public_profile_sharing_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.service_feature_enabled('PUBLIC_PROFILE');
$$;

revoke all on function public.public_profile_sharing_enabled() from public;
revoke all on function public.public_profile_sharing_enabled() from anon;
revoke all on function public.public_profile_sharing_enabled() from authenticated;
grant execute on function public.public_profile_sharing_enabled() to anon;
grant execute on function public.public_profile_sharing_enabled() to authenticated;
grant execute on function public.public_profile_sharing_enabled() to service_role;

revoke all on table public.saved_training_plans from public, anon, authenticated;
revoke all on table public.public_athlete_profiles from public, anon, authenticated;
revoke all on table public.public_plan_share_cards from public, anon, authenticated;

grant select, insert, update, delete on table public.saved_training_plans to authenticated;
grant select on table public.public_athlete_profiles to anon, authenticated;
grant insert, update, delete on table public.public_athlete_profiles to authenticated;
grant select on table public.public_plan_share_cards to anon, authenticated;
grant insert, update, delete on table public.public_plan_share_cards to authenticated;

create policy "own saved plans select" on public.saved_training_plans
  for select using (
    public.service_feature_enabled('PLAN_BACKUP')
    and public.account_network_access_allowed(user_id)
  );
create policy "own saved plans insert" on public.saved_training_plans
  for insert with check (
    public.service_feature_enabled('PLAN_BACKUP')
    and public.account_network_access_allowed(user_id)
  );
create policy "own saved plans update" on public.saved_training_plans
  for update using (
    public.service_feature_enabled('PLAN_BACKUP')
    and public.account_network_access_allowed(user_id)
  ) with check (
    public.service_feature_enabled('PLAN_BACKUP')
    and public.account_network_access_allowed(user_id)
  );
create policy "own saved plans delete" on public.saved_training_plans
  for delete using (
    public.service_feature_enabled('PLAN_BACKUP')
    and public.account_network_access_allowed(user_id)
  );

create policy "public or own athlete profile select" on public.public_athlete_profiles
  for select using (
    auth.uid() = user_id
    or (is_public and public.public_profile_sharing_enabled())
  );
create policy "own athlete profile insert" on public.public_athlete_profiles
  for insert with check (
    public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );
create policy "own athlete profile update" on public.public_athlete_profiles
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );
create policy "own athlete profile delete" on public.public_athlete_profiles
  for delete using (auth.uid() = user_id);

create policy "public or own plan card select" on public.public_plan_share_cards
  for select using (
    auth.uid() = user_id
    or (
      is_public
      and public.public_profile_sharing_enabled()
      and exists (
        select 1
        from public.public_athlete_profiles profile
        where profile.user_id = public_plan_share_cards.user_id
          and profile.is_public
      )
    )
  );
create policy "own plan card insert" on public.public_plan_share_cards
  for insert with check (
    public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );
create policy "own plan card update" on public.public_plan_share_cards
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.service_feature_enabled('PUBLIC_PROFILE')
    and public.account_network_access_allowed(user_id)
  );
create policy "own plan card delete" on public.public_plan_share_cards
  for delete using (auth.uid() = user_id);

drop trigger if exists saved_training_plan_feature_guard on public.saved_training_plans;
create trigger saved_training_plan_feature_guard
before insert or update or delete on public.saved_training_plans
for each row execute function public.enforce_service_feature_write('PLAN_BACKUP');

drop trigger if exists public_profile_feature_guard on public.public_athlete_profiles;
create trigger public_profile_feature_guard
before insert or update on public.public_athlete_profiles
for each row execute function public.enforce_service_feature_write('PUBLIC_PROFILE');

drop trigger if exists public_plan_card_feature_guard on public.public_plan_share_cards;
create trigger public_plan_card_feature_guard
before insert or update on public.public_plan_share_cards
for each row execute function public.enforce_service_feature_write('PUBLIC_PROFILE');
