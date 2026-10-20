-- Add optional selection metadata without rewriting existing offers or quotes.
alter table public.customer_discount_assignments add column expiration_option text
 check(expiration_option in ('none','30_days','90_days','specific_date'));
alter table public.customer_discount_assignments add constraint account_expiration_selection
 check(expiration_option is null or (expiration_option='none' and expires_on is null)
 or (expiration_option in ('30_days','90_days','specific_date') and expires_on is not null));

create function private.discount_expiration(option text,specific date,assigned_at timestamptz) returns date
language plpgsql stable set search_path='' as $$
declare today date=(assigned_at at time zone 'Asia/Manila')::date;
begin
 if option is null or option not in ('none','30_days','90_days','specific_date') then raise exception 'Choose a valid expiration option';end if;
 if option<>'specific_date' and specific is not null then raise exception 'Preset expiration is calculated by the server; do not supply a manual date';end if;
 if option='none' then return null;
 elsif option='30_days' then return today+30;
 elsif option='90_days' then return today+90;
 else
  if specific is null or not isfinite(specific) or specific<today then raise exception 'Choose today or a future expiration date (Manila)';end if;
  return specific;
 end if;
end $$;

-- Keep the five-argument API compatible with existing clients (manual dates).
-- New clients supply an explicit option; a preset never trusts a browser date.
create or replace function public.save_customer_discount(customer_id uuid,percentage_bps int,usage_type text,expires_on date,expected_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles;offer uuid;instant timestamptz;deadline date;selection text;
begin
 perform private.require_staff();select * into strict p from public.profiles where id=customer_id for update;
 if p.account_discount_id is distinct from expected_assignment_id then raise exception 'This customer discount changed. Refresh the customer list and try again';end if;
 instant=clock_timestamp();selection=case when expires_on is null then 'none' else 'specific_date' end;
 deadline=private.discount_expiration(selection,expires_on,instant);
 offer=private.assign_account_offer(customer_id,percentage_bps,usage_type,deadline,case when percentage_bps=0 then 'Removed in Customer Management' else 'Assigned in Customer Management' end);
 if offer is not null then update public.customer_discount_assignments set expiration_option=selection,assigned_at=instant where id=offer;end if;
 return jsonb_build_object('customer_name',p.full_name,'previous_bps',p.account_discount_bps,'percentage_bps',percentage_bps,'assignment_id',offer,'usage_type',usage_type,'expires_on',deadline);
end $$;

create function public.save_customer_discount(customer_id uuid,percentage_bps int,usage_type text,expires_on date,expected_assignment_id uuid,expiration_option text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;instant timestamptz;deadline date;offer uuid;
begin
 perform private.require_staff();
 -- Capture the assignment clock AFTER waiting for concurrent customer edits.
 perform 1 from public.profiles where id=customer_id for update;
 instant=clock_timestamp();deadline=private.discount_expiration(expiration_option,expires_on,instant);
 result=public.save_customer_discount(customer_id,percentage_bps,usage_type,deadline,expected_assignment_id);
 offer=(result->>'assignment_id')::uuid;
 if offer is not null then
  update public.customer_discount_assignments set expiration_option=save_customer_discount.expiration_option,assigned_at=instant where id=offer;
  perform private.audit('account_discount.expiration_set',offer::text,jsonb_build_object('customer_id',customer_id,'expiration_option',expiration_option,'expires_on',deadline,'assigned_at',instant,'timezone','Asia/Manila'));
 end if;
 return result||jsonb_build_object('expiration_option',expiration_option,'expires_on',deadline,'assigned_at',instant);
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
 a.id as assignment_id,a.usage_type,a.expires_on,private.account_discount_status(a) as discount_status,
 coalesce(a.expiration_option,case when a.expires_on is null then 'none' else 'specific_date' end) as expiration_option
 from public.profiles p join auth.users u on u.id=p.id left join public.customer_discount_assignments a on a.id=p.account_discount_id
 where p.role='customer' and (term='' or strpos(lower(p.full_name),term)>0 or strpos(lower(coalesce(u.email,'')),term)>0)
 order by p.full_name,p.id limit page_size offset page_number*page_size)x;
 return jsonb_build_object('customers',result,'total',total,'min_bps',0,'max_bps',10000,'business_cap_configured',false,
 'server_today',(clock_timestamp() at time zone 'Asia/Manila')::date);
end $$;

alter function public.export_application_snapshot() set schema private;
alter function private.export_application_snapshot() rename to export_application_snapshot_0031;
create function public.export_application_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select private.export_application_snapshot_0031()||jsonb_build_object('schema_version','0032_discount_expiration_options.sql')
$$;
revoke execute on function private.discount_expiration(text,date,timestamptz),private.export_application_snapshot_0031() from public,anon,authenticated;
revoke execute on function public.save_customer_discount(uuid,int,text,date,uuid,text),public.export_application_snapshot() from public,anon,authenticated;
grant execute on function public.save_customer_discount(uuid,int,text,date,uuid,text) to authenticated;
grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
