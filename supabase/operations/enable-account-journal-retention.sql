-- Run as the database operator only after the reviewed migrations are installed.
-- This schedules deletion of already-expired (30-day) previous versions, not active documents.
-- Reference: https://supabase.com/docs/guides/cron/quickstart
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('trainoracle-account-journal-retention', '17 * * * *',
  'select public.run_account_journal_retention_batch();');
commit;
select jobname, schedule, active from cron.job
  where jobname = 'trainoracle-account-journal-retention';
