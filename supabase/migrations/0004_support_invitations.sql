create table if not exists public.support_invitations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  season_ends_on date not null check (season_ends_on >= current_date),
  guardian_confirmation_id uuid references public.guardian_confirmations (id),
  expires_at timestamptz not null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_by is null and accepted_at is null) or (accepted_by is not null and accepted_at is not null))
);

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
    select 1
    from public.user_private_profiles profile
    where profile.user_id = athlete
      and profile.birth_date > current_date - interval '14 years'
  )
  or exists (
    select 1
    from public.guardian_confirmations confirmation
    where confirmation.id = confirmation_id
      and confirmation.child_user_id = athlete
      and confirmation.scope = 'FIRST_LINK'
  );
$$;

alter table public.support_invitations enable row level security;

create policy "athlete invitation select" on public.support_invitations
  for select using (auth.uid() = athlete_id);
create policy "athlete invitation insert" on public.support_invitations
  for insert with check (
    auth.uid() = athlete_id
    and public.account_network_access_allowed(athlete_id)
    and public.first_link_guardian_requirement_met(athlete_id, guardian_confirmation_id)
  );
create policy "athlete invitation delete" on public.support_invitations
  for delete using (auth.uid() = athlete_id);

create or replace function public.accept_support_invitation(invitation_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.support_invitations%rowtype;
  connection_id uuid;
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
  if not public.account_network_access_allowed(invitation.athlete_id) then
    raise exception 'athlete network access is blocked';
  end if;
  if not public.first_link_guardian_requirement_met(
    invitation.athlete_id,
    invitation.guardian_confirmation_id
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
    invitation.guardian_confirmation_id,
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

create index if not exists support_invitations_expiry_idx
  on public.support_invitations (expires_at)
  where accepted_at is null;
