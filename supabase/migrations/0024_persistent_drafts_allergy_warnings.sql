create table public.allergens(id text primary key check(id ~ '^[a-z_]+$'),name text not null);
insert into public.allergens values('seafood','Seafood'),('milk','Milk / dairy'),('egg','Egg'),('peanut','Peanut'),('tree_nuts','Tree nuts'),('soy','Soy'),('wheat','Wheat / gluten'),('sesame','Sesame');
alter table public.dishes add column allergen_info_reviewed boolean not null default false,add column allergen_revision bigint not null default 0;
create table public.dish_allergens(dish_id uuid references public.dishes on delete cascade,allergen_id text references public.allergens,primary key(dish_id,allergen_id));
-- Owner-provided Seafood menu category identifies possible seafood. It does not
-- establish a complete ingredient review or absence of any other allergen.
insert into public.dish_allergens select d.id,'seafood' from public.dishes d join public.menu_categories c on c.id=d.category_id where lower(c.name) in ('seafood','seafoods');
alter table public.reservations add column allergy_allergen_ids text[] not null default '{}',add column allergy_notes text not null default '' check(length(allergy_notes)<=2000),add column allergy_acknowledgments jsonb not null default '[]';
alter table public.allergens enable row level security;alter table public.dish_allergens enable row level security;
revoke all on public.allergens,public.dish_allergens from anon,authenticated;
grant select on public.allergens,public.dish_allergens to anon,authenticated;
grant all on public.allergens,public.dish_allergens to service_role;
create policy allergens_read on public.allergens for select using(true);
create policy dish_allergens_read on public.dish_allergens for select using(true);
create function public.configure_dish_allergens(did uuid,allergen_ids text[],reviewed boolean) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.require_staff();perform 1 from public.dishes where id=did for update;if not found then raise exception 'Dish not found';end if;
 if reviewed is null or allergen_ids is null or exists(select 1 from unnest(allergen_ids)a where not exists(select 1 from public.allergens where id=a)) then raise exception 'Choose known allergens';end if;
 delete from public.dish_allergens where dish_id=did;insert into public.dish_allergens select did,a from (select distinct unnest(allergen_ids)a)x;
 update public.dishes set allergen_info_reviewed=reviewed,allergen_revision=allergen_revision+1 where id=did;
 perform private.audit('dish.allergens_changed',did::text,jsonb_build_object('allergens',allergen_ids,'reviewed',reviewed));
end $$;
-- Allergen revisions/review state are changed through the audited RPC only.
revoke update on public.dishes from authenticated;
grant update(name,category_id,description,active,image_url,image_credit,image_source_url) on public.dishes to authenticated;
create function public.allergy_warnings(declared text[],notes text,dish_ids uuid[]) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('dish_id',d.id,'dish',d.name,'allergen_id',a.id,'allergen',a.name,'token',md5(coalesce((select string_agg(x,',' order by x) from unnest(declared)x),'')||coalesce(notes,'')||coalesce((select string_agg(x::text,',' order by x::text) from unnest(dish_ids)x),'')||d.id::text||a.id||d.allergen_revision::text)) order by d.name,a.name),'[]'::jsonb)
 from public.dishes d join public.dish_allergens da on da.dish_id=d.id join public.allergens a on a.id=da.allergen_id where d.id=any(dish_ids) and a.id=any(declared)
