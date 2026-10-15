-- Owner confirmed PHP 5,000 per Wedding inclusion and per Simple Buffet setup
-- extra on October 15, 2026. Existing reservation/financial rows are untouched.
update public.app_settings set value='{"stage_backdrop":500000,"elegant_chair":500000,"entrance":500000,"presidential_table":500000,"buffet_setup":500000,"diamond_dance_floor":500000}'::jsonb,updated_at=now() where key='wedding_component_prices';

alter function private.validate_event_preferences(uuid,jsonb) rename to validate_event_preferences_before_buffet;
create function private.validate_event_preferences(setup uuid,prefs jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare kind text; selected text[]; normalized jsonb;
begin
 select setup_kind into kind from public.event_setups where id=setup and active;
 if kind is distinct from 'buffet' then return private.validate_event_preferences_before_buffet(setup,prefs);end if;
 if prefs is null or jsonb_typeof(prefs)<>'object' then raise exception 'Invalid event preferences';end if;
 if prefs ? 'setup_inclusions' and jsonb_typeof(prefs->'setup_inclusions')<>'array' then raise exception 'Invalid setup inclusions';end if;
 select coalesce(array_agg(value),'{}') into selected from jsonb_array_elements_text(coalesce(prefs->'setup_inclusions','[]'::jsonb));
 if not selected <@ array['stage_backdrop','entrance','presidential_table','buffet_setup','diamond_dance_floor']::text[] or cardinality(selected)<>(select count(distinct x) from unnest(selected)x) then raise exception 'Invalid Simple Buffet setup extras';end if;
 normalized=private.validate_event_preferences_before_buffet(setup,prefs||jsonb_build_object('setup_inclusions','[]'::jsonb));
 return normalized||jsonb_build_object('setup_inclusions',to_jsonb(selected));
end $$;
alter function private.calculate_price(uuid) rename to calculate_price_before_buffet;
create function private.calculate_price(rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.reservations;quote jsonb;setup public.event_setups;amount bigint;prefs jsonb;
begin
 select * into strict r from public.reservations where id=rid;
 quote=private.calculate_price_before_buffet(rid);
 if r.booking_version=0 then return quote;end if;
 select s.* into setup from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id and s.active where x.reservation_id=rid;
 if setup.setup_kind='buffet' then
  prefs=private.validate_event_preferences(setup.id,r.event_preferences);
  amount=coalesce(setup.price,0)+jsonb_array_length(prefs->'setup_inclusions')*500000;
  return quote||jsonb_build_object('setup',amount,'total',(quote->>'total')::bigint-coalesce((quote->>'setup')::bigint,0)+amount);
 end if;
 return quote;
end $$;
alter function private.capture_selection_snapshot(uuid) rename to capture_selection_snapshot_before_buffet;
create function private.capture_selection_snapshot(rid uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;extra_rows jsonb;
begin
 perform private.capture_selection_snapshot_before_buffet(rid);
 select * into strict r from public.reservations where id=rid;
 if r.booking_version>0 and exists(select 1 from public.reservation_event_setups x join public.event_setups s on s.id=x.event_setup_id where x.reservation_id=rid and s.setup_kind='buffet') then
  select coalesce(jsonb_agg(jsonb_build_object('name',case k when 'stage_backdrop' then 'Stage Backdrop' when 'entrance' then 'Entrance' when 'presidential_table' then 'Presidential Table' when 'buffet_setup' then 'Buffet Styling Upgrade' when 'diamond_dance_floor' then 'Diamond Dance Floor' end,'quantity',1,'unit_amount',500000,'subtotal',500000,'basis','Optional Simple Buffet setup extra')),'[]'::jsonb) into extra_rows from jsonb_array_elements_text(r.event_preferences->'setup_inclusions')k;
  update public.reservations set selection_snapshot=coalesce(selection_snapshot,'[]'::jsonb)||extra_rows where id=rid;
 end if;
end $$;
revoke execute on function private.validate_event_preferences(uuid,jsonb),private.validate_event_preferences_before_buffet(uuid,jsonb),private.calculate_price(uuid),private.calculate_price_before_buffet(uuid),private.capture_selection_snapshot(uuid),private.capture_selection_snapshot_before_buffet(uuid) from public,anon,authenticated;

alter function public.export_application_snapshot() set schema private;
alter function private.export_application_snapshot() rename to export_application_snapshot_0021;
revoke execute on function private.export_application_snapshot_0021() from public,anon,authenticated;
create function public.export_application_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select private.export_application_snapshot_0021() || jsonb_build_object('schema_version','0022_buffet_extras_wedding_rates.sql')
$$;
revoke execute on function public.export_application_snapshot() from public,anon,authenticated;
grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
