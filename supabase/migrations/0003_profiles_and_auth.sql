create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check(length(full_name)<=150),
 phone text not null default '' check(length(phone)<=30), avatar_path text,
 role public.app_role not null default 'customer', created_at timestamptz not null default now()
);
create function private.bootstrap_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),150));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_profile();
