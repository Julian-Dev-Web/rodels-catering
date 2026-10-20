alter table public.adjustment_refunds add column processing boolean not null default false,add column processing_by uuid references public.profiles;
alter table public.adjustment_refunds drop constraint adjustment_refunds_method_check;
alter table public.adjustment_refunds add constraint adjustment_refunds_method_check check(method in ('cash','bank_transfer','paymongo'));
create table public.adjustment_refund_operations(id uuid primary key default gen_random_uuid(),refund_id uuid not null references public.adjustment_refunds,payment_id uuid not null references public.payments,amount bigint not null check(amount>0),claimed boolean not null default false,external_refund_id text unique,status text not null default 'not_started' check(status in ('not_started','pending','processing','succeeded','failed')),unique(refund_id,payment_id));
alter table public.adjustment_refund_operations enable row level security;revoke all on public.adjustment_refund_operations from anon,authenticated;grant select on public.adjustment_refund_operations to authenticated;grant all on public.adjustment_refund_operations to service_role;
create policy adjustment_operations_staff on public.adjustment_refund_operations for select to authenticated using(public.is_staff());
create function public.claim_adjustment_refund(fid uuid,actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.adjustment_refunds;r public.reservations;p public.payments;remaining bigint;used bigint;portion bigint;ops jsonb;begin
 if not exists(select 1 from public.profiles where id=actor and role in ('manager','super_admin') and account_status='active') then raise exception 'Active staff initiator required';end if;
 select * into strict f from public.adjustment_refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status='completed' then return jsonb_build_object('completed',true,'operations','[]');end if;
 if f.status<>'approved' then raise exception 'Approved adjustment refund required';end if;perform private.no_checkout(r.id);
 if not f.processing then
  remaining=f.amount;if remaining>(private.payment_amounts(r)->>'refund_due')::bigint then raise exception 'Refund exceeds the excess verified funds';end if;
  for p in select * from public.payments where reservation_id=r.id and source='paymongo' and status='fully_paid' and voided_at is null and external_payment_id is not null order by created_at,id for update loop
   select coalesce(sum((x->>'amount')::bigint),0) into used from public.adjustment_refunds a cross join jsonb_array_elements(coalesce(a.payment_allocations,'[]'))x where a.reservation_id=r.id and a.status='completed' and x->>'payment_id'=p.id::text;
   select used+coalesce(sum(amount),0) into used from public.refund_operations where payment_id=p.id and status='succeeded';portion=least(remaining,greatest(p.amount-used,0));
   if portion>0 then insert into public.adjustment_refund_operations(refund_id,payment_id,amount) values(fid,p.id,portion);remaining=remaining-portion;end if;
  end loop;
  if remaining<>0 then raise exception 'Provider receipts do not cover this payout. Use the explicit actual cash/bank payout workflow';end if;
  update public.adjustment_refunds set processing=true,processing_by=actor where id=fid;perform private.audit('adjustment_refund.provider_started',fid::text,jsonb_build_object('initiated_by',actor,'reservation_id',r.id,'amount',f.amount));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'amount',o.amount,'external_payment_id',pay.external_payment_id) order by pay.created_at),'[]') into ops from public.adjustment_refund_operations o join public.payments pay on pay.id=o.payment_id where o.refund_id=fid;return jsonb_build_object('completed',false,'operations',ops);