$$;
create function private.validate_allergy_ack(rid uuid,require_ack boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;warnings jsonb;w jsonb;
begin
 select * into strict r from public.reservations where id=rid;
 warnings=public.allergy_warnings(r.allergy_allergen_ids,r.allergy_notes,array(select dish_id from public.reservation_items where reservation_id=rid));
 if require_ack then for w in select value from jsonb_array_elements(warnings) loop
  if not exists(select 1 from jsonb_array_elements(r.allergy_acknowledgments)a where a->>'token'=w->>'token' and a->>'dish_id'=w->>'dish_id' and a->>'allergen_id'=w->>'allergen_id') then raise exception 'Allergy acknowledgment required for % (%). You may keep the dish after acknowledging the warning',w->>'dish',w->>'allergen';end if;
 end loop;end if;
end $$;
alter function public.save_reservation(jsonb) set schema private;
alter function private.save_reservation(jsonb) rename to save_reservation_before_allergy;
create function public.save_reservation(data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;declared text[];acks jsonb;note text;prior public.reservations;
begin
 perform private.require_customer();
 if nullif(data->>'id','') is not null then select * into prior from public.reservations where id=(data->>'id')::uuid and customer_id=auth.uid();data=jsonb_build_object('allergy_allergen_ids',coalesce(to_jsonb(prior.allergy_allergen_ids),'[]'::jsonb),'allergy_notes',coalesce(prior.allergy_notes,''),'allergy_acknowledgments',coalesce(prior.allergy_acknowledgments,'[]'::jsonb))||data;end if;
 if coalesce(jsonb_typeof(data->'allergy_allergen_ids'),'array')<>'array' or coalesce(jsonb_typeof(data->'allergy_acknowledgments'),'array')<>'array' then raise exception 'Invalid allergy declaration';end if;
 select coalesce(array_agg(distinct value),'{}') into declared from jsonb_array_elements_text(coalesce(data->'allergy_allergen_ids','[]'::jsonb));
 if exists(select 1 from unnest(declared)a where not exists(select 1 from public.allergens where id=a)) then raise exception 'Choose known allergens';end if;
 note=coalesce(data->>'allergy_notes','');acks=coalesce(data->'allergy_acknowledgments','[]'::jsonb);
 if length(note)>2000 or jsonb_array_length(acks)>200 then raise exception 'Allergy notes or acknowledgments too long';end if;
 rid=private.save_reservation_before_allergy(data);
 update public.reservations set allergy_allergen_ids=declared,allergy_notes=note,allergy_acknowledgments=acks where id=rid;
 perform private.validate_allergy_ack(rid,false);return rid;
end $$;
alter function public.finalize_reservation(uuid) set schema private;
alter function private.finalize_reservation(uuid) rename to finalize_reservation_before_allergy;
create function public.finalize_reservation(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.require_customer();if not exists(select 1 from public.reservations where id=rid and customer_id=auth.uid()) then raise exception 'Access denied';end if;
 perform private.validate_allergy_ack(rid,true);return private.finalize_reservation_before_allergy(rid);
end $$;

create table public.reservation_drafts(id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.profiles,data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=65536),wizard_step int not null default 0 check(wizard_step between 0 and 3),version int not null default 1,reservation_id uuid unique references public.reservations,submitted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.reservation_drafts enable row level security;revoke all on public.reservation_drafts from anon,authenticated;grant select on public.reservation_drafts to authenticated;grant all on public.reservation_drafts to service_role;
create policy drafts_read on public.reservation_drafts for select to authenticated using((customer_id=auth.uid() and public.customer_access()) or public.is_staff());
create function public.save_booking_draft(payload jsonb,did uuid default null,step int default 0,expected_version int default null,existing_reservation uuid default null) returns public.reservation_drafts language plpgsql security definer set search_path='' as $$
declare d public.reservation_drafts;r public.reservations;
begin
 perform private.require_customer();
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>65536 or step not between 0 and 3 then raise exception 'Invalid draft size or step';end if;
 if did is null and existing_reservation is not null then
  select * into strict r from public.reservations where id=existing_reservation for update;
  if r.customer_id<>auth.uid() or r.status<>'draft' or r.paid<>0 then raise exception 'Only your unpaid Draft can be continued';end if;
  perform private.no_checkout(r.id);select id into did from public.reservation_drafts where reservation_id=existing_reservation;
 end if;
 if did is not null then
  select * into strict d from public.reservation_drafts where id=did for update;
  if d.customer_id<>auth.uid() or d.submitted_at is not null then raise exception 'Draft unavailable or already submitted';end if;
  if expected_version is not null and expected_version<>d.version then raise exception 'This draft was updated in another tab. Reload to review the latest saved draft before replacing it';end if;
  update public.reservation_drafts set data=payload,wizard_step=step,version=version+1,updated_at=now() where id=did returning * into d;
 else
  if (select count(*) from public.reservation_drafts where customer_id=auth.uid() and submitted_at is null)>=30 then raise exception 'Finish an existing draft before starting another';end if;
  insert into public.reservation_drafts(customer_id,data,wizard_step,reservation_id) values(auth.uid(),payload,step,existing_reservation) returning * into d;
 end if;
 perform private.audit('draft.saved',d.id::text,jsonb_build_object('step',step,'version',d.version));return d;
end $$;
create function private.draft_submission_data(data jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb=data;chairs jsonb='[]';addons jsonb='[]';version int;guests int;chosen public.chair_types;quantity int;normal uuid;
begin
 if data ? 'chair_quantities' then
  select pricing_version into version from public.menu_sets where id=nullif(data->>'menu_set_id','')::uuid;guests=(data->>'guests')::int;
  if version=2 then
   select * into chosen from public.chair_types where id=nullif(data->>'chair_type_id','')::uuid and active;
   if chosen.id is not null then
    quantity=case when chosen.price=0 then guests else (data->>'elegant_chair_quantity')::int end;
    chairs=jsonb_build_array(jsonb_build_object('id',chosen.id,'quantity',quantity));
    if chosen.price>0 and quantity<guests then select id into normal from public.chair_types where name='Monoblock' and price=0 and active;chairs=chairs||jsonb_build_array(jsonb_build_object('id',normal,'quantity',guests-quantity));end if;
   end if;
  else select coalesce(jsonb_agg(jsonb_build_object('id',key,'quantity',value)),'[]'::jsonb) into chairs from jsonb_each(data->'chair_quantities') where (value::text)::numeric>0;end if;
  result=result||jsonb_build_object('chairs',chairs);
 end if;
 if data ? 'addon_quantities' then select coalesce(jsonb_agg(jsonb_build_object('id',key,'quantity',value)),'[]'::jsonb) into addons from jsonb_each(data->'addon_quantities') where (value::text)::numeric>0;result=result||jsonb_build_object('add_ons',addons);end if;
 return result;
end $$;
create function public.submit_booking_draft(did uuid,expected_version int) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.reservation_drafts;rid uuid;
begin
 perform private.require_customer();select * into strict d from public.reservation_drafts where id=did for update;
 if d.customer_id<>auth.uid() then raise exception 'Access denied';end if;
 if d.submitted_at is not null then return d.reservation_id;end if;
 if expected_version<>d.version then raise exception 'Draft changed; reload the saved version before finalizing';end if;
 rid=public.save_reservation(private.draft_submission_data(d.data)||jsonb_build_object('id',d.reservation_id));perform public.finalize_reservation(rid);
 update public.reservation_drafts set reservation_id=rid,submitted_at=now(),updated_at=now(),version=version+1 where id=did;
 perform private.audit('draft.finalized',rid::text,jsonb_build_object('draft_id',did,'reference',(select reservation_reference from public.reservations where id=rid)));return rid;
end $$;
revoke execute on function public.configure_dish_allergens(uuid,text[],boolean),public.allergy_warnings(text[],text,uuid[]),public.save_reservation(jsonb),public.finalize_reservation(uuid),public.save_booking_draft(jsonb,uuid,int,int,uuid),public.submit_booking_draft(uuid,int),private.validate_allergy_ack(uuid,boolean),private.save_reservation_before_allergy(jsonb),private.finalize_reservation_before_allergy(uuid) from public,anon,authenticated;
grant execute on function public.configure_dish_allergens(uuid,text[],boolean),public.allergy_warnings(text[],text,uuid[]),public.save_reservation(jsonb),public.finalize_reservation(uuid),public.save_booking_draft(jsonb,uuid,int,int,uuid),public.submit_booking_draft(uuid,int) to authenticated;
revoke execute on function private.draft_submission_data(jsonb) from public,anon,authenticated;
