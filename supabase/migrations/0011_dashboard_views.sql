create view public.reservation_summary with (security_invoker=true) as select r.*,m.name as package_name,p.full_name as customer_name from public.reservations r join public.menu_sets m on m.id=r.menu_set_id join public.profiles p on p.id=r.customer_id;
grant select on public.reservation_summary to authenticated;
create function public.dashboard_metrics() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; today date=(now() at time zone 'Asia/Manila')::date; this_month timestamp=date_trunc('month',now() at time zone 'Asia/Manila');
begin
 perform private.require_staff();
 select jsonb_build_object(
 'today_revenue',coalesce((select sum(amount) from public.transactions where kind='payment' and (created_at at time zone 'Asia/Manila')::date=today),0),
 'today_bookings',(select count(*) from public.reservations where (created_at at time zone 'Asia/Manila')::date=today),
 'customers',(select count(*) from public.profiles where role='customer'),
 'pending',(select count(*) from public.reservations where status='for_approval'),
 'current_month_bookings',(select count(*) from public.reservations where status in ('approved','completed') and event_date>=this_month::date and event_date<(this_month+interval '1 month')::date),
 'previous_month_bookings',(select count(*) from public.reservations where status in ('approved','completed') and event_date>=(this_month-interval '1 month')::date and event_date<this_month::date),
 'current_month_users',(select count(distinct customer_id) from public.reservations where status in ('approved','completed') and event_date>=this_month::date and event_date<(this_month+interval '1 month')::date),
 'previous_month_users',(select count(distinct customer_id) from public.reservations where status in ('approved','completed') and event_date>=(this_month-interval '1 month')::date and event_date<this_month::date),
 'current_month_revenue',coalesce((select sum(amount) from public.transactions where kind='payment' and created_at>=this_month at time zone 'Asia/Manila'),0),
 'previous_month_revenue',coalesce((select sum(amount) from public.transactions where kind='payment' and created_at>=(this_month-interval '1 month') at time zone 'Asia/Manila' and created_at<this_month at time zone 'Asia/Manila'),0),
 'top_packages',coalesce((select jsonb_agg(x) from (select m.name,count(*) as bookings from public.reservations r join public.menu_sets m on m.id=r.menu_set_id where r.status in ('approved','completed') group by m.name order by bookings desc limit 5)x),'[]'::jsonb),
 'weekly',coalesce((select jsonb_agg(x order by x.period) from (select date_trunc('week',event_date::timestamp)::date as period,count(*) as bookings from public.reservations where status in ('approved','completed') and event_date>=today-interval '12 weeks' and event_date<=today group by 1)x),'[]'::jsonb),
 'monthly',coalesce((select jsonb_agg(x order by x.period) from (select date_trunc('month',event_date::timestamp)::date as period,count(*) as bookings from public.reservations where status in ('approved','completed') and event_date>=today-interval '12 months' group by 1)x),'[]'::jsonb),
 'setup_counts',coalesce((select jsonb_agg(x) from (select s.name,count(*) as bookings from public.reservation_event_setups e join public.event_setups s on s.id=e.event_setup_id group by s.name)x),'[]'::jsonb)
 ) into result; return result;
end $$;
revoke execute on function public.dashboard_metrics() from public,anon;
grant execute on function public.dashboard_metrics() to authenticated;
