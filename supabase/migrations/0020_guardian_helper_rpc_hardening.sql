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
  select auth.uid() = athlete
    and (
      not exists (
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
      )
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

  if exists (
    select 1
    from public.user_private_profiles profile
    where profile.user_id = invitation.athlete_id
      and profile.birth_date > clock_timestamp()::date - interval '14 years'
  ) and first_link_confirmation_id is null then
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

revoke all on function public.first_link_guardian_requirement_met(uuid, uuid, date) from public;
revoke all on function public.first_link_guardian_requirement_met(uuid, uuid, date) from anon;
grant execute on function public.first_link_guardian_requirement_met(uuid, uuid, date) to authenticated;
grant execute on function public.first_link_guardian_requirement_met(uuid, uuid, date) to service_role;

revoke all on function public.accept_support_invitation(text) from public;
revoke all on function public.accept_support_invitation(text) from anon;
grant execute on function public.accept_support_invitation(text) to authenticated;
grant execute on function public.accept_support_invitation(text) to service_role;
