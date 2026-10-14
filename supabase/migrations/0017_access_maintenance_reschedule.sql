-- Existing identities and reservations are preserved. Suspension is application-level.
alter table public.profiles add column account_status text not null default 'active' check(account_status in ('active','suspended')),
 add column status_changed_at timestamptz;
alter publication supabase_realtime add table public.profiles;
create or replace function public.current_app_role() returns public.app_role language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and account_status='active'
$$;
create or replace function public.customer_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and account_status='active') and (not public.maintenance_enabled() or public.current_app_role()='super_admin')
$$;
create function public.admin_account_status(target_id uuid,new_status text) returns void language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
 perform pg_advisory_xact_lock(hashtextextended('privileged-account-administration',0));
 if public.current_app_role() is distinct from 'super_admin' then raise exception 'Super admin required'; end if;
 if target_id=auth.uid() then raise exception 'You cannot suspend your own account'; end if;
 if new_status is null or new_status not in ('active','suspended') then raise exception 'Invalid account status'; end if;
 select * into strict target from public.profiles where id=target_id for update;
 if target.role='super_admin' and new_status='suspended' and target.account_status='active' and (select count(*) from public.profiles where role='super_admin' and account_status='active')<=1 then raise exception 'The last active super admin must remain active'; end if;
 if target.account_status=new_status then return; end if;
 update public.profiles set account_status=new_status,status_changed_at=now() where id=target_id;
 perform private.audit('account.status_changed',target_id::text,jsonb_build_object('from',target.account_status,'to',new_status));
end $$;
revoke execute on function public.admin_account_status(uuid,text) from public,anon;
grant execute on function public.admin_account_status(uuid,text) to authenticated;

insert into public.app_settings(key,value) values('maintenance_message','"RodelConnect is currently undergoing scheduled maintenance. We are improving our services. Please check back shortly."');
create function public.maintenance_state() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('enabled',public.maintenance_enabled(),'message',(select value #>> '{}' from public.app_settings where key='maintenance_message'),'changed_at',(select updated_at from public.app_settings where key='maintenance'))
$$;
create function public.configure_maintenance(enabled boolean,message text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'super_admin' then raise exception 'Super admin required'; end if;
 if enabled is null or message is null or length(message)>500 then raise exception 'Enter a message up to 500 characters'; end if;
 perform pg_advisory_xact_lock(hashtextextended('maintenance-setting',0));
 update public.app_settings set value=to_jsonb(enabled),updated_at=now() where key='maintenance';
 update public.app_settings set value=to_jsonb(case when btrim(message)='' then 'RodelConnect is currently undergoing scheduled maintenance. We are improving our services. Please check back shortly.' else btrim(message) end),updated_at=now() where key='maintenance_message';
 perform private.audit('maintenance.changed','maintenance',jsonb_build_object('enabled',enabled,'message',btrim(message)));
end $$;
revoke execute on function public.maintenance_state(),public.configure_maintenance(boolean,text) from public,anon,authenticated;
grant execute on function public.maintenance_state() to anon,authenticated;
grant execute on function public.configure_maintenance(boolean,text) to authenticated;

-- Customers already use the 3-day preparation rule. Add availability checking
-- when requesting, as well as the existing atomic capacity guard on approval.
create or replace function public.request_reschedule(rid uuid,new_date date,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations; result uuid;
begin
 perform private.require_customer(); select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>auth.uid() or r.status<>'approved' or r.event_date<=(now() at time zone 'Asia/Manila')::date or new_date is null or new_date<(now() at time zone 'Asia/Manila')::date+3 or new_date=r.event_date or reason is null or length(btrim(reason)) not between 5 and 2000 then raise exception 'Choose a different available date at least 3 days ahead and provide a reason'; end if;
 perform private.no_checkout(rid);
 perform pg_advisory_xact_lock(hashtextextended('capacity:'||new_date::text,0));
 if (select count(*) from public.reservations where event_date=new_date and holds_capacity)>=3 then raise exception 'The requested date is at capacity'; end if;
 if exists(select 1 from public.reschedule_requests where reservation_id=rid and status='pending') then raise exception 'A reschedule request is already pending'; end if;
 if (select count(*) from public.reservation_reschedules where reservation_id=rid and date_trunc('month',created_at at time zone 'Asia/Manila')=date_trunc('month',now() at time zone 'Asia/Manila'))>=3 then raise exception 'Monthly reschedule limit reached'; end if;
 insert into public.reschedule_requests(reservation_id,new_date,reason) values(rid,new_date,btrim(reason)) returning id into result;
 perform private.notify(rid,'Reschedule requested','A manager will review the requested date. Your original booking date remains confirmed until approval.'); perform private.audit('reschedule.requested',result::text,jsonb_build_object('original_date',r.event_date,'requested_date',new_date));
 return result;
end $$;

create function public.operational_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_staff();
 return jsonb_build_object(
  'active',(select count(*) from public.reservations where status in ('pending','for_approval','approved','pending_cancellation')),
  'pending',(select count(*) from public.reservations where status in ('pending','for_approval')),
  'upcoming',(select count(*) from public.reservations where status='approved' and event_date>=(now() at time zone 'Asia/Manila')::date),
  'confirmed',(select count(*) from public.reservations where status='approved'),
  'cancellations',(select count(*) from public.cancellations where status='pending'),
  'refunds',(select count(*) from public.refunds where status='pending'),
  'reschedules',(select count(*) from public.reschedule_requests where status='pending'),
  'payments',coalesce((select jsonb_object_agg(payment_status,n) from (select payment_status,count(*) n from public.reservations group by payment_status)x),'{}'::jsonb)
 );
end $$;
revoke execute on function public.operational_metrics() from public,anon;
grant execute on function public.operational_metrics() to authenticated;

create or replace function public.system_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'super_admin' then raise exception 'Super admin required'; end if;
 return jsonb_build_object(
  'users',(select count(*) from public.profiles),
  'customers',(select count(*) from public.profiles where role='customer'),
  'managers',(select count(*) from public.profiles where role='manager'),
  'super_admins',(select count(*) from public.profiles where role='super_admin'),
  'active_accounts',(select count(*) from public.profiles where account_status='active'),
  'suspended_accounts',(select count(*) from public.profiles where account_status='suspended'),
  'reservations',(select count(*) from public.reservations),
  'pending_reservations',(select count(*) from public.reservations where status in ('pending','for_approval')),
  'approved_reservations',(select count(*) from public.reservations where status='approved'),
  'menus',(select count(*) from public.menu_sets where active),
  'published_photos',(select count(*) from public.gallery_images where active),
  'featured_photos',(select count(*) from public.gallery_images where active and featured),
  'maintenance',public.maintenance_enabled(),
  'last_export',(select created_at from public.audit_logs where action='backup.application_export_created' order by created_at desc limit 1),
  'recent_activity',coalesce((select jsonb_agg(x) from (select action,created_at from public.audit_logs order by created_at desc limit 8)x),'[]'::jsonb)
 );
end $$;
