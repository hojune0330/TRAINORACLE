-- Account legal acknowledgement only. Storage purpose version remains 2026-10-05.
-- No profile, consent, operational review, feature flag or credential is changed.
-- Reuse the currently installed definitions so later auth/session/erasure fixes
-- and function ownership, ACLs, volatility and SECURITY DEFINER settings survive.
begin;

do $legal_version$
declare
  signatures constant text[] := array[
    'public.account_admission_access_allowed(uuid)',
    'public.account_storage_subject_allowed(uuid)',
    'public.get_current_account_admission_status(uuid)',
    'public.account_subject_public_data_allowed(uuid)',
    'public.enforce_current_account_legal_versions()',
    'public.claim_beta_seat(uuid,uuid,date,text,text)'
  ];
  old_comparison constant text := $pattern$((?:profile\.|new\.)?(?:privacy_policy_version|terms_of_service_version)(?:_input)?[[:space:]]+(?:=|is distinct from)[[:space:]]+)'2026-10-05'$pattern$;
  new_comparison constant text := $pattern$((?:profile\.|new\.)?(?:privacy_policy_version|terms_of_service_version)(?:_input)?[[:space:]]+(?:=|is distinct from)[[:space:]]+)'2026-11-04'$pattern$;
  replacement constant text := $replacement$\1'2026-11-04'$replacement$;
  definitions text[] := array[]::text[];
  target text;
  function_id regprocedure;
  original text;
  revised text;
  comparisons integer;
  changed integer := 0;
begin
  -- Preflight every exact signature before replacing any definition. An absent,
  -- already-migrated or unexpectedly edited legal comparison needs inspection.
  foreach target in array signatures loop
    function_id := to_regprocedure(target);
    if function_id is null then
      raise exception 'ACCOUNT_LEGAL_FUNCTION_MISSING: %', target;
    end if;
    original := pg_get_functiondef(function_id);
    select count(*) into comparisons from regexp_matches(original,old_comparison,'g');
    if comparisons <> 2 or original ~ new_comparison then
      raise exception 'ACCOUNT_LEGAL_DEFINITION_UNEXPECTED: %', target;
    end if;
    revised := regexp_replace(original,old_comparison,replacement,'g');
    select count(*) into comparisons from regexp_matches(revised,new_comparison,'g');
    if comparisons <> 2 or revised ~ old_comparison or revised = original then
      raise exception 'ACCOUNT_LEGAL_REPLACEMENT_UNEXPECTED: %', target;
    end if;
    definitions := array_append(definitions,revised);
  end loop;

  -- Catch a new, unlisted admission path rather than leave two legal versions
  -- active. Purpose/version fields and stored user acknowledgements are excluded.
  for function_id in
    select p.oid::regprocedure from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prokind='f'
  loop
    original := pg_get_functiondef(function_id);
    if original ~ old_comparison
      and not(function_id = any(array(select to_regprocedure(s) from unnest(signatures) s))) then
      raise exception 'ACCOUNT_LEGAL_UNLISTED_FUNCTION: %', function_id;
    end if;
  end loop;

  foreach revised in array definitions loop
    execute revised;
    changed := changed + 1;
  end loop;
  if changed <> 6 then raise exception 'ACCOUNT_LEGAL_REPLACEMENT_COUNT'; end if;
end;
$legal_version$;

commit;
