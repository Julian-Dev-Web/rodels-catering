import { PGlite } from '@electric-sql/pglite'
import { readFile, writeFile } from 'node:fs/promises'
const db = new PGlite()
await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;create schema storage;create schema extensions;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
create publication supabase_realtime;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;`)
await db.exec((await readFile('supabase/setup.sql','utf8')).replace('create extension if not exists pgcrypto with schema extensions;', '-- Built-in UUID generation in isolated PostgreSQL audit runtime.'))
const tables=(await db.query(`select c.relname as name,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`)).rows
const columns=(await db.query(`select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`)).rows
const constraints=(await db.query(`select c.relname as table_name,x.conname as name,x.contype as type,pg_get_constraintdef(x.oid) as definition from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,x.contype,x.conname`)).rows
const foreignKeys=(await db.query(`select c.relname as child,np.nspname as parent_schema,p.relname as parent,
 array(select a.attname from unnest(x.conkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=x.conrelid and a.attnum=k.num order by k.pos) as child_columns,
 array(select a.attname from unnest(x.confkey) with ordinality k(num,pos) join pg_attribute a on a.attrelid=x.confrelid and a.attnum=k.num order by k.pos) as parent_columns,
 (select bool_and(a.attnotnull) from unnest(x.conkey) k(num) join pg_attribute a on a.attrelid=x.conrelid and a.attnum=k.num) as required_parent,
 exists(select 1 from pg_constraint u where u.conrelid=x.conrelid and u.contype in ('p','u') and u.conkey <@ x.conkey) as unique_child,
 pg_get_constraintdef(x.oid) as definition
 from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace nc on nc.oid=c.relnamespace join pg_class p on p.oid=x.confrelid join pg_namespace np on np.oid=p.relnamespace where nc.nspname='public' and x.contype='f' order by c.relname,x.conname`)).rows
const policies=(await db.query("select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname")).rows
const functions=(await db.query(`select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result,p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' order by n.nspname,p.proname`)).rows
const manifest={source:'13 repository migrations executed in isolated PostgreSQL/PGlite with mocked platform Auth/Storage scaffolding; no hosted records read',tables:tables.map(t=>({...t,columns:columns.filter(c=>c.table_name===t.name),constraints:constraints.filter(c=>c.table_name===t.name),policies:policies.filter(p=>p.tablename===t.name)})),foreignKeys,functions}
await writeFile('docs/source/schema-manifest.json',JSON.stringify(manifest,null,2)+'\n')
const lock=JSON.parse(await readFile('package-lock.json','utf8'))
const versions=Object.fromEntries(Object.entries(lock.packages).filter(([name])=>/^node_modules\/(react|react-dom|react-router-dom|typescript|vite|@supabase\/supabase-js|@tanstack\/react-query|react-hook-form|zod|recharts|vitest|@electric-sql\/pglite)$/.test(name)).map(([name,pkg])=>[name.replace('node_modules/',''),pkg.version]))
await writeFile('docs/source/dependency-versions.json',JSON.stringify(versions,null,2)+'\n')
console.log(JSON.stringify({tables:tables.length,foreignKeys:foreignKeys.length,all_domain_rls:tables.every(t=>t.rls),versions},null,2))
await db.close()
