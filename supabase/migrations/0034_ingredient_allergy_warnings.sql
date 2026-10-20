-- No recipes are inferred from dish names or category tags. Existing dishes
-- start unreviewed until catering staff enter and explicitly confirm a recipe.
create table public.recipe_ingredients(
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 2 and 150),
 normalized_name text not null,aliases text[] not null default '{}',definition_key text not null unique,
 created_by uuid references public.profiles on delete set null,created_at timestamptz not null default now()
);
create table public.ingredient_allergens(ingredient_id uuid references public.recipe_ingredients on delete cascade,allergen_id text references public.allergens,primary key(ingredient_id,allergen_id));
create table public.dish_ingredients(dish_id uuid references public.dishes on delete cascade,ingredient_id uuid references public.recipe_ingredients,component_of text not null default '' check(length(component_of)<=150),source_note text not null default '' check(length(source_note)<=500),position int not null default 0,primary key(dish_id,ingredient_id,component_of));
alter table public.dishes add column ingredient_review_state text not null default 'not_reviewed' check(ingredient_review_state in ('not_reviewed','incomplete','verified')),
 add column ingredient_updated_at timestamptz,add column ingredient_reviewed_at timestamptz,add column ingredient_reviewed_by uuid references public.profiles on delete set null,
 add column cross_contact_allergen_ids text[] not null default '{}',add column cross_contact_notes text not null default '',add column recipe_revision bigint not null default 0;
alter table public.reservations add column allergy_warning_snapshot jsonb not null default '[]',add column allergy_acknowledged_at timestamptz;

create function private.ingredient_key(value text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(lower(coalesce(value,'')),'[^[:alnum:]]+',' ','g'))
$$;
create function private.canonical_allergen(value text) returns text language sql immutable set search_path='' as $$
 select case value when 'milk_dairy' then 'milk' when 'wheat_gluten' then 'wheat' when 'fish' then 'seafood' when 'shellfish' then 'seafood' when 'crustaceans' then 'seafood' when 'mollusks' then 'seafood' else value end
$$;
create function private.recipe_json(did uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'aliases',i.aliases,'component_of',di.component_of,'source_note',di.source_note,'allergen_ids',coalesce((select jsonb_agg(ia.allergen_id order by ia.allergen_id) from public.ingredient_allergens ia where ia.ingredient_id=i.id),'[]'::jsonb)) order by di.position,i.name,di.component_of),'[]'::jsonb)
 from public.dish_ingredients di join public.recipe_ingredients i on i.id=di.ingredient_id where di.dish_id=did
