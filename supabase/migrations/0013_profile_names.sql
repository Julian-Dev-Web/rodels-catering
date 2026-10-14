-- Incremental update for an already-installed project. Existing full names are
-- preserved; this migration never guesses how to split an existing name.
alter table public.profiles
 add column if not exists first_name text not null default '' check(length(first_name)<=60),
 add column if not exists middle_name text not null default '' check(length(middle_name)<=60),
 add column if not exists last_name text not null default '' check(length(last_name)<=60);

create or replace function private.normalize_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 new.first_name=btrim(new.first_name);
 new.middle_name=btrim(new.middle_name);
 new.last_name=btrim(new.last_name);
 if new.first_name<>'' or new.last_name<>'' or new.middle_name<>'' then
  if new.first_name='' or new.last_name='' then
   raise exception 'First and last name are required';
  end if;
  new.full_name=concat_ws(' ',new.first_name,nullif(new.middle_name,''),new.last_name);
 end if;
 if TG_OP='INSERT' or new.phone is distinct from old.phone then
  new.phone=regexp_replace(new.phone,'[[:space:]()-]','','g');
  if new.phone<>'' then
   if new.phone !~ '^(09[0-9]{9}|\+639[0-9]{9})$' then
    raise exception 'Enter a valid Philippine mobile number';
   end if;
   if left(new.phone,1)='0' then new.phone='+63'||substr(new.phone,2); end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists profile_normalization on public.profiles;
create trigger profile_normalization before insert or update on public.profiles
 for each row execute function private.normalize_profile();

create or replace function private.bootstrap_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,first_name,middle_name,last_name,phone)
 values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),150),
  coalesce(new.raw_user_meta_data->>'first_name',''),
  coalesce(new.raw_user_meta_data->>'middle_name',''),
  coalesce(new.raw_user_meta_data->>'last_name',''),
  coalesce(new.raw_user_meta_data->>'phone',''));
 return new;
end $$;

-- Restore structured names/phone supplied by new clients before this update.
-- This uses explicitly supplied fields only, and preserves incomplete legacy names.
update public.profiles p set
 first_name=btrim(u.raw_user_meta_data->>'first_name'),
 middle_name=btrim(coalesce(u.raw_user_meta_data->>'middle_name','')),
 last_name=btrim(u.raw_user_meta_data->>'last_name'),
 phone=case when p.phone='' and regexp_replace(coalesce(u.raw_user_meta_data->>'phone',''),'[[:space:]()-]','','g') ~ '^(09[0-9]{9}|\+639[0-9]{9})$'
  then u.raw_user_meta_data->>'phone' else p.phone end
from auth.users u where u.id=p.id and p.first_name='' and p.last_name=''
 and length(btrim(coalesce(u.raw_user_meta_data->>'first_name',''))) between 1 and 60
 and length(btrim(coalesce(u.raw_user_meta_data->>'last_name',''))) between 1 and 60
 and length(btrim(coalesce(u.raw_user_meta_data->>'middle_name','')))<=60
 and length(concat_ws(' ',btrim(u.raw_user_meta_data->>'first_name'),nullif(btrim(coalesce(u.raw_user_meta_data->>'middle_name','')),''),btrim(u.raw_user_meta_data->>'last_name')))<=150;

grant update(first_name,middle_name,last_name) on public.profiles to authenticated;
drop trigger if exists profile_lifecycle_audit on public.profiles;
create trigger profile_lifecycle_audit after insert or update of
 full_name,first_name,middle_name,last_name,phone,avatar_path on public.profiles
 for each row execute function private.catalog_audit();
revoke execute on function private.normalize_profile(),private.bootstrap_profile() from public,anon,authenticated;
