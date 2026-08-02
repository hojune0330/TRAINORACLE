create table if not exists public.service_feature_controls (
  feature_key text primary key,
  enabled boolean not null default false,
  change_reason text not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default clock_timestamp(),
  check (feature_key in ('ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS')),
  check (length(trim(change_reason)) between 8 and 240)
);

create table if not exists public.service_feature_control_events (
  id bigint generated always as identity primary key,
  feature_key text not null,
  previous_enabled boolean not null,
  enabled boolean not null,
  change_reason text not null,
  revision bigint not null check (revision > 0),
  changed_at timestamptz not null default clock_timestamp(),
  changed_by text not null,
  check (feature_key in ('ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS')),
  check (length(trim(change_reason)) between 8 and 240)
);

create table if not exists public.retention_cleanup_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  analytics_deleted bigint not null check (analytics_deleted >= 0),
  accounts_deleted bigint not null check (accounts_deleted >= 0),
  status text not null check (status = 'SUCCEEDED'),
  workflow_run_id text,
  check (finished_at >= started_at)
);

insert into public.service_feature_controls (feature_key, enabled, change_reason)
values
  ('ACCOUNT', false, 'INITIAL_SAFE_DEFAULT'),
  ('SYNC', false, 'INITIAL_SAFE_DEFAULT'),
  ('SHARING', false, 'INITIAL_SAFE_DEFAULT'),
  ('PLAN_PROPOSALS', false, 'INITIAL_SAFE_DEFAULT'),
  ('PRODUCT_ANALYTICS', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

alter table public.service_feature_controls enable row level security;
alter table public.service_feature_control_events enable row level security;
alter table public.retention_cleanup_runs enable row level security;

revoke all on table public.service_feature_controls from public;
revoke all on table public.service_feature_controls from anon;
revoke all on table public.service_feature_controls from authenticated;
revoke all on table public.service_feature_controls from service_role;
revoke all on table public.service_feature_control_events from public;
revoke all on table public.service_feature_control_events from anon;
revoke all on table public.service_feature_control_events from authenticated;
revoke all on table public.service_feature_control_events from service_role;
revoke all on table public.retention_cleanup_runs from public;
revoke all on table public.retention_cleanup_runs from anon;
revoke all on table public.retention_cleanup_runs from authenticated;
revoke all on table public.retention_cleanup_runs from service_role;

grant select on table public.service_feature_controls to service_role;
grant select on table public.service_feature_control_events to service_role;
grant select on table public.retention_cleanup_runs to service_role;

create or replace function public.service_feature_enabled(feature_key_input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select control.enabled
    from public.service_feature_controls control
    where control.feature_key = feature_key_input
  ), false);
$$;

revoke all on function public.service_feature_enabled(text) from public;
revoke all on function public.service_feature_enabled(text) from anon;
revoke all on function public.service_feature_enabled(text) from authenticated;
grant execute on function public.service_feature_enabled(text) to authenticated;
grant execute on function public.service_feature_enabled(text) to service_role;

