drop policy if exists "journal owner or active supporter select" on public.journal_entries;
drop policy if exists "journal owner select" on public.journal_entries;
create policy "journal owner select" on public.journal_entries
  for select using (public.account_network_access_allowed(user_id));

create or replace function public.list_shared_journal_entries(target_athlete uuid)
returns table (
  entry_id text,
  saved_at text,
  shared_entry jsonb
)
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

  select connection.shared_fields
  into allowed_fields
  from public.support_connections connection
  where connection.athlete_id = target_athlete
    and connection.supporter_id = auth.uid()
    and connection.revoked_at is null
    and connection.season_ends_on >= current_date
  order by connection.season_ends_on desc, connection.created_at desc
  limit 1;

  if allowed_fields is null then
    raise exception 'shared journal access denied' using errcode = '42501';
  end if;

  if not (allowed_fields && array['TRAINING_RECORD', 'TRAINING_NOTE', 'PAIN', 'MOOD', 'BODY_STATE']::text[]) then
    return;
  end if;

  return query
  select
    journal.entry_id,
    journal.saved_at::text,
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
grant execute on function public.list_shared_journal_entries(uuid) to authenticated;
