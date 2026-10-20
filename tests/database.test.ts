import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { birthdayKeys, weddingKeys } from '../src/lib/booking-constants'
const db = new PGlite()
const users = {
  customer: '90000000-0000-0000-0000-000000000001',
  other: '90000000-0000-0000-0000-000000000002',
  manager: '90000000-0000-0000-0000-000000000003',
  super: '90000000-0000-0000-0000-000000000004',
  other_customer: '90000000-0000-0000-0000-000000000005',
}
async function identity(user: keyof typeof users | 'operator') {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user === 'operator' ? '' : users[user],
  ])
  if (user !== 'operator') await db.exec('set role authenticated')
}
async function scalar<T>(sql: string, args: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, args)).rows[0]?.value
}
const places = JSON.parse(await readFile('src/data/coverage.json', 'utf8')) as {
  code: string
  name: string
  parent_code: string | null
  level: string
}[]
const province = places.find(
  (p) => p.level === 'province' && p.name === 'Bulacan',
)!
const city = places.find(
  (p) => p.parent_code === province.code && p.name === 'San Ildefonso',
)!
const barangay = places.find(
  (p) => p.parent_code === city.code && p.level === 'barangay',
)!
const testAddress = {
  street: 'Test venue',
  province: province.name,
  province_code: province.code,
  city: city.name,
  city_code: city.code,
  barangay: barangay.name,
  barangay_code: barangay.code,
  contact: '09123456789',
  notes: '',
}
const consent = { consent_version: '2026-10-15-v1', consent_accepted: true }
let draft: string
let flow: string
let setupSql: string
let ownerCatalog: {
  name: string
  price: number
  dish_count: number
  min_guests: number
  max_guests: number
}[]
async function completeDraft(eventDate: string) {
  await identity('customer')
  const dishes = (
    await db.query<{ id: string }>('select id from dishes limit 3')
  ).rows.map((x) => x.id)
  const drink = await scalar<string>('select id as value from drinks limit 1')
  const dessert = await scalar<string>(
    'select id as value from desserts limit 1',
  )
  const setup = await scalar<string>(
    "select id as value from event_setups where name='Classic ivory'",
  )
  const table = await scalar<string>(
    'select id as value from table_types limit 1',
  )
  const chair = await scalar<string>(
    "select id as value from chair_types where name='Monoblock (legacy)'",
  )
  return scalar<string>('select save_reservation($1::jsonb) as value', [
    JSON.stringify({
      ...consent,
      event_name: 'Workflow event',
      event_date: eventDate,
      event_time: '12:00',
      guests: 50,
      menu_set_id: '10000000-0000-0000-0000-000000000001',
      drink_id: drink,
      dessert_id: dessert,
      dish_ids: dishes,
      setup_id: setup,
      table_type_id: table,
      table_quantity: 5,
      chairs: [{ id: chair, quantity: 50 }],
      address: testAddress,
    }),
  ])
}
beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
 create publication supabase_realtime;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant execute on function auth.uid() to anon,authenticated,service_role;`)
  await db.exec(
    'grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon',
  )
  setupSql = await readFile('supabase/setup.sql', 'utf8')
  for (const file of (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const migration = await readFile('supabase/migrations/' + file, 'utf8')
    expect(setupSql).toContain(migration.trimEnd())
  }
  // Execute the actual Dashboard installer. Only extension installation is
  // mocked because this embedded PostgreSQL already provides gen_random_uuid.
  await db.exec(
    setupSql.replace(
      'create extension if not exists pgcrypto with schema extensions;',
      '-- pgcrypto installation belongs to the real Supabase platform.',
    ),
  )
  // Isolated test fixture only; production stock remains unconfigured.
  await db.exec('update public.equipment_inventory set usable_quantity=1000000')
  ownerCatalog = (
    await db.query<{
      name: string
      price: number
      dish_count: number
      min_guests: number
      max_guests: number
    }>(
      'select name,price,dish_count,min_guests,max_guests from menu_sets where active order by dish_count',
    )
  ).rows
  // Restore the archived sample fixtures only inside this isolated test database
  // so the original payment/refund tests still exercise legacy pricing v1.
  await db.exec('update menu_sets set active=true where pricing_version=1')
  for (const table of [
    'dishes',
    'drinks',
    'desserts',
    'event_setups',
    'event_features',
    'add_ons',
    'chair_types',
    'table_types',
  ])
    await db.exec(`update ${table} set active=true`)
  for (const [name, id] of Object.entries(users))
    await db.query(
      'insert into auth.users(id,raw_user_meta_data) values($1,$2)',
      [id, JSON.stringify({ full_name: name, role: 'super_admin' })],
    )
  await db.exec(
    `update public.profiles set role='manager' where id='${users.manager}';update public.profiles set role='super_admin' where id='${users.super}';`,
  )
}, 60000)
afterAll(() => db.close())

describe('persistent assistant usage limits', () => {
  const guestHash = 'a'.repeat(64), memberHash = 'b'.repeat(64)
  it('allows ten guest questions, persists exhaustion across calls and does not charge status checks', async () => {
    await identity('operator')
    await db.exec('set role service_role')
    const status = () => scalar<{remaining:number;allowed:boolean;limit:number;audience:string}>('select assistant_access_quota($1,null,false) as value', [guestHash])
    expect(await status()).toMatchObject({ remaining: 10, allowed: true, limit: 10, audience: 'guest' })
    for(let i=1;i<=10;i++) expect(await scalar('select assistant_access_quota($1,null,true) as value', [guestHash])).toMatchObject({ remaining: 10-i, allowed: true })
    expect(await scalar('select assistant_access_quota($1,null,true) as value', [guestHash])).toMatchObject({ remaining: 0, allowed: false })
    expect(await status()).toMatchObject({ remaining: 0, allowed: false })
    await identity('operator')
    expect(await scalar('select questions as value from private.assistant_usage where subject_hash=$1', [guestHash])).toBe(10)
  })
  it('does not limit signed-in questions and rejects suspended/nonexistent identities', async () => {
    await identity('operator')
    await db.exec('set role service_role')
    const status = () => scalar('select assistant_access_quota($1,$2,false) as value', [memberHash, users.customer])
    expect(await status()).toMatchObject({ remaining: null, limit: null, audience: 'member', allowed: true })
    for(let i=1;i<=35;i++) expect(await scalar('select assistant_access_quota($1,$2,true) as value', [memberHash,users.customer])).toMatchObject({ remaining: null, allowed: true })
    await expect(scalar('select assistant_access_quota($1,$2,false) as value', [memberHash,'99000000-0000-0000-0000-000000000099'])).rejects.toThrow('Active account required')
    await identity('operator')
    expect(await scalar('select count(*)::int as value from private.assistant_usage where subject_hash=$1', [memberHash])).toBe(0)
    await db.query("update profiles set account_status='suspended' where id=$1", [users.customer])
    await db.exec('set role service_role')
    await expect(status()).rejects.toThrow('Active account required')
    await identity('operator')
    await db.query("update profiles set account_status='active' where id=$1", [users.customer])
  })
  it('does not expose quota writes or identifiers to anonymous/customer roles and permits a fresh day/window', async () => {
    await identity('customer')
    await expect(scalar('select assistant_access_quota($1,null,true) as value', [guestHash])).rejects.toThrow()
    await expect(db.query('select * from private.assistant_usage')).rejects.toThrow()
    await identity('operator')
    await db.exec('set role anon')
    await expect(scalar('select assistant_access_quota($1,null,true) as value', [guestHash])).rejects.toThrow()
    await identity('operator')
    await db.query("update private.assistant_usage set window_start=window_start-interval '3 days' where subject_hash=$1", [guestHash])
    await db.exec('set role service_role')
    expect(await scalar('select assistant_access_quota($1,null,true) as value', [guestHash])).toMatchObject({ remaining: 9, allowed: true })
    await identity('operator')
    expect(await scalar('select count(*)::int as value from private.assistant_usage where subject_hash=$1', [guestHash])).toBe(1)
  })
})

describe('system administration and private application export', () => {
  it('restricts system metrics to super admins and reports actual role counts', async () => {
    for (const role of ['customer', 'manager'] as const) {
      await identity(role)
      await expect(db.exec('select system_overview()')).rejects.toThrow(
        'Super admin required',
      )
    }
    await identity('super')
    const overview = await scalar<{
      users: number
      customers: number
      managers: number
      super_admins: number
    }>('select system_overview() as value')
    expect(overview).toMatchObject({
      users: 5,
      customers: 3,
      managers: 1,
      super_admins: 1,
    })
  })
  it('denies direct snapshot access even to super-admin browser identities', async () => {
    for (const role of ['customer', 'manager', 'super'] as const) {
      await identity(role)
      await expect(
        db.exec('select export_application_snapshot()'),
      ).rejects.toThrow(/permission denied/)
    }
  })
  it('exports only the fixed application tables with complete row counts', async () => {
    await identity('operator')
    await db.exec('set role service_role')
    const snapshot = await scalar<{
      format: string
      version: number
      tables: Record<string, unknown[]>
      counts: Record<string, number>
      exclusions: string[]
    }>('select export_application_snapshot() as value')
    expect(snapshot.format).toBe('rodelconnect-application-export')
    expect(Object.keys(snapshot.tables)).toHaveLength(50)
    expect(snapshot.tables.profiles).toHaveLength(5)
    expect(snapshot.tables).not.toHaveProperty('users')
    expect(snapshot.tables).not.toHaveProperty('storage.objects')
    for (const [table, rows] of Object.entries(snapshot.tables))
      expect(snapshot.counts[table]).toBe(rows.length)
    expect(snapshot.exclusions).toContain(
      'Supabase Auth accounts and credentials',
    )
    await identity('operator')
  })
  it('lets only super admins edit event metadata and preserves provider-independent photos', async () => {
    await identity('manager')
    expect(
      (await db.query('update gallery_images set featured=false returning id'))
        .rows,
    ).toHaveLength(0)
    await identity('super')
    const id = '60000000-0000-0000-0000-000000000004'
    await db.query('update gallery_images set featured=false where id=$1', [id])
    expect(
      await scalar('select featured as value from gallery_images where id=$1', [
        id,
      ]),
    ).toBe(false)
    await expect(
      db.query("update gallery_images set event_type='imaginary' where id=$1", [
        id,
      ]),
    ).rejects.toThrow(/check constraint/)
    await expect(
      db.query(
        "update gallery_images set source_url='javascript:alert(1)' where id=$1",
        [id],
      ),
    ).rejects.toThrow(/check constraint/)
    await db.query('update gallery_images set featured=true where id=$1', [id])
  })
})

async function ownerDraft(
  day: string,
  guests: number,
  chair = 'Monoblock',
  setup = 'Simple buffet setup',
  feature?: string,
  table = 'Round table',
  overrides: Record<string, unknown> = {},
) {
  await identity('customer')
  const lookup = (table: string, name: string) =>
    scalar<string>(`select id as value from ${table} where name=$1`, [name])
  const data = {
    ...consent,
    event_name: 'Confirmed catalog test',
    event_date: day,
    event_time: '12:00',
    guests,
    menu_set_id: await lookup('menu_sets', 'Set Menu No. 1'),
    drink_id: await lookup('drinks', 'Iced Tea'),
    dessert_id: await lookup('desserts', 'Coffee Jelly'),
    dish_ids: await Promise.all(
      ['Chicken Cordon Bleu', 'Korean Beef', 'Fried Chicken'].map((name) =>
        lookup('dishes', name),
      ),
    ),
    setup_id: await lookup('event_setups', setup),
    table_type_id: await lookup('table_types', table),
    table_quantity: 10,
    chairs: [{ id: await lookup('chair_types', chair), quantity: guests }],
    feature_ids: feature ? [await lookup('event_features', feature)] : [],
    address: testAddress,
  }
  return scalar<string>('select save_reservation($1::jsonb) as value', [
    JSON.stringify({ ...data, ...overrides }),
  ])
}

describe('owner menu pricing and included seating', () => {
  it('rejects 99 and 1,001 guests through the actual save RPC', async () => {
    await expect(ownerDraft('2098-01-01', 99)).rejects.toThrow(/minimum/)
    await expect(ownerDraft('2098-01-01', 1001)).rejects.toThrow(/maximum/)
  })
  it('includes Monoblock chairs, both table shapes, and simple setup in the menu price', async () => {
    const round = await ownerDraft('2098-01-02', 100)
    const long = await ownerDraft(
      '2098-01-03',
      100,
      'Monoblock',
      'Simple buffet setup',
      undefined,
      'Long table',
    )
    for (const id of [round, long]) {
      const quote = await scalar<Record<string, number>>(
        'select pricing as value from reservations where id=$1',
        [id],
      )
      expect(quote).toMatchObject({
        menu: 3200000,
        setup: 0,
        chair_upgrade: 0,
        total: 3200000,
      })
    }
    const maximum = await ownerDraft('2098-01-04', 1000)
    expect(
      await scalar('select total as value from reservations where id=$1', [
        maximum,
      ]),
    ).toBe(32000000)
    const quote = await scalar<Record<string, number>>(
      'select finalize_reservation($1) as value',
      [round],
    )
    expect(quote.total).toBe(3200000)
  })
  it('charges elegant chairs for every guest, including the first 100 seats', async () => {
    const id = await ownerDraft('2098-01-05', 100, 'Elegant chair')
    const quote = await scalar<Record<string, number>>(
      'select pricing as value from reservations where id=$1',
      [id],
    )
    expect(quote).toMatchObject({
      menu: 3200000,
      chair_upgrade: 100000,
      total: 3300000,
    })
    await identity('operator')
    await db.query(
      'update reservation_tables_chairs set chair_quantity=1 where reservation_id=$1',
      [id],
    )
    await expect(
      db.query('select private.calculate_price($1)', [id]),
    ).rejects.toThrow('one chair type for all guests')
  })
  it('adds fixed event fees and restricts the glass floor upgrade to weddings', async () => {
    const birthday = await ownerDraft(
      '2098-01-06',
      100,
      'Monoblock',
      'Birthday setup',
    )
    expect(
      await scalar('select total as value from reservations where id=$1', [
        birthday,
      ]),
    ).toBe(4700000)
    const wedding = await ownerDraft(
      '2098-01-07',
      100,
      'Elegant chair',
      'Wedding setup',
      'Glass dance floor upgrade',
    )
    expect(
      await scalar('select total as value from reservations where id=$1', [
        wedding,
      ]),
    ).toBe(6800000)
    const trusses = await ownerDraft(
      '2098-01-08',
      100,
      'Monoblock',
      'Simple buffet setup',
      'Trusses',
    )
    expect(
      await scalar('select total as value from reservations where id=$1', [
        trusses,
      ]),
    ).toBe(7700000)
    await expect(
      ownerDraft(
        '2098-01-09',
        100,
        'Monoblock',
        'Birthday setup',
        'Glass dance floor upgrade',
      ),
    ).rejects.toThrow(/matching event setup/)
  })
})
describe('clean migrations and actual PostgreSQL business rules', () => {
  it('installs the owner-confirmed four menus with the guest limits and current prices', () => {
    expect(
      ownerCatalog.map((menu) => [
        menu.price,
        menu.dish_count,
        menu.min_guests,
        menu.max_guests,
      ]),
    ).toEqual([
      [32000, 3, 100, 1000],
      [35000, 4, 100, 1000],
      [38000, 5, 100, 1000],
      [42000, 6, 100, 1000],
    ])
  })
  it('rejects the first three Manila dates and accepts the third day ahead in the real save RPC', async () => {
    await identity('operator')
    const today = await scalar<string>(
      "select ((now() at time zone 'Asia/Manila')::date)::text as value",
    )
    const day = (offset: number) => {
      const value = new Date(today! + 'T00:00:00Z')
      value.setUTCDate(value.getUTCDate() + offset)
      return value.toISOString().slice(0, 10)
    }
    for (const offset of [0, 1, 2])
      await expect(completeDraft(day(offset))).rejects.toThrow(
        'at least 3 days ahead',
      )
    const id = await completeDraft(day(3))
    expect(id).toBeTruthy()
    await identity('operator')
    await db.query('delete from reservations where id=$1', [id])
  })
  it('stores structured signup names and mobile while ignoring privileged metadata', async () => {
    await identity('operator')
    const id = '90000000-0000-0000-0000-000000000010'
    await db.query(
      'insert into auth.users(id,raw_user_meta_data) values($1,$2)',
      [
        id,
        JSON.stringify({
          first_name: ' Test ',
          middle_name: '',
          last_name: ' Customer ',
          phone: '639123456789',
          role: 'super_admin',
        }),
      ],
    )
    const profile = (
      await db.query(
        'select full_name,first_name,middle_name,last_name,phone,role from profiles where id=$1',
        [id],
      )
    ).rows[0]
    expect(profile).toMatchObject({
      full_name: 'Test Customer',
      first_name: 'Test',
      middle_name: '',
      last_name: 'Customer',
      phone: '+639123456789',
      role: 'customer',
    })
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    await db.exec('set role authenticated')
    await db.query("update profiles set middle_name='Middle' where id=$1", [id])
    expect(
      await scalar('select full_name as value from profiles where id=$1', [id]),
    ).toBe('Test Middle Customer')
    await expect(
      db.query("update profiles set phone='1234' where id=$1", [id]),
    ).rejects.toThrow()
    await expect(
      db.query("update profiles set last_name='' where id=$1", [id]),
    ).rejects.toThrow()
    await expect(
      db.query("update profiles set role='super_admin' where id=$1", [id]),
    ).rejects.toThrow()
    await identity('operator')
    expect(
      await scalar('select full_name as value from profiles where id=$1', [
        users.customer,
      ]),
    ).toBe('customer')
  })
  it('applies the standalone profile upgrade to legacy data without guessing name parts', async () => {
    const upgradeDb = new PGlite()
    try {
      await upgradeDb.exec(`create role anon nologin; create role authenticated nologin;
       create schema private; create schema auth;
       create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
       create type public.app_role as enum('customer','manager','super_admin');
       create table public.profiles(id uuid primary key references auth.users,full_name text not null default '' check(length(full_name)<=150),phone text not null default '' check(length(phone)<=30),avatar_path text,role public.app_role default 'customer');
       create function private.catalog_audit() returns trigger language plpgsql as $$begin return new; end$$;`)
      const legacyId = '91000000-0000-0000-0000-000000000001'
      const metadataId = '91000000-0000-0000-0000-000000000002'
      await upgradeDb.query('insert into auth.users values($1,$2),($3,$4)', [
        legacyId,
        JSON.stringify({ full_name: 'Preserved Legacy Name' }),
        metadataId,
        JSON.stringify({
          first_name: ' Explicit ',
          middle_name: ' Middle ',
          last_name: ' Name ',
          phone: '09123456789',
        }),
      ])
      await upgradeDb.query(
        'insert into profiles(id,full_name) values($1,$2),($3,$4)',
        [legacyId, 'Preserved Legacy Name', metadataId, 'Explicit Middle Name'],
      )
      const update = await readFile(
        'supabase/updates/0013_profile_names.sql',
        'utf8',
      )
      await upgradeDb.exec(update)
      await upgradeDb.exec(update)
      const result = (
        await upgradeDb.query(
          'select id,full_name,first_name,middle_name,last_name,phone from profiles order by id',
        )
      ).rows
      expect(result[0]).toMatchObject({
        full_name: 'Preserved Legacy Name',
        first_name: '',
        middle_name: '',
        last_name: '',
      })
      expect(result[1]).toMatchObject({
        full_name: 'Explicit Middle Name',
        first_name: 'Explicit',
        middle_name: 'Middle',
        last_name: 'Name',
        phone: '+639123456789',
      })
    } finally {
      await upgradeDb.close()
    }
  })
  it('bootstraps customer role even with malicious registration metadata', async () => {
    await identity('operator')
    expect(
      await scalar('select role::text as value from profiles where id=$1', [
        users.customer,
      ]),
    ).toBe('customer')
  })
  it('saves server-priced reservation and ignores forged total', async () => {
    await identity('customer')
    const data = {
      ...consent,
      event_name: 'Test celebration',
      event_date: '2099-05-10',
      event_time: '12:00',
      guests: 50,
      menu_set_id: '10000000-0000-0000-0000-000000000001',
      address: testAddress,
      total: 1,
    }
    draft = await scalar<string>(
      'select save_reservation($1::jsonb) as value',
      [JSON.stringify(data)],
    )
    expect(
      await scalar('select total as value from reservations where id=$1', [
        draft,
      ]),
    ).toBe(1750000)
    await identity('operator')
    const chair = await scalar<string>(
      "select id as value from chair_types where name='Monoblock (legacy)'",
    )
    const setup = await scalar<string>(
      "select id as value from event_setups where name='Classic ivory'",
    )
    await db.query(
      'insert into reservation_tables_chairs(reservation_id,chair_type_id,chair_quantity) values($1,$2,60)',
      [draft, chair],
    )
    await db.query('insert into reservation_event_setups values($1,$2)', [
      draft,
      setup,
    ])
    const quote = await scalar<Record<string, number>>(
      'select private.calculate_price($1) as value',
      [draft],
    )
    expect(quote.extra_chairs).toBe(20000)
    expect(quote.total).toBe(2070000)
  })
  it('blocks duplicate active customer/date even for direct inserts', async () => {
    await identity('customer')
    await expect(
      db.query('select save_reservation($1::jsonb)', [
        JSON.stringify({
          event_name: 'Duplicate',
          event_date: '2099-05-10',
          event_time: '13:00',
          guests: 50,
          menu_set_id: '10000000-0000-0000-0000-000000000001',
          address: testAddress,
          ...consent,
        }),
      ]),
    ).rejects.toThrow(/one_active_customer_date/)
  })
  it('denies direct role, payment, reservation status and audit writes', async () => {
    await identity('customer')
    await expect(
      db.query("update profiles set role='super_admin' where id=$1", [
        users.customer,
      ]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query("select admin_set_role($1,'manager')", [users.other]),
    ).rejects.toThrow(/not permitted/)
    await expect(
      db.query(
        "insert into payments(reservation_id,amount,intent,status) values($1,100,'full','fully_paid')",
        [draft],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query("select confirm_provider_payment('x','x','x',100)"),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.query("update reservations set status='approved' where id=$1", [
        draft,
      ]),
    ).rejects.toThrow(/permission denied/)
    await expect(
      db.exec("insert into audit_logs(action) values('forged')"),
    ).rejects.toThrow(/permission denied/)
  })
  it('hides another customer’s reservations through RLS', async () => {
    await identity('other')
    expect(
      await scalar(
        'select count(*)::int as value from reservations where id=$1',
        [draft],
      ),
    ).toBe(0)
  })
  it('keeps an archived menu visible through the owner summary without exposing it to another customer', async () => {
    await identity('operator')
    await db.exec(
      "update menu_sets set active=false where id='10000000-0000-0000-0000-000000000001'",
    )
    await identity('customer')
    expect(
      await scalar(
        'select count(*)::int as value from reservation_summary where id=$1',
        [draft],
      ),
    ).toBe(1)
    await identity('other')
    expect(
      await scalar(
        "select count(*)::int as value from menu_sets where id='10000000-0000-0000-0000-000000000001'",
      ),
    ).toBe(0)
    await identity('operator')
    await db.exec(
      "update menu_sets set active=true where id='10000000-0000-0000-0000-000000000001'",
    )
  })
  it('rejects incomplete menu finalization', async () => {
    await identity('customer')
    await expect(
      db.query('select finalize_reservation($1)', [draft]),
    ).rejects.toThrow(/exactly 3 dishes/)
  })
  it('enforces maximum 3 approved bookings with the database trigger', async () => {
    await identity('operator')
    for (let i = 0; i < 4; i++) {
      const id = `91000000-0000-0000-0000-00000000000${i}`
      await db.query('insert into auth.users(id) values($1)', [id])
      if (i < 3)
        await db.query(
          "insert into reservations(customer_id,event_name,event_date,guests,menu_set_id,status) values($1,'Capacity','2099-06-10',50,'10000000-0000-0000-0000-000000000001','approved')",
          [id],
        )
      else
        await expect(
          db.query(
            "insert into reservations(customer_id,event_name,event_date,guests,menu_set_id,status) values($1,'Capacity','2099-06-10',50,'10000000-0000-0000-0000-000000000001','approved')",
            [id],
          ),
        ).rejects.toThrow(/capacity/)
    }
  })
  it('requires cancellation more than 72 hours in Manila time', async () => {
    await identity('operator')
    const rid = await scalar<string>(
      "insert into reservations(customer_id,event_name,event_date,guests,menu_set_id) values($1,'Soon',(now() at time zone 'Asia/Manila')::date+3,50,'10000000-0000-0000-0000-000000000001') returning id as value",
      [users.customer],
    )
    await identity('customer')
    await expect(
      db.query("select request_cancellation($1,'Changed plans')", [rid]),
    ).rejects.toThrow(/more than 3 days/)
  })
  it('deducts 10% from paid money for down payments, full payments and nonstandard paid balances', async () => {
    await identity('customer')
    expect(
      await scalar('select refund_eligibility(1000000,500000) as value'),
    ).toBe(450000)
    expect(
      await scalar('select refund_eligibility(1000000,1000000) as value'),
    ).toBe(900000)
    expect(
      await scalar('select refund_eligibility(1000000,600000) as value'),
    ).toBe(540000)
  })
  it('enforces the monthly reschedule history limit', async () => {
    await identity('operator')
    await db.query("update reservations set status='approved' where id=$1", [
      draft,
    ])
    for (let i = 0; i < 3; i++)
      await db.query(
        "insert into reservation_reschedules(reservation_id,old_date,new_date) values($1,'2099-05-10','2099-05-11')",
        [draft],
      )
    await identity('customer')
    await expect(
      db.query(
        "select request_reschedule($1,'2099-05-20','Another date please')",
        [draft],
      ),
    ).rejects.toThrow(/Monthly reschedule limit/)
  })
  it('finalizes a complete wizard and stores the canonical quote', async () => {
    flow = await completeDraft('2099-08-01')
    const pricing = await scalar<Record<string, number>>(
      'select finalize_reservation($1) as value',
      [flow],
    )
    expect(pricing.total).toBe(2050000)
    expect(
      await scalar(
        'select status::text as value from reservations where id=$1',
        [flow],
      ),
    ).toBe('for_approval')
    expect(
      await scalar(
        'select amount as value from balances where reservation_id=$1',
        [flow],
      ),
    ).toBe(2050000)
  })
  it('computes checkout amounts server-side and freezes pending checkout edits', async () => {
    await identity('operator')
    const p = await scalar<{ amount: number; id: string }>(
      "select to_jsonb(begin_checkout($1,$2,'partial')) as value",
      [flow, users.customer],
    )
    expect(p.amount).toBe(1025000)
    await db.query(
      "update payments set external_session_id='cs_test_partial' where id=$1",
      [p.id],
    )
    await identity('customer')
    await expect(
      db.query('select save_reservation($1::jsonb)', [
        JSON.stringify({
          ...consent,
          address: testAddress,
          id: flow,
          event_date: '2099-08-01',
        }),
      ]),
    ).rejects.toThrow(/open checkout/)
    await expect(
      db.query("select request_cancellation($1,'Change of plans')", [flow]),
    ).rejects.toThrow(/open checkout/)
  })
  it('confirms a provider payment exactly once and updates balance/approval atomically', async () => {
    await identity('operator')
    await expect(
      db.query(
        "select confirm_provider_payment('evt_bad','cs_test_partial','pay_test',1)",
      ),
    ).rejects.toThrow(/does not match/)
    await db.exec(
      "select confirm_provider_payment('evt_partial','cs_test_partial','pay_partial',1025000)",
    )
    await db.exec(
      "select confirm_provider_payment('evt_partial','cs_test_partial','pay_partial',1025000)",
    )
    expect(
      await scalar('select paid as value from reservations where id=$1', [
        flow,
      ]),
    ).toBe(1025000)
    expect(
      await scalar(
        'select status::text as value from reservations where id=$1',
        [flow],
      ),
    ).toBe('approved')
    expect(
      await scalar(
        'select count(*)::int as value from transactions where reservation_id=$1',
        [flow],
      ),
    ).toBe(1)
    expect(
      await scalar(
        'select amount as value from balances where reservation_id=$1',
        [flow],
      ),
    ).toBe(1025000)
  })
  it('calculates a balance payment and reaches fully paid', async () => {
    await identity('operator')
    await expect(
      db.query("select begin_checkout($1,$2,'partial')", [
        flow,
        users.customer,
      ]),
    ).rejects.toThrow(/Invalid payment intent/)
    const p = await scalar<{ amount: number; id: string }>(
      "select to_jsonb(begin_checkout($1,$2,'balance')) as value",
      [flow, users.customer],
    )
    expect(p.amount).toBe(1025000)
    await db.query(
      "update payments set external_session_id='cs_test_balance' where id=$1",
      [p.id],
    )
    await db.exec(
      "select confirm_provider_payment('evt_balance','cs_test_balance','pay_balance',1025000)",
    )
    expect(
      await scalar(
        'select payment_status::text as value from reservations where id=$1',
        [flow],
      ),
    ).toBe('fully_paid')
    await identity('customer')
    await expect(
      db.query('select finalize_reservation($1)', [flow]),
    ).rejects.toThrow(/unpaid draft/)
  })
  it('reviews cancellation, releases capacity and freezes policy refund amount', async () => {
    await identity('customer')
    const cid = await scalar<string>(
      "select request_cancellation($1,'Changed celebration plans') as value",
      [flow],
    )
    expect(
      await scalar(
        'select holds_capacity as value from reservations where id=$1',
        [flow],
      ),
    ).toBe(true)
    await identity('manager')
    await db.query('select review_cancellation($1,true)', [cid])
    expect(
      await scalar(
        'select holds_capacity as value from reservations where id=$1',
        [flow],
      ),
    ).toBe(false)
    await identity('customer')
    const fid = await scalar<string>('select request_refund($1) as value', [
      flow,
    ])
    expect(
      await scalar('select eligible_amount as value from refunds where id=$1', [
        fid,
      ]),
    ).toBe(1845000)
    expect(
      await scalar(
        'select holds_capacity as value from reservations where id=$1',
        [flow],
      ),
    ).toBe(false)
    await identity('manager')
    await db.query('select review_refund($1,true)', [fid])
  })
  it('allocates refunds across payments, locks ambiguous retries and requires provider confirmation', async () => {
    await identity('operator')
    const fid = await scalar<string>(
      'select id as value from refunds where reservation_id=$1',
      [flow],
    )
    const planned = await scalar<{
      operations: { id: string; amount: number }[]
    }>('select claim_refund($1) as value', [fid])
    expect(planned.operations.reduce((s, o) => s + o.amount, 0)).toBe(1845000)
    expect(planned.operations).toHaveLength(2)
    const operation = planned.operations[0]
    await db.query('select claim_refund_operation($1)', [operation.id])
    await expect(
      db.query('select claim_refund_operation($1)', [operation.id]),
    ).rejects.toThrow(/ambiguous/)
    await expect(db.query('select finish_refund($1)', [fid])).rejects.toThrow(
      /not confirmed/,
    )
    for (const [i, op] of planned.operations.entries())
      await db.query(
        "update refund_operations set external_refund_id=$1,status='succeeded' where id=$2",
        ['re_' + i, op.id],
      )
    await db.query('select finish_refund($1)', [fid])
    await db.query('select finish_refund($1)', [fid])
    expect(
      await scalar('select refunded as value from reservations where id=$1', [
        flow,
      ]),
    ).toBe(1845000)
    expect(
      await scalar(
        "select count(*)::int as value from transactions where reservation_id=$1 and kind='refund'",
        [flow],
      ),
    ).toBe(1)
  })
  it('prices mixed extra chairs from the highest-priced type first', async () => {
    const rid = await completeDraft('2099-09-01')
    await identity('operator')
    const tiffany = await scalar<string>(
      "select id as value from chair_types where name='Tiffany (legacy)'",
    )
    await db.query(
      'insert into reservation_tables_chairs(reservation_id,chair_type_id,chair_quantity) values($1,$2,10)',
      [rid, tiffany],
    )
    const quote = await scalar<Record<string, number>>(
      'select private.calculate_price($1) as value',
      [rid],
    )
    expect(quote.extra_chairs).toBe(100000)
  })
  it('makes unauthorized staff dashboards, gallery and setting changes fail', async () => {
    await identity('customer')
    await expect(db.exec('select dashboard_metrics()')).rejects.toThrow(/Staff/)
    await expect(
      db.exec("select update_setting('maintenance','true')"),
    ).rejects.toThrow(/Super admin/)
    await expect(
      db.exec(
        "insert into gallery_images(name,image_url) values('forged','/forged.jpg')",
      ),
    ).rejects.toThrow(/row-level security/)
    await identity('manager')
    await expect(
      db.exec(
        "insert into menu_sets(name,price,dish_count) values('forged',100,3)",
      ),
    ).rejects.toThrow(/row-level security/)
    const metrics = await scalar<{ customers: number }>(
      'select dashboard_metrics() as value',
    )
    expect(metrics.customers).toBeGreaterThan(0)
  })
  it('keeps a new same-date booking valid while an older cancelled booking is refunded', async () => {
    const rid = await completeDraft('2099-08-01')
    expect(rid).not.toBe(flow)
  })
  it('enforces ownership of avatar paths and super-admin gallery storage writes', async () => {
    await identity('customer')
    await db.query(
      "insert into storage.objects(bucket_id,name) values('avatars',$1)",
      [users.customer + '/avatar.png'],
    )
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('avatars',$1)",
        [users.other + '/avatar.png'],
      ),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.exec(
        "insert into storage.objects(bucket_id,name) values('gallery','events/forged.png')",
      ),
    ).rejects.toThrow(/row-level security/)
    await identity('super')
    await db.exec(
      "insert into storage.objects(bucket_id,name) values('gallery','events/allowed.png')",
    )
  })
  it('approves a reschedule atomically and adds one monthly history record', async () => {
    const rid = await completeDraft('2099-10-01')
    await db.query('select finalize_reservation($1)', [rid])
    await identity('manager')
    await db.query("select manager_reservation_status($1,'approved')", [rid])
    await identity('customer')
    const request = await scalar<string>(
      "select request_reschedule($1,'2099-10-02','Need a different day') as value",
      [rid],
    )
    await identity('manager')
    await db.query('select review_reschedule($1,true)', [request])
    expect(
      await scalar(
        'select event_date::text as value from reservations where id=$1',
        [rid],
      ),
    ).toBe('2099-10-02')
    expect(
      await scalar(
        'select count(*)::int as value from reservation_reschedules where reservation_id=$1',
        [rid],
      ),
    ).toBe(1)
  })
  it('records a verified full payment without auto-approving a full event date', async () => {
    // Checkout starts while capacity is available; later bookings fill it
    // before the provider callback. New checkouts on a full date are blocked.
    await identity('operator')
    const occupied = (await db.query<{id:string}>("select id from reservations where event_date='2099-06-10' and holds_capacity")).rows.map(r=>r.id)
    await db.query("update reservations set event_date='2099-06-30' where id=any($1::uuid[])",[occupied])
    const rid = await completeDraft('2099-06-10')
    await db.query('select finalize_reservation($1)', [rid])
    await identity('operator')
    const payment = await scalar<{ id: string; amount: number }>(
      "select to_jsonb(begin_checkout($1,$2,'full')) as value",
      [rid, users.customer],
    )
    expect(payment.amount).toBe(2050000)
    await db.query(
      "update payments set external_session_id='cs_at_capacity' where id=$1",
      [payment.id],
    )
    await db.query("update reservations set event_date='2099-06-10' where id=any($1::uuid[])",[occupied])
    await db.exec(
      "select confirm_provider_payment('evt_capacity','cs_at_capacity','pay_capacity',2050000)",
    )
    expect(
      await scalar('select paid as value from reservations where id=$1', [rid]),
    ).toBe(2050000)
    expect(
      await scalar(
        'select status::text as value from reservations where id=$1',
        [rid],
      ),
    ).toBe('for_approval')
  })
  it('keeps support threads private and prevents notification recipient changes', async () => {
    await identity('customer')
    const tid = await scalar<string>(
      "select create_ticket('Question about setup','Can we discuss the venue?') as value",
    )
    await identity('other')
    expect(
      await scalar(
        'select count(*)::int as value from support_messages where ticket_id=$1',
        [tid],
      ),
    ).toBe(0)
    await expect(
      db.query("select reply_ticket($1,'Forged reply')", [tid]),
    ).rejects.toThrow(/Access denied/)
    await identity('customer')
    await expect(
      db.query('update notifications set user_id=$1', [users.other]),
    ).rejects.toThrow(/permission denied/)
    await identity('manager')
    await db.query("select reply_ticket($1,'We can help with the venue.')", [
      tid,
    ])
    await db.query('select resolve_ticket($1)', [tid])
    await identity('customer')
    await expect(
      db.query("select reply_ticket($1,'Late reply')", [tid]),
    ).rejects.toThrow(/closed/)
  })
  it('blocks maintenance customer operations and permits super-admin role assignment', async () => {
    await identity('super')
    await db.exec("select update_setting('maintenance','true'::jsonb)")
    await identity('customer')
    await expect(
      db.exec("select create_ticket('Help please','Need assistance')"),
    ).rejects.toThrow(/maintenance/)
    await identity('super')
    await db.query("select admin_set_role($1,'manager')", [users.other])
    expect(
      await scalar('select role::text as value from profiles where id=$1', [
        users.other,
      ]),
    ).toBe('manager')
    await db.exec("select update_setting('maintenance','false'::jsonb)")
  })
  it('rejects rerunning the hosted installer and preserves existing records', async () => {
    await identity('operator')
    const before = await scalar<number>(
      'select count(*)::int as value from profiles',
    )
    const menusBefore = await scalar<number>(
      'select count(*)::int as value from menu_sets',
    )
    await expect(db.exec(setupSql)).rejects.toThrow(
      /Setup requires an empty public schema/,
    )
    await db.exec('rollback')
    expect(
      await scalar<number>('select count(*)::int as value from profiles'),
    ).toBe(before)
    expect(
      await scalar<number>('select count(*)::int as value from menu_sets'),
    ).toBe(menusBefore)
  })
})

describe('coverage, consent, setup configuration and saved contacts', () => {
  it('rejects a different province, foreign city/barangay, missing consent and invalid mobile', async () => {
    for (const overrides of [
      {
        address: {
          ...testAddress,
          province: 'Metro Manila',
          province_code: '130000000',
        },
      },
      { address: { ...testAddress, city_code: '035403000' } },
      { address: { ...testAddress, barangay_code: '035403001' } },
      { consent_accepted: false },
      { consent_version: 'old-policy' },
      { address: { ...testAddress, contact: '12345' } },
    ])
      await expect(
        ownerDraft(
          '2096-01-01',
          100,
          'Monoblock',
          'Simple buffet setup',
          undefined,
          'Round table',
          overrides,
        ),
      ).rejects.toThrow()
  })
  it('stores a server consent timestamp and an alternate number without overwriting the primary', async () => {
    await identity('operator')
    await db.query("update profiles set phone='09111111111' where id=$1", [
      users.customer,
    ])
    const primaryBefore = await scalar(
      'select phone as value from profiles where id=$1',
      [users.customer],
    )
    const id = await ownerDraft(
      '2096-01-02',
      100,
      'Monoblock',
      'Simple buffet setup',
      undefined,
      'Round table',
      {
        save_contact: true,
        consent_at: '1970-01-01',
        event_preferences: {
          theme: 'Garden',
          colors: 'Ivory',
          occasion_type: 'other',
          setup_inclusions: [],
        },
      },
    )
    expect(
      await scalar('select phone as value from profiles where id=$1', [
        users.customer,
      ]),
    ).toBe(primaryBefore)
    expect(
      await scalar(
        "select count(*)::int as value from customer_contacts where phone='+639123456789'",
      ),
    ).toBe(1)
    const record = await scalar<{
      consent_version: string
      consent_at: string
      event_preferences: { theme: string }
    }>('select to_jsonb(r) as value from reservations r where id=$1', [id])
    expect(record.consent_version).toBe('2026-10-15-v1')
    expect(record.consent_at).not.toContain('1970')
    expect(record.event_preferences.theme).toBe('Garden')
    await identity('other_customer')
    expect(
      await scalar('select count(*)::int as value from customer_contacts'),
    ).toBe(0)
  })
  it('prices all four birthday subsets authoritatively and ignores forged prices/table counts', async () => {
    const keys = ['stage_backdrop', 'elegant_chair', 'entrance']
    for (let n = 0; n <= 3; n++) {
      const id = await ownerDraft(
        '2096-02-0' + (n + 1),
        100,
        'Monoblock',
        'Birthday setup',
        undefined,
        'Round table',
        {
          total: 1,
          table_quantity: 999,
          event_preferences: {
            setup_inclusions: keys.slice(0, n),
            theme: 'Stars',
            colors: 'Gold',
            celebrant_age: 18,
            occasion_type: 'birthday',
            component_prices: { stage_backdrop: 1 },
          },
        },
      )
      const quote = await scalar<Record<string, number>>(
        'select pricing as value from reservations where id=$1',
        [id],
      )
      expect(quote.setup).toBe(n * 500000)
      expect(quote.total).toBe(3200000 + n * 500000)
      expect(quote).not.toHaveProperty('tables')
      expect(
        await scalar(
          'select sum(table_quantity)::int as value from reservation_tables_chairs where reservation_id=$1',
          [id],
        ),
      ).toBe(0)
    }
    await expect(
      ownerDraft(
        '2096-02-08',
        100,
        'Monoblock',
        'Birthday setup',
        undefined,
        'Round table',
        {
          event_preferences: { setup_inclusions: ['fake'], celebrant_age: 18 },
        },
      ),
    ).rejects.toThrow('Invalid setup inclusions')
    await expect(
      ownerDraft(
        '2096-02-08',
        100,
        'Monoblock',
        'Birthday setup',
        undefined,
        'Round table',
        { event_preferences: { celebrant_age: -1 } },
      ),
    ).rejects.toThrow(/age/)
  })
  it('automatically prices the confirmed wedding inclusions and restricts later pricing configuration to approved admin changes', async () => {
    const prefs = {
      setup_inclusions: ['stage_backdrop'],
      occasion_type: 'wedding',
    }
    const current=await ownerDraft('2096-03-02',100,'Monoblock','Wedding setup',undefined,'Round table',{event_preferences:prefs})
    expect(await scalar('select total as value from reservations where id=$1',[current])).toBe(3700000)
    await identity('manager')
    await expect(
      db.query('select configure_wedding_prices($1,true)', [
        JSON.stringify({}),
      ]),
    ).rejects.toThrow('Super admin')
    // Unequal figures are isolated approval test fixtures, never production seeds.
    const prices = {
      stage_backdrop: 700000,
      elegant_chair: 300000,
      entrance: 500000,
      presidential_table: 600000,
      buffet_setup: 400000,
      diamond_dance_floor: 500000,
    }
    await identity('super')
    await expect(
      db.query('select configure_wedding_prices($1,false)', [
        JSON.stringify(prices),
      ]),
    ).rejects.toThrow(/owner-approved/)
    await expect(
      db.query('select configure_wedding_prices($1,true)', [
        JSON.stringify({ ...prices, entrance: 1 }),
      ]),
    ).rejects.toThrow(/exactly/)
    await db.query('select configure_wedding_prices($1,true)', [
      JSON.stringify(prices),
    ])
    const id = await ownerDraft(
      '2096-03-01',
      100,
      'Monoblock',
      'Wedding setup',
      undefined,
      'Round table',
      { event_preferences: prefs },
    )
    expect(
      await scalar('select total as value from reservations where id=$1', [id]),
    ).toBe(3900000)
    await identity('operator')
    await db.exec(
      "update app_settings set value='{\"stage_backdrop\":500000,\"elegant_chair\":500000,\"entrance\":500000,\"presidential_table\":500000,\"buffet_setup\":500000,\"diamond_dance_floor\":500000}'::jsonb where key='wedding_component_prices'",
    )
  })
})
describe('account suspension and persistent maintenance', () => {
  it('blocks suspended customer/staff API access and protected field writes', async () => {
    await identity('customer')
    await expect(
      db.query("update profiles set account_status='active' where id=$1", [
        users.customer,
      ]),
    ).rejects.toThrow(/permission/)
    await identity('manager')
    await expect(
      db.query("select admin_account_status($1,'suspended')", [users.customer]),
    ).rejects.toThrow('Super admin')
    await identity('super')
    await db.query("select admin_account_status($1,'suspended')", [
      users.customer,
    ])
    await identity('customer')
    expect(await scalar('select current_app_role() as value')).toBeNull()
    expect(
      await scalar('select count(*)::int as value from reservations'),
    ).toBe(0)
    await expect(
      db.exec("select create_ticket('Suspend test','Cannot submit')"),
    ).rejects.toThrow(/Customer access/)
    await identity('operator')
    await expect(
      db.query("select begin_checkout($1,$2,'full')", [draft, users.customer]),
    ).rejects.toThrow('Active customer access')
    await identity('super')
    await db.query("select admin_account_status($1,'active')", [users.customer])
    await db.query("select admin_account_status($1,'suspended')", [
      users.manager,
    ])
    await identity('manager')
    await expect(db.exec('select operational_metrics()')).rejects.toThrow(
      'Staff access',
    )
    await identity('super')
    await db.query("select admin_account_status($1,'active')", [users.manager])
    await expect(
      db.query("select admin_account_status($1,'suspended')", [users.super]),
    ).rejects.toThrow('own account')
    await expect(
      db.query("select admin_set_role($1,'customer')", [users.super]),
    ).rejects.toThrow(/not permitted/)
    expect(
      await scalar(
        "select count(*)::int as value from profiles where role='super_admin' and account_status='active'",
      ),
    ).toBe(1)
  })
  it('persists a maintenance message, blocks customer writes and keeps staff reads available', async () => {
    await identity('manager')
    await expect(
      db.exec("select configure_maintenance(true,'Paused')"),
    ).rejects.toThrow('Super admin')
    await identity('super')
    await db.exec(
      "select configure_maintenance(true,'Maintenance acceptance test')",
    )
    const state = await scalar<{ enabled: boolean; message: string }>(
      'select maintenance_state() as value',
    )
    expect(state).toMatchObject({
      enabled: true,
      message: 'Maintenance acceptance test',
    })
    await identity('customer')
    await expect(ownerDraft('2096-04-01', 100)).rejects.toThrow(/maintenance/)
    await identity('manager')
    expect(await scalar('select is_staff() as value')).toBe(true)
    await db.exec('select operational_metrics()')
    await identity('super')
    await db.exec("select configure_maintenance(false,'')")
    expect(
      (
        await scalar<{ enabled: boolean }>(
          'select maintenance_state() as value',
        )
      ).enabled,
    ).toBe(false)
  })
  it('continues verified payment confirmation during maintenance and makes duplicate callbacks harmless', async () => {
    const id = await ownerDraft('2096-04-02', 100)
    await db.query('select finalize_reservation($1)', [id])
    await identity('operator')
    const payment = await scalar<{ id: string; amount: number }>(
      "select to_jsonb(begin_checkout($1,$2,'partial')) as value",
      [id, users.customer],
    )
    await db.query(
      "update payments set external_session_id='cs_maintenance' where id=$1",
      [payment.id],
    )
    await identity('super')
    await db.exec("select configure_maintenance(true,'Payment callback test')")
    await identity('operator')
    await db.exec(
      "select confirm_provider_payment('evt_maintenance','cs_maintenance','pay_maintenance',1600000)",
    )
    await db.exec(
      "select confirm_provider_payment('evt_maintenance','cs_maintenance','pay_maintenance',1600000)",
    )
    expect(
      await scalar('select paid as value from reservations where id=$1', [id]),
    ).toBe(1600000)
    expect(
      await scalar(
        "select count(*)::int as value from transactions where reference='pay_maintenance'",
      ),
    ).toBe(1)
    await identity('super')
    await db.exec("select configure_maintenance(false,'')")
  })
})
describe('date-correct reschedule approval and five-day refund policy', () => {
  it('checks ownership, original date, availability and duplicate requests without moving the booking', async () => {
    const id = await ownerDraft('2095-01-01', 100)
    await db.query('select finalize_reservation($1)', [id])
    await identity('manager')
    await db.query("select manager_reservation_status($1,'approved')", [id])
    await identity('other_customer')
    await expect(
      db.query(
        "select request_reschedule($1,'2095-01-02','Different date please')",
        [id],
      ),
    ).rejects.toThrow()
    await identity('customer')
    for (const day of ['2020-01-01', '2095-01-01'])
      await expect(
        db.query("select request_reschedule($1,$2,'Different date please')", [
          id,
          day,
        ]),
      ).rejects.toThrow(/different available|at least 3 days/)
    await identity('operator')
    for (const customer of [users.customer, users.other_customer, users.other])
      await db.query(
        "insert into reservations(customer_id,event_name,event_date,guests,menu_set_id,status) values($1,'Capacity fixture','2095-01-05',100,(select id from menu_sets where name='Set Menu No. 1'),'approved')",
        [customer],
      )
    await identity('customer')
    await expect(
      db.query(
        "select request_reschedule($1,'2095-01-05','Need that date please')",
        [id],
      ),
    ).rejects.toThrow(/capacity/)
    const req = await scalar<string>(
      "select request_reschedule($1,'2095-01-02','New date please') as value",
      [id],
    )
    expect(
      await scalar(
        'select event_date::text as value from reservations where id=$1',
        [id],
      ),
    ).toBe('2095-01-01')
    await expect(
      db.query("select request_reschedule($1,'2095-01-03','New date again')", [
        id,
      ]),
    ).rejects.toThrow(/already pending/)
    await identity('customer')
    await expect(
      db.query('select review_reschedule($1,true)', [req]),
    ).rejects.toThrow(/Staff/)
    await identity('manager')
    await db.query('select review_reschedule($1,true)', [req])
    expect(
      await scalar(
        'select event_date::text as value from reservations where id=$1',
        [id],
      ),
    ).toBe('2095-01-02')
    expect(
      await scalar(
        'select count(*)::int as value from reservation_reschedules where reservation_id=$1',
        [id],
      ),
    ).toBe(1)
  })
  it('calculates PHP9,000/18,000 and subtracts previous refunds without a second proportional fee', async () => {
    await identity('customer')
    expect(
      await scalar('select refund_eligibility(2000000,1000000) as value'),
    ).toBe(900000)
    expect(
      await scalar('select refund_eligibility(2000000,2000000) as value'),
    ).toBe(1800000)
    await identity('operator')
    const amount = await scalar<{
      gross_amount: number
      fee_amount: number
      eligible_amount: number
    }>('select private.refund_amounts(1000000,450000) as value')
    expect(amount).toMatchObject({
      gross_amount: 550000,
      fee_amount: 100000,
      eligible_amount: 450000,
    })
  })
  it('accepts exactly five full days in Manila and rejects four days or one second after the cutoff', async () => {
    await identity('operator')
    const id = await scalar<string>(
      "insert into reservations(customer_id,event_name,event_date,event_time,guests,menu_set_id,status,total,paid) values($1,'Cutoff fixture','2026-10-20','07:30',100,(select id from menu_sets where name='Set Menu No. 1'),'cancelled',2000000,1000000) returning id as value",
      [users.customer],
    )
    await db.query(
      "insert into cancellations(reservation_id,reason,previous_status,status) values($1,'Test cancellation','approved','approved')",
      [id],
    )
    const evaluate = async (at: string) =>
      scalar<{ eligible: boolean; cutoff_at: string }>(
        'select private.refund_quote($1,$2) as value',
        [id, at],
      )
    expect((await evaluate('2026-10-15T07:30:00+08:00')).eligible).toBe(true)
    expect((await evaluate('2026-10-15T07:30:01+08:00')).eligible).toBe(false)
    expect((await evaluate('2026-10-16T07:30:00+08:00')).eligible).toBe(false)
    expect((await evaluate('2026-10-14T23:30:00Z')).eligible).toBe(true)
    await identity('other_customer')
    await expect(db.query('select refund_preview($1)', [id])).rejects.toThrow(
      /access/,
    )
  })
})

describe('consolidated hours, decisions, readable references and mixed guest chairs',()=>{
 it('deduplicates all valid alternate-phone formats and denies invalid phone writes or staff contact reads by customers',async()=>{
  await identity('customer');let saved:string|undefined;
  for(const phone of ['09987654321','639987654321','+639987654321']){const id=await scalar<string>("select save_contact_number('QA alternate',$1) as value",[phone]);if(saved)expect(id).toBe(saved);saved=id}
  expect(await scalar("select count(*)::int as value from customer_contacts where phone='+639987654321'")).toBe(1)
  for(const phone of ['abc09987654321','0998 7654321','099876543210','+6399876543210']){await expect(db.query("select save_contact_number('Invalid alternate',$1)",[phone])).rejects.toThrow(/Use 09/);await expect(db.query('update profiles set phone=$1 where id=$2',[phone,users.customer])).rejects.toThrow(/Use 09/)}
  const id=await ownerDraft('2093-01-01',100);await expect(db.query('select staff_customer_contact($1)',[id])).rejects.toThrow(/Staff/);await identity('manager');expect((await scalar<{name:string}>('select staff_customer_contact($1) as value',[id])).name).toBeTruthy()
 })
 it('creates immutable unique references while retaining UUID keys and rejects direct customer changes',async()=>{
  const id=await ownerDraft('2093-02-01',100)
  const ref=await scalar<string>('select reservation_reference as value from reservations where id=$1',[id]);expect(ref).toMatch(/^RC-\d{4}-\d{6,}$/)
  await expect(db.query("update reservations set reservation_reference='RC-2093-000000' where id=$1",[id])).rejects.toThrow(/permission denied/)
  await identity('operator');await expect(db.query("update reservations set reservation_reference='RC-2093-000000' where id=$1",[id])).rejects.toThrow(/cannot be changed/)
  const refs=(await db.query<{ref:string}>('select private.next_reservation_reference() ref from generate_series(1,100)')).rows.map(r=>r.ref);expect(new Set(refs).size).toBe(100)
 })
 it('enforces the owner-approved Sunday hours and a blocked date at creation/approval/checkout',async()=>{
  const sunday=new Date('2093-03-01T00:00:00Z');while(sunday.getUTCDay()!==0)sunday.setUTCDate(sunday.getUTCDate()+1);const day=sunday.toISOString().slice(0,10)
  await identity('customer');const hours=await scalar<{opens:string;closes:string;times:string[]}>('select booking_window($1) as value',[day]);expect(hours.opens).toBe('08:00:00');expect(hours.closes).toBe('21:00:00');expect(hours.times[0]).toBe('08:00')
  await expect(ownerDraft(day,100,'Monoblock','Simple buffet setup',undefined,'Round table',{event_time:'07:30'})).rejects.toThrow(/business hours/)
  const id=await ownerDraft(day,100,'Monoblock','Simple buffet setup',undefined,'Round table',{event_time:'20:30'});await db.query('select finalize_reservation($1)',[id])
  await expect(db.query("select configure_business_date($1,true)",[day])).rejects.toThrow(/Staff/)
  await identity('manager');await db.query("select configure_business_date($1,true,null,null,'Approved test closure')",[day]);await expect(db.query("select manager_reservation_status($1,'approved')",[id])).rejects.toThrow(/closed or blocked/)
  await identity('operator');await expect(db.query("select begin_checkout($1,$2,'full')",[id,users.customer])).rejects.toThrow(/closed or blocked/)
  await identity('manager');await db.query('select remove_business_date($1)',[day])
 })
 it('records a supplied rejection reason only for the correct booking and prevents repeated/unauthorized transitions',async()=>{
  const id=await ownerDraft('2093-04-01',100);await db.query('select finalize_reservation($1)',[id])
  await expect(db.query("select manager_reservation_status($1,'rejected','Forged decision')",[id])).rejects.toThrow(/Staff/)
  await identity('manager');await db.query("select manager_reservation_status($1,'rejected','We need clarification of some reservation details.')",[id]);await expect(db.query("select manager_reservation_status($1,'rejected','Second decision')",[id])).rejects.toThrow(/Invalid reservation transition/)
  const decision=await scalar<{reason:string;decision:string}>('select to_jsonb(d) as value from reservation_decisions d where reservation_id=$1',[id]);expect(decision.reason).toContain('clarification');expect(decision.decision).toBe('rejected')
  await identity('customer');expect(await scalar<number>("select count(*)::int as value from notifications where href='/customer/reservations/'||$1 and body like '%clarification%'",[id])).toBe(1)
  const history=await scalar<{reason:string|null}[]>('select reservation_activity($1) as value',[id]);expect(history.some(h=>h.reason?.includes('clarification'))).toBe(true)
  await identity('other_customer');await expect(db.query('select reservation_activity($1)',[id])).rejects.toThrow(/Access denied/)
 })
 it('accepts a blank optional rejection reason without fabricating one',async()=>{
  const id=await ownerDraft('2093-04-02',100);await db.query('select finalize_reservation($1)',[id]);await identity('manager');await db.query("select manager_reservation_status($1,'rejected','   ')",[id]);expect(await scalar('select reason as value from reservation_decisions where reservation_id=$1',[id])).toBeNull()
 })
 it('charges only the selected elegant guest chairs and snapshots unit charges without changing the fixed setup fee',async()=>{
  await identity('customer');const normal=await scalar<string>("select id as value from chair_types where name='Monoblock'"),elegant=await scalar<string>("select id as value from chair_types where name='Elegant chair'")
  const id=await ownerDraft('2093-05-01',100,'Elegant chair','Birthday setup',undefined,'Round table',{chairs:[{id:elegant,quantity:30},{id:normal,quantity:70}]})
  const quote=await scalar<{pricing:Record<string,number>;selection_snapshot:{name:string;quantity:number;unit_amount:number}[]}>('select to_jsonb(r) as value from reservations r where id=$1',[id]);expect(quote.pricing.setup).toBe(1500000);expect(quote.pricing.chair_upgrade).toBe(30000);expect(quote.pricing.total).toBe(4730000);expect(quote.selection_snapshot.find(s=>s.name==='Elegant chair')).toMatchObject({quantity:30,unit_amount:1000})
  for(const count of [0,-1,0.5,101])await expect(ownerDraft('2093-05-02',100,'Elegant chair','Simple buffet setup',undefined,'Round table',{chairs:[{id:elegant,quantity:count}]})).rejects.toThrow(/whole numbers/)
  await db.query('select finalize_reservation($1)',[id]);expect(await scalar('select count(*)::int as value from reservation_tables_chairs where reservation_id=$1',[id])).toBe(2)
 })
 it('preserves the original event/time until approval and requires a replacement time that fits the new date',async()=>{
  const initial='2093-06-01',replacement='2093-06-02';const id=await ownerDraft(initial,100);await db.query('select finalize_reservation($1)',[id]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[id]);await db.query("select configure_business_date($1,false,'16:00','18:00','Approved special hours')",[replacement])
  await identity('customer');await expect(db.query("select request_reschedule($1,$2,'Different schedule please')",[id,replacement])).rejects.toThrow(/business hours/)
  const req=await scalar<string>("select request_reschedule($1,$2,'Different schedule please','16:30') as value",[id,replacement]);expect(await scalar<string>('select event_date::text as value from reservations where id=$1',[id])).toBe(initial)
  await identity('manager');await db.query('select review_reschedule($1,true)',[req]);expect(await scalar<string>('select event_time::text as value from reservations where id=$1',[id])).toBe('16:30:00');expect(await scalar<string>('select old_time::text as value from reservation_reschedules where reservation_id=$1',[id])).toBe('12:00:00');await db.query('select remove_business_date($1)',[replacement])
 })
 it('makes a genuinely available optional add-on work across buffet, birthday and wedding without inventing production products',async()=>{
  await identity('operator');const addon=await scalar<string>("insert into add_ons(name,price) values('Isolated approved add-on fixture',13750) returning id as value")
  for(const [i,setup] of ['Simple buffet setup','Birthday setup','Wedding setup'].entries()){
   const id=await ownerDraft('2093-07-0'+(i+1),100,'Monoblock',setup,undefined,'Round table',{add_ons:[{id:addon,quantity:2}]});const r=await scalar<{pricing:Record<string,number>;selection_snapshot:{name:string;quantity:number;subtotal:number}[]}>('select to_jsonb(r) as value from reservations r where id=$1',[id]);expect(r.pricing.add_ons).toBe(27500);expect(r.selection_snapshot.find(x=>x.name==='Isolated approved add-on fixture')).toMatchObject({quantity:2,subtotal:27500})
  }
  for(const quantity of [0,-1,1.5,1001])await expect(ownerDraft('2093-07-04',100,'Monoblock','Simple buffet setup',undefined,'Round table',{add_ons:[{id:addon,quantity}]})).rejects.toThrow(/whole numbers/)
  await identity('operator');await db.query('update add_ons set active=false where id=$1',[addon])
 })
})

describe('catalog food photographs',()=>{
 it('allows staff photo edits, rejects customer/anonymous edits, and retains catalog identity and price',async()=>{
  for(const table of ['dishes','drinks','desserts']){
   await identity('operator');const row=(await db.query<{id:string;name:string}>(`select id,name from ${table} limit 1`)).rows[0]
   await identity('customer');await expect(db.query(`update ${table} set image_url='https://example.com/test.jpg' where id=$1`,[row.id])).resolves.toMatchObject({affectedRows:0})
   await db.exec('reset role;set role anon');await expect(db.query(`update ${table} set image_url='https://example.com/test.jpg' where id=$1`,[row.id])).rejects.toThrow(/permission denied/)
   await identity('manager');await db.query(`update ${table} set image_url='https://example.com/menu.jpg',image_credit='QA photographer',image_source_url='https://example.com/source' where id=$1`,[row.id]);expect(await scalar(`select name as value from ${table} where id=$1`,[row.id])).toBe(row.name)
   expect(await scalar(`select image_credit as value from ${table} where id=$1`,[row.id])).toBe('QA photographer')
   for(const url of ['javascript:alert(1)','http://example.com/p.jpg','/images/../private'])await expect(db.query(`update ${table} set image_url=$1 where id=$2`,[url,row.id])).rejects.toThrow(/check constraint/)
   await expect(db.query(`update ${table} set image_source_url='javascript:alert(1)' where id=$1`,[row.id])).rejects.toThrow(/check constraint/)
   await expect(db.query(`update ${table} set image_credit=$1 where id=$2`,['x'.repeat(501),row.id])).rejects.toThrow(/check constraint/)
   await identity('super');await db.query(`update ${table} set image_url=null,image_credit='',image_source_url=null where id=$1`,[row.id])
  }
 })
 it('exports the matching photo schema without granting customer access to the operator snapshot',async()=>{
  await identity('customer');await expect(db.query('select export_application_snapshot()')).rejects.toThrow(/permission denied/)
  await identity('operator');expect((await scalar<{schema_version:string}>('select export_application_snapshot() as value')).schema_version).toBe('0034_ingredient_allergy_warnings.sql')
 })
})

describe('confirmed buffet extras and Wedding rates',()=>{
 const keys=['stage_backdrop','entrance','presidential_table','buffet_setup','diamond_dance_floor']
 it('prices every Simple Buffet subset, snapshots setup charges, and leaves basic seating free',async()=>{
  for(let n=0;n<=5;n++){
   const id=await ownerDraft('2091-09-0'+(n+1),100,'Monoblock','Simple buffet setup',undefined,'Round table',{total:1,event_preferences:{setup_inclusions:keys.slice(0,n),component_prices:{stage_backdrop:1}}})
   const r=await scalar<{pricing:Record<string,number>;selection_snapshot:{basis:string;subtotal:number}[]}>('select to_jsonb(r) as value from reservations r where id=$1',[id]);expect(r.pricing.setup).toBe(n*500000);expect(r.pricing.total).toBe(3200000+n*500000);expect(r.pricing.chair_upgrade).toBe(0);expect(r.selection_snapshot.filter(s=>s.basis==='Optional Simple Buffet setup extra').reduce((sum,s)=>sum+s.subtotal,0)).toBe(n*500000)
   if(n===2){const final=await scalar<Record<string,number>>('select finalize_reservation($1) as value',[id]);expect(final.setup).toBe(1000000);const saved=await scalar<{basis:string}[]>('select selection_snapshot as value from reservations where id=$1',[id]);expect(saved.filter(s=>s.basis==='Optional Simple Buffet setup extra')).toHaveLength(2)}
  }
 })
 it('rejects unknown, duplicate or Elegant Chair setup extras for Simple Buffet',async()=>{
  for(const selected of [['elegant_chair'],['stage_backdrop','stage_backdrop'],['made_up']])await expect(ownerDraft('2091-09-15',100,'Monoblock','Simple buffet setup',undefined,'Round table',{event_preferences:{setup_inclusions:selected}})).rejects.toThrow(/Invalid Simple Buffet/)
 })
 it('deducts exactly PHP5,000 for each unchecked Wedding inclusion including an all-unchecked quote',async()=>{
  const all=['stage_backdrop','elegant_chair','entrance','presidential_table','buffet_setup','diamond_dance_floor']
  for(const n of [6,5,1,0]){const id=await ownerDraft('2091-10-'+String(n+1).padStart(2,'0'),100,'Monoblock','Wedding setup',undefined,'Round table',{event_preferences:{setup_inclusions:all.slice(0,n)}});expect(await scalar('select total as value from reservations where id=$1',[id])).toBe(3200000+n*500000)}
 })
})

describe('shared whole-day Elegant Chair inventory',()=>{
 it('requires configured stock, prevents over-allocation, releases cancellations and moves approved reschedules',async()=>{
  await identity('operator');await db.exec("update equipment_inventory set usable_quantity=null where code='elegant_chair'");
  await expect(ownerDraft('2090-11-20',600,'Elegant chair')).rejects.toThrow(/not configured/)
  await identity('manager');const eid=await scalar<string>("select id as value from equipment_inventory where code='elegant_chair'");await db.query('select configure_equipment($1,1000)',[eid]);
  const a=await ownerDraft('2090-11-20',600,'Elegant chair');await db.query('select finalize_reservation($1)',[a]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[a]);
  const b=await ownerDraft('2090-11-21',500,'Elegant chair');await db.query('select finalize_reservation($1)',[b]);await identity('operator');await db.query('update reservations set customer_id=$1,event_date=$2 where id=$3',[users.other_customer,'2090-11-20',b]);await identity('manager');await expect(db.query("select manager_reservation_status($1,'approved')",[b])).rejects.toThrow(/shortage.*500 requested, 400 available/);
  expect(await scalar<number>('select sum(quantity)::int as value from equipment_allocations where event_date=$1',['2090-11-20'])).toBe(600);
  await expect(db.query('select configure_equipment($1,400)',[eid])).rejects.toThrow(/below 600/);
  // Represent a pre-existing shortage without allowing a manager to create one.
  await identity('operator');await db.query('update equipment_inventory set usable_quantity=400 where id=$1',[eid]);await identity('manager');expect((await scalar<{overcommitted:boolean;available:number}[]>("select equipment_availability('2090-11-20') as value")).find(i=>i.overcommitted)).toMatchObject({overcommitted:true,available:0});expect(await scalar('select status::text as value from reservations where id=$1',[a])).toBe('approved');
  expect(await scalar('select adjust_equipment_stock($1,$2,50,$3,gen_random_uuid()) as value',[eid,'add','Partial shortage recovery fixture'])).toMatchObject({total:450});
  await db.query('select set_equipment_active($1,false)',[eid]);await db.query('select set_equipment_active($1,true)',[eid]);expect(await scalar('select usable_quantity as value from equipment_inventory where id=$1',[eid])).toBe(450);
  await identity('operator');await db.query("update reservations set status='cancelled' where id=$1",[a]);await identity('manager');await db.query('select configure_equipment($1,1000)',[eid]);await db.query("select manager_reservation_status($1,'approved')",[b]);
  await identity('other_customer');const request=await scalar<string>("select request_reschedule($1,'2090-11-22','Inventory date move') as value",[b]);await identity('manager');await db.query('select review_reschedule($1,true)',[request]);expect(await scalar("select event_date::text as value from equipment_allocations where reservation_id=$1",[b])).toBe('2090-11-22');expect((await scalar<{available:number;code:string}[]>("select equipment_availability('2090-11-20') as value")).find(i=>i.code==='elegant_chair')?.available).toBe(1000);
  await identity('customer');await expect(db.query('select configure_equipment($1,1000000)',[eid])).rejects.toThrow(/Staff/);await expect(db.query('update equipment_inventory set usable_quantity=1000000')).rejects.toThrow(/permission/);
  await identity('operator');await db.exec('update equipment_inventory set usable_quantity=1000000');
 })
})
async function draftPayloadFrom(rid:string,day:string){
 return scalar<Record<string,unknown>>(`select to_jsonb(r)||jsonb_build_object('id',null,'event_date',$2::text,'consent_accepted',true,'setup_id',(select event_setup_id from reservation_event_setups where reservation_id=r.id),'dish_ids',array(select dish_id from reservation_items where reservation_id=r.id),'table_type_id',(select table_type_id from reservation_tables_chairs where reservation_id=r.id limit 1),'chairs',(select jsonb_agg(jsonb_build_object('id',chair_type_id,'quantity',chair_quantity)) from reservation_tables_chairs where reservation_id=r.id),'feature_ids','[]'::jsonb,'add_ons','[]'::jsonb) as value from reservations r where id=$1`,[rid,day])
}
describe('ingredient-backed allergy matching and recipe authorization',()=>{
 // Artificial recipes below are isolated test evidence, never production seeds.
 type W=import('../src/lib/allergy').AllergyWarning
 type I=import('../src/lib/allergy').RecipeIngredient
 const ingredient=(name:string,tags:string[]=[],aliases:string[]=[],component_of=''):I=>({name,allergen_ids:tags,aliases,component_of,source_note:'Isolated test recipe; not business recipe data'})
 async function recipe(name:string,items:I[],state='verified',contacts:string[]=[],notes=''){
  await identity('manager');const id=await scalar<string>('insert into dishes(name) values($1) returning id as value',[name]);
  await db.query('select save_dish_recipe($1,$2,$3,$4,$5,$6)',[id,JSON.stringify(items),state,contacts,notes,state==='verified']);await identity('customer');return id;
 }
 const warnings=(ids:string[],declared:string[]=[],notes='')=>scalar<W[]>('select allergy_warnings($1,$2,$3) as value',[declared,notes,ids]);
 it('matches Egg to confirmed quail eggs and groups the full risk under that dish',async()=>{
  const id=await recipe('Green Peas with Quail Eggs',[ingredient('Quail eggs',['egg'],['quail egg']),ingredient('Green peas')]);
  const [w]=await warnings([id],['egg']);expect(w.status).toBe('contains');expect(w.requires_ack).toBe(true);expect(w.matches).toEqual([expect.objectContaining({allergen_id:'egg',ingredient:'Quail eggs'})]);
  expect(await warnings([id])).toEqual([]);
  expect(await warnings([id],[],' \t\n ')).toEqual([]);
 })
 it('matches every standardized allergen including fish/shellfish aliases, dairy, soy and compound ingredients',async()=>{
  for(const [input,canonical,label] of[['milk_dairy','milk','Label-confirmed cream'],['soy','soy','Label-confirmed tofu'],['peanut','peanut','Peanuts'],['fish','seafood','Fish'],['shellfish','seafood','Shrimp'],['sesame','sesame','Sesame seeds'],['tree_nuts','tree_nuts','Almonds'],['wheat_gluten','wheat','Label-confirmed wheat flour']]){
   const id=await recipe('Allergen fixture '+input,[ingredient(label,[input],[],'Confirmed sauce or main ingredient')]);const [w]=await warnings([id],[canonical]);expect(w.matches[0]).toMatchObject({allergen_id:canonical,ingredient:label});expect(w.requires_ack).toBe(true);
  }
  const id=await recipe('Multiple allergen fixture',[ingredient('Label-confirmed egg mayonnaise',['egg'],[],'Dressing'),ingredient('Label-confirmed dairy butter',['milk']),ingredient('Label-confirmed soy sauce',['soy','wheat'])]);const [w]=await warnings([id],['egg','milk','soy','wheat']);expect(w.matches.map(m=>m.allergen_id).sort()).toEqual(['egg','milk','soy','wheat']);
 })
 it('uses exact custom ingredient names and reliable aliases, not short substrings or unstructured guesses',async()=>{
  const id=await recipe('Custom ingredient fixture',[ingredient('Garlic',[],['bawang']),ingredient('Peanuts',['peanut']),ingredient('Green onion',[],['spring onion'])]);
  expect((await warnings([id],[],'garlic, spring onion'))[0].matches.map(m=>m.ingredient).sort()).toEqual(['Garlic','Green onion']);
  expect((await warnings([id],[],'BAWANG'))[0].matches[0].ingredient).toBe('Garlic');
  const [short]=await warnings([id],[],'pea');expect(short.matches).toEqual([]);expect(short.risk_types).toContain('custom_unresolved');
  const [text]=await warnings([id],[],'I react badly to some sauces');expect(text.status).toBe('uncertain');expect(text.requires_ack).toBe(true);
  const [unresolved]=await warnings([id],[],'???');expect(unresolved.risk_types).toContain('custom_unresolved');expect(unresolved.requires_ack).toBe(true);
 })
 it('separates confirmed matches, unknown recipes and possible cross-contact without safe-food claims',async()=>{
  const incomplete=await recipe('Missing recipe fixture',[],'incomplete');let [w]=await warnings([incomplete],['egg']);expect(w.risk_types).toEqual(['incomplete']);expect(w.requires_ack).toBe(true);
  const known=await recipe('Reviewed no match fixture',[ingredient('Rice')]);[w]=await warnings([known],['egg']);expect(w.status).toBe('reviewed_no_match');expect(w.requires_ack).toBe(false);
  const cross=await recipe('Shared equipment fixture',[ingredient('Rice')],'verified',['egg'],'Shared preparation equipment');[w]=await warnings([cross],['egg']);expect(w.matches).toEqual([]);expect(w.risk_types).toContain('cross_contact');expect(w.cross_contact_allergens).toEqual(['Egg']);
 })
 it('invalidates acknowledgments when declarations, notes, selections or recipe revisions change',async()=>{
  const first=await recipe('Revision fixture',[ingredient('Egg',['egg'])]),second=await recipe('Added dish fixture',[ingredient('Milk',['milk'])]);
  const original=(await warnings([first],['egg']))[0];expect((await warnings([first],['egg','milk']))[0].token).not.toBe(original.token);expect((await warnings([first],['egg'],'garlic'))[0].token).not.toBe(original.token);
  expect((await warnings([first,second],['egg'])).find(w=>w.dish_id===first)!.token).not.toBe(original.token);
  await identity('manager');await db.query('select save_dish_recipe($1,$2,$3)',[first,JSON.stringify([ingredient('Egg',['egg'],['hen egg'])]),'incomplete']);await identity('customer');expect((await warnings([first],['egg']))[0].token).not.toBe(original.token);
  expect(await warnings([second])).toEqual([]);
 })
 it('rejects browser bypass/stale tokens and records an authoritative acknowledged warning snapshot',async()=>{
  const ids=[await recipe('Acknowledged egg fixture',[ingredient('Quail eggs',['egg'])]),await recipe('Reviewed plain fixture A',[ingredient('Rice')]),await recipe('Reviewed plain fixture B',[ingredient('Salt')])];
  const data={dish_ids:ids,allergy_allergen_ids:['egg'],allergy_notes:''};let rid=await ownerDraft('2097-01-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',data);
  await expect(db.query('select finalize_reservation($1)',[rid])).rejects.toThrow(/Allergy acknowledgment required/);
  const good=await warnings(ids,['egg']);rid=await ownerDraft('2097-01-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',{...data,id:rid,allergy_acknowledgments:[{...good[0],token:'forged'}]});await expect(db.query('select finalize_reservation($1)',[rid])).rejects.toThrow(/Allergy acknowledgment required/);
  rid=await ownerDraft('2097-01-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',{...data,id:rid,allergy_acknowledgments:good.filter(w=>w.requires_ack)});await db.query('select finalize_reservation($1)',[rid]);
  const snapshot=await scalar<(W&{acknowledged:boolean;acknowledged_at:string})[]>('select allergy_warning_snapshot as value from reservations where id=$1',[rid]);expect(snapshot.find(w=>w.requires_ack)).toMatchObject({acknowledged:true,matches:[expect.objectContaining({ingredient:'Quail eggs'})]});expect(snapshot.find(w=>w.requires_ack)!.acknowledged_at).toBeTruthy();
  await identity('manager');await db.query('select save_dish_recipe($1,$2,$3)',[ids[0],JSON.stringify([ingredient('Chicken egg',['egg'])]),'incomplete']);expect(await scalar('select allergy_warning_snapshot as value from reservations where id=$1',[rid])).toEqual(snapshot);
  await identity('other_customer');expect(await scalar('select count(*)::int as value from reservations where id=$1',[rid])).toBe(0);
 })
 it('preserves raw allergy notes and acknowledgments in drafts, and recomputes at submission after staff edits',async()=>{
  const base=await ownerDraft('2097-02-01',100),payload=await draftPayloadFrom(base,'2097-02-02');const ids=[await recipe('Draft garlic fixture',[ingredient('Garlic')]),await recipe('Draft plain A',[ingredient('Rice')]),await recipe('Draft plain B',[ingredient('Salt')])];
  const note='Garlic';const original=await warnings(ids,[],note);Object.assign(payload,{dish_ids:ids,allergy_allergen_ids:[],allergy_notes:note,allergy_acknowledgments:original.filter(w=>w.requires_ack)});
  const d=await scalar<{id:string;version:number;data:Record<string,unknown>}>('select to_jsonb(save_booking_draft($1)) as value',[JSON.stringify(payload)]);expect(d.data.allergy_notes).toBe(note);expect(d.data.allergy_acknowledgments).toEqual(original.filter(w=>w.requires_ack));
  await identity('manager');await db.query('select save_dish_recipe($1,$2,$3)',[ids[0],JSON.stringify([ingredient('Garlic',[],['bawang'])]),'incomplete']);await identity('customer');await expect(db.query('select submit_booking_draft($1,$2)',[d.id,d.version])).rejects.toThrow(/Allergy acknowledgment required/);expect(await scalar('select submitted_at as value from reservation_drafts where id=$1',[d.id])).toBeNull();
  Object.assign(payload,{allergy_acknowledgments:(await warnings(ids,[],note)).filter(w=>w.requires_ack)});const updated=await scalar<{version:number}>('select to_jsonb(save_booking_draft($1,$2,3,$3)) as value',[JSON.stringify(payload),d.id,d.version]);const rid=await scalar<string>('select submit_booking_draft($1,$2) as value',[d.id,updated.version]);expect(await scalar('select allergy_notes as value from reservations where id=$1',[rid])).toBe(note);
 })
 it('enforces Manager authorization, explicit complete-recipe confirmation and private customer snapshots',async()=>{
  await identity('manager');const id=await scalar<string>("insert into dishes(name) values('Protected recipe fixture') returning id as value");await expect(db.query('select save_dish_recipe($1,$2,$3)',[id,'[]','verified'])).rejects.toThrow(/actual ingredients/);
  await expect(db.query('select save_dish_recipe($1,$2,$3)',[id,JSON.stringify([ingredient('Rice')]),'verified'])).rejects.toThrow(/explicitly confirm/);
  await db.query('select save_dish_recipe($1,$2,$3,$4,$5,true)',[id,JSON.stringify([ingredient('Rice')]),'verified',[],'']);expect(await scalar('select ingredient_reviewed_by::text as value from dishes where id=$1',[id])).toBe(users.manager);
  await identity('customer');await expect(db.query('select save_dish_recipe($1,$2,$3)',[id,'[]','incomplete'])).rejects.toThrow(/Staff/);await expect(db.query('select recipe_review_queue()')).rejects.toThrow(/Staff/);await expect(db.query("update dishes set ingredient_review_state='verified' where id=$1",[id])).rejects.toThrow(/permission/);await expect(db.query("insert into recipe_ingredients(name,normalized_name,definition_key) values('Forged','forged','forged')")).rejects.toThrow(/permission/);
  await identity('operator');await db.exec('set role anon');await expect(db.query('select allergy_warnings($1,$2,$3)',[['egg'],'',[id]])).rejects.toThrow(/permission/);await expect(db.query('select * from dish_ingredients')).rejects.toThrow(/permission/);await identity('operator');
 })
})

describe('persistent incomplete drafts and allergy acknowledgments',()=>{
 it('saves missing required fields without a reservation/hold, protects ownership/version and submits exactly once',async()=>{
  const template=await ownerDraft('2088-01-01',100),complete=await draftPayloadFrom(template,'2088-01-02');
  const before=await scalar<number>('select count(*)::int as value from reservations');
  let d=await scalar<{id:string;version:number;submitted_at:string|null}>("select to_jsonb(save_booking_draft('{\"event_name\":\"Unfinished\",\"event_date\":\"\"}')) as value");
  expect(await scalar('select count(*)::int as value from reservations')).toBe(before);await expect(db.query('select submit_booking_draft($1,$2)',[d.id,d.version])).rejects.toThrow();
  expect(await scalar('select submitted_at as value from reservation_drafts where id=$1',[d.id])).toBeNull();
  await identity('other_customer');expect(await scalar('select count(*)::int as value from reservation_drafts where id=$1',[d.id])).toBe(0);await expect(db.query('select submit_booking_draft($1,$2)',[d.id,d.version])).rejects.toThrow(/Access denied/);
  await identity('customer');d=await scalar('select to_jsonb(save_booking_draft($1,$2,3,$3)) as value',[JSON.stringify(complete),d.id,d.version]);
  await expect(db.query('select save_booking_draft($1,$2,0,1)',[JSON.stringify(complete),d.id])).rejects.toThrow(/another tab/);
  const rid=await scalar<string>('select submit_booking_draft($1,$2) as value',[d.id,d.version]);expect(await scalar('select submit_booking_draft($1,$2) as value',[d.id,d.version])).toBe(rid);expect(await scalar('select status::text as value from reservations where id=$1',[rid])).toBe('for_approval');expect(await scalar('select count(*)::int as value from reservations')).toBe(before+1);
  expect(await scalar('select count(*)::int as value from equipment_allocations where reservation_id=$1',[rid])).toBe(0);
 })
 it('requires an explicit matching allergy acknowledgment, allows the dish after acknowledgment and invalidates ingredient changes',async()=>{
  await identity('customer');const shrimp=await scalar<string>("select id as value from dishes where name='Shrimp Tempura'"),chicken=await scalar<string>("select id as value from dishes where name='Fried Chicken'"),beef=await scalar<string>("select id as value from dishes where name='Korean Beef'");const dishes=[shrimp,chicken,beef];
  const payload={allergy_allergen_ids:['seafood'],allergy_notes:'Please discuss cross-contact with us',dish_ids:dishes};let rid=await ownerDraft('2088-02-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',payload);
  await expect(db.query('select finalize_reservation($1)',[rid])).rejects.toThrow(/Allergy acknowledgment required/);
  const warnings=await scalar<{token:string;dish_id:string;allergen_id:string}[]>('select allergy_warnings($1,$2,$3) as value',[['seafood'],payload.allergy_notes,dishes]);expect(warnings).toHaveLength(3);
  rid=await ownerDraft('2088-02-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',{...payload,id:rid,allergy_acknowledgments:warnings});await db.query('select finalize_reservation($1)',[rid]);
  await identity('manager');await db.query('select configure_dish_allergens($1,$2,true)',[shrimp,['seafood','milk']]);const changed=await scalar<{token:string;dish_id:string}[]>('select allergy_warnings($1,$2,$3) as value',[['seafood'],payload.allergy_notes,dishes]);expect(changed.find(w=>w.dish_id===shrimp)!.token).not.toBe(warnings.find(w=>w.dish_id===shrimp)!.token);
  await identity('customer');await expect(db.query('select configure_dish_allergens($1,$2,true)',[shrimp,[]])).rejects.toThrow(/Staff/);
  expect(await scalar('select allergen_info_reviewed as value from dishes where id=$1',[chicken])).toBe(false);
 })
})
describe('tax snapshots and staff-assigned discounts',()=>{
 it('computes inclusive, exclusive, non-VAT and centavo rounding without changing inclusive gross totals',async()=>{
  await identity('operator');const calc=(gross:number,mode:string,kind:string|null=null,value:number|null=null)=>scalar<Record<string,number>>('select private.financial_quote($1,$2,$3,$4) as value',[gross,kind,value,JSON.stringify({mode,rate_bps:1200,business_confirmed:false})]);
  expect(await calc(11200,'vat_inclusive')).toMatchObject({total:11200,taxable_basis:10000,vat_amount:1200});expect(await calc(10000,'vat_exclusive')).toMatchObject({total:11200,taxable_basis:10000,vat_amount:1200});expect(await calc(11200,'non_vat')).toMatchObject({total:11200,vat_amount:0});expect(await calc(1,'vat_inclusive')).toMatchObject({total:1,vat_amount:0});expect(await calc(11200,'vat_inclusive','percentage',1000)).toMatchObject({total:10080,discount_amount:1120,vat_amount:1080});await expect(calc(100,'non_vat','fixed',101)).rejects.toThrow(/exceeds/);
 })
 it('rejects customer discount forgery and paid/open-checkout changes; enforces one offer, eligibility, usage caps and audit',async()=>{
  const a=await ownerDraft('2088-03-01',100),b=await ownerDraft('2088-03-02',100);await identity('manager');const offer=await scalar<string>('select save_discount_offer($1) as value',[JSON.stringify({name:'Isolated approved discount',kind:'percentage',value:1000,min_guests:100,usage_cap:1})]);
  await identity('customer');await expect(db.query('select apply_reservation_discount($1,$2,$3)',[a,offer,'Forged user promo'])).rejects.toThrow(/Staff/);await expect(db.query('insert into reservation_discounts(reservation_id,promo_id) values($1,$2)',[a,offer])).rejects.toThrow(/permission/);
  await identity('manager');await db.query('select apply_reservation_discount($1,$2,$3)',[a,offer,'Confirmed test adjustment']);expect(await scalar('select total as value from reservations where id=$1',[a])).toBe(2880000);expect(await scalar('select paid as value from reservations where id=$1',[a])).toBe(0);await expect(db.query('select apply_reservation_discount($1,$2,$3)',[a,offer,'No stacking'])).rejects.toThrow(/do not stack/);await expect(db.query('select apply_reservation_discount($1,$2,$3)',[b,offer,'Usage test'])).rejects.toThrow(/cap reached/);
  await db.query('select apply_reservation_discount($1,null,$2)',[a,'Remove test discount']);expect(await scalar('select total as value from reservations where id=$1',[a])).toBe(3200000);
  await identity('operator');await db.query("update reservations set paid=100,payment_status='partially_paid' where id=$1",[a]);await identity('manager');await expect(db.query('select apply_reservation_discount($1,$2,$3)',[a,offer,'No paid adjustment'])).rejects.toThrow(/unpaid/);
  expect(await scalar<number>("select count(*)::int as value from audit_logs where action='discount.applied' and entity_id=$1",[a])).toBe(0);await identity('super');expect(await scalar<number>("select count(*)::int as value from audit_logs where action='discount.applied' and entity_id=$1",[a])).toBe(1);
 })
})
describe('D-7 through D-1 reminder idempotency and lifecycle',()=>{
 it('queues one in-app and one email per booking/day after the Manila send hour, stops cancelled events and protects worker RPCs',async()=>{
  const rid=await ownerDraft('2088-04-08',100);await db.query('select finalize_reservation($1)',[rid]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[rid]);await identity('customer');await db.query('select update_reminder_preferences(true,true)');await expect(db.query('select enqueue_event_reminders()')).rejects.toThrow(/permission/);
  await identity('operator');expect(await scalar("select enqueue_event_reminders('2088-04-01T06:59:00+08:00') as value")).toBe(0);await db.query("select enqueue_event_reminders('2088-04-01T07:00:00+08:00')");await db.query("select enqueue_event_reminders('2088-04-01T07:05:00+08:00')");expect(await scalar('select count(*)::int as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1 and reminder_date=$2',[rid,'2088-04-01'])).toBe(2);
  for(let day=2;day<=7;day++)await db.query('select enqueue_event_reminders($1)',[`2088-04-0${day}T07:00:00+08:00`]);expect(await scalar('select count(*)::int as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1',[rid])).toBe(14);await db.query("select enqueue_event_reminders('2088-04-08T07:00:00+08:00')");expect(await scalar('select count(*)::int as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1',[rid])).toBe(14);
  await db.query("update reservations set status='cancelled' where id=$1",[rid]);expect(await scalar('select count(*)::int as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1 and channel=$2 and status<>$3',[rid,'email','cancelled'])).toBe(0);
  await identity('customer');await db.query('select update_reminder_preferences(true,false)');
 })
})

describe('panel edge cases',()=>{
 it('allows a corrected guest/chair reduction in a draft without leaving an oversized allocation',async()=>{
  const id=await ownerDraft('2087-01-01',200,'Elegant chair');await ownerDraft('2087-01-01',100,'Elegant chair','Simple buffet setup',undefined,'Round table',{id});expect(await scalar('select guests as value from reservations where id=$1',[id])).toBe(100);expect(await scalar('select sum(chair_quantity)::int as value from reservation_tables_chairs where reservation_id=$1',[id])).toBe(100);
 })
 it('normalizes form-shaped draft seating/add-ons and reuses an existing reservation instead of creating another',async()=>{
  const id=await ownerDraft('2087-02-01',100),payload=await draftPayloadFrom(id,'2087-02-01');const normal=await scalar<string>("select id as value from chair_types where name='Monoblock'");payload.chair_quantities={};payload.chair_type_id=normal;payload.elegant_chair_quantity=0;payload.addon_quantities={};delete payload.chairs;delete payload.add_ons;
  const d=await scalar<{id:string;version:number}>('select to_jsonb(save_booking_draft($1,null,3,null,$2)) as value',[JSON.stringify(payload),id]);const before=await scalar('select count(*)::int as value from reservations');expect(await scalar('select submit_booking_draft($1,$2) as value',[d.id,d.version])).toBe(id);expect(await scalar('select count(*)::int as value from reservations')).toBe(before);
 })
 it('cancels stale queued emails after rescheduling and prevents an unaccepted email from being marked sent',async()=>{
  const id=await ownerDraft('2087-03-08',100);await db.query('select finalize_reservation($1)',[id]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[id]);await identity('customer');await db.query('select update_reminder_preferences(true,true)');await identity('operator');await db.query("select enqueue_event_reminders('2087-03-01T07:00:00+08:00')");const email=await scalar<string>("select id as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1 and channel='email'",[id]);await expect(db.query("select finish_reminder_email($1,'sent',null)",[email])).rejects.toThrow(/acceptance/);
  await db.query("update reservations set event_date='2087-03-12' where id=$1",[id]);expect(await scalar('select status as value from reminder_deliveries where id=$1',[email])).toBe('cancelled');await db.query("select enqueue_event_reminders('2087-03-05T07:00:00+08:00')");expect(await scalar("select count(*)::int as value from reminder_deliveries where audience=$$customer$$ and reservation_id=$1 and event_date='2087-03-12' and reminder_date='2087-03-05'",[id])).toBe(2);await identity('customer');await db.query('select update_reminder_preferences(true,false)');
 })
})

describe('verified payment when shared equipment fills during checkout',()=>{
 it('records money once, preserves pending review, and never oversells chairs',async()=>{
  await identity('manager');const eid=await scalar<string>("select id as value from equipment_inventory where code='elegant_chair'");await db.query('select configure_equipment($1,1000)',[eid]);
  const a=await ownerDraft('2086-12-20',600,'Elegant chair');await db.query('select finalize_reservation($1)',[a]);await identity('operator');const p=await scalar<{id:string;amount:number}>("select to_jsonb(begin_checkout($1,$2,'partial')) as value",[a,users.customer]);await db.query("update payments set external_session_id='cs_stock_filled' where id=$1",[p.id]);
  const b=await ownerDraft('2086-12-21',500,'Elegant chair');await db.query('select finalize_reservation($1)',[b]);await identity('operator');await db.query('update reservations set customer_id=$1,event_date=$2 where id=$3',[users.other_customer,'2086-12-20',b]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[b]);
  await identity('operator');for(let i=0;i<2;i++)await db.query("select confirm_provider_payment('evt_stock_filled','cs_stock_filled','pay_stock_filled',$1)",[p.amount]);
  expect(await scalar('select paid as value from reservations where id=$1',[a])).toBe(p.amount);expect(await scalar('select status::text as value from reservations where id=$1',[a])).toBe('for_approval');expect(await scalar("select count(*)::int as value from transactions where reference='pay_stock_filled'")).toBe(1);expect(await scalar('select sum(quantity)::int as value from equipment_allocations where event_date=$1',['2086-12-20'])).toBe(500);expect(await scalar('select amount as value from balances where reservation_id=$1',[a])).toBe(p.amount);
  await identity('manager');await expect(db.query("select manager_reservation_status($1,'approved')",[a])).rejects.toThrow(/shortage/);await identity('operator');await db.exec('update equipment_inventory set usable_quantity=1000000');
 })
})

describe('customer account discounts', () => {
  async function assign(bps:number,reason='Approved account discount test') {
    await identity('manager')
    await db.query('select set_customer_account_discount($1,$2,$3)',[users.customer,bps,reason])
  }
  async function resetAccount() {
    await identity('operator')
    await db.query("update profiles set account_discount_bps=0,account_discount_reason='',account_discount_changed_by=null,account_discount_changed_at=null where id=$1",[users.customer])
  }
  it('permits staff assignments, changes and removals with an audit trail, and rejects forged account discounts',async()=>{
    try {
      await identity('customer')
      await expect(db.query('select set_customer_account_discount($1,2000,$2)',[users.customer,'Customer forgery'])).rejects.toThrow(/Staff/)
      await expect(db.query('update profiles set account_discount_bps=2000 where id=$1',[users.customer])).rejects.toThrow(/permission/)
      await identity('manager')
      await expect(db.query('select set_customer_account_discount($1,2000,$2)',[users.manager,'Wrong role'])).rejects.toThrow(/customer accounts/)
      for(const rate of [-1,10001])await expect(db.query('select set_customer_account_discount($1,$2,$3)',[users.customer,rate,'Invalid rate'])).rejects.toThrow(/percentage/)
      await expect(db.query('select set_customer_account_discount($1,500,$2)',[users.customer,'x'])).rejects.toThrow(/reason/)
      await assign(500,'Account assignment audit fixture');await assign(1000,'Account update audit fixture');await assign(0,'Account removal audit fixture')
      await identity('super')
      const actions=(await db.query<{action:string}>("select action from audit_logs where entity_id=$1 and details->>'reason' like 'Account % audit fixture'",[users.customer])).rows.map(x=>x.action)
      expect(actions.sort()).toEqual(['account_discount.assigned','account_discount.updated','account_discount.removed'].sort())
    }finally{await resetAccount()}
  })
  it('automatically quotes new reservations at 5, 10, 15 and 20 percent and ignores customer-supplied rates',async()=>{
    try{
      for(const [index,bps]of[500,1000,1500,2000].entries()){
        await assign(bps)
        const rid=await ownerDraft(`2084-01-0${index+1}`,100,'Monoblock','Simple buffet setup',undefined,'Round table',{account_discount_bps:9000,discount_percent:90,total:1})
        await db.query('select finalize_reservation($1)',[rid])
        const snapshot=await scalar<Record<string,number|string>>('select financial_snapshot as value from reservations where id=$1',[rid]),total=3200000-3200000*bps/10000
        expect(snapshot).toMatchObject({gross_subtotal:3200000,discount_source:'account',discount_percent:bps/100,discount_amount:3200000*bps/10000,total,vat_amount:Math.round(total*1200/11200)})
        expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(total)
        expect(await scalar('select source as value from reservation_discounts where reservation_id=$1',[rid])).toBe('account')
      }
    }finally{await resetAccount()}
  })
  it('persists a changed unpaid quote for review before checkout and freezes pending/verified payment amounts',async()=>{
    try{
      const rid=await ownerDraft('2084-02-01',100);await db.query('select finalize_reservation($1)',[rid])
      const before=await scalar<{captured_at:string}>('select financial_snapshot as value from reservations where id=$1',[rid])
      await assign(1000)
      await identity('operator')
      expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(3200000)
      await expect(db.query('select begin_checkout($1,$2,$3)',[rid,users.customer,'partial'])).rejects.toThrow(/Refresh and review/)
      expect(await scalar('select count(*)::int as value from payments where reservation_id=$1',[rid])).toBe(0)
      await identity('customer')
      expect(await scalar('select prepare_checkout_quote($1,$2,$3) as value',[rid,3200000,before.captured_at])).toMatchObject({quote_updated:true,total:2880000})
      const quote=await scalar<{captured_at:string}>('select financial_snapshot as value from reservations where id=$1',[rid])
      expect(await scalar('select prepare_checkout_quote($1,$2,$3) as value',[rid,2880000,quote.captured_at])).toMatchObject({quote_updated:false})
      await identity('other_customer');await expect(db.query('select prepare_checkout_quote($1)',[rid])).rejects.toThrow(/access/)
      await identity('operator')
      const payment=await scalar<{id:string;amount:number}>('select to_jsonb(begin_checkout($1,$2,$3)) as value',[rid,users.customer,'partial'])
      expect(payment.amount).toBe(1440000)
      await db.query("update payments set external_session_id='account-discount-test-session' where id=$1",[payment.id])
      await assign(2000);await identity('customer')
      expect(await scalar('select prepare_checkout_quote($1) as value',[rid])).toMatchObject({quote_updated:false,total:2880000})
      await identity('operator')
      await expect(db.query('select confirm_provider_payment($1,$2,$3,$4)',['account-wrong-amount','account-discount-test-session','account-fixture-payment',1440001])).rejects.toThrow(/match/)
      await db.query('select confirm_provider_payment($1,$2,$3,$4)',['account-correct-amount','account-discount-test-session','account-fixture-payment',payment.amount])
      const frozen=await scalar('select financial_snapshot as value from reservations where id=$1',[rid])
      await assign(0);await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid])
      expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toEqual(frozen)
      await identity('operator')
      const balance=await scalar<{amount:number}>('select to_jsonb(begin_checkout($1,$2,$3)) as value',[rid,users.customer,'balance'])
      expect(balance.amount).toBe(1440000)
      expect(await scalar('select sum(amount)::bigint as value from transactions where reservation_id=$1 and kind=$2',[rid,'payment'])).toBe(1440000)
      expect(await scalar('select paid as value from reservations where id=$1',[rid])).toBe(1440000)
      await db.query("update payments set external_session_id='account-balance-test-session' where reservation_id=$1 and status='pending'",[rid])
      await db.query('select confirm_provider_payment($1,$2,$3,$4)',['account-balance-paid','account-balance-test-session','account-balance-fixture-payment',balance.amount])
      await db.query('select confirm_provider_payment($1,$2,$3,$4)',['account-balance-paid','account-balance-test-session','account-balance-fixture-payment',balance.amount])
      expect(await scalar('select paid as value from reservations where id=$1',[rid])).toBe(2880000)
      expect(await scalar('select count(*)::int as value from transactions where reservation_id=$1',[rid])).toBe(2)
      await db.query("update reservations set status='completed' where id=$1",[rid])
      await assign(500);await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid])
      expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toEqual(frozen)
    }finally{await resetAccount()}
  })
  it('explicit promotions replace account discounts without stacking, and removal restores the account rate',async()=>{
    try{
      await assign(1000);const rid=await ownerDraft('2084-03-01',100)
      await identity('manager')
      const offer=await scalar<string>('select save_discount_offer($1) as value',[JSON.stringify({name:'Account nonstacking fixture',kind:'percentage',value:500})])
      await db.query('select apply_reservation_discount($1,$2,$3)',[rid,offer,'Explicit promotion replaces account'])
      expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({total:3040000,discount_source:'promotion',discount_percent:5})
      await assign(2000);await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid])
      expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(3040000)
      await identity('manager');await db.query('select apply_reservation_discount($1,null,$2)',[rid,'Remove promotional override'])
      expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({total:2560000,discount_source:'account',discount_percent:20})
      await assign(0);await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid])
      expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(3200000)
    }finally{await resetAccount()}
  })
  it('uses configured inclusive, exclusive and non-VAT treatment after the account discount',async()=>{
    await identity('operator');const policy=await scalar('select value as value from app_settings where key=$1',['tax_policy'])
    try{
      await assign(1000)
      for(const [index,mode]of['vat_inclusive','vat_exclusive','non_vat'].entries()){
        await identity('super');await db.query('select configure_tax_policy($1,1200,true)',[mode])
        const rid=await ownerDraft(`2084-04-0${index+1}`,100),expected=mode==='vat_exclusive'?3225600:2880000
        expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({discount_amount:320000,total:expected,vat_amount:mode==='non_vat'?0:mode==='vat_exclusive'?345600:308571})
      }
    }finally{await resetAccount();await db.query('update app_settings set value=$1 where key=$2',[JSON.stringify(policy),'tax_policy'])}
  })
})

describe('staff customer directory and physical chair adjustments',()=>{
 it('confirms initial stock once and preserves new stock when an outdated initialization is retried',async()=>{
  await identity('operator');const eid=await scalar<string>("insert into equipment_inventory(code,name) values('qa_initial_confirmation','QA initial stock') returning id as value")
  try{await identity('customer');await expect(db.query('select confirm_equipment_stock($1,100)',[eid])).rejects.toThrow(/Staff/);await identity('manager');expect(await scalar('select confirm_equipment_stock($1,100) as value',[eid])).toMatchObject({total:100});await db.query('select adjust_equipment_stock($1,$2,50,$3,gen_random_uuid())',[eid,'add','After initial confirmation']);await expect(db.query('select confirm_equipment_stock($1,200)',[eid])).rejects.toThrow(/already confirmed/);await db.query('select set_equipment_active($1,false)',[eid]);expect(await scalar('select usable_quantity as value from equipment_inventory where id=$1',[eid])).toBe(150)}finally{await identity('operator');await db.query('delete from equipment_inventory where id=$1',[eid])}
 })
 it('restricts the legitimate Auth email directory to active staff and searches/paginates without exposing credentials',async()=>{
  await identity('operator');await db.query('update auth.users set email=$1 where id=$2',['directory-fixture@example.invalid',users.customer])
  try{
   await identity('customer');await expect(db.query('select staff_customer_directory()')).rejects.toThrow(/Staff/)
   await db.exec('reset role;set role anon');await expect(db.query('select staff_customer_directory()')).rejects.toThrow(/permission/)
   await identity('manager')
   const found=await scalar<{customers:{id:string;email:string}[];total:number}>('select staff_customer_directory($1,0,20) as value',['DIRECTORY-FIXTURE@'])
   expect(found.total).toBe(1);expect(found.customers[0]).toMatchObject({id:users.customer,email:'directory-fixture@example.invalid'})
   expect(Object.keys(found.customers[0]).sort()).toEqual(['id','full_name','email','account_status','account_discount_bps','account_discount_changed_at','assignment_id','usage_type','expires_on','discount_status','expiration_option'].sort())
   const a=await scalar<{customers:{id:string}[]}>('select staff_customer_directory($1,0,1) as value',['']),b=await scalar<{customers:{id:string}[]}>('select staff_customer_directory($1,1,1) as value',[''])
   expect(a.customers[0].id).not.toBe(b.customers[0].id)
   expect(await scalar('select staff_customer_directory($1) as value',['no-such-customer-unique-fixture'])).toMatchObject({total:0,customers:[]})
   await expect(db.query('select staff_customer_directory($1,-1,20)',[''])).rejects.toThrow(/Invalid/)
   await identity('operator');await db.query("update profiles set account_status='suspended' where id=$1",[users.manager]);await identity('manager');await expect(db.query('select staff_customer_directory()')).rejects.toThrow(/Staff/)
  }finally{await identity('operator');await db.query("update profiles set account_status='active' where id=$1",[users.manager]);await db.query('update auth.users set email=null where id=$1',[users.customer])}
 })
 it('uses one account discount across Simple Buffet, Birthday and Wedding, then removes it for future bookings',async()=>{
  try{
   await identity('manager');expect(await scalar('select manage_customer_account_discount($1,1000) as value',[users.customer])).toMatchObject({previous_bps:0,percentage_bps:1000})
   for(const [index,setup]of['Simple buffet setup','Birthday setup','Wedding setup'].entries()){
    const rid=await ownerDraft(`2083-01-0${index+1}`,100,'Monoblock',setup,undefined,'Round table',{event_preferences:{occasion_type:index===1?'birthday':index===2?'wedding':'other',theme:'',colors:'',celebrant_age:null,setup_inclusions:index===1?birthdayKeys:index===2?weddingKeys:[]}})
    await db.query('select finalize_reservation($1)',[rid])
    const f=await scalar<{gross_subtotal:number;total:number}>('select financial_snapshot as value from reservations where id=$1',[rid])
    expect(f.total).toBe(Math.round(f.gross_subtotal*.9))
   }
   await identity('manager');expect(await scalar('select manage_customer_account_discount($1,2000) as value',[users.customer])).toMatchObject({previous_bps:1000,percentage_bps:2000})
   const changed=await ownerDraft('2083-01-04',100);expect(await scalar('select total as value from reservations where id=$1',[changed])).toBe(2560000)
   await identity('manager');await db.query('select manage_customer_account_discount($1,0)',[users.customer])
   const normal=await ownerDraft('2083-01-05',100);expect(await scalar('select total as value from reservations where id=$1',[normal])).toBe(3200000)
   await identity('customer');await expect(db.query('select manage_customer_account_discount($1,2000)',[users.other])).rejects.toThrow(/Staff/)
  }finally{await identity('operator');await db.query("update profiles set account_discount_bps=0,account_discount_reason='' where id=$1",[users.customer])}
 })
 it('adds/removes both chair types atomically, retains history and deduplicates retried adjustments',async()=>{
  for(const code of['qa_elegant_adjustment','qa_monoblock_adjustment']){
   await identity('operator');const eid=await scalar<string>('insert into equipment_inventory(code,name,usable_quantity) values($1,$2,300) returning id as value',[code,code])
   try{
    await identity('customer');await expect(db.query('select adjust_equipment_stock($1,$2,200,$3,gen_random_uuid())',[eid,'add','Purchased fixture'])).rejects.toThrow(/Staff/)
    await identity('manager');const operation=await scalar<string>('select gen_random_uuid() as value')
    const add=()=>scalar('select adjust_equipment_stock($1,$2,200,$3,$4) as value',[eid,'add','Purchased fixture',operation])
    expect(await add()).toMatchObject({previous_quantity:300,total:500,change:200});expect(await add()).toMatchObject({total:500})
    await expect(db.query('select adjust_equipment_stock($1,$2,100,$3,$4)',[eid,'add','Purchased fixture',operation])).rejects.toThrow(/already used/)
    expect(await scalar('select adjust_equipment_stock($1,$2,100,$3,gen_random_uuid()) as value',[eid,'remove','Damaged fixture'])).toMatchObject({previous_quantity:500,total:400,change:-100})
    for(const q of[0,-1,1000001])await expect(db.query('select adjust_equipment_stock($1,$2,$3,$4,gen_random_uuid())',[eid,'add',q,'Bad input'])).rejects.toThrow(/positive whole/)
    await expect(db.query('select adjust_equipment_stock($1,$2,$3,$4,gen_random_uuid())',[eid,'add','1.5','Bad input'])).rejects.toThrow()
    await expect(db.query('select adjust_equipment_stock($1,$2,401,$3,gen_random_uuid())',[eid,'remove','Too many'])).rejects.toThrow(/resulting stock/)
    await identity('super');expect(await scalar("select count(*)::int as value from audit_logs where entity_id=$1 and action='equipment.stock_adjusted'",[eid])).toBe(2)
   }finally{await identity('operator');await db.query('delete from equipment_inventory where id=$1',[eid])}
  }
 })
 it('blocks stock reductions below daily commitments, releases allocations once, and leaves physical stock unchanged on cancellation',async()=>{
  const rid=await ownerDraft('2083-02-01',100);await db.query('select finalize_reservation($1)',[rid]);await identity('manager');await db.query("select manager_reservation_status($1,'approved')",[rid])
  await identity('operator');const eid=await scalar<string>("insert into equipment_inventory(code,name,usable_quantity) values('qa_committed_stock','QA commitment stock',200) returning id as value")
  try{
   await db.query("insert into equipment_allocations(reservation_id,equipment_id,event_date,quantity) values($1,$2,'2083-02-01',100)",[rid,eid]);await identity('manager')
   await expect(db.query('select adjust_equipment_stock($1,$2,101,$3,gen_random_uuid())',[eid,'remove','Would break commitments'])).rejects.toThrow(/100 are committed/)
   await expect(db.query('select configure_equipment($1,99)',[eid])).rejects.toThrow(/below 100/)
   await identity('customer');const request=await scalar<string>('select request_cancellation($1,$2) as value',[rid,'Controlled cancellation release'])
   await identity('manager');await db.query('select review_cancellation($1,true)',[request]);await expect(db.query('select review_cancellation($1,true)',[request])).rejects.toThrow(/already reviewed/)
   expect(await scalar('select usable_quantity as value from equipment_inventory where id=$1',[eid])).toBe(200)
   expect(await scalar('select count(*)::int as value from equipment_allocations where reservation_id=$1',[rid])).toBe(0)
   expect(await scalar('select adjust_equipment_stock($1,$2,150,$3,gen_random_uuid()) as value',[eid,'remove','Released commitment'])).toMatchObject({total:50})
  }finally{await identity('operator');await db.query('delete from equipment_allocations where equipment_id=$1',[eid]);await db.query('delete from equipment_inventory where id=$1',[eid])}
 })
 it('requires confirmed Monoblock stock and rejects mixed modern seating above the guest count without changing prices',async()=>{
  await identity('operator');const mono=await scalar<string>("select id as value from equipment_inventory where code='monoblock_chair'")
  try{await db.query('update equipment_inventory set usable_quantity=null where id=$1',[mono]);await expect(ownerDraft('2083-03-01',100)).rejects.toThrow(/Monoblock.*not configured/)}finally{await identity('operator');await db.query('update equipment_inventory set usable_quantity=1000000 where id=$1',[mono])}
  const normal=await scalar<string>("select id as value from chair_types where name='Monoblock'"),elegant=await scalar<string>("select id as value from chair_types where name='Elegant chair'")
  await expect(ownerDraft('2083-03-02',100,'Monoblock','Simple buffet setup',undefined,'Round table',{chairs:[{id:normal,quantity:60},{id:elegant,quantity:60}]})).rejects.toThrow(/guest count|chair type/)
  const mixed=await ownerDraft('2083-03-04',100,'Elegant chair','Simple buffet setup',undefined,'Round table',{chairs:[{id:elegant,quantity:40},{id:normal,quantity:60}]})
  expect(await scalar('select total as value from reservations where id=$1',[mixed])).toBe(3240000)
  const rid=await ownerDraft('2083-03-03',100);expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(3200000)
 })
 it('can reapply the incremental migration without duplicating stock, allocations or export wrappers',async()=>{
  await identity('operator');const before=await scalar('select count(*)::int as value from equipment_allocations')
  await db.exec('begin')
  await db.exec(await readFile('supabase/migrations/0030_customer_directory_chair_stock.sql','utf8'))
  expect(await scalar("select count(*)::int as value from equipment_inventory where code='monoblock_chair'")).toBe(1)
  expect(await scalar('select count(*)::int as value from equipment_allocations')).toBe(before)
  await db.exec('rollback')
 })
})

describe('versioned ongoing and one-time account offers',()=>{
 async function assign(bps=2000,usage='one_time',expiry:string|null=null){
  await identity('manager');const id=await scalar<string|null>('select account_discount_id as value from profiles where id=$1',[users.customer])
  return scalar<{assignment_id:string}>('select save_customer_discount($1,$2,$3,$4,$5) as value',[users.customer,bps,usage,expiry,id])
 }
 async function reset(){await identity('manager');await db.query('select manage_customer_account_discount($1,0)',[users.customer])}
 async function checkout(rid:string,intent='partial'){
  await identity('operator');return scalar<{id:string;amount:number}>("select to_jsonb(begin_checkout($1,$2,$3)) as value",[rid,users.customer,intent])
 }
 async function status(id:string){await identity('operator');return scalar<string>('select private.account_discount_status(a) as value from customer_discount_assignments a where id=$1',[id])}
 it('offers an atomic customer-row save, preserves versions, and rejects stale edits or customer writes',async()=>{
  try{
   const a=await assign(1000,'ongoing');expect(await status(a.assignment_id)).toBe('ACTIVE')
   await identity('customer');await expect(db.query('select save_customer_discount($1,2000,$2,null,$3)',[users.customer,'one_time',a.assignment_id])).rejects.toThrow(/Staff/)
   await expect(db.query('update customer_discount_assignments set percentage_bps=9999 where id=$1',[a.assignment_id])).rejects.toThrow(/permission/)
   expect(await scalar('select count(*)::int as value from customer_discount_assignments where customer_id=$1',[users.other_customer])).toBe(0)
   await expect(db.query('select release_checkout(gen_random_uuid())')).rejects.toThrow(/permission/)
   const b=await assign(1500,'one_time','2090-12-31');expect(await status(a.assignment_id)).toBe('REMOVED')
   await identity('manager');await expect(db.query('select save_customer_discount($1,500,$2,null,$3)',[users.customer,'ongoing',a.assignment_id])).rejects.toThrow(/changed/)
   await expect(db.query("select save_customer_discount($1,500,'ongoing',current_date-2,$2)",[users.customer,b.assignment_id])).rejects.toThrow(/today or a future/)
   await identity('customer');expect(await scalar('select my_account_discount() as value')).toMatchObject({account_discount_bps:1500,status:'ACTIVE',usage_type:'one_time',expires_on:'2090-12-31'})
  }finally{await reset()}
 })
 it('applies ongoing offers to successive Simple Buffet, Birthday and Wedding bookings without consumption',async()=>{
  try{const a=await assign(1000,'ongoing');for(const[index,setup]of['Simple buffet setup','Birthday setup','Wedding setup'].entries()){
   const rid=await ownerDraft(`2090-01-0${index+1}`,100,'Monoblock',setup,undefined,'Round table',{event_preferences:{occasion_type:index===1?'birthday':index===2?'wedding':'other',theme:'',colors:'',celebrant_age:null,setup_inclusions:index===1?birthdayKeys:index===2?weddingKeys:[]}})
   await db.query('select finalize_reservation($1)',[rid]);const f=await scalar<{gross_subtotal:number;total:number}>('select financial_snapshot as value from reservations where id=$1',[rid]);expect(f.total).toBe(Math.round(f.gross_subtotal*.9))
  }expect(await status(a.assignment_id)).toBe('ACTIVE')}finally{await reset()}
 })
 it('honors the inclusive Manila deadline and reprices expired unpaid quotes without consuming them',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-02-01',100);await identity('operator')
   await db.query("update customer_discount_assignments set expiration_option='specific_date',expires_on='2090-11-30' where id=$1",[a.assignment_id])
   expect(await scalar("select private.account_discount_status(a,'2090-11-30T23:59:59.999+08:00') as value from customer_discount_assignments a where id=$1",[a.assignment_id])).toBe('ACTIVE')
   expect(await scalar("select private.account_discount_status(a,'2090-12-01T00:00:00+08:00') as value from customer_discount_assignments a where id=$1",[a.assignment_id])).toBe('EXPIRED')
   await db.query('update customer_discount_assignments set expires_on=(now() at time zone $2)::date-1 where id=$1',[a.assignment_id,'Asia/Manila'])
   await identity('customer');expect(await scalar('select prepare_checkout_quote($1) as value',[rid])).toMatchObject({quote_updated:true,total:3200000});expect(await scalar('select my_account_discount() as value')).toMatchObject({status:'EXPIRED',account_discount_bps:0})
  }finally{await reset()}
 })
 it('does not consume drafts, holds exactly one checkout, and refreshes the competing quote before payment',async()=>{
  try{const a=await assign();const r1=await ownerDraft('2090-03-01',100),r2=await ownerDraft('2090-03-02',100)
   expect(await status(a.assignment_id)).toBe('ACTIVE');await identity('customer');await db.query('select finalize_reservation($1)',[r1]);await db.query('select finalize_reservation($1)',[r2])
   const p=await checkout(r1);expect(p.amount).toBe(1280000);expect(await status(a.assignment_id)).toBe('RESERVED');expect((await checkout(r1)).id).toBe(p.id)
   await expect(checkout(r2)).rejects.toThrow(/changed|reserved/)
   await identity('customer');expect(await scalar('select prepare_checkout_quote($1) as value',[r2])).toMatchObject({quote_updated:true,total:3200000})
   expect((await checkout(r2)).amount).toBe(1600000)
   expect(await status(a.assignment_id)).toBe('RESERVED')
  }finally{await reset()}
 })
 it('consumes once on the verified half payment, keeps balance/frozen VAT terms, and never restores on cancellation/refund',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-04-01',100);await db.query('select finalize_reservation($1)',[rid]);const p=await checkout(rid)
   await db.query("update payments set external_session_id='cs_v2_partial' where id=$1",[p.id]);const frozen=await scalar('select financial_snapshot as value from reservations where id=$1',[rid])
   for(let i=0;i<2;i++)await db.query("select confirm_provider_payment('evt_v2_partial','cs_v2_partial','pay_v2_partial',$1)",[p.amount])
   expect(await status(a.assignment_id)).toBe('USED');expect(await scalar('select count(*)::int as value from audit_logs where entity_id=$1 and action=$2',[a.assignment_id,'account_discount.redeemed'])).toBe(1)
   await assign(500,'ongoing');await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid]);expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toEqual(frozen)
   const balance=await checkout(rid,'balance');expect(balance.amount).toBe(1280000);await db.query("update payments set external_session_id='cs_v2_balance' where id=$1",[balance.id]);await db.query("select confirm_provider_payment('evt_v2_balance','cs_v2_balance','pay_v2_balance',$1)",[balance.amount])
   expect(await scalar('select paid as value from reservations where id=$1',[rid])).toBe(2560000);expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toEqual(frozen)
   await db.query("update reservations set status='cancelled',refunded=100 where id=$1",[rid]);expect(await status(a.assignment_id)).toBe('USED')
   expect(await scalar("select sum(amount)::bigint as value from transactions where reservation_id=$1 and kind='payment'",[rid])).toBe(2560000)
  }finally{await reset()}
 })
 it('releases only unclaimed or provider-confirmed terminal holds, audits once, and safely retries',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-05-01',100);await db.query('select finalize_reservation($1)',[rid]);const p=await checkout(rid)
   await db.query('select release_checkout($1)',[p.id]);await db.query('select release_checkout($1)',[p.id]);expect(await status(a.assignment_id)).toBe('ACTIVE')
   const retry=await checkout(rid);await db.query("update payments set provider_claimed_at=now() where id=$1",[retry.id]);await expect(db.query('select release_checkout($1)',[retry.id])).rejects.toThrow(/Ambiguous/)
   await db.query("update payments set external_session_id='cs_v2_closed' where id=$1",[retry.id]);await expect(db.query('select release_checkout($1,$2)',[retry.id,'wrong'])).rejects.toThrow(/Provider-confirmed/)
   await db.query("select release_checkout($1,'cs_v2_closed')",[retry.id]);expect(await status(a.assignment_id)).toBe('ACTIVE')
   await expect(db.query("select confirm_provider_payment('evt_late_released','cs_v2_closed','pay_late_released',$1)",[retry.amount])).rejects.toThrow(/pending checkout/)
   expect(await status(a.assignment_id)).toBe('ACTIVE');expect(await scalar('select paid as value from reservations where id=$1',[rid])).toBe(0)
   expect(await scalar("select count(*)::int as value from audit_logs where action='account_discount.released' and entity_id=$1",[a.assignment_id])).toBe(2)
  }finally{await reset()}
 })
 it('preserves an edited/removed payable version through expiry until its real payment is verified',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-06-01',100);await db.query('select finalize_reservation($1)',[rid]);const p=await checkout(rid)
   await db.query("update payments set external_session_id='cs_v2_removed' where id=$1",[p.id]);const frozen=await scalar('select financial_snapshot as value from reservations where id=$1',[rid])
   await reset();await identity('operator');await db.query("update customer_discount_assignments set expiration_option='specific_date',expires_on=current_date-1 where id=$1",[a.assignment_id]);await identity('customer');await db.query('select prepare_checkout_quote($1)',[rid]);expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toEqual(frozen)
   await identity('operator');await db.query("select confirm_provider_payment('evt_v2_removed','cs_v2_removed','pay_v2_removed',$1)",[p.amount]);expect(await status(a.assignment_id)).toBe('USED')
  }finally{await reset()}
 })
 it('does not redeem a pending payment when the underlying verifier rejects a replayed event',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-07-01',100);await db.query('select finalize_reservation($1)',[rid]);const p=await checkout(rid)
   await db.query("update payments set external_session_id='cs_v2_duplicate_event' where id=$1",[p.id]);await db.query("select confirm_provider_payment('evt_v2_partial','cs_v2_duplicate_event','pay_unaccepted',$1)",[p.amount])
   expect(await status(a.assignment_id)).toBe('RESERVED');expect(await scalar('select paid as value from reservations where id=$1',[rid])).toBe(0)
  }finally{await reset()}
 })
 it('retains genuine promo precedence and restores complete one-time metadata immediately when it is removed',async()=>{
  try{const a=await assign();const rid=await ownerDraft('2090-08-01',100)
   await identity('manager');const promo=await scalar<string>('select save_discount_offer($1) as value',[JSON.stringify({name:'V2 explicit promo fixture',kind:'percentage',value:500})])
   await db.query('select apply_reservation_discount($1,$2,$3)',[rid,promo,'Explicit promotion fixture'])
   expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({discount_source:'promotion',discount_percent:5,total:3040000})
   expect(await status(a.assignment_id)).toBe('ACTIVE');await identity('manager');await db.query('select apply_reservation_discount($1,null,$2)',[rid,'Restore account offer fixture'])
   expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({discount_source:'account',discount_usage_type:'one_time',discount_assignment_id:a.assignment_id,discount_percent:20,total:2560000})
  }finally{await reset()}
 })
})

describe('account discount expiration options',()=>{
 async function save(option:string,usage='ongoing',date:string|null=null,bps=1000){
  await identity('manager');const previous=await scalar<string|null>('select account_discount_id as value from profiles where id=$1',[users.customer]);
  return scalar<{assignment_id:string;expires_on:string|null;assigned_at:string;expiration_option:string}>('select save_customer_discount($1,$2,$3,$4,$5,$6) as value',[users.customer,bps,usage,date,previous,option]);
 }
 async function reset(){await identity('manager');await db.query('select manage_customer_account_discount($1,0)',[users.customer])}
 for(const [ui,usage]of['ongoing','one_time'].entries())for(const[oi,option]of['none','30_days','90_days','specific_date'].entries()){
  it(`saves and applies ${usage} with ${option}, retaining expiry metadata and an audit`,async()=>{
   try{
    await identity('operator');const today=await scalar<string>("select (clock_timestamp() at time zone 'Asia/Manila')::date::text as value")
    const a=await save(option,usage,option==='specific_date'?today:null)
    const rid=await ownerDraft(`2097-06-${String(ui*4+oi+1).padStart(2,'0')}`,100)
    expect(await scalar('select financial_snapshot as value from reservations where id=$1',[rid])).toMatchObject({discount_percent:10,discount_usage_type:usage,discount_expires_on:a.expires_on,total:2880000})
    await identity('operator');expect(await scalar('select expiration_option as value from customer_discount_assignments where id=$1',[a.assignment_id])).toBe(option)
    expect(await scalar("select expires_on is not distinct from case $2 when 'none' then null::date when '30_days' then (assigned_at at time zone 'Asia/Manila')::date+30 when '90_days' then (assigned_at at time zone 'Asia/Manila')::date+90 else $3::date end as value from customer_discount_assignments where id=$1",[a.assignment_id,option,today])).toBe(true)
    expect(await scalar("select details->>'expiration_option' as value from audit_logs where action='account_discount.expiration_set' and entity_id=$1",[a.assignment_id])).toBe(option)
    await identity('manager');const directory=await scalar<{customers:{id:string;expiration_option:string;expires_on:string|null}[];server_today:string}>('select staff_customer_directory() as value');expect(directory.server_today).toBe(today);expect(directory.customers.find(c=>c.id===users.customer)).toMatchObject({expiration_option:option,expires_on:a.expires_on})
   }finally{await reset()}
  })
 }
 it('uses Manila date rollover, calendar months and leap years independently of the database session timezone',async()=>{
  await identity('operator');await db.exec("set timezone='America/Los_Angeles'")
  try{
   expect(await scalar("select private.discount_expiration('30_days',null,'2026-10-20T00:00:00+08:00')::text as value")).toBe('2026-11-19')
   expect(await scalar("select private.discount_expiration('30_days',null,'2026-10-19T15:59:59Z')::text as value")).toBe('2026-11-18')
   expect(await scalar("select private.discount_expiration('30_days',null,'2026-10-19T16:00:00Z')::text as value")).toBe('2026-11-19')
   expect(await scalar("select private.discount_expiration('30_days',null,'2028-01-31T22:00:00+08:00')::text as value")).toBe('2028-03-01')
   expect(await scalar("select private.discount_expiration('90_days',null,'2026-10-20T23:59:59+08:00')::text as value")).toBe('2027-01-18')
  }finally{await db.exec("set timezone='UTC'")}
 })
 it('rejects tampered preset dates, invalid choices, past/invalid manual dates and unauthorized assignment',async()=>{
  try{
   for(const option of['none','30_days','90_days'])await expect(save(option,'ongoing','2099-12-31')).rejects.toThrow(/server/)
   await expect(save('7_days')).rejects.toThrow(/valid expiration/)
   await expect(save('specific_date')).rejects.toThrow(/today or a future/)
   await expect(save('specific_date','ongoing','2020-01-01')).rejects.toThrow(/today or a future/)
   for(const day of['infinity','-infinity'])await expect(save('specific_date','one_time',day)).rejects.toThrow(/today or a future/)
   await expect(save('specific_date','ongoing','2026-02-30')).rejects.toThrow()
   await identity('customer');await expect(db.query("select save_customer_discount($1,1000,'one_time',null,null,'30_days')",[users.customer])).rejects.toThrow(/Staff/)
   await expect(db.query("select private.discount_expiration('30_days',null,now())")).rejects.toThrow(/permission/)
   await expect(db.query("update customer_discount_assignments set expiration_option='none' where customer_id=$1",[users.customer])).rejects.toThrow(/permission/)
   await identity('operator');const current=await scalar<string|null>('select account_discount_id as value from profiles where id=$1',[users.customer]);await identity('manager');await expect(db.query("select save_customer_discount($1,1000,'ongoing','infinity'::date,$2)",[users.customer,current])).rejects.toThrow(/today or a future/)
  }finally{await reset()}
 })
 it('expires ongoing and unused one-time presets at the inclusive Manila deadline and excludes new bookings',async()=>{
  try{for(const[ui,usage]of['ongoing','one_time'].entries()){
   const a=await save('30_days',usage);await identity('operator')
   expect(await scalar("select private.account_discount_status(a,((expires_on::timestamp+time '23:59:59.999') at time zone 'Asia/Manila')) as value from customer_discount_assignments a where id=$1",[a.assignment_id])).toBe('ACTIVE')
   expect(await scalar("select private.account_discount_status(a,((expires_on+1)::timestamp at time zone 'Asia/Manila')) as value from customer_discount_assignments a where id=$1",[a.assignment_id])).toBe('EXPIRED')
   await db.query("update customer_discount_assignments set expires_on=(clock_timestamp() at time zone 'Asia/Manila')::date-1 where id=$1",[a.assignment_id])
   const rid=await ownerDraft(`2097-07-0${ui+1}`,100);expect(await scalar('select total as value from reservations where id=$1',[rid])).toBe(3200000);expect(await scalar('select my_account_discount() as value')).toMatchObject({status:'EXPIRED',account_discount_bps:0})
  }}finally{await reset()}
 })
 it('does not rewrite finalized quotes or payments when assigning, editing or removing expiration settings',async()=>{
  try{
   await save('90_days');const rid=await ownerDraft('2097-08-01',100);await db.query('select finalize_reservation($1)',[rid]);const before=await scalar('select to_jsonb(r) as value from reservations r where id=$1',[rid])
   for(const option of['30_days','specific_date','none']){await save(option,'one_time',option==='specific_date'?'2095-12-31':null);await identity('operator');expect(await scalar('select to_jsonb(r) as value from reservations r where id=$1',[rid])).toEqual(before)}
   await reset();await identity('operator');expect(await scalar('select to_jsonb(r) as value from reservations r where id=$1',[rid])).toEqual(before);expect(await scalar('select count(*)::int as value from payments where reservation_id=$1',[rid])).toBe(0)
  }finally{await reset()}
 })
 it('preserves exclusive one-time redemption and paid balance terms for a 30-day assignment',async()=>{
  try{
   const a=await save('30_days','one_time');const first=await ownerDraft('2097-09-01',100),second=await ownerDraft('2097-09-02',100);await db.query('select finalize_reservation($1)',[first]);await db.query('select finalize_reservation($1)',[second]);await identity('operator');
   const p=await scalar<{id:string;amount:number}>("select to_jsonb(begin_checkout($1,$2,'partial')) as value",[first,users.customer]);await expect(db.query("select begin_checkout($1,$2,'partial')",[second,users.customer])).rejects.toThrow(/changed|reserved/)
   const frozen=await scalar('select financial_snapshot as value from reservations where id=$1',[first]);await db.query("update payments set external_session_id='cs_expiration_preset' where id=$1",[p.id]);for(let i=0;i<2;i++)await db.query("select confirm_provider_payment('evt_expiration_preset','cs_expiration_preset','pay_expiration_preset',$1)",[p.amount]);
   expect(await scalar('select private.account_discount_status(a) as value from customer_discount_assignments a where id=$1',[a.assignment_id])).toBe('USED');const newBooking=await ownerDraft('2097-09-03',100);expect(await scalar('select total as value from reservations where id=$1',[newBooking])).toBe(3200000)
   await save('90_days','ongoing',null,2000);await identity('customer');await db.query('select prepare_checkout_quote($1)',[first]);expect(await scalar('select financial_snapshot as value from reservations where id=$1',[first])).toEqual(frozen)
   await identity('operator');const balance=await scalar<{amount:number}>("select to_jsonb(begin_checkout($1,$2,'balance')) as value",[first,users.customer]);expect(balance.amount).toBe(1440000);expect(p.amount).toBe(1440000)
  }finally{await reset()}
 })
})

describe('optional booking fields and historical venue notes',()=>{
 it('accepts omitted/null optional fields, no declared allergies and no add-ons through finalization',async()=>{
  const id=await ownerDraft('2096-06-01',100,'Monoblock','Simple buffet setup',undefined,'Round table',{address:{...testAddress,notes:undefined},feature_ids:null,add_ons:null,allergy_allergen_ids:null,allergy_acknowledgments:null,allergy_notes:null,event_preferences:{occasion_type:'other',theme:null,colors:null,celebrant_age:null,setup_inclusions:null},save_contact:null})
  await db.query('select finalize_reservation($1)',[id]);expect(await scalar('select status::text as value from reservations where id=$1',[id])).toBe('for_approval');expect(await scalar('select total as value from reservations where id=$1',[id])).toBe(3200000);expect(await scalar('select allergy_allergen_ids as value from reservations where id=$1',[id])).toEqual([])
 })
 it('preserves a customer historical venue note when the updated client omits that removed field',async()=>{
  const id=await ownerDraft('2096-06-02',100,'Monoblock','Simple buffet setup',undefined,'Round table',{address:{...testAddress,notes:'Historical setup access instructions'}})
  await ownerDraft('2096-06-02',100,'Monoblock','Simple buffet setup',undefined,'Round table',{id,address:{...testAddress,notes:undefined}})
  expect(await scalar("select address->>'notes' as value from reservations where id=$1",[id])).toBe('Historical setup access instructions')
  await identity('other_customer');await expect(db.query('select save_reservation($1)',[JSON.stringify({id,address:{...testAddress}})])).rejects.toThrow();await identity('customer');expect(await scalar("select address->>'notes' as value from reservations where id=$1",[id])).toBe('Historical setup access instructions')
 })
 it('saves incomplete drafts freely but validates required fields only upon submission',async()=>{
  await identity('customer');const d=await scalar<{id:string;version:number}>('select to_jsonb(save_booking_draft($1)) as value',[JSON.stringify({event_name:'',allergy_notes:null,addon_quantities:{blank:null},event_preferences:{theme:null,colors:'',celebrant_age:null}})])
  expect(d.id).toBeTruthy();await expect(db.query('select submit_booking_draft($1,$2)',[d.id,d.version])).rejects.toThrow();expect(await scalar('select submitted_at as value from reservation_drafts where id=$1',[d.id])).toBeNull()
 })
 it('normalizes blank optional quantity records but rejects supplied negative, fractional and over-limit quantities',async()=>{
  const source=await ownerDraft('2096-06-03',100),base=await draftPayloadFrom(source,'2096-06-04')
  await identity('customer');const d=await scalar<{id:string;version:number}>('select to_jsonb(save_booking_draft($1)) as value',[JSON.stringify({...base,addon_quantities:{blank:'',unset:null},chair_quantities:{},chair_type_id:await scalar("select id as value from chair_types where name='Monoblock'"),elegant_chair_quantity:null})])
  const id=await scalar<string>('select submit_booking_draft($1,$2) as value',[d.id,d.version]);expect(await scalar('select total as value from reservations where id=$1',[id])).toBe(3200000)
  for(const quantity of[-1,1.5,1001])await expect(db.query('select save_reservation($1)',[JSON.stringify({...base,event_date:'2096-06-05',addon_quantities:{invalid:quantity}})])).rejects.toThrow(/Optional quantities/)
 })
 it('accepts blank birthday age/theme/colors while retaining supplied optional preferences and contact opt-in behavior',async()=>{
  const id=await ownerDraft('2096-06-06',100,'Monoblock','Birthday setup',undefined,'Round table',{event_preferences:{occasion_type:'birthday',theme:'',colors:null,celebrant_age:'',setup_inclusions:[]},save_contact:false})
  await db.query('select finalize_reservation($1)',[id]);expect(await scalar('select event_preferences as value from reservations where id=$1',[id])).toMatchObject({theme:'',colors:'',celebrant_age:null,setup_inclusions:[]})
  const next=await ownerDraft('2096-06-07',100,'Monoblock','Birthday setup',undefined,'Round table',{event_preferences:{occasion_type:'birthday',theme:'Garden',colors:'Ivory',celebrant_age:18,setup_inclusions:[]},save_contact:false});expect(await scalar('select event_preferences as value from reservations where id=$1',[next])).toMatchObject({theme:'Garden',colors:'Ivory',celebrant_age:18})
  await expect(ownerDraft('2096-06-08',100,'Monoblock','Simple buffet setup',undefined,'Round table',{address:{...testAddress,contact:''}})).rejects.toThrow(/09XXXXXXXXX|mobile/)
 })
})

describe('manager and customer reminder recipients', () => {
  async function preferenceSnapshot() {
    await identity('operator')
    return (await db.query<{id:string;role:string;account_status:string;reminder_inapp_opt_in:boolean;reminder_email_opt_in:boolean}>(
      'select id,role,account_status,reminder_inapp_opt_in,reminder_email_opt_in from profiles where id=any($1::uuid[])',
      [[users.customer, users.manager, users.other]],
    )).rows
  }
  async function restorePreferences(rows: Awaited<ReturnType<typeof preferenceSnapshot>>) {
    await identity('operator')
    for (const p of rows) await db.query('update profiles set role=$2::public.app_role,account_status=$3,reminder_inapp_opt_in=$4,reminder_email_opt_in=$5 where id=$1',
      [p.id,p.role,p.account_status,p.reminder_inapp_opt_in,p.reminder_email_opt_in])
  }
  it('delivers separate customer/manager channels once per day and isolates each recipient with RLS', async () => {
    const previous=await preferenceSnapshot()
    try {
      const rid=await ownerDraft('2085-06-08',100)
      await db.query('select finalize_reservation($1)',[rid])
      await db.query('select update_reminder_preferences(true,true)')
      await identity('manager');await db.query('select update_reminder_preferences(true,true)')
      await db.query("select manager_reservation_status($1,'approved')",[rid])
      await identity('operator')
      expect(await scalar("select enqueue_event_reminders('2085-06-01T06:59:00+08:00') as value")).toBe(0)
      for(let i=0;i<2;i++) await db.query("select enqueue_event_reminders('2085-06-01T07:00:00+08:00')")
      for(const recipient of [users.customer,users.manager]) expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2',[rid,recipient])).toBe(2)
      expect(await scalar("select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2",[rid,users.super])).toBe(0)
      expect(await scalar("select n.href as value from reminder_deliveries d join notifications n on n.id=d.notification_id where d.reservation_id=$1 and d.recipient_id=$2 and d.channel='in_app'",[rid,users.manager])).toBe('/manager/upcoming')
      expect(await scalar("select n.user_id::text as value from reminder_deliveries d join notifications n on n.id=d.notification_id where d.reservation_id=$1 and d.recipient_id=$2 and d.channel='in_app'",[rid,users.manager])).toBe(users.manager)
      const claimed=(await db.query<{recipient_id:string;audience:string}>("select recipient_id,audience from claim_event_reminder_emails('2085-06-01T07:00:00+08:00',20)")).rows
      expect(claimed).toContainEqual({recipient_id:users.manager,audience:'manager'})
      expect(claimed).toContainEqual({recipient_id:users.customer,audience:'customer'})
      expect((await db.query("select * from claim_event_reminder_emails('2085-06-01T07:00:00+08:00',20)")).rows).toHaveLength(0)
      await identity('customer')
      expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1',[rid])).toBe(2)
      expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2',[rid,users.manager])).toBe(0)
      await identity('manager');expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1',[rid])).toBe(2)
      await identity('other_customer');expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1',[rid])).toBe(0)
      await identity('operator')
      for(let day=2;day<=8;day++) await db.query('select enqueue_event_reminders($1)',[`2085-06-0${day}T07:00:00+08:00`])
      for(const recipient of [users.customer,users.manager]) expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2',[rid,recipient])).toBe(14)
    } finally { await restorePreferences(previous) }
  })
  it('supports two managers without stacking duplicate deliveries or broadcasting to super admins', async () => {
    const previous=await preferenceSnapshot()
    try {
      const rid=await ownerDraft('2085-07-08',100);await db.query('select finalize_reservation($1)',[rid]);await db.query('select update_reminder_preferences(false,false)')
      await identity('manager');await db.query('select update_reminder_preferences(true,true)');await db.query("select manager_reservation_status($1,'approved')",[rid])
      await identity('operator');await db.query("update profiles set role='manager',account_status='active',reminder_inapp_opt_in=true,reminder_email_opt_in=true where id=$1",[users.other])
      for(let day=1;day<=8;day++) for(let retry=0;retry<2;retry++) await db.query('select enqueue_event_reminders($1)',[`2085-07-0${day}T07:00:00+08:00`])
      for(const recipient of [users.manager,users.other]) expect(await scalar('select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2',[rid,recipient])).toBe(14)
      expect(await scalar("select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=any($2::uuid[])",[rid,[users.customer,users.super]])).toBe(0)
      expect(await scalar("select count(*)::int as value from (select recipient_id,reminder_date,channel,count(*) from reminder_deliveries where reservation_id=$1 group by 1,2,3 having count(*)>1)x",[rid])).toBe(0)
    } finally { await restorePreferences(previous) }
  })
  it('binds the worker job to the manager recipient and revalidates their opt-out without cancelling the customer job', async () => {
    const previous=await preferenceSnapshot()
    try {
      await identity('operator')
      const day=await scalar<string>("select ((now() at time zone 'Asia/Manila')::date+6)::text as value")
      const at=await scalar<string>("select (((now() at time zone 'Asia/Manila')::date+time '07:00') at time zone 'Asia/Manila')::text as value")
      const rid=await ownerDraft(day,100);await db.query('select finalize_reservation($1)',[rid]);await db.query('select update_reminder_preferences(true,true)')
      await identity('manager');await db.query('select update_reminder_preferences(true,true)');await db.query("select manager_reservation_status($1,'approved')",[rid])
      await identity('operator');await db.query('select enqueue_event_reminders($1)',[at]);await db.query('select * from claim_event_reminder_emails($1,20)',[at])
      const delivery=await scalar<string>("select id as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2 and channel='email'",[rid,users.manager])
      expect(await scalar('select (prepare_reminder_email($1)).recipient_id::text as value',[delivery])).toBe(users.manager)
      await identity('manager');await db.query('select update_reminder_preferences(true,false)')
      await identity('operator');await expect(db.query('select prepare_reminder_email($1)',[delivery])).rejects.toThrow(/no longer eligible/)
      expect(await scalar('select status as value from reminder_deliveries where id=$1',[delivery])).toBe('cancelled')
      expect(await scalar("select status as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2 and channel='email'",[rid,users.customer])).toBe('sending')
    } finally { await restorePreferences(previous) }
  })
  it('stops suspended/former managers, preserves sent notices, and recomputes after reschedule and completion', async () => {
    const previous=await preferenceSnapshot()
    try {
      const rid=await ownerDraft('2085-08-08',100);await db.query('select finalize_reservation($1)',[rid]);await db.query('select update_reminder_preferences(true,true)')
      await identity('manager');await db.query('select update_reminder_preferences(true,true)');await db.query("select manager_reservation_status($1,'approved')",[rid])
      await identity('operator');await db.query("select enqueue_event_reminders('2085-08-01T07:00:00+08:00')")
      const delivery=await scalar<string>("select id as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2 and channel='email'",[rid,users.manager])
      await db.query("update profiles set account_status='suspended' where id=$1",[users.manager])
      expect(await scalar('select error_code as value from reminder_deliveries where id=$1',[delivery])).toBe('recipient_inactive')
      await db.query("update profiles set account_status='active' where id=$1",[users.manager]);await db.query("select enqueue_event_reminders('2085-08-01T07:05:00+08:00')")
      await db.query("update profiles set role='customer' where id=$1",[users.manager])
      expect(await scalar('select error_code as value from reminder_deliveries where id=$1',[delivery])).toBe('recipient_role_changed')
      await db.query("update profiles set role='manager' where id=$1",[users.manager]);await db.query("select enqueue_event_reminders('2085-08-01T07:10:00+08:00')")
      expect(await scalar("select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2 and channel='in_app'",[rid,users.manager])).toBe(1)
      await db.query("update reservations set event_date='2085-08-09' where id=$1",[rid]);expect(await scalar('select status as value from reminder_deliveries where id=$1',[delivery])).toBe('cancelled')
      await db.query("select enqueue_event_reminders('2085-08-02T07:00:00+08:00')")
      expect(await scalar("select count(*)::int as value from reminder_deliveries where reservation_id=$1 and recipient_id=$2 and reminder_date='2085-08-02' and event_date='2085-08-09'",[rid,users.manager])).toBe(2)
      await db.query("update reservations set status='completed' where id=$1",[rid]);await db.query("select enqueue_event_reminders('2085-08-03T07:00:00+08:00')")
      expect(await scalar("select count(*)::int as value from reminder_deliveries where reservation_id=$1 and reminder_date='2085-08-03'",[rid])).toBe(0)
    } finally { await restorePreferences(previous) }
  })
})
