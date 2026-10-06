-- Durable minimum deletion delivery, including after the current immediate-due
-- auth.users purge. No source account/journal rows or raw credentials here.
begin;

create table public.lounge_identity_deletion_outbox (
  request_id uuid primary key default gen_random_uuid(),
  subject uuid not null unique,
  requested_at timestamptz not null,
  status text not null default 'PENDING' check (status in ('PENDING','INFLIGHT')),
  available_at timestamptz not null default clock_timestamp(),
  lease_id uuid,
  lease_until timestamptz,
  check ((status = 'PENDING' and lease_id is null and lease_until is null)
    or (status = 'INFLIGHT' and lease_id is not null and lease_until is not null))
);
-- Deliberately NO foreign key to auth.users/account_deletion_requests: failed
-- remote delivery must not be erased by local account retention cleanup.
create index lounge_identity_deletion_outbox_due
  on public.lounge_identity_deletion_outbox(available_at,lease_until);
alter table public.lounge_identity_deletion_outbox enable row level security;
revoke all on public.lounge_identity_deletion_outbox from public,anon,authenticated,service_role;

create function public.enqueue_lounge_identity_deletion()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.lounge_identity_deletion_outbox(subject,requested_at)
    values(new.user_id,new.requested_at) on conflict(subject) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_lounge_identity_deletion() from public,anon,authenticated,service_role;
create trigger enqueue_lounge_identity_deletion
  after insert on public.account_deletion_requests
  for each row execute function public.enqueue_lounge_identity_deletion();

-- Existing blocked accounts need the same delivery guarantee on adoption.
insert into public.lounge_identity_deletion_outbox(subject,requested_at)
  select user_id,requested_at from public.account_deletion_requests
  on conflict(subject) do nothing;

create function public.claim_lounge_identity_deletions(limit_input integer default 10)
returns jsonb language plpgsql volatile security definer set search_path = pg_catalog as $$
declare claimed jsonb;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  if limit_input is null or limit_input < 1 or limit_input > 10 then
    raise exception 'invalid batch limit' using errcode='22023';
  end if;
  with due as (
    select request_id from public.lounge_identity_deletion_outbox
    where (status='PENDING' and available_at <= clock_timestamp())
      or (status='INFLIGHT' and lease_until <= clock_timestamp())
    order by requested_at,request_id for update skip locked limit limit_input
  ), leased as (
    update public.lounge_identity_deletion_outbox queue
    set status='INFLIGHT',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
    from due where queue.request_id=due.request_id
    returning queue.request_id,queue.subject,queue.lease_id
  ) select coalesce(jsonb_agg(jsonb_build_object('version',1,'requestId',request_id,
      'subject',subject,'leaseId',lease_id)),'[]'::jsonb) into claimed from leased;
  return claimed;
end;
$$;

create function public.complete_lounge_identity_deletion(request_id_input uuid,lease_id_input uuid)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog as $$
declare deleted_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  delete from public.lounge_identity_deletion_outbox
    where request_id=request_id_input and lease_id=lease_id_input and status='INFLIGHT';
  get diagnostics deleted_count = row_count;
  return deleted_count=1;
end;
$$;

create function public.retry_lounge_identity_deletion(request_id_input uuid,lease_id_input uuid)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog as $$
declare updated_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'service role required' using errcode='42501';
  end if;
  update public.lounge_identity_deletion_outbox set status='PENDING',lease_id=null,lease_until=null,
      available_at=clock_timestamp()+interval '5 minutes'
    where request_id=request_id_input and lease_id=lease_id_input and status='INFLIGHT';
  get diagnostics updated_count = row_count;
  return updated_count=1;
end;
$$;

revoke all on function public.claim_lounge_identity_deletions(integer) from public,anon,authenticated,service_role;
revoke all on function public.complete_lounge_identity_deletion(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.retry_lounge_identity_deletion(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.claim_lounge_identity_deletions(integer) to service_role;
grant execute on function public.complete_lounge_identity_deletion(uuid,uuid) to service_role;
grant execute on function public.retry_lounge_identity_deletion(uuid,uuid) to service_role;

comment on table public.lounge_identity_deletion_outbox is
  'Private minimum subject/request/status/time delivery until committed lounge deletion ACK. No account FK; no journal, email, messages or credentials. ACK removes row immediately. Current immediate-due account purge remains unchanged. Operator must deploy and schedule the dedicated worker before public cutover.';
commit;
