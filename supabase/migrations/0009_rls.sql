-- Default-deny all domain tables. Writes to financial/state tables are RPC only.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_staff());
grant update(full_name,phone,avatar_path) on public.profiles to authenticated;
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() and public.customer_access()) with check(id=auth.uid());

do $$ declare t text; begin
 foreach t in array array['menu_sets','menu_categories','dishes','drinks','desserts','add_ons','event_setups','event_features','chair_types','table_types','gallery_images'] loop
  execute format('grant select on public.%I to anon',t);
  execute format('create policy catalog_read on public.%I for select using ((active and not public.maintenance_enabled()) or public.is_staff())',t);
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  if t in ('menu_categories','dishes','drinks','desserts') then
   execute format('create policy catalog_manage on public.%I for all to authenticated using(public.is_staff()) with check(public.is_staff())',t);
  else
   execute format('create policy catalog_manage on public.%I for all to authenticated using(public.current_app_role()=''super_admin'') with check(public.current_app_role()=''super_admin'')',t);
  end if;
 end loop;
end $$;
create policy reservation_read on public.reservations for select to authenticated using(public.can_read_reservation(id));
do $$ declare t text; begin
 foreach t in array array['reservation_items','reservation_event_setups','reservation_event_features','reservation_tables_chairs','reservation_add_ons','reservation_reschedules','reschedule_requests','payments','balances','transactions','cancellations','refunds'] loop
  execute format('create policy related_read on public.%I for select to authenticated using(public.can_read_reservation(reservation_id))',t);
 end loop;
end $$;
create policy feedback_read on public.feedback for select to authenticated using(public.is_staff() or (customer_id=auth.uid() and public.customer_access()));
create policy ticket_read on public.support_tickets for select to authenticated using(public.is_staff() or (customer_id=auth.uid() and public.customer_access()));
create policy message_read on public.support_messages for select to authenticated using(exists(select 1 from public.support_tickets t where t.id=ticket_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid() and (public.customer_access() or public.is_staff()));
grant update(read_at) on public.notifications to authenticated;
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid() and (public.customer_access() or public.is_staff())) with check(user_id=auth.uid());
grant select on public.app_settings to anon;
create policy settings_read on public.app_settings for select using(key in ('maintenance','refund_partial_rate','refund_full_rate') or public.current_app_role()='super_admin');
create policy audit_read on public.audit_logs for select to authenticated using(public.current_app_role()='super_admin');
-- No policies for webhook_events/email_deliveries: service role only.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']),('gallery','gallery',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy storage_read on storage.objects for select using(bucket_id in ('avatars','gallery'));
create policy avatar_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.customer_access());
create policy avatar_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.customer_access()) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text and public.customer_access());
create policy gallery_storage_manage on storage.objects for all to authenticated using(bucket_id='gallery' and public.current_app_role()='super_admin') with check(bucket_id='gallery' and public.current_app_role()='super_admin');
alter publication supabase_realtime add table public.notifications;
