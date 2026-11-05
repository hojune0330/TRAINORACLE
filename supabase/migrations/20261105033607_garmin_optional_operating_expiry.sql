-- Operating approval does not require periodic renewal unless a deadline was
-- explicitly entered. Preserve every existing row, key, grant and journal write.
-- NULL means no deadline; approved=false and configuration binding still stop use.
begin;

alter table public.garmin_integration_controls alter column valid_until drop not null;
comment on column public.garmin_integration_controls.valid_until is
  'Optional operating-approval deadline. NULL has no expiry; approved and config_hash remain authoritative. Existing explicit deadlines are retained.';

-- Keep the complete deployed functions, including atomic journal/inbox commits,
-- owner/session/consent checks and execute grants. Change only the expiry predicate.
-- Abort atomically if the expected contract has drifted instead of installing an
-- older copied function body over a newer deployed version.
do $$
declare target record; definition text; occurrences integer;
  old_predicate constant text := 'valid_until>clock_timestamp()';
  new_predicate constant text := '(valid_until is null or valid_until>clock_timestamp())';
begin
  for target in select * from (values
    ('public.garmin_integration_attested(text,text,text)',2),
    ('public.garmin_maintenance_attested(text,text,text)',1),
    ('public.garmin_autosave_attested(text,text,text)',1)
  ) as targets(signature,expected_count) loop
    if to_regprocedure(target.signature) is null then
      raise exception 'GARMIN_OPERATING_EXPIRY_PREREQUISITE_MISSING: %',target.signature;
    end if;
    definition:=pg_get_functiondef(to_regprocedure(target.signature));
    occurrences:=(length(definition)-length(replace(definition,old_predicate,'')))/length(old_predicate);
    if occurrences<>target.expected_count or position(new_predicate in definition)>0 then
      raise exception 'GARMIN_OPERATING_EXPIRY_CONTRACT_CHANGED: %',target.signature;
    end if;
    execute replace(definition,old_predicate,new_predicate);
  end loop;
end $$;

commit;