$$;
create function public.dish_recipe(did uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.dishes;
begin
 if not (public.is_staff() or public.customer_access()) then raise exception 'Authenticated catering access required';end if;
 select * into strict d from public.dishes where id=did and (active or public.is_staff());
 return jsonb_build_object('ingredients',private.recipe_json(did),'review_state',d.ingredient_review_state,'cross_contact_allergen_ids',d.cross_contact_allergen_ids,'cross_contact_notes',d.cross_contact_notes,'revision',d.recipe_revision,'updated_at',d.ingredient_updated_at,'reviewed_at',d.ingredient_reviewed_at);
end $$;
create function public.recipe_review_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform private.require_staff();
 return coalesce((select jsonb_agg(x order by (x.ingredient_review_state='verified'),x.booking_count desc,x.name) from (select d.id,d.name,d.active,d.ingredient_review_state,(select count(*) from public.dish_ingredients where dish_id=d.id) as ingredient_count,(select count(*) from public.reservation_items where dish_id=d.id) as booking_count from public.dishes d)x),'[]');
end $$;

create function public.save_dish_recipe(did uuid,recipe jsonb,review_state text,cross_contacts text[] default '{}',cross_notes text default '',confirm_review boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;ingredient uuid;ingredient_name text;aliases text[];tags text[];fingerprint text;position int=0;contacts text[];
begin
 perform private.require_staff();perform 1 from public.dishes where id=did for update;if not found then raise exception 'Dish not found';end if;
 if recipe is null or jsonb_typeof(recipe)<>'array' or jsonb_array_length(recipe)>100 or review_state is null or review_state not in ('incomplete','verified') or length(coalesce(cross_notes,''))>2000 then raise exception 'Invalid ingredient review';end if;
 if review_state='verified' and (not coalesce(confirm_review,false) or jsonb_array_length(recipe)=0) then raise exception 'Enter actual ingredients and explicitly confirm the complete recipe before marking verified';end if;
 select coalesce(array_agg(distinct private.canonical_allergen(x) order by private.canonical_allergen(x)),'{}') into contacts from unnest(coalesce(cross_contacts,'{}'))x;
 if exists(select 1 from unnest(contacts)x where not exists(select 1 from public.allergens where id=x)) then raise exception 'Choose known cross-contact allergens';end if;
 delete from public.dish_ingredients where dish_id=did;
 for item in select value from jsonb_array_elements(recipe) loop
  ingredient_name=trim(coalesce(item->>'name',''));
  if length(ingredient_name) not between 2 and 150 or private.ingredient_key(ingredient_name)='' or coalesce(jsonb_typeof(item->'aliases'),'array')<>'array' or coalesce(jsonb_typeof(item->'allergen_ids'),'array')<>'array' or length(coalesce(item->>'component_of',''))>150 or length(coalesce(item->>'source_note',''))>500 then raise exception 'Enter valid ingredient names, aliases and label/recipe notes';end if;
  select coalesce(array_agg(distinct private.ingredient_key(x) order by private.ingredient_key(x)) filter(where private.ingredient_key(x)<>''),'{}') into aliases from jsonb_array_elements_text(coalesce(item->'aliases','[]'))x;
  select coalesce(array_agg(distinct private.canonical_allergen(x) order by private.canonical_allergen(x)),'{}') into tags from jsonb_array_elements_text(coalesce(item->'allergen_ids','[]'))x;
  if cardinality(aliases)>30 or exists(select 1 from unnest(aliases)x where length(x) not between 2 and 150) or exists(select 1 from unnest(tags)x where not exists(select 1 from public.allergens where id=x)) then raise exception 'Choose known allergens and valid ingredient aliases';end if;
  -- Ingredient definitions are immutable. A different brand/tag/alias definition
  -- gets a separate identifier, never silently changing another dish's recipe.
  fingerprint=md5(jsonb_build_array(private.ingredient_key(ingredient_name),aliases,tags)::text);
  insert into public.recipe_ingredients(name,normalized_name,aliases,definition_key,created_by) values(ingredient_name,private.ingredient_key(ingredient_name),aliases,fingerprint,auth.uid()) on conflict(definition_key) do nothing;
  select id into strict ingredient from public.recipe_ingredients where definition_key=fingerprint;
  insert into public.ingredient_allergens select ingredient,x from unnest(tags)x on conflict do nothing;
  insert into public.dish_ingredients(dish_id,ingredient_id,component_of,source_note,position) values(did,ingredient,trim(coalesce(item->>'component_of','')),trim(coalesce(item->>'source_note','')),position);
  position=position+1;
 end loop;
 delete from public.dish_allergens where dish_id=did;
 insert into public.dish_allergens select distinct did,ia.allergen_id from public.dish_ingredients di join public.ingredient_allergens ia on ia.ingredient_id=di.ingredient_id where di.dish_id=did;
 update public.dishes set ingredient_review_state=review_state,ingredient_updated_at=clock_timestamp(),ingredient_reviewed_at=case when review_state='verified' then clock_timestamp() else null end,ingredient_reviewed_by=case when review_state='verified' then auth.uid() else null end,cross_contact_allergen_ids=contacts,cross_contact_notes=coalesce(cross_notes,''),recipe_revision=recipe_revision+1,allergen_revision=allergen_revision+1,allergen_info_reviewed=review_state='verified' where id=did;
 perform private.audit('dish.recipe_saved',did::text,jsonb_build_object('review_state',review_state,'ingredient_count',position,'cross_contacts',contacts));
end $$;

-- Keep the legacy staff RPC working, while requiring a new recipe review after
-- an independent tag edit. It cannot certify an ingredient list as complete.
alter function public.configure_dish_allergens(uuid,text[],boolean) set schema private;
alter function private.configure_dish_allergens(uuid,text[],boolean) rename to configure_dish_allergens_legacy;
create function public.configure_dish_allergens(did uuid,allergen_ids text[],reviewed boolean) returns void language plpgsql security definer set search_path='' as $$begin
 perform private.configure_dish_allergens_legacy(did,allergen_ids,reviewed);
 update public.dishes set ingredient_review_state='incomplete',ingredient_reviewed_at=null,ingredient_reviewed_by=null,ingredient_updated_at=clock_timestamp(),recipe_revision=recipe_revision+1 where id=did;
end $$;

create or replace function public.allergy_warnings(declared text[],notes text,dish_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.dishes;recipe jsonb;matches jsonb;risks jsonb;custom text[];unknown_terms text[];canonical text[];contacts text[];legacy text[];ctx text;token text;result jsonb='[]';has_declaration boolean;
begin
 if not (public.is_staff() or public.customer_access()) then raise exception 'Authenticated catering access required';end if;
 if cardinality(coalesce(dish_ids,'{}'))>100 or cardinality(coalesce(declared,'{}'))>20 or length(coalesce(notes,''))>2000 then raise exception 'Allergy request too large';end if;
 select coalesce(array_agg(distinct private.canonical_allergen(x) order by private.canonical_allergen(x)),'{}') into canonical from unnest(coalesce(declared,'{}'))x;
 if exists(select 1 from unnest(canonical)x where not exists(select 1 from public.allergens where id=x)) then raise exception 'Choose known allergens';end if;
 select coalesce(array_agg(distinct private.ingredient_key(x) order by private.ingredient_key(x)) filter(where private.ingredient_key(x)<>''),'{}') into custom from regexp_split_to_table(coalesce(notes,''),'[,;\n]+')x;
 has_declaration=cardinality(canonical)>0 or regexp_replace(coalesce(notes,''),'[[:space:]]','','g')<>'';
 if not has_declaration then return '[]';end if;
 -- Only exact normalized names or staff-supplied aliases resolve custom text.
 select coalesce(array_agg(x order by x),'{}') into unknown_terms from unnest(custom)x where not exists(select 1 from public.recipe_ingredients i where i.normalized_name=x or x=any(i.aliases));
 if regexp_replace(coalesce(notes,''),'[[:space:]]','','g')<>'' and cardinality(custom)=0 then unknown_terms=array[notes];end if;
 ctx=jsonb_build_array(canonical,coalesce(notes,''),array(select distinct x from unnest(coalesce(dish_ids,'{}'))x order by x))::text;
 for d in select * from public.dishes where id=any(dish_ids) order by name,id loop
  recipe=private.recipe_json(d.id);risks='[]';
  select coalesce(jsonb_agg(m order by m->>'allergen',m->>'ingredient'),'[]') into matches from (
   select distinct jsonb_build_object('allergen_id',a.id,'allergen',a.name,'ingredient',i.name,'ingredient_id',i.id,'component_of',di.component_of,'kind','allergen')m
   from public.dish_ingredients di join public.recipe_ingredients i on i.id=di.ingredient_id join public.ingredient_allergens ia on ia.ingredient_id=i.id join public.allergens a on a.id=ia.allergen_id where di.dish_id=d.id and a.id=any(canonical)
   union
   select distinct jsonb_build_object('allergen_id','custom','allergen',x,'ingredient',i.name,'ingredient_id',i.id,'component_of',di.component_of,'kind','custom')m
   from public.dish_ingredients di join public.recipe_ingredients i on i.id=di.ingredient_id cross join unnest(custom)x where di.dish_id=d.id and (i.normalized_name=x or x=any(i.aliases))
  )q;
  if jsonb_array_length(matches)>0 then risks=risks||jsonb_build_array('contains');end if;
  select coalesce(array_agg(a.name order by a.name),'{}') into contacts from public.allergens a where a.id=any(d.cross_contact_allergen_ids) and a.id=any(canonical);
  if cardinality(contacts)>0 or trim(d.cross_contact_notes)<>'' then risks=risks||jsonb_build_array('cross_contact');end if;
  select coalesce(array_agg(a.name order by a.name),'{}') into legacy from public.dish_allergens da join public.allergens a on a.id=da.allergen_id where da.dish_id=d.id and a.id=any(canonical) and not exists(select 1 from jsonb_array_elements(matches)m where m->>'allergen_id'=a.id);
  if cardinality(legacy)>0 then risks=risks||jsonb_build_array('unresolved_tag');end if;
  if d.ingredient_review_state<>'verified' or jsonb_array_length(recipe)=0 then risks=risks||jsonb_build_array('incomplete');end if;
  if cardinality(unknown_terms)>0 then risks=risks||jsonb_build_array('custom_unresolved');end if;
  token=md5(ctx||jsonb_build_array(d.id,d.recipe_revision,d.allergen_revision,d.ingredient_review_state,recipe,matches,risks,contacts,d.cross_contact_notes,legacy)::text);
  result=result||jsonb_build_array(jsonb_build_object('dish_id',d.id,'dish',d.name,'allergen_id','dish_risk','allergen',coalesce((select string_agg(distinct m->>'allergen',', ' order by m->>'allergen') from jsonb_array_elements(matches)m),'Ingredient review'),'token',token,'recipe_hash',md5(recipe::text||d.recipe_revision::text||d.allergen_revision::text),'review_state',d.ingredient_review_state,'matches',matches,'risk_types',risks,'cross_contact_allergens',contacts,'cross_contact_notes',d.cross_contact_notes,'unresolved_tags',legacy,'unresolved_custom',unknown_terms,'requires_ack',jsonb_array_length(risks)>0,'status',case when jsonb_array_length(matches)>0 then 'contains' when jsonb_array_length(risks)>0 then 'uncertain' else 'reviewed_no_match' end));
 end loop;
 return result;
end $$;

create or replace function private.validate_allergy_ack(rid uuid,require_ack boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.reservations;warnings jsonb;w jsonb;snapshot jsonb='[]';acknowledged boolean;at timestamptz=clock_timestamp();
begin
 select * into strict r from public.reservations where id=rid for update;
 -- Serialize finalization with staff recipe edits, so the snapshot and the
 -- acknowledged recipe describe the same revision at submission.
 perform 1 from public.dishes where id in(select dish_id from public.reservation_items where reservation_id=rid) order by id for share;
 warnings=public.allergy_warnings(r.allergy_allergen_ids,r.allergy_notes,array(select dish_id from public.reservation_items where reservation_id=rid));
 for w in select value from jsonb_array_elements(warnings) loop
  acknowledged=exists(select 1 from jsonb_array_elements(r.allergy_acknowledgments)a where a->>'token'=w->>'token' and a->>'dish_id'=w->>'dish_id' and a->>'allergen_id'=w->>'allergen_id');
  if require_ack and (w->>'requires_ack')::boolean and not acknowledged then raise exception 'Allergy acknowledgment required for %. Review the current dish ingredients and warning before continuing',w->>'dish';end if;
  snapshot=snapshot||jsonb_build_array(w||jsonb_build_object('acknowledged',acknowledged,'acknowledged_at',case when acknowledged then to_jsonb(at) else 'null'::jsonb end,'captured_at',at));
 end loop;
 if require_ack then update public.reservations set allergy_warning_snapshot=snapshot,allergy_acknowledged_at=case when exists(select 1 from jsonb_array_elements(snapshot)s where (s->>'acknowledged')::boolean) then at else null end where id=rid;end if;
end $$;

-- Lock recipe metadata against catalog writes outside the audited RPC.
revoke insert on public.dishes from authenticated;
grant insert(id,name,category_id,description,active,image_url,image_credit,image_source_url) on public.dishes to authenticated;
do $$declare t text;begin foreach t in array array['recipe_ingredients','ingredient_allergens','dish_ingredients'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('grant all on public.%I to service_role',t);
 execute format('create policy recipe_read on public.%I for select to authenticated using(public.is_staff() or public.customer_access())',t);
end loop;end $$;
revoke execute on function private.ingredient_key(text),private.canonical_allergen(text),private.recipe_json(uuid),private.configure_dish_allergens_legacy(uuid,text[],boolean),private.validate_allergy_ack(uuid,boolean) from public,anon,authenticated;
revoke execute on function public.save_dish_recipe(uuid,jsonb,text,text[],text,boolean),public.dish_recipe(uuid),public.recipe_review_queue(),public.configure_dish_allergens(uuid,text[],boolean) from public,anon,authenticated;
grant execute on function public.save_dish_recipe(uuid,jsonb,text,text[],text,boolean),public.dish_recipe(uuid),public.recipe_review_queue(),public.configure_dish_allergens(uuid,text[],boolean) to authenticated;

alter function public.export_application_snapshot() set schema private;
alter function private.export_application_snapshot() rename to export_application_snapshot_0033;
create function public.export_application_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb=private.export_application_snapshot_0033();t text;rows jsonb;n bigint;begin
 foreach t in array array['recipe_ingredients','ingredient_allergens','dish_ingredients'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb),count(*) from (select * from public.%I limit 50001)x',t) into rows,n;
  if n>50000 then raise exception 'Dataset too large for application export; use a PostgreSQL backup';end if;
  result=jsonb_set(result,'{tables}',(result->'tables')||jsonb_build_object(t,rows));result=jsonb_set(result,'{counts}',(result->'counts')||jsonb_build_object(t,n));
 end loop;
 if octet_length(result::text)>10485760 then raise exception 'Dataset too large for application export; use a PostgreSQL backup';end if;
 return result||jsonb_build_object('schema_version','0034_ingredient_allergy_warnings.sql');
end $$;
revoke execute on function private.export_application_snapshot_0033(),public.export_application_snapshot() from public,anon,authenticated;
grant execute on function public.export_application_snapshot() to service_role;
notify pgrst,'reload schema';
