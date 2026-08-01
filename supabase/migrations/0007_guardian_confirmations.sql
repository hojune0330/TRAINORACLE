alter table public.guardian_confirmations
  add column if not exists guardian_user_id uuid references auth.users (id) on delete cascade;

create table if not exists public.guardian_invitations (
  id uuid primary key default gen_random_uuid(),
  child_user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_by is null and accepted_at is null) or (accepted_by is not null and accepted_at is not null))
);

alter table public.guardian_invitations enable row level security;

create policy "child guardian invitation select" on public.guardian_invitations
  for select using (auth.uid() = child_user_id);
create policy "under14 guardian invitation insert" on public.guardian_invitations
  for insert with check (
    auth.uid() = child_user_id
    and exists (
      select 1 from public.user_private_profiles profile
      where profile.user_id = child_user_id
        and profile.birth_date > current_date - interval '14 years'
        and profile.deletion_requested_at is null
    )
  );
create policy "child guardian invitation delete" on public.guardian_invitations
  for delete using (auth.uid() = child_user_id);

drop policy if exists "child guardian confirmations select" on public.guardian_confirmations;
create policy "guardian confirmation participants select" on public.guardian_confirmations
  for select using (auth.uid() in (child_user_id, guardian_user_id));

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
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into invitation
  from public.guardian_invitations
  where code_hash = invitation_code_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if invitation.id is null then
    raise exception 'invalid or expired invitation';
  end if;
  if invitation.child_user_id = auth.uid() then
    raise exception 'child_user_id <> auth.uid()';
  end if;
  if exists (
    select 1 from public.guardian_confirmations confirmation
    where confirmation.child_user_id = invitation.child_user_id
      and confirmation.scope = 'ACCOUNT_SYNC'
      and confirmation.guardian_user_id is not null
  ) then
    raise exception 'guardian already confirmed';
  end if;

  insert into public.guardian_confirmations (
    child_user_id,
    guardian_user_id,
    scope,
    confirmed_at
  ) values (
    invitation.child_user_id,
    auth.uid(),
    'ACCOUNT_SYNC',
    now()
  ) returning id into confirmation_id;

  insert into public.guardian_confirmations (
    child_user_id,
    guardian_user_id,
    scope,
    confirmed_at
  ) values (
    invitation.child_user_id,
    auth.uid(),
    'FIRST_LINK',
    now()
  ) returning id into first_link_confirmation_id;

  update public.guardian_invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invitation.id;

  return confirmation_id;
end;
$$;

revoke all on function public.accept_guardian_invitation(text) from public;
grant execute on function public.accept_guardian_invitation(text) to authenticated;

create or replace function public.athlete_support_access_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
            and confirmation.guardian_user_id is not null
        )
      )
  )
  and not exists (
    select 1
    from public.account_deletion_requests request
    where request.user_id = target_user
  );
$$;

revoke all on function public.athlete_support_access_allowed(uuid) from public;
revoke all on function public.athlete_support_access_allowed(uuid) from anon;
revoke all on function public.athlete_support_access_allowed(uuid) from authenticated;

create or replace function public.account_network_access_allowed(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = target_user
    and public.athlete_support_access_allowed(target_user);
$$;

create or replace function public.first_link_guardian_requirement_met(
  athlete uuid,
  confirmation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.user_private_profiles profile
    where profile.user_id = athlete
      and profile.birth_date > current_date - interval '14 years'
  )
  or exists (
    select 1 from public.guardian_confirmations confirmation
    where (confirmation_id is null or confirmation.id = confirmation_id)
      and confirmation.child_user_id = athlete
      and confirmation.scope = 'FIRST_LINK'
      and confirmation.guardian_user_id is not null
  );
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
    and expires_at > now()
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
    and confirmation.guardian_user_id is not null
  order by confirmation.confirmed_at desc
  limit 1;

  if not public.first_link_guardian_requirement_met(
    invitation.athlete_id,
    first_link_confirmation_id
  ) then
    raise exception 'guardian confirmation required';
  end if;

  insert into public.support_connections (
    athlete_id,
    supporter_id,
    qualification_label,
    guardian_confirmation_id,
    season_ends_on
  ) values (
    invitation.athlete_id,
    auth.uid(),
    '자격 미확인',
    first_link_confirmation_id,
    invitation.season_ends_on
  ) returning id into connection_id;

  update public.support_invitations
  set accepted_by = auth.uid(), accepted_at = now()
  where id = invitation.id;

  return connection_id;
end;
$$;

revoke all on function public.accept_support_invitation(text) from public;
grant execute on function public.accept_support_invitation(text) to authenticated;

create index if not exists guardian_invitations_expiry_idx
  on public.guardian_invitations (expires_at)
  where accepted_at is null;