end $$;
create function public.claim_adjustment_operation(operation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare o public.adjustment_refund_operations;f public.adjustment_refunds;begin
 select a.* into strict f from public.adjustment_refund_operations x join public.adjustment_refunds a on a.id=x.refund_id where x.id=operation_id for update of a;
 if f.status<>'approved' or not f.processing then raise exception 'Refund is not processing';end if;
 select * into strict o from public.adjustment_refund_operations where id=operation_id for update;
 if o.external_refund_id is not null then return to_jsonb(o)||jsonb_build_object('newly_claimed',false);end if;
 if o.claimed then raise exception 'Ambiguous provider refund requires reconciliation before retry';end if;
 update public.adjustment_refund_operations set claimed=true where id=o.id;return to_jsonb(o)||jsonb_build_object('newly_claimed',true);
end $$;
create function public.record_adjustment_operation(operation_id uuid,provider_id text,provider_status text) returns void language plpgsql security definer set search_path='' as $$declare o public.adjustment_refund_operations;f public.adjustment_refunds;r public.reservations;begin
 select a.* into strict f from public.adjustment_refund_operations x join public.adjustment_refunds a on a.id=x.refund_id where x.id=operation_id for update of a;
 select * into strict r from public.reservations where id=f.reservation_id for update;
 select * into strict o from public.adjustment_refund_operations where id=operation_id for update;
 if not o.claimed or nullif(provider_id,'') is null or provider_status is null or provider_status not in ('pending','processing','succeeded','failed') or (o.external_refund_id is not null and o.external_refund_id<>provider_id) or (o.status='succeeded' and provider_status<>'succeeded') then raise exception 'Invalid verified provider refund outcome';end if;
 if provider_status='succeeded' and o.status<>'succeeded' then
  if f.status<>'approved' or not f.processing or o.amount>r.paid-r.refunded-r.payment_reversed then raise exception 'Refund allocation exceeds verified receipts';end if;
  update public.reservations set refunded=refunded+o.amount where id=r.id;perform private.refresh_payment_state(r.id);
  insert into public.transactions(reservation_id,payment_id,kind,amount,reference,source,method,received_at) values(r.id,o.payment_id,'refund',o.amount,'adjustment-operation:'||o.id,'paymongo','paymongo',now());
  perform private.audit('adjustment_refund.provider_receipt',o.id::text,jsonb_build_object('refund_id',f.id,'reservation_id',r.id,'amount',o.amount,'provider_refund_id',provider_id));
 end if;
 update public.adjustment_refund_operations set external_refund_id=provider_id,status=provider_status where id=o.id;
end $$;
create function public.finish_adjustment_refund(fid uuid) returns void language plpgsql security definer set search_path='' as $$declare f public.adjustment_refunds;r public.reservations;actual bigint;allocations jsonb;begin
 select * into strict f from public.adjustment_refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status='completed' then return;end if;
 select coalesce(sum(o.amount),0),coalesce(jsonb_agg(jsonb_build_object('payment_id',o.payment_id,'amount',o.amount,'reference',coalesce(p.payment_reference,p.external_payment_id),'provider_refund_id',o.external_refund_id)),'[]') into actual,allocations from public.adjustment_refund_operations o join public.payments p on p.id=o.payment_id where o.refund_id=fid and o.status='succeeded' and o.external_refund_id is not null;
 if f.status<>'approved' or not f.processing or actual<>f.amount then raise exception 'Provider has not confirmed the full eligible excess refund';end if;
 update public.adjustment_refunds set status='completed',processing=false,completed_at=now(),paid_at=now(),completed_by=processing_by,method='paymongo',payment_allocations=allocations,proof_reference='Provider-confirmed refund allocations' where id=fid;
 perform private.audit('adjustment_refund.provider_completed',fid::text,jsonb_build_object('reservation_id',r.id,'amount',actual,'initiated_by',f.processing_by,'operations',allocations));
end $$;
-- A known rejection before a provider refund exists can be released for manual
-- payout. Ambiguous operations stay held until an operator reconciles them.
create function public.release_rejected_adjustment_operation(operation_id uuid) returns void language plpgsql security definer set search_path='' as $$declare o public.adjustment_refund_operations;begin
 select * into strict o from public.adjustment_refund_operations where id=operation_id for update;
 if o.external_refund_id is not null then raise exception 'A provider refund reference already exists';end if;
 update public.adjustment_refund_operations set claimed=false,status='failed' where id=o.id;
 perform private.audit('adjustment_refund.provider_rejected',o.refund_id::text,jsonb_build_object('operation_id',o.id));
end $$;
create function private.complete_receipt_details() returns trigger language plpgsql security definer set search_path='' as $$declare r public.reservations;details jsonb;begin
 if new.kind<>'payment' or new.payment_id is null then return new;end if;
 select * into strict r from public.reservations where id=new.reservation_id;
 details=jsonb_build_object('reservation_reference',r.reservation_reference,'event_name',r.event_name,'event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'package',(select name from public.menu_sets where id=r.menu_set_id),'dishes',(select coalesce(jsonb_agg(d.name order by d.name),'[]') from public.reservation_items x join public.dishes d on d.id=x.dish_id where x.reservation_id=r.id),'drink',(select name from public.drinks where id=r.drink_id),'dessert',(select name from public.desserts where id=r.dessert_id),'setup',(select s.name from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id where x.reservation_id=r.id),'address',r.address,'selections',r.selection_snapshot,'setup_inclusions',r.event_preferences->'setup_inclusions');
 update public.payments set quote_snapshot=coalesce(quote_snapshot,'{}')||details where id=new.payment_id;return new;
end $$;
create trigger complete_receipt_details before insert on public.transactions for each row execute function private.complete_receipt_details();
revoke execute on function private.complete_receipt_details() from public,anon,authenticated;
alter function public.complete_adjustment_refund(uuid,text,timestamptz,text,uuid) set schema private;alter function private.complete_adjustment_refund(uuid,text,timestamptz,text,uuid) rename to complete_adjustment_refund_before_provider_guard;
-- Renamed RPC uses positional arguments for its qualified parameters.
do $$begin execute replace(replace(replace(pg_get_functiondef('private.complete_adjustment_refund_before_provider_guard(uuid,text,timestamptz,text,uuid)'::regprocedure),'complete_adjustment_refund.paid_at','$3'),'complete_adjustment_refund.method','$2'),'complete_adjustment_refund.proof_reference','$4');end $$;
create function public.complete_adjustment_refund(fid uuid,method text,paid_at timestamptz,proof_reference text,idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare f public.adjustment_refunds;begin
 perform private.require_staff();select * into strict f from public.adjustment_refunds where id=fid for update;
 if f.status<>'completed' and exists(select 1 from public.adjustment_refund_operations where refund_id=fid and (claimed or external_refund_id is not null)) then raise exception 'Provider refund is processing or ambiguous. Reconcile it before manual payout';end if;
 update public.adjustment_refunds set processing=false where id=fid;return private.complete_adjustment_refund_before_provider_guard(fid,method,paid_at,proof_reference,idempotency_key);
end $$;
revoke execute on function private.complete_adjustment_refund_before_provider_guard(uuid,text,timestamptz,text,uuid),public.complete_adjustment_refund(uuid,text,timestamptz,text,uuid),public.claim_adjustment_refund(uuid,uuid),public.claim_adjustment_operation(uuid),public.record_adjustment_operation(uuid,text,text),public.finish_adjustment_refund(uuid),public.release_rejected_adjustment_operation(uuid) from public,anon,authenticated;
grant execute on function public.complete_adjustment_refund(uuid,text,timestamptz,text,uuid) to authenticated;
grant execute on function public.claim_adjustment_refund(uuid,uuid),public.claim_adjustment_operation(uuid),public.record_adjustment_operation(uuid,text,text),public.finish_adjustment_refund(uuid),public.release_rejected_adjustment_operation(uuid) to service_role;
alter function public.export_application_snapshot() set schema private;alter function private.export_application_snapshot() rename to export_application_snapshot_0037;
create function public.export_application_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$declare r jsonb=private.export_application_snapshot_0037();rows jsonb;n bigint;begin
 select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'),count(*) into rows,n from(select * from public.adjustment_refund_operations limit 50001)x;if n>50000 then raise exception 'Dataset too large for application export';end if;r=jsonb_set(r,'{tables}',(r->'tables')||jsonb_build_object('adjustment_refund_operations',rows));r=jsonb_set(r,'{counts}',(r->'counts')||jsonb_build_object('adjustment_refund_operations',n));if octet_length(r::text)>10485760 then raise exception 'Dataset too large for application export';end if;return r||jsonb_build_object('schema_version','0038_adjustment_provider_refunds.sql');
end $$;
revoke execute on function private.export_application_snapshot_0037(),public.export_application_snapshot() from public,anon,authenticated;grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
