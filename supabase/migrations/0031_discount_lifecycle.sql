-- Versioned account offers. Existing paid financial records are never rewritten.
create table public.customer_discount_assignments (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles,
 percentage_bps int not null check(percentage_bps between 1 and 10000),
 usage_type text not null check(usage_type in ('ongoing','one_time')),
 expires_on date, reason text not null,
 assigned_by uuid references public.profiles on delete set null,
 assigned_at timestamptz not null default now(), removed_at timestamptz,
 held_payment_id uuid unique references public.payments,
 used_payment_id uuid unique references public.payments,
 used_reservation_id uuid references public.reservations,
 used_at timestamptz,
 check((used_payment_id is null)=(used_at is null)),
 check((used_reservation_id is null)=(used_at is null)),
 check(usage_type='one_time' or (held_payment_id is null and used_at is null))
);
create index customer_discount_history on public.customer_discount_assignments(customer_id,assigned_at desc);
alter table public.profiles add column account_discount_id uuid references public.customer_discount_assignments;
alter table public.reservation_discounts add column account_assignment_id uuid references public.customer_discount_assignments;
alter table public.customer_discount_assignments enable row level security;
revoke all on public.customer_discount_assignments from public,anon,authenticated;
grant select on public.customer_discount_assignments to authenticated;
grant all on public.customer_discount_assignments to service_role;
create policy account_discount_read on public.customer_discount_assignments for select to authenticated
 using(public.is_staff() or (customer_id=auth.uid() and public.customer_access()));
-- Existing assignments become ongoing, without altering any reservation snapshots.
with migrated as (
 insert into public.customer_discount_assignments(customer_id,percentage_bps,usage_type,reason,assigned_by,assigned_at)
 select id,account_discount_bps,'ongoing',account_discount_reason,account_discount_changed_by,coalesce(account_discount_changed_at,now())
 from public.profiles where role='customer' and account_discount_bps>0 returning id,customer_id
) update public.profiles p set account_discount_id=m.id from migrated m where p.id=m.customer_id;

create function private.account_discount_status(a public.customer_discount_assignments,at_time timestamptz default now()) returns text
language sql stable security definer set search_path='' as $$
 select case when a.id is null then 'NONE' when a.used_at is not null then 'USED'
 when a.held_payment_id is not null then 'RESERVED' when a.removed_at is not null then 'REMOVED'
 when a.expires_on is not null and at_time>=((a.expires_on+1)::timestamp at time zone 'Asia/Manila') then 'EXPIRED' else 'ACTIVE' end
$$;
create function private.account_offer(customer uuid,rid uuid default null) returns public.customer_discount_assignments
language plpgsql stable security definer set search_path='' as $$
declare a public.customer_discount_assignments;
begin
 select x.* into a from public.profiles p join public.customer_discount_assignments x on x.id=p.account_discount_id
 where p.id=customer and p.role='customer' and p.account_discount_bps>0;
 if private.account_discount_status(a)='ACTIVE' then return a;end if;
 -- A payable checkout keeps its agreement even if the manager changes the offer.
 if rid is not null and a.held_payment_id is not null and exists(select 1 from public.payments where id=a.held_payment_id and reservation_id=rid and status='pending') then return a;end if;
 return null;
end $$;

