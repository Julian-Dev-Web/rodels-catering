create function private.capacity_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.updated_at=now();
 if new.status in ('approved','completed') then new.holds_capacity=true;
 elsif new.status='pending_cancellation' and TG_OP='UPDATE' then new.holds_capacity=old.holds_capacity;
 else new.holds_capacity=false; end if;
 if new.holds_capacity then
  perform pg_advisory_xact_lock(hashtextextended('capacity:'||new.event_date::text,0));
  if (select count(*) from public.reservations where event_date=new.event_date and id<>new.id and holds_capacity)>=3 then raise exception 'This event date is at capacity'; end if;
 end if;
 return new;
end $$;
create trigger reservation_capacity before insert or update on public.reservations for each row execute function private.capacity_guard();

create function private.no_checkout(rid uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if exists(select 1 from public.payments where reservation_id=rid and status='pending') then raise exception 'An open checkout must be reconciled before this change'; end if;
end $$;

create function private.calculate_price(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; m public.menu_sets; menu bigint; setup bigint; features bigint; addons bigint; chairs bigint=0; tables bigint; extra bigint; seating record;
begin
 select * into strict r from public.reservations where id=rid;
 select * into strict m from public.menu_sets where id=r.menu_set_id and active;
 if r.guests<m.min_guests then raise exception 'Guest count is below the package minimum'; end if;
 menu=m.price*r.guests;
 select coalesce(sum(s.price),0) into setup from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id where x.reservation_id=rid and s.active;
 select coalesce(sum(s.price),0) into features from public.reservation_event_features x join public.event_features s on s.id=x.event_feature_id where x.reservation_id=rid and s.active;
 select coalesce(sum(s.price*x.quantity),0) into addons from public.reservation_add_ons x join public.add_ons s on s.id=x.add_on_id where x.reservation_id=rid and s.active;
 select greatest(coalesce(sum(chair_quantity),0)-r.guests,0) into extra from public.reservation_tables_chairs where reservation_id=rid;
 for seating in select x.chair_quantity,s.price from public.reservation_tables_chairs x join public.chair_types s on s.id=x.chair_type_id where x.reservation_id=rid and s.active order by s.price desc loop
  chairs=chairs+least(extra,seating.chair_quantity)*seating.price; extra=greatest(extra-seating.chair_quantity,0);
 end loop;
 select coalesce(sum(x.table_quantity*s.price),0) into tables from public.reservation_tables_chairs x join public.table_types s on s.id=x.table_type_id where x.reservation_id=rid and s.active;
 return jsonb_build_object('menu',menu,'setup',setup,'features',features,'add_ons',addons,'extra_chairs',chairs,'tables',tables,'total',menu+setup+features+addons+chairs+tables);
end $$;

create function public.save_reservation(data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.reservations; item jsonb; quote jsonb;
begin
 perform private.require_customer();
 rid=nullif(data->>'id','')::uuid;
 if (data->>'event_date')::date < (now() at time zone 'Asia/Manila')::date+3 then raise exception 'Choose an event date at least 3 days ahead'; end if;
 if rid is not null then
  select * into strict r from public.reservations where id=rid for update;
  if r.customer_id<>auth.uid() or r.status not in ('draft','pending','for_approval') or r.paid>0 then raise exception 'This reservation cannot be modified'; end if;
  perform private.no_checkout(rid);
  update public.reservations set event_name=data->>'event_name',event_date=(data->>'event_date')::date,event_time=(data->>'event_time')::time,address=data->'address',guests=(data->>'guests')::int,menu_set_id=(data->>'menu_set_id')::uuid,drink_id=nullif(data->>'drink_id','')::uuid,dessert_id=nullif(data->>'dessert_id','')::uuid,status='draft',finalized_at=null where id=rid;
 else
  insert into public.reservations(customer_id,event_name,event_date,event_time,address,guests,menu_set_id,drink_id,dessert_id) values(auth.uid(),data->>'event_name',(data->>'event_date')::date,(data->>'event_time')::time,data->'address',(data->>'guests')::int,(data->>'menu_set_id')::uuid,nullif(data->>'drink_id','')::uuid,nullif(data->>'dessert_id','')::uuid) returning id into rid;
 end if;
 delete from public.reservation_items where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'dish_ids','[]')) loop
  if not exists(select 1 from public.dishes where id=(item#>>'{}')::uuid and active) then raise exception 'Dish unavailable'; end if;
  insert into public.reservation_items values(rid,(item#>>'{}')::uuid);
 end loop;
 delete from public.reservation_event_setups where reservation_id=rid;
 if nullif(data->>'setup_id','') is not null then
  if not exists(select 1 from public.event_setups where id=(data->>'setup_id')::uuid and active) then raise exception 'Setup unavailable'; end if;
  insert into public.reservation_event_setups values(rid,(data->>'setup_id')::uuid);
 end if;
 delete from public.reservation_event_features where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'feature_ids','[]')) loop
  if not exists(select 1 from public.event_features where id=(item#>>'{}')::uuid and active) then raise exception 'Feature unavailable'; end if;
  insert into public.reservation_event_features values(rid,(item#>>'{}')::uuid);
 end loop;
 delete from public.reservation_add_ons where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'add_ons','[]')) loop
  if not exists(select 1 from public.add_ons where id=(item->>'id')::uuid and active) then raise exception 'Add-on unavailable'; end if;
  insert into public.reservation_add_ons values(rid,(item->>'id')::uuid,(item->>'quantity')::int);
 end loop;
 delete from public.reservation_tables_chairs where reservation_id=rid;
 if data ? 'chairs' then
  for item in select value from jsonb_array_elements(data->'chairs') loop
   if not exists(select 1 from public.chair_types where id=(item->>'id')::uuid and active) or not exists(select 1 from public.table_types where id=(data->>'table_type_id')::uuid and active) then raise exception 'Seating unavailable'; end if;
   insert into public.reservation_tables_chairs values(rid,(data->>'table_type_id')::uuid,(item->>'id')::uuid,case when not exists(select 1 from public.reservation_tables_chairs where reservation_id=rid) then coalesce((data->>'table_quantity')::int,0) else 0 end,(item->>'quantity')::int);
  end loop;
 elsif nullif(data->>'chair_type_id','') is not null then
  if not exists(select 1 from public.chair_types where id=(data->>'chair_type_id')::uuid and active) or not exists(select 1 from public.table_types where id=(data->>'table_type_id')::uuid and active) then raise exception 'Seating unavailable'; end if;
  insert into public.reservation_tables_chairs values(rid,(data->>'table_type_id')::uuid,(data->>'chair_type_id')::uuid,coalesce((data->>'table_quantity')::int,0),coalesce((data->>'chair_quantity')::int,0));
 end if;
 quote=private.calculate_price(rid);
 update public.reservations set pricing=quote,total=(quote->>'total')::bigint where id=rid;
 perform private.audit('reservation.saved',rid::text);
 return rid;
end $$;

create function public.finalize_reservation(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations; required int; quote jsonb;
begin
 perform private.require_customer();
 select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>auth.uid() or r.status<>'draft' or r.paid>0 then raise exception 'Only your unpaid draft can be finalized'; end if;
 perform private.no_checkout(rid);
 if r.event_date<(now() at time zone 'Asia/Manila')::date+3 then raise exception 'Choose an event date at least 3 days ahead'; end if;
 select dish_count into strict required from public.menu_sets where id=r.menu_set_id and active;
 if (select count(*) from public.reservation_items x join public.dishes d on d.id=x.dish_id and d.active where reservation_id=rid)<>required then raise exception 'Select exactly % dishes',required; end if;
 if not exists(select 1 from public.drinks where id=r.drink_id and active) or not exists(select 1 from public.desserts where id=r.dessert_id and active) or not exists(select 1 from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id and s.active where reservation_id=rid) then raise exception 'Select a drink, dessert and event setup'; end if;
 if coalesce((select sum(chair_quantity) from public.reservation_tables_chairs x join public.chair_types c on c.id=x.chair_type_id and c.active where reservation_id=rid),0)<r.guests or coalesce((select sum(table_quantity) from public.reservation_tables_chairs x join public.table_types t on t.id=x.table_type_id and t.active where reservation_id=rid),0)<1 then raise exception 'Select tables and enough active chairs for your guests'; end if;
 if coalesce(r.address->>'street','')='' or coalesce(r.address->>'city','')='' or coalesce(r.address->>'province','')='' or coalesce(r.address->>'barangay','')='' then raise exception 'Complete the event address'; end if;
 if regexp_replace(coalesce(r.address->>'contact',''),'[^+0-9]','','g') !~ '^(\+63|0)9[0-9]{9}$' then raise exception 'Enter a valid Philippine mobile contact number'; end if;
 if exists(select 1 from public.reservation_event_features x join public.event_features f on f.id=x.event_feature_id where reservation_id=rid and not f.active) or exists(select 1 from public.reservation_add_ons x join public.add_ons a on a.id=x.add_on_id where reservation_id=rid and not a.active) then raise exception 'A selected extra is unavailable'; end if;
 quote=private.calculate_price(rid);
 update public.reservations set status='for_approval',pricing=quote,total=(quote->>'total')::bigint,finalized_at=now() where id=rid;
 insert into public.balances values(rid,(quote->>'total')::bigint,now()) on conflict(reservation_id) do update set amount=excluded.amount,updated_at=now();
 perform private.notify(rid,'Reservation finalized','Your reservation is ready for review and payment.');
 perform private.audit('reservation.finalized',rid::text,quote);
 return quote;
end $$;

create function public.available_dates(start_date date,end_date date) returns table(event_date date,remaining bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if public.maintenance_enabled() and public.current_app_role() is distinct from 'super_admin' then raise exception 'Maintenance is enabled'; end if;
 if end_date<start_date or end_date-start_date>366 then raise exception 'Select at most one year'; end if;
 return query select d::date,3-count(r.id) from generate_series(start_date::timestamp,end_date::timestamp,interval '1 day') d left join public.reservations r on r.event_date=d::date and r.holds_capacity group by d order by d;
end $$;

create function public.request_cancellation(rid uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations; cid uuid;
begin
 perform private.require_customer();
 select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>auth.uid() or r.status not in ('draft','pending','for_approval','approved') then raise exception 'This reservation cannot be cancelled'; end if;
 perform private.no_checkout(rid);
 if r.event_date::timestamp at time zone 'Asia/Manila' <= now()+interval '3 days' then raise exception 'Cancellation requires more than 3 days before the event'; end if;
 insert into public.cancellations(reservation_id,reason,previous_status) values(rid,reason,r.status) returning id into cid;
 update public.reservations set status='pending_cancellation' where id=rid;
 perform private.audit('cancellation.requested',cid::text);
 perform private.notify(rid,'Cancellation requested','Our team will review your cancellation.');
 return cid;
end $$;

create function public.review_cancellation(cid uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare c public.cancellations;
begin
 perform private.require_staff();
 select * into strict c from public.cancellations where id=cid for update;
 perform 1 from public.reservations where id=c.reservation_id for update;
 if c.status<>'pending' then raise exception 'Request already reviewed'; end if;
 update public.cancellations set status=case when approve then 'approved'::public.refund_status else 'rejected'::public.refund_status end where id=cid;
 update public.reservations set status=case when approve then 'cancelled'::public.reservation_status else c.previous_status end where id=c.reservation_id;
 if approve then update public.balances set amount=0,updated_at=now() where reservation_id=c.reservation_id; end if;
 perform private.audit('cancellation.reviewed',cid::text,jsonb_build_object('approved',approve));
 perform private.notify(c.reservation_id,'Cancellation reviewed',case when approve then 'Cancellation approved. You may request an eligible refund.' else 'Cancellation request was rejected.' end);
end $$;

create function public.refund_eligibility(total bigint,paid bigint) returns bigint language plpgsql stable security definer set search_path='' as $$
declare rate numeric;
begin
 if total<=0 or paid<=0 or paid>total then raise exception 'Invalid payment amounts'; end if;
 if paid=total then select value::text::numeric into rate from public.app_settings where key='refund_full_rate';
 elsif paid=(total+1)/2 then select value::text::numeric into rate from public.app_settings where key='refund_partial_rate';
 else raise exception 'Payment requires manual refund reconciliation'; end if;
 return round(paid*rate)::bigint;
end $$;

create function public.request_refund(rid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations; fid uuid; eligible bigint;
begin
 perform private.require_customer();
 select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>auth.uid() or r.status<>'cancelled' or not exists(select 1 from public.cancellations where reservation_id=rid and status='approved') then raise exception 'Approved cancellation required'; end if;
 eligible=public.refund_eligibility(r.total,r.paid);
 if eligible<=0 then raise exception 'No refundable amount under the current policy'; end if;
 insert into public.refunds(reservation_id,eligible_amount) values(rid,eligible) returning id into fid;
 update public.reservations set status='pending_refund' where id=rid;
 perform private.audit('refund.requested',fid::text,jsonb_build_object('eligible_amount',eligible));
 perform private.notify(rid,'Refund requested','The policy-calculated amount is awaiting review.');
 return fid;
end $$;

create function public.review_refund(fid uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare f public.refunds;
begin
 perform private.require_staff(); select * into strict f from public.refunds where id=fid for update;
 if f.status<>'pending' then raise exception 'Refund already reviewed'; end if;
 update public.refunds set status=case when approve then 'approved'::public.refund_status else 'rejected'::public.refund_status end where id=fid;
 update public.reservations set status=case when approve then 'refund_approved'::public.reservation_status else 'cancelled'::public.reservation_status end where id=f.reservation_id;
 perform private.audit('refund.reviewed',fid::text,jsonb_build_object('approved',approve,'amount',f.eligible_amount));
 perform private.notify(f.reservation_id,'Refund reviewed',case when approve then 'Refund approved; provider processing is next.' else 'Refund request rejected. Please contact support.' end);
end $$;

create function public.request_reschedule(rid uuid,new_date date,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.reservations; result uuid;
begin
 perform private.require_customer(); select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>auth.uid() or r.status<>'approved' or r.event_date<=(now() at time zone 'Asia/Manila')::date or new_date<(now() at time zone 'Asia/Manila')::date+3 or new_date=r.event_date or length(reason)<5 then raise exception 'An approved future booking, new date at least 3 days ahead and reason are required'; end if;
 perform private.no_checkout(rid);
 if (select count(*) from public.reservation_reschedules where reservation_id=rid and date_trunc('month',created_at at time zone 'Asia/Manila')=date_trunc('month',now() at time zone 'Asia/Manila'))>=3 then raise exception 'Monthly reschedule limit reached'; end if;
 insert into public.reschedule_requests(reservation_id,new_date,reason) values(rid,new_date,reason) returning id into result;
 perform private.notify(rid,'Reschedule requested','A manager will review the requested date.'); perform private.audit('reschedule.requested',result::text);
 return result;
end $$;

create function public.review_reschedule(request_id uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare req public.reschedule_requests; r public.reservations;
begin
 perform private.require_staff(); select * into strict req from public.reschedule_requests where id=request_id for update;
 select * into strict r from public.reservations where id=req.reservation_id for update;
 if req.status<>'pending' or r.status<>'approved' then raise exception 'Request cannot be reviewed'; end if;
 if approve then
  perform private.no_checkout(r.id);
  if req.new_date<(now() at time zone 'Asia/Manila')::date+3 then raise exception 'New date must be at least 3 days ahead'; end if;
  if (select count(*) from public.reservation_reschedules where reservation_id=r.id and date_trunc('month',created_at at time zone 'Asia/Manila')=date_trunc('month',now() at time zone 'Asia/Manila'))>=3 then raise exception 'Monthly reschedule limit reached'; end if;
  update public.reservations set event_date=req.new_date where id=r.id;
  insert into public.reservation_reschedules(reservation_id,old_date,new_date) values(r.id,r.event_date,req.new_date);
 end if;
 update public.reschedule_requests set status=case when approve then 'approved'::public.refund_status else 'rejected'::public.refund_status end where id=request_id;
 perform private.audit('reschedule.reviewed',request_id::text,jsonb_build_object('approved',approve)); perform private.notify(r.id,'Reschedule reviewed',case when approve then 'Your new event date is confirmed.' else 'Reschedule request rejected.' end);
end $$;

create function public.manager_reservation_status(rid uuid,new_status public.reservation_status) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;
begin
 perform private.require_staff(); select * into strict r from public.reservations where id=rid for update;
 if not ((r.status in ('pending','for_approval') and new_status='approved' and r.finalized_at is not null and r.event_date>(now() at time zone 'Asia/Manila')::date) or (r.status in ('pending','for_approval') and new_status='rejected' and r.paid=0) or (r.status='approved' and new_status='completed' and r.paid=r.total and r.event_date<=(now() at time zone 'Asia/Manila')::date)) then raise exception 'Invalid reservation transition'; end if;
 perform private.no_checkout(rid);
 update public.reservations set status=new_status where id=rid;
 perform private.audit('reservation.status_changed',rid::text,jsonb_build_object('from',r.status,'to',new_status)); perform private.notify(rid,'Reservation updated','Reservation status: '||new_status::text);
end $$;

create function public.admin_set_role(target_id uuid,target_role public.app_role) returns void language plpgsql security definer set search_path='' as $$
declare old_role public.app_role;
begin
 if public.current_app_role() is distinct from 'super_admin' or target_role='super_admin' or target_id=auth.uid() then raise exception 'Role assignment is not permitted'; end if;
 select role into strict old_role from public.profiles where id=target_id for update;
 if old_role='super_admin' then raise exception 'Super admins require an operator-managed workflow'; end if;
 update public.profiles set role=target_role where id=target_id;
 perform private.audit('role.changed',target_id::text,jsonb_build_object('from',old_role,'to',target_role));
 insert into public.notifications(user_id,title,body,href) values(target_id,'Role updated','Your access role is now '||target_role::text,'/login');
end $$;

create function public.update_setting(setting_key text,setting_value jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.current_app_role() is distinct from 'super_admin' then raise exception 'Super admin required'; end if;
 if setting_key='maintenance' then if jsonb_typeof(setting_value)<>'boolean' then raise exception 'Boolean required'; end if;
 elsif setting_key in ('refund_partial_rate','refund_full_rate') then if jsonb_typeof(setting_value)<>'number' or setting_value::text::numeric not between 0 and 1 then raise exception 'Rate must be between 0 and 1'; end if;
 else raise exception 'Unknown setting'; end if;
 update public.app_settings set value=setting_value,updated_at=now() where key=setting_key;
 perform private.audit('setting.changed',setting_key,jsonb_build_object('value',setting_value));
end $$;

create function public.submit_feedback(rid uuid,rating int,message text) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_customer();
 if not exists(select 1 from public.reservations where id=rid and customer_id=auth.uid() and status='completed') then raise exception 'Completed reservation required'; end if;
 insert into public.feedback(reservation_id,customer_id,rating,message) values(rid,auth.uid(),rating,message); perform private.audit('feedback.created',rid::text);
end $$;
create function public.create_ticket(subject text,body text) returns uuid language plpgsql security definer set search_path='' as $$ declare tid uuid; begin
 perform private.require_customer();
 insert into public.support_tickets(customer_id,subject) values(auth.uid(),subject) returning id into tid;
 insert into public.support_messages(ticket_id,author_id,body) values(tid,auth.uid(),body);
 insert into public.notifications(user_id,title,body,href) select id,'New support ticket',subject,'/manager/support' from public.profiles where role='manager';
 perform private.audit('support.created',tid::text); return tid;
end $$;
create function public.reply_ticket(tid uuid,body text) returns void language plpgsql security definer set search_path='' as $$ declare t public.support_tickets; begin
 select * into strict t from public.support_tickets where id=tid for update;
 if not public.is_staff() and (t.customer_id<>auth.uid() or not public.customer_access()) then raise exception 'Access denied'; end if;
 if auth.uid() is null or t.status='done' then raise exception 'Ticket is closed'; end if;
 insert into public.support_messages(ticket_id,author_id,body) values(tid,auth.uid(),body);
 update public.support_tickets set status=case when public.is_staff() then 'replied'::public.support_status else 'pending'::public.support_status end where id=tid;
 insert into public.notifications(user_id,title,body,href) values(t.customer_id,'Support reply','There is a new reply in your support ticket.','/customer/support');
 perform private.audit('support.replied',tid::text);
end $$;
create function public.resolve_ticket(tid uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform private.require_staff(); update public.support_tickets set status='done' where id=tid; if not found then raise exception 'Ticket not found'; end if; perform private.audit('support.resolved',tid::text);
end $$;
create function public.pending_notification_emails(limit_count int default 50) returns table(id uuid) language sql security definer set search_path='' as $$
 select n.id from public.notifications n left join public.email_deliveries e on e.notification_id=n.id where e.id is null order by n.created_at limit greatest(1,least(limit_count,100));
$$;

-- Only the service role can reserve/confirm provider operations. Caller identity is
-- verified by Edge Functions with auth.getUser(), never supplied by the browser.
create function public.begin_checkout(rid uuid,customer uuid,payment_intent text) returns public.payments language plpgsql security definer set search_path='' as $$
declare r public.reservations; p public.payments; amount bigint;
begin
 if public.maintenance_enabled() then raise exception 'Maintenance is enabled'; end if;
 select * into strict r from public.reservations where id=rid for update;
 if r.customer_id<>customer or r.status not in ('for_approval','pending','approved') or r.finalized_at is null or r.event_date<=(now() at time zone 'Asia/Manila')::date then raise exception 'Reservation is not payable'; end if;
 select * into p from public.payments where reservation_id=rid and status='pending';
 if found then
  if p.intent<>payment_intent or p.expires_at<=now() then raise exception 'Existing checkout requires provider reconciliation'; end if;
  return p;
 end if;
 if payment_intent='partial' and r.paid=0 then amount=(r.total+1)/2;
 elsif payment_intent='full' and r.paid=0 then amount=r.total;
 elsif payment_intent='balance' and r.paid>0 and r.paid<r.total then amount=r.total-r.paid;
 else raise exception 'Invalid payment intent'; end if;
 if amount<=0 then raise exception 'Nothing to pay'; end if;
 insert into public.payments(reservation_id,amount,intent) values(rid,amount,payment_intent) returning * into p;
 return p;
end $$;

create function public.confirm_provider_payment(event_id text,session_id text,provider_payment_id text,amount bigint) returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; r public.reservations; next_status public.reservation_status; total_paid bigint;
begin
 select * into strict p from public.payments where external_session_id=session_id for update;
 select * into strict r from public.reservations where id=p.reservation_id for update;
 if p.status='fully_paid' then return; end if;
 if p.status<>'pending' or p.amount<>amount or provider_payment_id is null or r.paid+amount>r.total then raise exception 'Payment does not match the pending checkout'; end if;
 insert into public.webhook_events(id,event_type) values(event_id,'checkout_session.payment.paid') on conflict do nothing;
 if not found then return; end if;
 total_paid=r.paid+amount; next_status=r.status;
 perform pg_advisory_xact_lock(hashtextextended('capacity:'||r.event_date::text,0));
 if r.status in ('for_approval','pending') and r.event_date>(now() at time zone 'Asia/Manila')::date and (select count(*) from public.reservations where event_date=r.event_date and holds_capacity)<3 then next_status='approved'; end if;
 update public.payments set status='fully_paid',external_payment_id=provider_payment_id where id=p.id;
 update public.reservations set paid=total_paid,payment_status=case when total_paid=total then 'fully_paid'::public.payment_status else 'partially_paid'::public.payment_status end,status=next_status where id=r.id;
 insert into public.balances values(r.id,r.total-total_paid,now()) on conflict(reservation_id) do update set amount=excluded.amount,updated_at=now();
 insert into public.transactions(reservation_id,payment_id,kind,amount,reference) values(r.id,p.id,'payment',amount,provider_payment_id);
 perform private.audit('payment.confirmed',p.id::text,jsonb_build_object('provider_payment_id',provider_payment_id,'event',event_id));
 perform private.notify(r.id,'Payment confirmed',case when next_status='approved' then 'Your payment and event date are confirmed.' else 'Payment received. Our team must confirm date capacity with you.' end);
end $$;

create function public.claim_refund(fid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.refunds; allocations jsonb; p public.payments; remaining bigint; portion bigint;
begin
 select * into strict f from public.refunds where id=fid for update;
 if f.status<>'approved' then raise exception 'Approved refund required'; end if;
 if not f.processing then
  remaining=f.eligible_amount;
  for p in select * from public.payments where reservation_id=f.reservation_id and status='fully_paid' order by created_at loop
   portion=least(remaining,p.amount);
   if portion>0 then insert into public.refund_operations(refund_id,payment_id,amount) values(fid,p.id,portion);remaining=remaining-portion; end if;
  end loop;
  if remaining<>0 then raise exception 'Payment allocation does not cover eligible refund'; end if;
  update public.refunds set processing=true where id=fid;
 end if;
 select jsonb_agg(jsonb_build_object('id',o.id,'amount',o.amount,'external_payment_id',pay.external_payment_id) order by pay.created_at) into allocations from public.refund_operations o join public.payments pay on pay.id=o.payment_id where o.refund_id=fid;
 return jsonb_build_object('refund',to_jsonb(f),'operations',allocations);
end $$;
create function public.claim_refund_operation(operation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation public.refund_operations;
begin
 select * into strict operation from public.refund_operations where id=operation_id for update;
 if operation.external_refund_id is not null then return to_jsonb(operation)||jsonb_build_object('newly_claimed',false); end if;
 if operation.claimed then raise exception 'An ambiguous provider operation needs reconciliation before retry'; end if;
 update public.refund_operations set claimed=true where id=operation_id;
 return to_jsonb(operation)||jsonb_build_object('newly_claimed',true);
end $$;
create function public.finish_refund(fid uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.refunds; r public.reservations; actual bigint;
begin
 select * into strict f from public.refunds where id=fid for update;
 if f.status='completed' then return; end if;
 if f.status<>'approved' or not f.processing then raise exception 'Refund is not processing'; end if;
 select coalesce(sum(amount),0) into actual from public.refund_operations where refund_id=fid and status='succeeded' and external_refund_id is not null;
 if actual<>f.eligible_amount then raise exception 'Provider has not confirmed the full eligible refund'; end if;
 select * into strict r from public.reservations where id=f.reservation_id for update;
 update public.refunds set status='completed',processing=false where id=fid;
 update public.reservations set refunded=actual,status='refunded',payment_status=case when actual=paid then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=r.id;
 update public.balances set amount=0,updated_at=now() where reservation_id=r.id;
 insert into public.transactions(reservation_id,kind,amount,reference) values(r.id,'refund',actual,'refund:'||fid::text);
 perform private.audit('refund.completed',fid::text,jsonb_build_object('amount',actual)); perform private.notify(r.id,'Refund completed','Your provider-confirmed refund has been recorded.');
end $$;

create function private.catalog_audit() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform private.audit(TG_TABLE_NAME||'.'||lower(TG_OP),coalesce(new.id,old.id)::text);
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger profile_lifecycle_audit after insert or update of full_name,phone,avatar_path on public.profiles for each row execute function private.catalog_audit();
do $$ declare t text; begin foreach t in array array['menu_sets','menu_categories','dishes','drinks','desserts','add_ons','event_setups','event_features','chair_types','table_types','gallery_images'] loop execute format('create trigger catalog_audit after insert or update or delete on public.%I for each row execute function private.catalog_audit()',t); end loop; end $$;

-- No implicit PUBLIC execute on definer functions.
revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function public.current_app_role(),public.is_staff(),public.maintenance_enabled(),public.customer_access(),public.can_read_reservation(uuid) to anon,authenticated;
grant execute on function public.available_dates(date,date),public.refund_eligibility(bigint,bigint) to anon,authenticated;
grant execute on function public.save_reservation(jsonb),public.finalize_reservation(uuid),public.request_cancellation(uuid,text),public.review_cancellation(uuid,boolean),public.request_refund(uuid),public.review_refund(uuid,boolean),public.request_reschedule(uuid,date,text),public.review_reschedule(uuid,boolean),public.manager_reservation_status(uuid,public.reservation_status),public.admin_set_role(uuid,public.app_role),public.update_setting(text,jsonb),public.submit_feedback(uuid,int,text),public.create_ticket(text,text),public.reply_ticket(uuid,text),public.resolve_ticket(uuid) to authenticated;
grant execute on function public.begin_checkout(uuid,uuid,text),public.confirm_provider_payment(text,text,text,bigint),public.claim_refund(uuid),public.claim_refund_operation(uuid),public.finish_refund(uuid),public.pending_notification_emails(int) to service_role;
grant all on all tables in schema public to service_role;
revoke update,delete,truncate on public.audit_logs from service_role;
