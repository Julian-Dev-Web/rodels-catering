-- Hosted Supabase operator setup, after migrations 0023-0026 and worker deploy.
-- No secret values belong in this file. Provision the following Vault entries
-- privately: rodel_reminder_worker_secret and rodel_project_url.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function private.run_event_reminder_tick() returns void language plpgsql security definer set search_path='' as $$
declare token text;base text;
begin
 perform public.enqueue_event_reminders();
 select decrypted_secret into token from vault.decrypted_secrets where name='rodel_reminder_worker_secret';
 select decrypted_secret into base from vault.decrypted_secrets where name='rodel_project_url';
 if token is null or base is null then return;end if;
 perform net.http_post(url:=base||'/functions/v1/dispatch-event-reminders',headers:=jsonb_build_object('Authorization','Bearer '||token,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke execute on function private.run_event_reminder_tick() from public,anon,authenticated;
do $$begin
 if exists(select 1 from cron.job where jobname='rodel-upcoming-event-reminders') then perform cron.unschedule('rodel-upcoming-event-reminders');end if;
 perform cron.schedule('rodel-upcoming-event-reminders','*/5 * * * *','select private.run_event_reminder_tick()');
end $$;
