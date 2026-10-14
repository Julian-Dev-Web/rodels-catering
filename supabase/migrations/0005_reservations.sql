create table public.reservations(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.profiles,
 event_name text not null check(length(event_name) between 2 and 150), event_date date not null, event_time time not null default '12:00' check(event_time between '07:00'::time and '22:00'::time),
 address jsonb not null default '{}' check(jsonb_typeof(address)='object'), guests int not null check(guests between 1 and 10000),
 menu_set_id uuid not null references public.menu_sets, drink_id uuid references public.drinks, dessert_id uuid references public.desserts,
 status public.reservation_status not null default 'draft', holds_capacity boolean not null default false, payment_status public.payment_status not null default 'unpaid',
 total bigint not null default 0 check(total>=0), paid bigint not null default 0 check(paid>=0), refunded bigint not null default 0 check(refunded>=0),
 pricing jsonb not null default '{}', finalized_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),check(paid<=total),check(refunded<=paid)
);
create unique index one_active_customer_date on public.reservations(customer_id,event_date) where status not in ('cancelled','rejected','pending_refund','refund_approved','refunded');
create index reservation_date_status on public.reservations(event_date,status);
create index reservations_customer_created on public.reservations(customer_id,created_at desc);
create index reservations_status_created on public.reservations(status,created_at desc);
create table public.reservation_items(reservation_id uuid references public.reservations on delete cascade, dish_id uuid references public.dishes, primary key(reservation_id,dish_id));
create table public.reservation_event_setups(reservation_id uuid primary key references public.reservations on delete cascade, event_setup_id uuid not null references public.event_setups);
create table public.reservation_event_features(reservation_id uuid references public.reservations on delete cascade, event_feature_id uuid references public.event_features, primary key(reservation_id,event_feature_id));
create table public.reservation_tables_chairs(reservation_id uuid references public.reservations on delete cascade, table_type_id uuid references public.table_types, chair_type_id uuid references public.chair_types, table_quantity int not null default 0 check(table_quantity between 0 and 1000), chair_quantity int not null default 0 check(chair_quantity between 0 and 10000), primary key(reservation_id,chair_type_id));
create table public.reservation_add_ons(reservation_id uuid references public.reservations on delete cascade, add_on_id uuid references public.add_ons, quantity int not null default 1 check(quantity between 1 and 1000), primary key(reservation_id,add_on_id));
create table public.reservation_reschedules(id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.reservations,old_date date not null,new_date date not null,created_at timestamptz not null default now());
create index reschedules_month on public.reservation_reschedules(reservation_id,created_at);
create table public.reschedule_requests(id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.reservations,new_date date not null,reason text not null,status public.refund_status not null default 'pending',created_at timestamptz not null default now());
create unique index one_pending_reschedule on public.reschedule_requests(reservation_id) where status='pending';
