alter table public.guardian_confirmations
  add column if not exists valid_from timestamptz,
  add column if not exists valid_until timestamptz,
  add column if not exists authority_season_ends_on date,
  add column if not exists revoked_at timestamptz;

-- Legacy confirmations are deliberately expired: no pre-hardening record gains authority.
update public.guardian_confirmations
set valid_from = coalesce(valid_from, confirmed_at),
    valid_until = coalesce(valid_until, confirmed_at + interval '1 microsecond'),
    authority_season_ends_on = coalesce(authority_season_ends_on, confirmed_at::date)
where valid_from is null
   or valid_until is null
   or authority_season_ends_on is null;

alter table public.guardian_confirmations
  alter column valid_from set not null,
  alter column valid_until set not null,
  alter column authority_season_ends_on set not null,
  alter column valid_from set default clock_timestamp(),
  alter column valid_until set default clock_timestamp(),
  add constraint guardian_confirmation_valid_window_check check (valid_until > valid_from),
  add constraint guardian_confirmation_season_check check (authority_season_ends_on >= valid_from::date);

create index if not exists guardian_confirmations_active_authority_idx
  on public.guardian_confirmations (child_user_id, scope, authority_season_ends_on)
  where revoked_at is null;

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
  select exists (
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
grant execute on function public.guardian_authority_allowed(uuid, text, date) to authenticated;

create or replace function public.athlete_support_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_private_profiles profile
    where profile.user_id = target_user
      and profile.deletion_requested_at is null
      and (
        profile.birth_date <= clock_timestamp()::date - interval '14 years'
        or public.guardian_authority_allowed(target_user, 'ACCOUNT_SYNC')
      )
  )
  and not exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = target_user
  );
$$;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select auth.uid() = target_user
    and public.athlete_support_access_allowed(target_user);
$$;

create or replace function public.first_link_guardian_requirement_met(
  athlete uuid,
  confirmation_id uuid,
  season_ends_on date
)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.user_private_profiles profile
    where profile.user_id = athlete
      and profile.birth_date > clock_timestamp()::date - interval '14 years'
  )
  or exists (
    select 1
    from public.guardian_confirmations confirmation
    where confirmation.id = confirmation_id
      and confirmation.child_user_id = athlete
      and confirmation.scope = 'FIRST_LINK'
      and confirmation.valid_from <= clock_timestamp()
      and confirmation.valid_until > clock_timestamp()
      and confirmation.revoked_at is null
      and confirmation.authority_season_ends_on >= season_ends_on
  );
$$;

drop policy if exists "athlete invitation insert" on public.support_invitations;
create policy "athlete invitation insert" on public.support_invitations
  for insert with check (
    auth.uid() = athlete_id
    and public.account_network_access_allowed(athlete_id)
    and public.first_link_guardian_requirement_met(
      athlete_id,
      guardian_confirmation_id,
      season_ends_on
    )
  );

