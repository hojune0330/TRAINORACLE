begin;
create extension if not exists pg_net with schema extensions;
do $$
declare existing record;
begin
  select jobid,schedule,command,active into existing from cron.job where jobname='trainoracle-garmin-minute';
  if found then
    if existing.schedule<>'* * * * *' or existing.command<>'select garmin_private.schedule_tick();' or not existing.active then
      raise exception 'GARMIN_SCHEDULE_CONFLICT';
    end if;
  else
    perform cron.schedule('trainoracle-garmin-minute','* * * * *','select garmin_private.schedule_tick();');
  end if;
end $$;
commit;
