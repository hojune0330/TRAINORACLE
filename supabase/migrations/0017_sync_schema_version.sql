create table if not exists public.service_contract_versions (
  contract_key text primary key,
  schema_version integer not null check (schema_version >= 1),
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.service_contract_versions (contract_key, schema_version)
values ('JOURNAL_SYNC', 17)
on conflict (contract_key) do update
set schema_version = greatest(service_contract_versions.schema_version, excluded.schema_version),
    updated_at = clock_timestamp();

alter table public.service_contract_versions enable row level security;

revoke all on table public.service_contract_versions from public;
revoke all on table public.service_contract_versions from anon;
revoke all on table public.service_contract_versions from authenticated;

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

  select schema_version
  into current_version
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
