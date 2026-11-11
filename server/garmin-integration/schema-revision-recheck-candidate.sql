-- Pending migration: generate its timestamp with the Supabase CLI at integration.
-- Recheck only a newly accepted, unsaved provider revision. This does not infer
-- duration semantics, enable AUTO, or bypass the existing worker/commit checks.
begin;

do $$
begin
  if to_regprocedure('public.garmin_autosave_attested(text,text,text)') is null
    or to_regprocedure('public.preserve_garmin_dismissal()') is null then
    raise exception 'GARMIN_REVISION_RECHECK_PREREQUISITE_MISSING';
  end if;
end $$;

create function public.recheck_garmin_revised_activity() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
  if new.source_revision>old.source_revision
    and new.state='PENDING' and old.state='PENDING'
    and new.document_id is null and old.document_id is null
    and new.user_id=old.user_id and new.connection_id=old.connection_id
    and new.epoch=old.epoch and new.activity_hash=old.activity_hash then
    new.auto_review_required:=false;
    new.autosave_due_at:=clock_timestamp();
  end if;
  return new;
end $$;
revoke all on function public.recheck_garmin_revised_activity() from public,anon,authenticated,service_role;
create trigger recheck_garmin_revised_activity before update of source_revision on public.garmin_inbox
  for each row execute function public.recheck_garmin_revised_activity();

commit;