create or replace function public.accept_guardian_invitation(invitation_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.guardian_invitations%rowtype;
  confirmation_id uuid;
  first_link_confirmation_id uuid;
  authority_season_end date := (date_trunc('year', clock_timestamp()) + interval '1 year - 1 day')::date;
  authority_valid_until timestamptz := date_trunc('year', clock_timestamp()) + interval '1 year';
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into invitation
  from public.guardian_invitations
  where code_hash = invitation_code_hash
    and accepted_at is null
    and expires_at > clock_timestamp()
  for update;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;
  if invitation.child_user_id = auth.uid() then
    raise exception 'child_user_id <> auth.uid()';
  end if;
  if public.guardian_authority_allowed(invitation.child_user_id, 'ACCOUNT_SYNC') then
    raise exception 'guardian already confirmed';
  end if;

  insert into public.guardian_confirmations (
    child_user_id, guardian_user_id, scope, confirmed_at,
    valid_from, valid_until, authority_season_ends_on
  ) values (
    invitation.child_user_id, auth.uid(), 'ACCOUNT_SYNC', clock_timestamp(),
    clock_timestamp(), authority_valid_until, authority_season_end
  ) returning id into confirmation_id;

  insert into public.guardian_confirmations (
    child_user_id, guardian_user_id, scope, confirmed_at,
    valid_from, valid_until, authority_season_ends_on
  ) values (
    invitation.child_user_id, auth.uid(), 'FIRST_LINK', clock_timestamp(),
    clock_timestamp(), authority_valid_until, authority_season_end
  ) returning id into first_link_confirmation_id;

  update public.guardian_invitations
  set accepted_by = auth.uid(), accepted_at = clock_timestamp()
  where id = invitation.id;

  return confirmation_id;
end;
$$;

create or replace function public.accept_support_invitation(invitation_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.support_invitations%rowtype;
  connection_id uuid;
  first_link_confirmation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into invitation
  from public.support_invitations
  where code_hash = invitation_code_hash
    and accepted_at is null
    and expires_at > clock_timestamp()
  for update;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;
  if invitation.athlete_id = auth.uid() then
    raise exception 'athlete cannot accept own invitation';
  end if;
  if not public.athlete_support_access_allowed(invitation.athlete_id) then
    raise exception 'athlete network access is blocked';
  end if;

  select confirmation.id into first_link_confirmation_id
  from public.guardian_confirmations confirmation
  where confirmation.child_user_id = invitation.athlete_id
    and confirmation.scope = 'FIRST_LINK'
    and confirmation.valid_from <= clock_timestamp()
    and confirmation.valid_until > clock_timestamp()
    and confirmation.revoked_at is null
    and confirmation.authority_season_ends_on >= invitation.season_ends_on
  order by confirmation.confirmed_at desc
  limit 1;

  if not public.first_link_guardian_requirement_met(
    invitation.athlete_id,
    first_link_confirmation_id,
    invitation.season_ends_on
  ) then
    raise exception 'guardian confirmation required';
  end if;

  insert into public.support_connections (
    athlete_id, supporter_id, guardian_confirmation_id, season_ends_on
  ) values (
    invitation.athlete_id, auth.uid(), first_link_confirmation_id, invitation.season_ends_on
  ) returning id into connection_id;

  update public.support_invitations
  set accepted_by = auth.uid(), accepted_at = clock_timestamp()
  where id = invitation.id;

  return connection_id;
end;
$$;

create or replace function public.support_connection_network_access_allowed(connection_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
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

revoke all on function public.support_connection_network_access_allowed(uuid) from public;
revoke all on function public.support_connection_network_access_allowed(uuid) from anon;
grant execute on function public.support_connection_network_access_allowed(uuid) to authenticated;

drop policy if exists "connection participants select" on public.support_connections;
create policy "connection participants select" on public.support_connections
  for select using (
    auth.uid() in (athlete_id, supporter_id)
    and public.support_connection_network_access_allowed(id)
  );

drop policy if exists "athlete connection update" on public.support_connections;
create policy "athlete connection update" on public.support_connections
  for update using (
    auth.uid() = athlete_id
    and public.account_network_access_allowed(athlete_id)
  ) with check (
    auth.uid() = athlete_id
    and public.account_network_access_allowed(athlete_id)
    and not ('PRIVATE_MEMO' = any(shared_fields))
  );

create or replace function public.enforce_guardian_connection_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.user_private_profiles profile
    where profile.user_id = new.athlete_id
      and profile.birth_date > clock_timestamp()::date - interval '14 years'
  ) then
    if new.season_ends_on is distinct from old.season_ends_on
      and not public.guardian_authority_allowed(
        new.athlete_id,
        'SEASON_RENEWAL',
        new.season_ends_on
      ) then
      raise exception 'guardian seasonal renewal authority required';
    end if;
    if (
      new.shared_fields is distinct from old.shared_fields
      or new.guardian_confirmation_id is distinct from old.guardian_confirmation_id
    ) and not public.guardian_authority_allowed(
      new.athlete_id,
      'SHARE_EXPANSION',
      new.season_ends_on
    ) then
      raise exception 'guardian sharing authority required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_guardian_connection_authority on public.support_connections;
create trigger enforce_guardian_connection_authority
before update on public.support_connections
for each row execute function public.enforce_guardian_connection_authority();

drop policy if exists "proposal participants select" on public.plan_proposals;
create policy "proposal participants select" on public.plan_proposals
  for select using (
    auth.uid() = athlete_id
    or exists (
      select 1 from public.support_connections connection
      where connection.athlete_id = plan_proposals.athlete_id
        and connection.supporter_id = auth.uid()
        and public.support_connection_network_access_allowed(connection.id)
    )
  );