create function private.assign_account_offer(customer uuid,bps int,usage text,expiry date,note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.profiles;offer uuid;
begin
 perform private.require_staff();
 if bps is null or bps not between 0 and 10000 then raise exception 'Choose a percentage from 0 to 100';end if;
 if usage is null or usage not in ('ongoing','one_time') then raise exception 'Choose ongoing or one-time';end if;
 if expiry<(now() at time zone 'Asia/Manila')::date then raise exception 'Expiration cannot be before today (Manila)';end if;
 if length(btrim(coalesce(note,''))) not between 3 and 500 then raise exception 'Enter an assignment reason (3-500 characters)';end if;
 select * into strict p from public.profiles where id=customer for update;
 if p.role<>'customer' then raise exception 'Account discounts are for customer accounts only';end if;
 update public.customer_discount_assignments set removed_at=coalesce(removed_at,now()) where id=p.account_discount_id;
 if bps>0 then
  insert into public.customer_discount_assignments(customer_id,percentage_bps,usage_type,expires_on,reason,assigned_by)
  values(customer,bps,usage,expiry,btrim(note),auth.uid()) returning id into offer;
 end if;
 update public.profiles set account_discount_id=coalesce(offer,account_discount_id),account_discount_bps=bps,account_discount_reason=btrim(note),
 account_discount_changed_by=auth.uid(),account_discount_changed_at=now() where id=customer;
 perform private.audit(case when bps=0 then 'account_discount.removed' when p.account_discount_bps=0 then 'account_discount.assigned' else 'account_discount.updated' end,
 customer::text,jsonb_build_object('previous_assignment',p.account_discount_id,'assignment',offer,'previous_bps',p.account_discount_bps,'percentage_bps',bps,'usage_type',usage,'expires_on',expiry,'reason',btrim(note)));
 return offer;
end $$;
-- Compatibility with existing staff integrations: old calls assign ongoing offers.
create or replace function public.set_customer_account_discount(customer_id uuid,percentage_bps int,reason text) returns void
language plpgsql security definer set search_path='' as $$begin perform private.assign_account_offer(customer_id,percentage_bps,'ongoing',null,reason);end $$;
create function public.save_customer_discount(customer_id uuid,percentage_bps int,usage_type text,expires_on date,expected_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles;offer uuid;
begin
 perform private.require_staff();select * into strict p from public.profiles where id=customer_id for update;
 if p.account_discount_id is distinct from expected_assignment_id then raise exception 'This customer discount changed. Refresh the customer list and try again';end if;
 offer=private.assign_account_offer(customer_id,percentage_bps,usage_type,expires_on,case when percentage_bps=0 then 'Removed in Customer Management' else 'Assigned in Customer Management' end);
 return jsonb_build_object('customer_name',p.full_name,'previous_bps',p.account_discount_bps,'percentage_bps',percentage_bps,'assignment_id',offer,'usage_type',usage_type,'expires_on',expires_on);
end $$;

create function public.my_account_discount() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.customer_discount_assignments;eligible public.customer_discount_assignments;
begin
 perform private.require_customer();select x.* into a from public.profiles p join public.customer_discount_assignments x on x.id=p.account_discount_id where p.id=auth.uid();
 eligible=private.account_offer(auth.uid());
 return jsonb_build_object('account_discount_bps',coalesce(eligible.percentage_bps,0),'account_discount_reason',eligible.reason,
 'assignment_id',a.id,'usage_type',a.usage_type,'expires_on',a.expires_on,'status',private.account_discount_status(a),
 'reserved_reservation_id',(select reservation_id from public.payments where id=a.held_payment_id));
end $$;
create or replace function public.staff_customer_directory(search text default '',page_number int default 0,page_size int default 20) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;total bigint;term text=lower(btrim(coalesce(search,'')));
begin
 perform private.require_staff();
 if search is null or page_number is null or page_size is null or page_number<0 or page_number>100000 or page_size not between 1 and 100 or length(term)>200 then raise exception 'Invalid customer directory page or search';end if;
 select count(*) into total from public.profiles p join auth.users u on u.id=p.id where p.role='customer'
 and (term='' or strpos(lower(p.full_name),term)>0 or strpos(lower(coalesce(u.email,'')),term)>0);
 select coalesce(jsonb_agg(x order by x.full_name,x.id),'[]'::jsonb) into result from (
 select p.id,p.full_name,coalesce(u.email,'') as email,p.account_status,p.account_discount_bps,p.account_discount_changed_at,
 a.id as assignment_id,a.usage_type,a.expires_on,private.account_discount_status(a) as discount_status
 from public.profiles p join auth.users u on u.id=p.id left join public.customer_discount_assignments a on a.id=p.account_discount_id
 where p.role='customer' and (term='' or strpos(lower(p.full_name),term)>0 or strpos(lower(coalesce(u.email,'')),term)>0)
 order by p.full_name,p.id limit page_size offset page_number*page_size)x;
 return jsonb_build_object('customers',result,'total',total,'min_bps',0,'max_bps',10000,'business_cap_configured',false);
end $$;

create or replace function private.discount_for_quote(rid uuid,gross bigint) returns public.reservation_discounts
language plpgsql volatile security definer set search_path='' as $$
declare d public.reservation_discounts;r public.reservations;a public.customer_discount_assignments;today date=(now() at time zone 'Asia/Manila')::date;
begin
 select * into strict r from public.reservations where id=rid;select * into d from public.reservation_discounts where reservation_id=rid;
 if r.paid=0 and r.refunded=0 and r.status in ('draft','pending','for_approval','approved')
 and not exists(select 1 from public.payments where reservation_id=rid and status='pending') then
  if d.reservation_id is null or d.source='account' then
   a=private.account_offer(r.customer_id,rid);
   if a.id is not null then
    insert into public.reservation_discounts(reservation_id,promo_id,source,name,reason,kind,value,min_guests,min_total,applied_by,applied_at,account_assignment_id)
    values(rid,null,'account',case when a.usage_type='one_time' then 'One-time account offer' else 'Account discount' end,a.reason,'percentage',a.percentage_bps,1,0,a.assigned_by,a.assigned_at,a.id)
    on conflict(reservation_id) do update set name=excluded.name,reason=excluded.reason,value=excluded.value,applied_by=excluded.applied_by,applied_at=excluded.applied_at,account_assignment_id=excluded.account_assignment_id returning * into d;
   else delete from public.reservation_discounts where reservation_id=rid and source='account';d=null;end if;
  end if;
 end if;
 if d.reservation_id is null then return d;end if;
 if r.guests<d.min_guests or gross<d.min_total or (d.menu_set_id is not null and r.menu_set_id<>d.menu_set_id)
 or (d.starts_on is not null and today<d.starts_on) or (d.ends_on is not null and today>d.ends_on) then raise exception 'The assigned discount no longer meets its saved eligibility rules. Ask the manager to review it';end if;
 return d;
end $$;
create or replace function private.reservation_financial_quote(rid uuid,gross bigint,tax jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.reservation_discounts;a public.customer_discount_assignments;
begin
 d=private.discount_for_quote(rid,gross);select * into a from public.customer_discount_assignments where id=d.account_assignment_id;
 return private.financial_quote(gross,d.kind,d.value,tax)||jsonb_build_object('discount_name',d.name,'discount_reason',d.reason,
 'discount_source',d.source,'discount_kind',d.kind,'discount_value',d.value,'discount_percent',case when d.kind='percentage' then d.value::numeric/100 else null end)
 ||case when a.id is not null then jsonb_build_object('discount_assignment_id',a.id,'discount_usage_type',a.usage_type,'discount_expires_on',a.expires_on) else '{}'::jsonb end;
end $$;

-- Preserve genuine promotions and immediately restore complete account metadata
-- when an explicit promotion is removed from an unpaid booking.
create or replace function public.apply_reservation_discount(rid uuid,pid uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservations;f jsonb;tax jsonb;
begin
 perform private.require_staff();select * into strict r from public.reservations where id=rid for update;perform private.no_checkout(rid);
 if r.paid<>0 or r.refunded<>0 or r.status not in ('draft','pending','for_approval','approved') then raise exception 'Discount changes require an eligible unpaid booking';end if;
 if pid is not null then delete from public.reservation_discounts where reservation_id=rid and source='account';end if;
 perform private.apply_reservation_discount_before_account(rid,pid,reason);
 select * into strict r from public.reservations where id=rid;
 tax=jsonb_build_object('mode',r.financial_snapshot->>'tax_mode','rate_bps',r.financial_snapshot->'rate_bps','business_confirmed',r.financial_snapshot->'business_confirmed');
 f=private.reservation_financial_quote(rid,(r.financial_snapshot->>'gross_subtotal')::bigint,tax);
 update public.reservations set financial_snapshot=f||jsonb_build_object('captured_at',now()) where id=rid;
end $$;

create or replace function public.begin_checkout(rid uuid,customer uuid,payment_intent text) returns public.payments
language plpgsql security definer set search_path='' as $$
declare r public.reservations;p public.payments;d public.reservation_discounts;a public.customer_discount_assignments;
begin
 select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>customer then raise exception 'Reservation access required';end if;
 if private.reprice_account_discount(rid) then raise exception 'Your account discount changed. Refresh and review the quotation before starting payment';end if;
 select * into d from public.reservation_discounts where reservation_id=rid;
 if r.paid=0 and d.account_assignment_id is not null then
  select * into strict a from public.customer_discount_assignments where id=d.account_assignment_id for update;
  if a.usage_type='one_time' and a.held_payment_id is null and private.account_discount_status(a)<>'ACTIVE' then raise exception 'This one-time offer is no longer available. Refresh the quotation';end if;
  if a.usage_type='one_time' and a.held_payment_id is not null and not exists(select 1 from public.payments where id=a.held_payment_id and reservation_id=rid and status='pending') then raise exception 'This one-time offer is reserved for another checkout. Refresh the quotation';end if;
 end if;
 p=private.begin_checkout_before_account_discount(rid,customer,payment_intent);
 if r.paid=0 and a.usage_type='one_time' and a.held_payment_id is null then
  update public.customer_discount_assignments set held_payment_id=p.id where id=a.id;
  perform private.audit('account_discount.reserved',a.id::text,jsonb_build_object('reservation_id',rid,'payment_id',p.id));
 end if;
 return p;
end $$;

alter function public.confirm_provider_payment(text,text,text,bigint) set schema private;
alter function private.confirm_provider_payment(text,text,text,bigint) rename to confirm_provider_payment_before_lifecycle;
create function public.confirm_provider_payment(event_id text,session_id text,provider_payment_id text,amount bigint) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payments;a public.customer_discount_assignments;
begin
 select * into strict p from public.payments where external_session_id=session_id for update;
 -- Shared lock order: payment -> reservation -> assignment. Checkout never locks
 -- an existing payment after an assignment, avoiding webhook/retry deadlocks.
 perform 1 from public.reservations where id=p.reservation_id for update;
 perform private.confirm_provider_payment_before_lifecycle(event_id,session_id,provider_payment_id,amount);
 select * into a from public.customer_discount_assignments where held_payment_id=p.id for update;
 if a.id is not null and a.used_at is null and exists(select 1 from public.payments where id=p.id and status='fully_paid') then
  update public.customer_discount_assignments set used_payment_id=p.id,used_reservation_id=p.reservation_id,used_at=now(),held_payment_id=null where id=a.id;
  perform private.audit('account_discount.redeemed',a.id::text,jsonb_build_object('reservation_id',p.reservation_id,'payment_id',p.id,'percentage_bps',a.percentage_bps));
 end if;
end $$;

-- Only a trusted provider reconciliation may release a payable checkout.
-- Local clocks and customer-supplied "failed" flags are not proof of expiry.
create function public.release_checkout(payment_id uuid,confirmed_session_id text default null) returns void
language plpgsql security definer set search_path='' as $$
declare p public.payments;a public.customer_discount_assignments;
begin
 select * into strict p from public.payments where id=payment_id for update;
 perform 1 from public.reservations where id=p.reservation_id for update;
 if p.status<>'pending' then return;end if;
 if p.external_session_id is not null then
  if confirmed_session_id is distinct from p.external_session_id then raise exception 'Provider-confirmed expired session required';end if;
 elsif p.provider_claimed_at is not null then raise exception 'Ambiguous provider operation requires reconciliation before release';
 elsif confirmed_session_id is not null then raise exception 'Unexpected provider session';end if;
 update public.payments set status='failed' where id=p.id;
 update public.customer_discount_assignments set held_payment_id=null where held_payment_id=p.id and used_at is null returning * into a;
 perform private.audit('checkout.released',p.id::text,jsonb_build_object('reservation_id',p.reservation_id,'provider_confirmed',p.external_session_id is not null));
 if a.id is not null then perform private.audit('account_discount.released',a.id::text,jsonb_build_object('reservation_id',p.reservation_id,'payment_id',p.id));end if;
end $$;

alter function public.export_application_snapshot() set schema private;
alter function private.export_application_snapshot() rename to export_application_snapshot_0030;
create function public.export_application_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s jsonb;rows jsonb;
begin
 s=private.export_application_snapshot_0030();
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) into rows from (select * from public.customer_discount_assignments limit 50001)a;
 if jsonb_array_length(rows)>50000 or octet_length((s->'tables')::text)+octet_length(rows::text)>10485760 then raise exception 'Dataset too large for application export';end if;
 return s||jsonb_build_object('schema_version','0031_discount_lifecycle.sql','tables',s->'tables'||jsonb_build_object('customer_discount_assignments',rows),'counts',s->'counts'||jsonb_build_object('customer_discount_assignments',jsonb_array_length(rows)));
end $$;
revoke execute on all functions in schema private from public,anon,authenticated;
revoke execute on function public.save_customer_discount(uuid,int,text,date,uuid),public.my_account_discount(),public.release_checkout(uuid,text),public.confirm_provider_payment(text,text,text,bigint),public.export_application_snapshot() from public,anon,authenticated;
grant execute on function public.save_customer_discount(uuid,int,text,date,uuid),public.my_account_discount() to authenticated;
grant execute on function public.release_checkout(uuid,text),public.confirm_provider_payment(text,text,text,bigint),public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