create or replace function public.get_service_feature_states()
returns table (feature_key text, enabled boolean, revision bigint, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select control.feature_key, control.enabled, control.revision, control.updated_at
  from public.service_feature_controls control
  order by control.feature_key;
$$;

revoke all on function public.get_service_feature_states() from public;
revoke all on function public.get_service_feature_states() from anon;
revoke all on function public.get_service_feature_states() from authenticated;
grant execute on function public.get_service_feature_states() to authenticated;
grant execute on function public.get_service_feature_states() to service_role;

create or replace function public.set_service_feature_state(
  feature_key_input text,
  enabled_input boolean,
  change_reason_input text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_enabled boolean;
  next_revision bigint;
  actor text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if length(trim(coalesce(change_reason_input, ''))) not between 8 and 240 then
    raise exception 'change reason must be 8 to 240 characters';
  end if;

  select control.enabled
  into previous_enabled
  from public.service_feature_controls control
  where control.feature_key = feature_key_input
  for update;

  if previous_enabled is null then
    raise exception 'unsupported service feature';
  end if;

  update public.service_feature_controls
  set enabled = enabled_input,
      change_reason = trim(change_reason_input),
      revision = revision + 1,
      updated_at = clock_timestamp()
  where feature_key = feature_key_input
  returning revision into next_revision;

  actor := coalesce(auth.jwt() ->> 'sub', 'service_role');
  insert into public.service_feature_control_events (
    feature_key, previous_enabled, enabled, change_reason, revision, changed_by
  ) values (
    feature_key_input, previous_enabled, enabled_input,
    trim(change_reason_input), next_revision, actor
  );

  return next_revision;
end;
$$;

revoke all on function public.set_service_feature_state(text, boolean, text) from public;
revoke all on function public.set_service_feature_state(text, boolean, text) from anon;
revoke all on function public.set_service_feature_state(text, boolean, text) from authenticated;
revoke all on function public.set_service_feature_state(text, boolean, text) from service_role;
grant execute on function public.set_service_feature_state(text, boolean, text) to service_role;

create or replace function public.enforce_service_feature_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and auth.uid() is not null
    and not public.service_feature_enabled(tg_argv[0]) then
    raise exception using
      errcode = '42501',
      message = 'SERVER_FEATURE_DISABLED_' || tg_argv[0];
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_service_feature_write() from public;
revoke all on function public.enforce_service_feature_write() from anon;
revoke all on function public.enforce_service_feature_write() from authenticated;

drop trigger if exists account_feature_write_guard on public.beta_enrollments;
create trigger account_feature_write_guard
before insert or update on public.beta_enrollments
for each row execute function public.enforce_service_feature_write('ACCOUNT');

drop trigger if exists sync_feature_write_guard on public.journal_entries;
create trigger sync_feature_write_guard
before insert or update or delete on public.journal_entries
for each row execute function public.enforce_service_feature_write('SYNC');

drop trigger if exists tombstone_sync_feature_write_guard on public.journal_tombstones;
create trigger tombstone_sync_feature_write_guard
before insert or update or delete on public.journal_tombstones
for each row execute function public.enforce_service_feature_write('SYNC');

drop trigger if exists private_note_sync_feature_write_guard on public.encrypted_private_notes;
create trigger private_note_sync_feature_write_guard
before insert or update or delete on public.encrypted_private_notes
for each row execute function public.enforce_service_feature_write('SYNC');

drop trigger if exists support_invitation_feature_write_guard on public.support_invitations;
create trigger support_invitation_feature_write_guard
before insert or update or delete on public.support_invitations
for each row execute function public.enforce_service_feature_write('SHARING');

drop trigger if exists guardian_invitation_feature_write_guard on public.guardian_invitations;
create trigger guardian_invitation_feature_write_guard
before insert or update or delete on public.guardian_invitations
for each row execute function public.enforce_service_feature_write('SHARING');

drop trigger if exists guardian_confirmation_feature_write_guard on public.guardian_confirmations;
create trigger guardian_confirmation_feature_write_guard
before insert or update or delete on public.guardian_confirmations
for each row execute function public.enforce_service_feature_write('SHARING');

drop trigger if exists support_connection_feature_write_guard on public.support_connections;
create trigger support_connection_feature_write_guard
before insert or update or delete on public.support_connections
for each row execute function public.enforce_service_feature_write('SHARING');

drop trigger if exists plan_proposal_feature_write_guard on public.plan_proposals;
create trigger plan_proposal_feature_write_guard
before insert or update or delete on public.plan_proposals
for each row execute function public.enforce_service_feature_write('PLAN_PROPOSALS');

drop trigger if exists plan_safety_feature_write_guard on public.plan_safety_snapshots;
create trigger plan_safety_feature_write_guard
before insert or update or delete on public.plan_safety_snapshots
for each row execute function public.enforce_service_feature_write('PLAN_PROPOSALS');

drop trigger if exists plan_version_feature_write_guard on public.plan_versions;
create trigger plan_version_feature_write_guard
before insert or update or delete on public.plan_versions
for each row execute function public.enforce_service_feature_write('PLAN_PROPOSALS');

drop trigger if exists active_plan_feature_write_guard on public.athlete_active_plans;
create trigger active_plan_feature_write_guard
before insert or update or delete on public.athlete_active_plans
for each row execute function public.enforce_service_feature_write('PLAN_PROPOSALS');

drop trigger if exists plan_receipt_feature_write_guard on public.plan_activation_receipts;
create trigger plan_receipt_feature_write_guard
before insert or update or delete on public.plan_activation_receipts
for each row execute function public.enforce_service_feature_write('PLAN_PROPOSALS');

drop trigger if exists analytics_feature_write_guard on public.product_analytics_events;
create trigger analytics_feature_write_guard
before insert or update on public.product_analytics_events
for each row execute function public.enforce_service_feature_write('PRODUCT_ANALYTICS');

drop policy if exists "account feature enabled" on public.user_private_profiles;
create policy "account feature enabled" on public.user_private_profiles
  as restrictive for all to authenticated
  using (public.service_feature_enabled('ACCOUNT'))
  with check (public.service_feature_enabled('ACCOUNT'));

drop policy if exists "sync feature enabled" on public.journal_entries;
create policy "sync feature enabled" on public.journal_entries
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SYNC'))
  with check (public.service_feature_enabled('SYNC'));

drop policy if exists "sync feature enabled" on public.journal_tombstones;
create policy "sync feature enabled" on public.journal_tombstones
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SYNC'))
  with check (public.service_feature_enabled('SYNC'));

drop policy if exists "sync feature enabled" on public.encrypted_private_notes;
create policy "sync feature enabled" on public.encrypted_private_notes
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SYNC'))
  with check (public.service_feature_enabled('SYNC'));

drop policy if exists "sharing feature enabled" on public.guardian_confirmations;
create policy "sharing feature enabled" on public.guardian_confirmations
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SHARING'))
  with check (public.service_feature_enabled('SHARING'));

drop policy if exists "sharing feature enabled" on public.guardian_invitations;
create policy "sharing feature enabled" on public.guardian_invitations
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SHARING'))
  with check (public.service_feature_enabled('SHARING'));

drop policy if exists "sharing feature enabled" on public.support_invitations;
create policy "sharing feature enabled" on public.support_invitations
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SHARING'))
  with check (public.service_feature_enabled('SHARING'));

drop policy if exists "sharing feature enabled" on public.support_connections;
create policy "sharing feature enabled" on public.support_connections
  as restrictive for all to authenticated
  using (public.service_feature_enabled('SHARING'))
  with check (public.service_feature_enabled('SHARING'));

drop policy if exists "plan proposal feature enabled" on public.plan_proposals;
create policy "plan proposal feature enabled" on public.plan_proposals
  as restrictive for all to authenticated
  using (public.service_feature_enabled('PLAN_PROPOSALS'))
  with check (public.service_feature_enabled('PLAN_PROPOSALS'));

drop policy if exists "analytics feature enabled" on public.product_analytics_events;
create policy "analytics feature enabled" on public.product_analytics_events
  as restrictive for all to authenticated
  using (public.service_feature_enabled('PRODUCT_ANALYTICS'))
  with check (public.service_feature_enabled('PRODUCT_ANALYTICS'));

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select public.service_feature_enabled('ACCOUNT')
    and auth.uid() = target_user
    and exists (
      select 1
      from public.beta_enrollments enrollment
      where enrollment.user_id = target_user
    )
    and public.athlete_support_access_allowed(target_user);
$$;

create or replace function public.guardian_authority_allowed(
  target_user uuid,
  required_scope text,
  required_season_ends_on date default null
)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select (
    (
      required_scope = 'ACCOUNT_SYNC'
      and public.service_feature_enabled('ACCOUNT')
    )
    or (
      required_scope in ('FIRST_LINK', 'SHARE_EXPANSION', 'SEASON_RENEWAL')
      and public.service_feature_enabled('ACCOUNT')
      and public.service_feature_enabled('SHARING')
    )
  ) and exists (
    select 1
    from public.guardian_confirmations confirmation
    where confirmation.child_user_id = target_user
      and confirmation.scope = required_scope
      and confirmation.valid_from <= clock_timestamp()
      and confirmation.valid_until > clock_timestamp()
      and confirmation.revoked_at is null
      and confirmation.authority_season_ends_on >= clock_timestamp()::date
      and (
        required_season_ends_on is null
        or confirmation.authority_season_ends_on >= required_season_ends_on
      )
  );
$$;

revoke all on function public.guardian_authority_allowed(uuid, text, date) from public;
revoke all on function public.guardian_authority_allowed(uuid, text, date) from anon;
revoke all on function public.guardian_authority_allowed(uuid, text, date) from authenticated;
grant execute on function public.guardian_authority_allowed(uuid, text, date) to authenticated;

create or replace function public.claim_beta_seat(birth_date_input date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  capacity_limit integer;
  occupied_seats integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.service_feature_enabled('ACCOUNT') then
    return 'ACCOUNT_FEATURE_DISABLED';
  end if;
  if birth_date_input is null or birth_date_input > current_date then
    raise exception 'invalid birth date';
  end if;
  if exists (
    select 1 from public.account_deletion_requests request
    where request.user_id = auth.uid()
  ) then
    return 'ACCOUNT_BLOCKED';
  end if;

  select capacity.seat_limit
  into capacity_limit
  from public.beta_capacity_controls capacity
  where capacity.capacity_key = 'PUBLIC_BETA'
  for update;

  if capacity_limit is null then
    raise exception 'beta capacity is not configured';
  end if;
  if exists (
    select 1 from public.beta_enrollments enrollment
    where enrollment.user_id = auth.uid()
  ) then
    insert into public.user_private_profiles (user_id, birth_date, updated_at)
    values (auth.uid(), birth_date_input, clock_timestamp())
    on conflict (user_id) do update
    set birth_date = excluded.birth_date,
        updated_at = excluded.updated_at
    where user_private_profiles.deletion_requested_at is null;
    return 'ADMITTED_EXISTING';
  end if;

  select count(*) into occupied_seats from public.beta_enrollments;
  if occupied_seats >= capacity_limit then
    return 'BETA_FULL';
  end if;

  insert into public.beta_enrollments (user_id) values (auth.uid());
  insert into public.user_private_profiles (user_id, birth_date, updated_at)
  values (auth.uid(), birth_date_input, clock_timestamp())
  on conflict (user_id) do update
  set birth_date = excluded.birth_date,
      updated_at = excluded.updated_at
  where user_private_profiles.deletion_requested_at is null;
  return 'ADMITTED_NEW';
end;
$$;

revoke all on function public.claim_beta_seat(date) from public;
revoke all on function public.claim_beta_seat(date) from anon;
revoke all on function public.claim_beta_seat(date) from authenticated;
grant execute on function public.claim_beta_seat(date) to authenticated;

create or replace function public.get_sync_schema_version()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_version integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.service_feature_enabled('SYNC') then
    raise exception 'sync feature disabled' using errcode = '42501';
  end if;

  select schema_version into current_version
  from public.service_contract_versions
  where contract_key = 'JOURNAL_SYNC';
  if current_version is null then
    raise exception 'journal sync schema version is not configured';
  end if;
  return current_version;
end;
$$;

revoke all on function public.get_sync_schema_version() from public;
revoke all on function public.get_sync_schema_version() from anon;
revoke all on function public.get_sync_schema_version() from authenticated;
grant execute on function public.get_sync_schema_version() to authenticated;

create or replace function public.support_connection_network_access_allowed(connection_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select public.service_feature_enabled('ACCOUNT')
    and public.service_feature_enabled('SHARING')
    and exists (
      select 1
      from public.support_connections connection
      where connection.id = connection_id
        and connection.revoked_at is null
        and connection.season_ends_on >= clock_timestamp()::date
        and public.athlete_support_access_allowed(connection.athlete_id)
        and (
          exists (
            select 1 from public.user_private_profiles profile
            where profile.user_id = connection.athlete_id
              and profile.birth_date <= clock_timestamp()::date - interval '14 years'
          )
          or exists (
            select 1 from public.guardian_confirmations confirmation
            where confirmation.id = connection.guardian_confirmation_id
              and confirmation.child_user_id = connection.athlete_id
              and confirmation.scope = 'FIRST_LINK'
              and confirmation.valid_from <= clock_timestamp()
              and confirmation.valid_until > clock_timestamp()
              and confirmation.revoked_at is null
              and confirmation.authority_season_ends_on >= connection.season_ends_on
          )
        )
    );
$$;

create or replace function public.can_access_shared_athlete_data(target_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.service_feature_enabled('ACCOUNT')
    and public.service_feature_enabled('SHARING')
    and auth.uid() is not null
    and public.athlete_support_access_allowed(target_athlete)
    and (
      auth.uid() = target_athlete
      or exists (
        select 1
        from public.support_connections connection
        where connection.athlete_id = target_athlete
          and connection.supporter_id = auth.uid()
          and public.support_connection_network_access_allowed(connection.id)
      )
    );
$$;

revoke all on function public.can_access_shared_athlete_data(uuid) from public;
revoke all on function public.can_access_shared_athlete_data(uuid) from anon;
revoke all on function public.can_access_shared_athlete_data(uuid) from authenticated;
grant execute on function public.can_access_shared_athlete_data(uuid) to authenticated;

create or replace function public.can_create_plan_proposal(target_athlete uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.service_feature_enabled('ACCOUNT')
    and public.service_feature_enabled('PLAN_PROPOSALS')
    and auth.uid() is not null
    and public.athlete_support_access_allowed(target_athlete)
    and (
      auth.uid() = target_athlete
      or exists (
        select 1 from public.support_connections connection
        where connection.athlete_id = target_athlete
          and connection.supporter_id = auth.uid()
          and public.support_connection_network_access_allowed(connection.id)
      )
    );
$$;

revoke all on function public.can_create_plan_proposal(uuid) from public;
revoke all on function public.can_create_plan_proposal(uuid) from anon;
revoke all on function public.can_create_plan_proposal(uuid) from authenticated;
grant execute on function public.can_create_plan_proposal(uuid) to authenticated;

create or replace function public.list_shared_journal_entries(target_athlete uuid)
returns table (entry_id text, saved_at text, shared_entry jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed_fields text[];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not public.service_feature_enabled('ACCOUNT')
    or not public.service_feature_enabled('SYNC')
    or not public.service_feature_enabled('SHARING') then
    raise exception 'shared journal feature disabled' using errcode = '42501';
  end if;
  if not public.athlete_support_access_allowed(target_athlete) then
    raise exception 'shared journal access denied' using errcode = '42501';
  end if;

  select connection.shared_fields into allowed_fields
  from public.support_connections connection
  where connection.athlete_id = target_athlete
    and connection.supporter_id = auth.uid()
    and public.support_connection_network_access_allowed(connection.id)
  order by connection.season_ends_on desc, connection.created_at desc
  limit 1;

  if allowed_fields is null then
    raise exception 'shared journal access denied' using errcode = '42501';
  end if;
  if not (allowed_fields && array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE']::text[]) then
    return;
  end if;

  return query
  select journal.entry_id, journal.saved_at::text,
    jsonb_strip_nulls(jsonb_build_object(
      'id', journal.entry -> 'id',
      'date', journal.entry -> 'date',
      'kind', journal.entry -> 'kind',
      'trainingNote', case
        when 'TRAINING_NOTE' = any(allowed_fields)
          and journal.entry ->> 'memoPurpose' = 'ANALYZABLE_TRAINING_NOTE'
          then coalesce(journal.entry -> 'memo', journal.entry -> 'note')
      end,
      'trainingRecord', case when 'TRAINING_RECORD' = any(allowed_fields) then jsonb_strip_nulls(jsonb_build_object(
        'system', journal.entry -> 'system',
        'title', journal.entry -> 'title',
        'distanceKm', journal.entry -> 'distanceKm',
        'durationMin', journal.entry -> 'durationMin',
        'avgPace', journal.entry -> 'avgPace',
        'rpe', journal.entry -> 'rpe',
        'stage', journal.entry -> 'stage',
        'record', journal.entry -> 'record',
        'rank', journal.entry -> 'rank',
        'result', journal.entry -> 'result',
        'goalPace', journal.entry -> 'goalPace'
      )) end,
      'pain', case when 'PAIN' = any(allowed_fields) then journal.entry -> 'painParts' end,
      'mood', case when 'MOOD' = any(allowed_fields) then journal.entry -> 'mood' end,
      'bodyState', case when 'BODY_STATE' = any(allowed_fields) then jsonb_strip_nulls(jsonb_build_object(
        'sleepH', journal.entry -> 'sleepH',
        'sleepQuality', journal.entry -> 'sleepQuality',
        'weightKg', journal.entry -> 'weightKg',
        'restingHr', journal.entry -> 'restingHr',
        'tension', journal.entry -> 'tension',
        'condition', journal.entry -> 'condition'
      )) end
    ))
  from public.journal_entries journal
  where journal.user_id = target_athlete
  order by journal.saved_at desc;
end;
$$;

revoke all on function public.list_shared_journal_entries(uuid) from public;
revoke all on function public.list_shared_journal_entries(uuid) from anon;
revoke all on function public.list_shared_journal_entries(uuid) from authenticated;
grant execute on function public.list_shared_journal_entries(uuid) to authenticated;

create or replace function public.set_product_analytics_consent(enabled_input boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not enabled_input then
    update public.user_private_profiles
    set analytics_opt_in = false,
        updated_at = clock_timestamp()
    where user_id = auth.uid();
    delete from public.product_analytics_events where user_id = auth.uid();
    return true;
  end if;
  if not public.service_feature_enabled('PRODUCT_ANALYTICS') then
    return false;
  end if;
  if not public.account_network_access_allowed(auth.uid()) then
    return false;
  end if;

  update public.user_private_profiles
  set analytics_opt_in = enabled_input,
      updated_at = clock_timestamp()
  where user_id = auth.uid()
    and deletion_requested_at is null;
  if not found then
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.set_product_analytics_consent(boolean) from public;
revoke all on function public.set_product_analytics_consent(boolean) from anon;
revoke all on function public.set_product_analytics_consent(boolean) from authenticated;
grant execute on function public.set_product_analytics_consent(boolean) to authenticated;

create or replace function public.record_product_analytics_event(event_name_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  occurred timestamptz;
  opted_in boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not public.service_feature_enabled('PRODUCT_ANALYTICS') then
    return false;
  end if;
  if event_name_input not in (
    'APP_OPENED', 'JOURNAL_STARTED', 'JOURNAL_SAVED', 'ARCHIVE_OPENED',
    'PLAN_PROPOSAL_REVIEWED', 'SYNC_SUCCEEDED', 'SYNC_FAILED'
  ) then
    raise exception 'unsupported analytics event';
  end if;
  if not public.account_network_access_allowed(auth.uid()) then
    return false;
  end if;

  select profile.analytics_opt_in into opted_in
  from public.user_private_profiles profile
  where profile.user_id = auth.uid()
    and profile.deletion_requested_at is null
  for update;
  if not coalesce(opted_in, false) then
    return false;
  end if;

  occurred := clock_timestamp();
  insert into public.product_analytics_events (
    user_id, event_name, occurred_at, expires_at
  ) values (
    auth.uid(), event_name_input, occurred, occurred + interval '30 days'
  );
  return true;
end;
$$;

revoke all on function public.record_product_analytics_event(text) from public;
revoke all on function public.record_product_analytics_event(text) from anon;
revoke all on function public.record_product_analytics_event(text) from authenticated;
grant execute on function public.record_product_analytics_event(text) to authenticated;

alter table public.support_connections
  drop constraint if exists support_connections_guardian_confirmation_id_fkey,
  add constraint support_connections_guardian_confirmation_id_fkey
    foreign key (guardian_confirmation_id)
    references public.guardian_confirmations (id) on delete set null;

alter table public.support_invitations
  drop constraint if exists support_invitations_guardian_confirmation_id_fkey,
  add constraint support_invitations_guardian_confirmation_id_fkey
    foreign key (guardian_confirmation_id)
    references public.guardian_confirmations (id) on delete set null;

alter table public.plan_proposals
  alter column proposed_by drop not null,
  drop constraint if exists plan_proposals_proposed_by_fkey,
  add constraint plan_proposals_proposed_by_fkey
    foreign key (proposed_by) references auth.users (id) on delete set null,
  drop constraint if exists plan_proposals_safety_snapshot_id_fkey,
  add constraint plan_proposals_safety_snapshot_id_fkey
    foreign key (safety_snapshot_id) references public.plan_safety_snapshots (id) on delete set null,
  drop constraint if exists plan_proposals_warning_reviewed_by_fkey,
  add constraint plan_proposals_warning_reviewed_by_fkey
    foreign key (warning_reviewed_by) references auth.users (id) on delete set null,
  drop constraint if exists plan_proposals_warning_acknowledged_by_fkey,
  add constraint plan_proposals_warning_acknowledged_by_fkey
    foreign key (warning_acknowledged_by) references auth.users (id) on delete set null;

alter table public.plan_versions
  alter column activated_by drop not null,
  drop constraint if exists plan_versions_source_proposal_id_fkey,
  add constraint plan_versions_source_proposal_id_fkey
    foreign key (source_proposal_id) references public.plan_proposals (id) on delete cascade,
  drop constraint if exists plan_versions_activated_by_fkey,
  add constraint plan_versions_activated_by_fkey
    foreign key (activated_by) references auth.users (id) on delete set null;

alter table public.athlete_active_plans
  drop constraint if exists athlete_active_plans_active_plan_version_id_fkey,
  add constraint athlete_active_plans_active_plan_version_id_fkey
    foreign key (active_plan_version_id) references public.plan_versions (id) on delete cascade;

alter table public.plan_activation_receipts
  alter column activated_by drop not null,
  drop constraint if exists plan_activation_receipts_proposal_id_fkey,
  add constraint plan_activation_receipts_proposal_id_fkey
    foreign key (proposal_id) references public.plan_proposals (id) on delete cascade,
  drop constraint if exists plan_activation_receipts_plan_version_id_fkey,
  add constraint plan_activation_receipts_plan_version_id_fkey
    foreign key (plan_version_id) references public.plan_versions (id) on delete cascade,
  drop constraint if exists plan_activation_receipts_activated_by_fkey,
  add constraint plan_activation_receipts_activated_by_fkey
    foreign key (activated_by) references auth.users (id) on delete set null;

create or replace function public.reject_plan_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('trainoracle.retention_cleanup', true) = 'AUTHORIZED'
    and coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return old;
  end if;
  raise exception using errcode = 'P0001', message = 'IMMUTABLE_PLAN_VERSION';
end;
$$;

revoke all on function public.reject_plan_version_mutation() from public;
revoke all on function public.reject_plan_version_mutation() from anon;
revoke all on function public.reject_plan_version_mutation() from authenticated;

create or replace function public.purge_expired_beta_data()
returns table (analytics_deleted bigint, accounts_deleted bigint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleanup_started_at timestamptz := clock_timestamp();
  cleanup_finished_at timestamptz;
  analytics_count bigint;
  account_count bigint;
  workflow_id text := nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-trainoracle-workflow-run-id', '');
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not pg_try_advisory_xact_lock(hashtext('TRAINORACLE_RETENTION_CLEANUP')) then
    raise exception 'retention cleanup already running';
  end if;

  perform set_config('trainoracle.retention_cleanup', 'AUTHORIZED', true);

  delete from public.product_analytics_events
  where expires_at <= cleanup_started_at;
  get diagnostics analytics_count = row_count;

  delete from auth.users
  where id in (
    select request.user_id
    from public.account_deletion_requests request
    where request.delete_by <= cleanup_started_at
      and request.status <> 'DELETED'
  );
  get diagnostics account_count = row_count;

  cleanup_finished_at := clock_timestamp();
  insert into public.retention_cleanup_runs (
    started_at, finished_at, analytics_deleted, accounts_deleted, status, workflow_run_id
  ) values (
    cleanup_started_at, cleanup_finished_at, analytics_count, account_count,
    'SUCCEEDED', workflow_id
  );

  return query select analytics_count, account_count;
end;
$$;

revoke all on function public.purge_expired_beta_data() from public;
revoke all on function public.purge_expired_beta_data() from anon;
revoke all on function public.purge_expired_beta_data() from authenticated;
revoke all on function public.purge_expired_beta_data() from service_role;
grant execute on function public.purge_expired_beta_data() to service_role;
