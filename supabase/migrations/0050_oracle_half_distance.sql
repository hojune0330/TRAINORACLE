-- Follows the pace-record migration without reusing existing main versions.
begin;

-- Keep legacy integer events and the existing consent/privacy checks unchanged.
do $migration$
declare
  source text;
  old_check constant text := $anchor$(payload #>> '{record,eventDistanceM}')::numeric <> trunc((payload #>> '{record,eventDistanceM}')::numeric)$anchor$;
  new_check constant text := $anchor$((payload #>> '{record,eventDistanceM}')::numeric <> 21097.5 and (payload #>> '{record,eventDistanceM}')::numeric <> trunc((payload #>> '{record,eventDistanceM}')::numeric))$anchor$;
begin
  source := pg_get_functiondef('public.oracle_comparison_snapshot_is_safe(jsonb)'::regprocedure);
  if (length(source) - length(replace(source, old_check, ''))) / length(old_check) <> 1
    or position(new_check in source) > 0 then
    raise exception 'ORACLE_HALF_DISTANCE_ANCHOR_MISMATCH';
  end if;
  execute replace(source, old_check, new_check);
end;
$migration$;

commit;
