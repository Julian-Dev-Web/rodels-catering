-- Normalize only empty optional values. Required fields, owner checks, financial
-- calculations, stock checks and finalization rules remain authoritative.
create function private.normalize_booking_optionals(data jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb=data;key text;entry record;quantity numeric;maximum int;
begin
 if data is null or jsonb_typeof(data)<>'object' then return data;end if;
 foreach key in array array['feature_ids','add_ons','allergy_allergen_ids','allergy_acknowledgments'] loop
  if result->key='null'::jsonb then result=jsonb_set(result,array[key],'[]'::jsonb);end if;
 end loop;
 if result->'event_preferences'='null'::jsonb then result=jsonb_set(result,'{event_preferences}','{}'::jsonb);end if;
 if result#>'{event_preferences,setup_inclusions}'='null'::jsonb then result=jsonb_set(result,'{event_preferences,setup_inclusions}','[]'::jsonb);end if;
 foreach key in array array['addon_quantities','chair_quantities'] loop
  if result->key='null'::jsonb then result=jsonb_set(result,array[key],'{}'::jsonb);end if;
  if jsonb_typeof(result->key)='object' then
   for entry in select * from jsonb_each(result->key) loop
    if entry.value='null'::jsonb or (jsonb_typeof(entry.value)='string' and btrim(entry.value#>>'{}')='') then result=jsonb_set(result,array[key,entry.key],'0'::jsonb);
    else
     maximum=case when key='addon_quantities' then 1000 else 10000 end;
     begin quantity=(entry.value#>>'{}')::numeric;exception when others then raise exception 'Enter valid whole-number optional quantities';end;
     if quantity is null or quantity<0 or quantity>maximum or quantity<>trunc(quantity) then raise exception 'Optional quantities must be whole numbers from 0 to %',maximum;end if;
    end if;
   end loop;
  end if;
 end loop;
 return result;
end $$;

alter function public.save_reservation(jsonb) set schema private;
alter function private.save_reservation(jsonb) rename to save_reservation_before_optional_fields;
create function public.save_reservation(data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.reservations;
begin
 perform private.require_customer();data=private.normalize_booking_optionals(data);
 -- New clients no longer submit venue notes. Carry the owner's saved notes
 -- forward when editing; never copy another customer's address or notes.
 if nullif(data->>'id','') is not null and jsonb_typeof(data->'address')='object' and not (data->'address' ? 'notes') then
  select * into prior from public.reservations where id=(data->>'id')::uuid and customer_id=auth.uid() for update;
  if prior.address ? 'notes' then data=jsonb_set(data,'{address,notes}',prior.address->'notes');end if;
 end if;
 return private.save_reservation_before_optional_fields(data);
end $$;
alter function private.draft_submission_data(jsonb) rename to draft_submission_data_before_optional_fields;
create function private.draft_submission_data(data jsonb) returns jsonb language sql stable set search_path='' as $$
 select private.draft_submission_data_before_optional_fields(private.normalize_booking_optionals(data))
$$;

alter function public.export_application_snapshot() set schema private;
alter function private.export_application_snapshot() rename to export_application_snapshot_0032;
create function public.export_application_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select private.export_application_snapshot_0032()||jsonb_build_object('schema_version','0033_optional_booking_fields.sql')
$$;
revoke execute on function private.normalize_booking_optionals(jsonb),private.save_reservation_before_optional_fields(jsonb),private.draft_submission_data_before_optional_fields(jsonb),private.draft_submission_data(jsonb),private.export_application_snapshot_0032() from public,anon,authenticated;
revoke execute on function public.save_reservation(jsonb),public.export_application_snapshot() from public,anon,authenticated;
grant execute on function public.save_reservation(jsonb) to authenticated;
grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
