-- Additive preparation only. Client readers still independently validate retained evidence.
begin;

alter table public.saved_training_plans
  drop constraint if exists saved_training_plans_schema_version_check;

alter table public.saved_training_plans
  add constraint saved_training_plans_schema_version_check
  check (schema_version in (3, 6));

alter table public.saved_training_plans
  add constraint saved_training_plans_v6_envelope_check check (
    schema_version <> 6 or (
      plan_payload ->> 'version' = '6'
      and plan_payload ->> 'contentFingerprint' ~ '^sha256:[a-f0-9]{64}$'
      and plan_id = 'multi-v6:' || (plan_payload ->> 'contentFingerprint')
      and jsonb_typeof(plan_payload -> 'selection') = 'object'
      and jsonb_typeof(plan_payload -> 'progress') = 'array'
      and plan_payload ?& array['version', 'selection', 'progress', 'updatedAt', 'contentFingerprint']
      and (plan_payload - array['version', 'selection', 'progress', 'updatedAt', 'contentFingerprint']) = '{}'::jsonb
    ) is true
  );

-- Existing owner-only RLS and feature guards remain unchanged.
commit;
