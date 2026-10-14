-- Menu metadata and seating upgrade rules. Existing menu versions and saved
-- reservation totals are preserved; only new/edited quotes are calculated here.
alter table public.menu_sets
 add column if not exists max_guests int check(max_guests is null or max_guests>=min_guests),
 add column if not exists pricing_version int not null default 1 check(pricing_version in (1,2)),
 add column if not exists inclusions text[] not null default '{}',
 add column if not exists suggested_dishes jsonb not null default '[]' check(jsonb_typeof(suggested_dishes)='array');
alter table public.menu_sets alter column pricing_version set default 2;
alter table public.menu_sets alter column max_guests set default 1000;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='menu_guest_and_dish_limits_v2' and conrelid='public.menu_sets'::regclass) then
  alter table public.menu_sets add constraint menu_guest_and_dish_limits_v2 check(pricing_version=1 or (min_guests>=100 and max_guests is not null and max_guests<=1000 and dish_count between 3 and 6));
 end if;
end $$;
alter table public.event_setups add column if not exists description text not null default '';
alter table public.event_features add column if not exists required_setup_id uuid references public.event_setups;

-- Archiving choices must not hide customers' existing reservations through the
-- security-invoker summary view or remove access to their selected item names.
do $$ declare t text; predicate text; begin
 foreach t in array array['menu_sets','drinks','desserts','dishes','menu_categories','event_setups','chair_types','table_types','event_features','add_ons'] loop
  predicate=case t
   when 'menu_sets' then 'exists(select 1 from public.reservations r where r.menu_set_id=menu_sets.id)'
   when 'drinks' then 'exists(select 1 from public.reservations r where r.drink_id=drinks.id)'
   when 'desserts' then 'exists(select 1 from public.reservations r where r.dessert_id=desserts.id)'
   when 'dishes' then 'exists(select 1 from public.reservation_items x where x.dish_id=dishes.id)'
   when 'menu_categories' then 'exists(select 1 from public.dishes d where d.category_id=menu_categories.id)'
   when 'event_setups' then 'exists(select 1 from public.reservation_event_setups x where x.event_setup_id=event_setups.id)'
   when 'chair_types' then 'exists(select 1 from public.reservation_tables_chairs x where x.chair_type_id=chair_types.id)'
   when 'table_types' then 'exists(select 1 from public.reservation_tables_chairs x where x.table_type_id=table_types.id)'
   when 'event_features' then 'exists(select 1 from public.reservation_event_features x where x.event_feature_id=event_features.id)'
   when 'add_ons' then 'exists(select 1 from public.reservation_add_ons x where x.add_on_id=add_ons.id)'
  end;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname='catalog_history_read') then
   execute format('create policy catalog_history_read on public.%I for select to authenticated using (%s)',t,predicate);
  end if;
 end loop;
end $$;

create or replace function private.calculate_price(rid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.reservations; m public.menu_sets; menu bigint; setup bigint; features bigint; addons bigint; chairs bigint=0; tables bigint; extra bigint; seating record; quote jsonb;
begin
 select * into strict r from public.reservations where id=rid;
 select * into strict m from public.menu_sets where id=r.menu_set_id and active;
 if r.guests<m.min_guests then raise exception 'Guest count is below the package minimum (% guests)',m.min_guests; end if;
 if m.max_guests is not null and r.guests>m.max_guests then raise exception 'Guest count exceeds the package maximum (% guests)',m.max_guests; end if;
 if exists(select 1 from public.reservation_event_features x join public.event_features f on f.id=x.event_feature_id
   where x.reservation_id=rid and f.required_setup_id is not null and not exists(
    select 1 from public.reservation_event_setups s where s.reservation_id=rid and s.event_setup_id=f.required_setup_id)) then
  raise exception 'A selected upgrade requires its matching event setup';
 end if;
 menu=m.price*r.guests;
 select coalesce(sum(s.price),0) into setup from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id where x.reservation_id=rid and s.active;
 select coalesce(sum(s.price),0) into features from public.reservation_event_features x join public.event_features s on s.id=x.event_feature_id where x.reservation_id=rid and s.active;
 select coalesce(sum(s.price*x.quantity),0) into addons from public.reservation_add_ons x join public.add_ons s on s.id=x.add_on_id where x.reservation_id=rid and s.active;
 if m.pricing_version=2 then
  if exists(select 1 from public.reservation_tables_chairs where reservation_id=rid) and (
    (select count(*) from public.reservation_tables_chairs where reservation_id=rid)<>1 or
    (select coalesce(sum(chair_quantity),0) from public.reservation_tables_chairs where reservation_id=rid)<>r.guests) then
   raise exception 'Choose one chair type for all guests';
  end if;
  -- Basic seats have a zero surcharge. Upgrades apply to every guest, even
  -- when chair quantity equals guest count (not just to excess chairs).
  select coalesce(sum(s.price*x.chair_quantity),0) into chairs from public.reservation_tables_chairs x join public.chair_types s on s.id=x.chair_type_id where x.reservation_id=rid and s.active;
 else
  -- Preserve the original calculation for archived/legacy menu versions.
  select greatest(coalesce(sum(chair_quantity),0)-r.guests,0) into extra from public.reservation_tables_chairs where reservation_id=rid;
  for seating in select x.chair_quantity,s.price from public.reservation_tables_chairs x join public.chair_types s on s.id=x.chair_type_id where x.reservation_id=rid and s.active order by s.price desc loop
   chairs=chairs+least(extra,seating.chair_quantity)*seating.price; extra=greatest(extra-seating.chair_quantity,0);
  end loop;
 end if;
 select coalesce(sum(x.table_quantity*s.price),0) into tables from public.reservation_tables_chairs x join public.table_types s on s.id=x.table_type_id where x.reservation_id=rid and s.active;
 quote=jsonb_build_object('menu',menu,'setup',setup,'features',features,'add_ons',addons,'tables',tables,'total',menu+setup+features+addons+chairs+tables);
 return quote||jsonb_build_object(case when m.pricing_version=2 then 'chair_upgrade' else 'extra_chairs' end,chairs);
end $$;
revoke execute on function private.calculate_price(uuid) from public,anon,authenticated;
