-- Paid changes preserve receipts and use the existing catalog pricing, equipment,
-- consent and ingredient validators. Preview runs inside a rolled-back subtransaction:
-- no proposed selection, allocation, audit or timestamp becomes visible/persistent.
alter table public.reservations add column approved_revision int not null default 0;
create table public.reservation_changes(id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.reservations,base_revision int not null,payload jsonb not null,before_snapshot jsonb not null,proposal jsonb not null,quote_hash text not null,reason text not null default '' check(length(reason)<=2000),status text not null default 'pending' check(status in ('pending','approved','rejected')),requested_by uuid not null references public.profiles,created_at timestamptz not null default now(),reviewed_by uuid references public.profiles,reviewed_at timestamptz,decision_reason text check(length(decision_reason)<=2000));
create unique index one_pending_booking_change on public.reservation_changes(reservation_id) where status='pending';
create table public.adjustment_refunds(id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.reservations,amount bigint not null check(amount>0),reason text not null check(length(reason) between 5 and 2000),status text not null default 'requested' check(status in ('requested','approved','rejected','completed')),requested_by uuid not null references public.profiles,created_at timestamptz not null default now(),approved_by uuid references public.profiles,approved_at timestamptz,completed_by uuid references public.profiles,completed_at timestamptz,paid_at timestamptz,method text check(method in ('cash','bank_transfer')),proof_reference text,payment_allocations jsonb,completion_key uuid unique);
create unique index one_open_adjustment_refund on public.adjustment_refunds(reservation_id) where status in ('requested','approved');
alter table public.refunds add column manual_method text check(manual_method in ('cash','bank_transfer')),add column manual_paid_at timestamptz,add column manual_proof text,add column manual_completed_by uuid references public.profiles,add column manual_completion_key uuid unique;
do $$declare t text;begin foreach t in array array['reservation_changes','adjustment_refunds'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create policy booking_related_read on public.%I for select to authenticated using(public.can_read_reservation(reservation_id))',t);
 execute format('alter publication supabase_realtime add table public.%I',t);
end loop;end $$;

create function private.booking_change_snapshot(rid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event_name',r.event_name,'event_date',r.event_date,'event_time',r.event_time,'guests',r.guests,'package',(select name from public.menu_sets where id=r.menu_set_id),'dishes',(select coalesce(jsonb_agg(d.name order by d.name),'[]') from public.reservation_items x join public.dishes d on d.id=x.dish_id where x.reservation_id=r.id),'drink',(select name from public.drinks where id=r.drink_id),'dessert',(select name from public.desserts where id=r.dessert_id),'setup',(select s.name from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id where x.reservation_id=r.id),'inclusions',r.event_preferences->'setup_inclusions','address',r.address,'event_preferences',r.event_preferences,'selections',r.selection_snapshot,'allergy_allergen_ids',r.allergy_allergen_ids,'allergy_notes',r.allergy_notes,'allergy_warning_snapshot',r.allergy_warning_snapshot,'total',r.total,'pricing',r.pricing,'financial_snapshot',r.financial_snapshot,'revision',r.approved_revision) from public.reservations r where id=rid
$$;
create function private.assert_paid_change(rid uuid) returns public.reservations language plpgsql security definer set search_path='' as $$declare r public.reservations;begin
 select * into strict r from public.reservations where id=rid for update;
 if r.status not in ('pending','for_approval','approved') or r.finalized_at is null or r.paid-r.payment_reversed-r.refunded<=0 then raise exception 'Changes require an active paid booking';end if;
 if r.event_date<(now() at time zone 'Asia/Manila')::date+3 then raise exception 'Submit and approve booking changes at least 3 days before the event';end if;
 perform private.no_checkout(rid);
 if exists(select 1 from public.adjustment_refunds where reservation_id=rid and status in ('requested','approved')) then raise exception 'Resolve the open adjustment refund before changing this booking';end if;
 return r;
end $$;
create function private.apply_paid_selection(rid uuid,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations;m public.menu_sets;item jsonb;raw jsonb;f jsonb;tax jsonb;validated_address jsonb;prefs jsonb;begin
 r=private.assert_paid_change(rid);data=private.draft_submission_data(data);
 if (data->>'event_date')::date is distinct from r.event_date or (data->>'event_time')::time is distinct from r.event_time then raise exception 'Use the separate reschedule request to change the event date/time';end if;
 if data->>'consent_version' is distinct from public.booking_policy_version() or (data->>'consent_accepted')::boolean is distinct from true then raise exception 'Accept the current Terms and Privacy Notice';end if;
 perform private.assert_event_window(r.event_date,r.event_time,rid);
 validated_address=private.validate_event_address(data->'address');if r.address ? 'notes' and not(validated_address ? 'notes') then validated_address=validated_address||jsonb_build_object('notes',r.address->'notes');end if;
 prefs=private.validate_event_preferences((data->>'setup_id')::uuid,data->'event_preferences');
 select * into strict m from public.menu_sets where id=(data->>'menu_set_id')::uuid and active;
 if (data->>'guests')::numeric<>trunc((data->>'guests')::numeric) or (data->>'guests')::int not between greatest(m.min_guests,100) and least(coalesce(m.max_guests,1000),1000) then raise exception 'Choose a whole guest count within the current package limits (100-1000)';end if;
 if jsonb_array_length(data->'dish_ids')<>m.dish_count then raise exception 'Choose exactly % dishes',m.dish_count;end if;
 if not exists(select 1 from public.drinks where id=(data->>'drink_id')::uuid and active) or not exists(select 1 from public.desserts where id=(data->>'dessert_id')::uuid and active) or not exists(select 1 from public.event_setups where id=(data->>'setup_id')::uuid and active) then raise exception 'Choose an active drink, dessert and setup';end if;
 delete from public.reservation_tables_chairs where reservation_id=rid;
 update public.reservations set event_name=data->>'event_name',address=validated_address,guests=(data->>'guests')::int,menu_set_id=m.id,drink_id=(data->>'drink_id')::uuid,dessert_id=(data->>'dessert_id')::uuid,booking_version=1,event_preferences=prefs,consent_version=public.booking_policy_version(),consent_at=coalesce(consent_at,now()),allergy_allergen_ids=array(select jsonb_array_elements_text(coalesce(data->'allergy_allergen_ids','[]'))),allergy_notes=coalesce(data->>'allergy_notes',''),allergy_acknowledgments=coalesce(data->'allergy_acknowledgments','[]') where id=rid;
 delete from public.reservation_items where reservation_id=rid;
 for item in select value from jsonb_array_elements(data->'dish_ids') loop
  if not exists(select 1 from public.dishes where id=(item#>>'{}')::uuid and active) then raise exception 'Dish unavailable';end if;
  insert into public.reservation_items values(rid,(item#>>'{}')::uuid);
 end loop;
 delete from public.reservation_event_setups where reservation_id=rid;insert into public.reservation_event_setups values(rid,(data->>'setup_id')::uuid);
 delete from public.reservation_event_features where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'feature_ids','[]')) loop
  if not exists(select 1 from public.event_features where id=(item#>>'{}')::uuid and active) then raise exception 'Feature unavailable';end if;insert into public.reservation_event_features values(rid,(item#>>'{}')::uuid);
 end loop;
 delete from public.reservation_add_ons where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'add_ons','[]')) loop
  if (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::int not between 1 and 1000 or not exists(select 1 from public.add_ons where id=(item->>'id')::uuid and active) then raise exception 'Choose an available add-on and whole quantity (1-1000)';end if;insert into public.reservation_add_ons values(rid,(item->>'id')::uuid,(item->>'quantity')::int);
 end loop;
 delete from public.reservation_tables_chairs where reservation_id=rid;
 for item in select value from jsonb_array_elements(coalesce(data->'chairs','[]')) loop
  if (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::int not between 1 and (data->>'guests')::int or not exists(select 1 from public.chair_types where id=(item->>'id')::uuid and active) or not exists(select 1 from public.table_types where id=(data->>'table_type_id')::uuid and active) then raise exception 'Choose available seating and whole chair quantities';end if;
  insert into public.reservation_tables_chairs values(rid,(data->>'table_type_id')::uuid,(item->>'id')::uuid,0,(item->>'quantity')::int);
 end loop;
 if (select coalesce(sum(chair_quantity),0) from public.reservation_tables_chairs where reservation_id=rid)<>(data->>'guests')::int then raise exception 'Seat every guest exactly once';end if;
 perform private.sync_equipment(rid,true);perform private.validate_allergy_ack(rid,true);
 raw=private.calculate_price_before_tax(rid);
 -- Paid changes carry the original discount and tax agreement, including an
 -- already-consumed one-time offer. No current account promo is silently added.
 if r.financial_snapshot is null then raise exception 'Historical booking needs an accounting-reviewed tax/discount snapshot before revision';end if;
 tax=jsonb_build_object('mode',r.financial_snapshot->>'tax_mode','rate_bps',r.financial_snapshot->'rate_bps','business_confirmed',r.financial_snapshot->'business_confirmed');
 f=r.financial_snapshot||private.financial_quote((raw->>'total')::bigint,r.financial_snapshot->>'discount_kind',(r.financial_snapshot->>'discount_value')::bigint,tax);
 f=f-'captured_at';update public.reservations set pricing=raw||jsonb_build_object('total',(f->>'total')::bigint),total=(f->>'total')::bigint,financial_snapshot=f where id=rid;
 perform private.capture_selection_snapshot(rid);
 return private.booking_change_snapshot(rid);
end $$;
create function private.preview_paid_selection(rid uuid,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 begin result=private.apply_paid_selection(rid,data);raise exception using errcode='ZP001',message='rollback quote preview';exception when sqlstate 'ZP001' then null;end;
 -- Recipe timestamps change with each preview; identity is the risk token.
 return result||jsonb_build_object('quote_hash',md5((result-'allergy_warning_snapshot')::text||coalesce((select string_agg(x->>'token',',' order by x->>'dish_id') from jsonb_array_elements(result->'allergy_warning_snapshot')x),'')));
end $$;
create function public.preview_reservation_change(rid uuid,data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.require_customer();if not exists(select 1 from public.reservations where id=rid and customer_id=auth.uid()) then raise exception 'Reservation access required';end if;
 return private.preview_paid_selection(rid,data);
end $$;
create function public.request_reservation_change(rid uuid,data jsonb,expected_hash text,reason text default '') returns uuid language plpgsql security definer set search_path='' as $$declare proposal jsonb;cid uuid;r public.reservations;begin
 perform private.require_customer();select * into strict r from public.reservations where id=rid and customer_id=auth.uid() for update;proposal=private.preview_paid_selection(rid,data);
 if expected_hash is distinct from proposal->>'quote_hash' then raise exception 'Quotation changed. Review the current proposed quotation before submitting';end if;
 insert into public.reservation_changes(reservation_id,base_revision,payload,before_snapshot,proposal,quote_hash,reason,requested_by) values(rid,r.approved_revision,data,private.booking_change_snapshot(rid),proposal,expected_hash,coalesce(reason,''),auth.uid()) returning id into cid;
 perform private.audit('reservation.change_requested',cid::text,jsonb_build_object('reservation_id',rid,'old_total',r.total,'proposed_total',proposal->'total'));perform private.notify(rid,'Booking change requested','Your paid booking remains unchanged while the manager reviews your request.');return cid;
end $$;
create function public.review_reservation_change(change_id uuid,approve boolean,reason text default '') returns void language plpgsql security definer set search_path='' as $$declare c public.reservation_changes;r public.reservations;p jsonb;begin
 perform private.require_staff();select * into strict c from public.reservation_changes where id=change_id for update;select * into strict r from public.reservations where id=c.reservation_id for update;
 if c.status<>'pending' or approve is null or length(coalesce(reason,''))>2000 then raise exception 'Choose a pending request and valid decision';end if;
 if approve then
  if r.approved_revision<>c.base_revision or private.booking_change_snapshot(r.id) is distinct from c.before_snapshot then raise exception 'The agreed booking changed; reject this request and ask the customer to review a fresh proposal';end if;
  p=private.preview_paid_selection(r.id,c.payload);if p->>'quote_hash' is distinct from c.quote_hash then raise exception 'Catalog or ingredient quotation changed; reject this request and ask the customer to review the new quote';end if;
  perform private.apply_paid_selection(r.id,c.payload);update public.reservations set approved_revision=approved_revision+1,financial_snapshot=financial_snapshot||jsonb_build_object('captured_at',now()) where id=r.id;perform private.refresh_payment_state(r.id);
 end if;
 update public.reservation_changes set status=case when approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),decision_reason=coalesce(review_reservation_change.reason,'') where id=c.id;
 perform private.audit('reservation.change_reviewed',c.id::text,jsonb_build_object('reservation_id',r.id,'approved',approve,'previous_total',r.total,'new_total',case when approve then p->'total' else to_jsonb(r.total) end));perform private.notify(r.id,'Booking change '||case when approve then 'approved' else 'rejected' end,case when approve then 'The revised quotation is saved. Review the additional balance or refund due. Original payment receipts are preserved.' else 'Your original booking and payment amounts remain in place. '||coalesce(reason,'') end);
end $$;

create function public.request_adjustment_refund(rid uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$declare r public.reservations;fid uuid;due bigint;begin
 if not public.is_staff() then perform private.require_customer();end if;
 select * into strict r from public.reservations where id=rid for update;if not public.is_staff() and r.customer_id<>auth.uid() then raise exception 'Reservation access required';end if;
 perform private.no_checkout(rid);due=(private.payment_amounts(r)->>'refund_due')::bigint;
 if due<=0 or r.approved_revision=0 or exists(select 1 from public.reservation_changes where reservation_id=rid and status='pending') then raise exception 'An approved price adjustment with excess verified funds is required';end if;
 insert into public.adjustment_refunds(reservation_id,amount,reason,requested_by) values(rid,due,reason,auth.uid()) returning id into fid;
 perform private.audit('adjustment_refund.requested',fid::text,jsonb_build_object('reservation_id',rid,'amount',due));perform private.notify(rid,'Price adjustment refund requested','The excess verified payment is awaiting review. No cancellation deduction applies.');return fid;
end $$;
create function public.review_adjustment_refund(fid uuid,approve boolean) returns void language plpgsql security definer set search_path='' as $$declare f public.adjustment_refunds;r public.reservations;begin
 perform private.require_staff();select * into strict f from public.adjustment_refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status<>'requested' or approve is null then raise exception 'Choose a requested adjustment refund';end if;perform private.no_checkout(r.id);
 if approve and f.amount>(private.payment_amounts(r)->>'refund_due')::bigint then raise exception 'Refund exceeds the current excess payment';end if;
 update public.adjustment_refunds set status=case when approve then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now() where id=fid;perform private.audit('adjustment_refund.reviewed',fid::text,jsonb_build_object('approved',approve));perform private.notify(r.id,'Price adjustment refund reviewed',case when approve then 'Approved for payout. It is not refunded until the actual cash or bank payout is recorded.' else 'Request rejected. Please contact support.' end);
end $$;
create function public.complete_adjustment_refund(fid uuid,method text,paid_at timestamptz,proof_reference text,idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.adjustment_refunds;r public.reservations;p public.payments;remaining bigint;portion bigint;used bigint;allocations jsonb='[]';begin
 perform private.require_staff();select * into strict f from public.adjustment_refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status='completed' then if f.completion_key is distinct from idempotency_key then raise exception 'Payout already recorded';end if;return private.payment_amounts(r);end if;
 if f.status<>'approved' or idempotency_key is null or method is null or method not in ('cash','bank_transfer') or paid_at is null or paid_at>now()+interval '1 minute' or paid_at<f.created_at-interval '1 day' or length(trim(coalesce(proof_reference,''))) not between 3 and 500 then raise exception 'Confirm an approved actual payout, cash/bank method, received date and proof/reference';end if;
 perform private.no_checkout(r.id);if f.amount>(private.payment_amounts(r)->>'refund_due')::bigint then raise exception 'Refund exceeds the current excess payment';end if;
 remaining=f.amount;
 for p in select * from public.payments where reservation_id=r.id and status='fully_paid' and voided_at is null order by created_at,id for update loop
  select coalesce(sum((x->>'amount')::bigint),0) into used from public.adjustment_refunds a cross join jsonb_array_elements(coalesce(a.payment_allocations,'[]'))x where a.reservation_id=r.id and a.status='completed' and x->>'payment_id'=p.id::text;
  select used+coalesce(sum(amount),0) into used from public.refund_operations where payment_id=p.id and status='succeeded';portion=least(remaining,greatest(p.amount-used,0));
  if portion>0 then allocations=allocations||jsonb_build_array(jsonb_build_object('payment_id',p.id,'amount',portion,'reference',coalesce(p.payment_reference,p.external_payment_id,'Historical receipt')));remaining=remaining-portion;end if;
 end loop;
 if remaining<>0 then raise exception 'Original receipt allocation does not cover this payout';end if;
 update public.adjustment_refunds set status='completed',completed_by=auth.uid(),completed_at=now(),paid_at=complete_adjustment_refund.paid_at,method=complete_adjustment_refund.method,proof_reference=trim(complete_adjustment_refund.proof_reference),payment_allocations=allocations,completion_key=idempotency_key where id=f.id;
 update public.reservations set refunded=refunded+f.amount where id=r.id;perform private.refresh_payment_state(r.id);
 insert into public.transactions(reservation_id,kind,amount,reference,source,method,received_at,recorded_by) values(r.id,'refund',f.amount,'adjustment-refund:'||f.id,'manual',method,paid_at,auth.uid());
 perform private.audit('adjustment_refund.completed',f.id::text,jsonb_build_object('reservation_id',r.id,'amount',f.amount,'channel',method,'proof_reference',trim(proof_reference),'payments',allocations));select * into r from public.reservations where id=r.id;return private.payment_amounts(r);
end $$;

-- Retain the five-day / 10% cancellation policy. An earlier price-adjustment
-- payout or receipt correction is excluded from its paid basis.
alter function private.refund_quote(uuid,timestamptz) rename to refund_quote_before_receipt_corrections;
create function private.refund_quote(rid uuid,reference_time timestamptz) returns jsonb language plpgsql stable set search_path='' as $$declare r public.reservations;q jsonb;a jsonb;adjusted bigint;basis bigint;begin
 q=private.refund_quote_before_receipt_corrections(rid,reference_time);select * into strict r from public.reservations where id=rid;
 select coalesce(sum(amount),0) into adjusted from public.adjustment_refunds where reservation_id=rid and status='completed';basis=r.paid-r.payment_reversed-adjusted;
 if (r.payment_reversed>0 or adjusted>0) and basis>0 then a=private.refund_amounts(basis,r.refunded-adjusted);q=q||a||jsonb_build_object('previously_refunded',r.refunded);end if;
 if basis<=r.refunded-adjusted then q=q||jsonb_build_object('eligible',false,'eligible_amount',0,'reason','No remaining verified funds are refundable.');end if;return q;
end $$;
create or replace function public.claim_refund(fid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.refunds;r public.reservations;p public.payments;remaining bigint;portion bigint;used bigint;allocations jsonb;begin
 select * into strict f from public.refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status<>'approved' then raise exception 'Approved refund required';end if;
 if exists(select 1 from public.payments where reservation_id=r.id and source='manual' and voided_at is null and status='fully_paid') then raise exception 'This booking includes manual receipts. Record an actual cash/bank cancellation payout with proof instead of a provider refund';end if;
 if not f.processing then
  remaining=f.eligible_amount;if remaining>r.paid-r.refunded-r.payment_reversed then raise exception 'Refund exceeds net verified receipts';end if;
  for p in select * from public.payments where reservation_id=r.id and status='fully_paid' and source='paymongo' and voided_at is null order by created_at,id for update loop
   select coalesce(sum((x->>'amount')::bigint),0) into used from public.adjustment_refunds a cross join jsonb_array_elements(coalesce(a.payment_allocations,'[]'))x where a.reservation_id=r.id and a.status='completed' and x->>'payment_id'=p.id::text;
   portion=least(remaining,greatest(p.amount-used,0));if portion>0 then insert into public.refund_operations(refund_id,payment_id,amount) values(fid,p.id,portion);remaining=remaining-portion;end if;
  end loop;if remaining<>0 then raise exception 'Payment allocation does not cover eligible refund';end if;update public.refunds set processing=true where id=fid;
 end if;
 select jsonb_agg(jsonb_build_object('id',o.id,'amount',o.amount,'external_payment_id',pay.external_payment_id) order by pay.created_at) into allocations from public.refund_operations o join public.payments pay on pay.id=o.payment_id where o.refund_id=fid;
 return jsonb_build_object('refund',to_jsonb(f),'operations',allocations);
end $$;
create function public.complete_manual_cancellation_refund(fid uuid,method text,paid_at timestamptz,proof_reference text,idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare f public.refunds;r public.reservations;begin
 perform private.require_staff();select * into strict f from public.refunds where id=fid for update;select * into strict r from public.reservations where id=f.reservation_id for update;
 if f.status='completed' then if f.manual_completion_key is distinct from idempotency_key then raise exception 'Payout already recorded';end if;return private.payment_amounts(r);end if;
 if f.status<>'approved' or f.processing or exists(select 1 from public.refund_operations where refund_id=fid and (claimed or external_refund_id is not null)) then raise exception 'Reconcile any claimed provider operation before recording a manual payout';end if;
 if idempotency_key is null or method is null or method not in ('cash','bank_transfer') or paid_at is null or paid_at>now()+interval '1 minute' or paid_at<f.created_at-interval '1 day' or length(trim(coalesce(proof_reference,''))) not between 3 and 500 then raise exception 'Actual payout method, date and proof/reference required';end if;
 if f.eligible_amount>r.paid-r.refunded-r.payment_reversed then raise exception 'Payout exceeds net verified receipts';end if;
 update public.refunds set status='completed',manual_method=method,manual_paid_at=paid_at,manual_proof=trim(proof_reference),manual_completed_by=auth.uid(),manual_completion_key=idempotency_key where id=fid;
 update public.reservations set refunded=refunded+f.eligible_amount,status='refunded',payment_status=case when r.refunded+f.eligible_amount=r.paid-r.payment_reversed then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end where id=r.id;perform private.refresh_payment_state(r.id);
 insert into public.transactions(reservation_id,kind,amount,reference,source,method,received_at,recorded_by) values(r.id,'refund',f.eligible_amount,'manual-cancellation-refund:'||f.id,'manual',method,paid_at,auth.uid());perform private.audit('refund.manual_completed',fid::text,jsonb_build_object('reservation_id',r.id,'amount',f.eligible_amount,'method',method,'proof_reference',trim(proof_reference)));
 select * into r from public.reservations where id=r.id;return private.payment_amounts(r);
end $$;

-- Freeze cancellation rules while an adjustment is awaiting payment/refund, so
-- the two independent refund workflows cannot reserve the same funds.
alter function public.request_cancellation(uuid,text) set schema private;alter function private.request_cancellation(uuid,text) rename to request_cancellation_before_paid_changes;
create function public.request_cancellation(rid uuid,reason text) returns uuid language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.reservations where id=rid for update;
 if exists(select 1 from public.adjustment_refunds where reservation_id=rid and status in ('requested','approved')) or exists(select 1 from public.reservation_changes where reservation_id=rid and status='pending') then raise exception 'Resolve the pending booking change or adjustment refund before cancellation';end if;
 return private.request_cancellation_before_paid_changes(rid,reason);
end $$;
alter function public.void_manual_payment(uuid,text,uuid) set schema private;alter function private.void_manual_payment(uuid,text,uuid) rename to void_manual_payment_before_refund_guard;
create function public.void_manual_payment(payment_id uuid,reason text,idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare p public.payments;r public.reservations;begin
 perform private.require_staff();select * into strict p from public.payments where id=payment_id;select * into strict r from public.reservations where id=p.reservation_id for update;
 if p.voided_at is null and (r.status not in ('pending','for_approval','approved') or exists(select 1 from public.refunds where reservation_id=r.id and status in ('pending','approved','completed')) or exists(select 1 from public.adjustment_refunds where reservation_id=r.id and status in ('requested','approved')) or exists(select 1 from public.adjustment_refunds a cross join jsonb_array_elements(coalesce(a.payment_allocations,'[]'))x where a.status='completed' and x->>'payment_id'=p.id::text)) then raise exception 'A refund or closed booking is linked to this receipt. Reconcile with accounting before correcting it';end if;
 return private.void_manual_payment_before_refund_guard(payment_id,reason,idempotency_key);
end $$;
revoke execute on function private.void_manual_payment_before_refund_guard(uuid,text,uuid),public.void_manual_payment(uuid,text,uuid) from public,anon,authenticated;grant execute on function public.void_manual_payment(uuid,text,uuid) to authenticated;
create or replace function public.payment_summary(rid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare r public.reservations;begin
 if not public.can_read_reservation(rid) then raise exception 'Reservation access required';end if;select * into strict r from public.reservations where id=rid;
 return private.payment_amounts(r)||jsonb_build_object('pending_checkout',exists(select 1 from public.payments where reservation_id=rid and status='pending'),'additional_payment_due',r.approved_revision>0 and r.paid-r.refunded-r.payment_reversed>0 and r.total>r.paid-r.refunded-r.payment_reversed,'approved_revision',r.approved_revision);
end $$;
alter function public.reservation_activity(uuid) set schema private;alter function private.reservation_activity(uuid) rename to reservation_activity_before_paid_changes;
create function public.reservation_activity(rid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare old jsonb;begin
 old=private.reservation_activity_before_paid_changes(rid);
 return (select coalesce(jsonb_agg(x order by x->>'created_at' desc),'[]') from (
  select value x from jsonb_array_elements(old) where value->>'kind' not in ('payment','refund','reversal')
  union all select jsonb_build_object('created_at',created_at,'kind',kind,'description',case when kind='reversal' then 'Mistaken manual receipt corrected' when kind='refund' then 'Completed refund' when source='manual' then 'Manager recorded '||replace(method,'_',' ')||' payment' else 'Provider-verified payment' end,'amount',amount,'reason',null) from public.transactions where reservation_id=rid
  union all select jsonb_build_object('created_at',coalesce(reviewed_at,created_at),'kind','change','description','Booking change '||status,'reason',coalesce(decision_reason,reason),'amount',(proposal->>'total')::bigint) from public.reservation_changes where reservation_id=rid
  union all select jsonb_build_object('created_at',coalesce(completed_at,approved_at,created_at),'kind','adjustment_refund','description','Price adjustment refund '||status||' (no cancellation penalty)','reason',reason,'amount',amount) from public.adjustment_refunds where reservation_id=rid
 )items);
end $$;
revoke execute on function private.booking_change_snapshot(uuid),private.assert_paid_change(uuid),private.apply_paid_selection(uuid,jsonb),private.preview_paid_selection(uuid,jsonb),private.request_cancellation_before_paid_changes(uuid,text),private.reservation_activity_before_paid_changes(uuid),private.refund_quote_before_receipt_corrections(uuid,timestamptz),private.refund_quote(uuid,timestamptz) from public,anon,authenticated;
revoke execute on function public.complete_manual_cancellation_refund(uuid,text,timestamptz,text,uuid) from public,anon,authenticated;grant execute on function public.complete_manual_cancellation_refund(uuid,text,timestamptz,text,uuid) to authenticated;
revoke execute on function public.preview_reservation_change(uuid,jsonb),public.request_reservation_change(uuid,jsonb,text,text),public.review_reservation_change(uuid,boolean,text),public.request_adjustment_refund(uuid,text),public.review_adjustment_refund(uuid,boolean),public.complete_adjustment_refund(uuid,text,timestamptz,text,uuid),public.request_cancellation(uuid,text),public.reservation_activity(uuid) from public,anon,authenticated;
grant execute on function public.preview_reservation_change(uuid,jsonb),public.request_reservation_change(uuid,jsonb,text,text),public.review_reservation_change(uuid,boolean,text),public.request_adjustment_refund(uuid,text),public.review_adjustment_refund(uuid,boolean),public.complete_adjustment_refund(uuid,text,timestamptz,text,uuid),public.request_cancellation(uuid,text),public.reservation_activity(uuid) to authenticated;
alter function public.export_application_snapshot() set schema private;alter function private.export_application_snapshot() rename to export_application_snapshot_0035;
create function public.export_application_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$declare r jsonb=private.export_application_snapshot_0035();t text;rows jsonb;n bigint;begin
 foreach t in array array['reservation_changes','adjustment_refunds'] loop execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]''::jsonb),count(*) from(select * from public.%I limit 50001)x',t) into rows,n;if n>50000 then raise exception 'Dataset too large for application export';end if;r=jsonb_set(r,'{tables}',(r->'tables')||jsonb_build_object(t,rows));r=jsonb_set(r,'{counts}',(r->'counts')||jsonb_build_object(t,n));end loop;
 if octet_length(r::text)>10485760 then raise exception 'Dataset too large for application export';end if;return r||jsonb_build_object('schema_version','0036_paid_booking_changes.sql');
end $$;
revoke execute on function private.export_application_snapshot_0035(),public.export_application_snapshot() from public,anon,authenticated;grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
