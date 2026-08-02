update public.guardian_invitations
set expires_at = least(expires_at, created_at + interval '7 days')
where expires_at > created_at + interval '7 days';

alter table public.guardian_invitations
  add constraint guardian_invitation_server_expiry_cap_check
  check (expires_at <= created_at + interval '7 days');

drop policy if exists "under14 guardian invitation insert" on public.guardian_invitations;
revoke insert on table public.guardian_invitations from anon;
revoke insert on table public.guardian_invitations from authenticated;

create or replace function public.create_guardian_invitation(invitation_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if invitation_code_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid invitation code hash';
  end if;
  if not exists (
    select 1
    from public.user_private_profiles profile
    where profile.user_id = auth.uid()
      and profile.birth_date > clock_timestamp()::date - interval '14 years'
      and profile.deletion_requested_at is null
  ) then
    raise exception 'under-14 child account required';
  end if;

  insert into public.guardian_invitations (
    child_user_id,
    code_hash,
    expires_at
  ) values (
    auth.uid(),
    invitation_code_hash,
    clock_timestamp() + interval '7 days'
  ) returning id into invitation_id;

  return invitation_id;
end;
$$;

revoke all on function public.create_guardian_invitation(text) from public;
revoke all on function public.create_guardian_invitation(text) from anon;
grant execute on function public.create_guardian_invitation(text) to authenticated;
