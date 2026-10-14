create table public.gallery_images(id uuid primary key default gen_random_uuid(),name text not null,image_url text not null,active boolean not null default true,created_at timestamptz not null default now());
create table public.app_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
insert into public.app_settings(key,value) values('maintenance','false'),('refund_partial_rate','0.30'),('refund_full_rate','0.70');
create table public.audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles on delete set null,action text not null,entity_id text,details jsonb not null default '{}',created_at timestamptz not null default now());
create index audit_created on public.audit_logs(created_at desc);
create table public.email_deliveries(id uuid primary key default gen_random_uuid(),notification_id uuid not null unique references public.notifications,provider_id text,created_at timestamptz not null default now());

create function public.current_app_role() returns public.app_role language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(public.current_app_role() in ('manager','super_admin'),false) $$;
create function public.maintenance_enabled() returns boolean language sql stable security definer set search_path='' as $$ select coalesce((select value::text::boolean from public.app_settings where key='maintenance'),false) $$;
create function public.customer_access() returns boolean language sql stable security definer set search_path='' as $$ select auth.uid() is not null and (not public.maintenance_enabled() or public.current_app_role()='super_admin') $$;
create function public.can_read_reservation(rid uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.is_staff() or (public.customer_access() and exists(select 1 from public.reservations where id=rid and customer_id=auth.uid())) $$;
create function private.require_customer() returns void language plpgsql security definer set search_path='' as $$ begin if not coalesce(public.customer_access(),false) or public.current_app_role() is distinct from 'customer' then raise exception 'Customer access required or maintenance enabled'; end if; end $$;
create function private.require_staff() returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_staff() then raise exception 'Staff access required'; end if; end $$;
create function private.audit(action text,entity text,details jsonb default '{}') returns void language sql security definer set search_path='' as $$ insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),action,entity,details) $$;
create function private.notify(rid uuid,title text,body text) returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,title,body,href) select customer_id,title,body,'/customer/reservations/'||id from public.reservations where id=rid;
 insert into public.notifications(user_id,title,body,href) select id,title,body,case when role='super_admin' then '/super-admin/dashboard' else '/manager/reservations' end from public.profiles where role in ('manager','super_admin');
end $$;
