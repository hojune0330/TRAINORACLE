-- Local/nonproduction preparation only. Does not enable file evidence writes.
begin;

alter table public.service_feature_controls
  drop constraint service_feature_controls_feature_key_check;
alter table public.service_feature_controls
  add constraint service_feature_controls_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2', 'FILE_ANALYSIS_WRITE'
  ));
alter table public.service_feature_control_events
  drop constraint service_feature_control_events_feature_key_check;
alter table public.service_feature_control_events
  add constraint service_feature_control_events_feature_key_check check (feature_key in (
    'ACCOUNT', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PRODUCT_ANALYTICS', 'FEEDBACK_BOARD',
    'PLAN_BACKUP', 'PUBLIC_PROFILE', 'DEVICE_INTEGRATION', 'ACCOUNT_JOURNAL_V2', 'FILE_ANALYSIS_WRITE'
  ));
insert into public.service_feature_controls(feature_key, enabled, change_reason)
values ('FILE_ANALYSIS_WRITE', false, 'INITIAL_SAFE_DEFAULT')
on conflict (feature_key) do nothing;

commit;
