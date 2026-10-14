import { PGlite } from '@electric-sql/pglite'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
const db = new PGlite()
const users = {
  customer: '90000000-0000-0000-0000-000000000001',
  other: '90000000-0000-0000-0000-000000000002',
  manager: '90000000-0000-0000-0000-000000000003',
  super: '90000000-0000-0000-0000-000000000004',
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
let draft: string
let flow: string
let setupSql: string
let ownerCatalog: { name: string; price: number; dish_count: number; min_guests: number; max_guests: number }[]
async function completeDraft(eventDate: string) {
  await identity('customer')
  const dishes = (await db.query<{ id: string }>('select id from dishes limit 3')).rows.map(
    (x) => x.id,
  )
  const drink = await scalar<string>('select id as value from drinks limit 1')
  const dessert = await scalar<string>('select id as value from desserts limit 1')
  const setup = await scalar<string>(
    "select id as value from event_setups where name='Classic ivory'",
  )
  const table = await scalar<string>('select id as value from table_types limit 1')
  const chair = await scalar<string>("select id as value from chair_types where name='Monoblock (legacy)'")
  return scalar<string>('select save_reservation($1::jsonb) as value', [
    JSON.stringify({
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
      address: {
        street: 'Test venue',
        province: 'Bulacan',
        city: 'San Ildefonso',
        barangay: 'Test barangay',
        contact: '09123456789',
      },
    }),
  ])
}
beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
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
  await db.exec(setupSql.replace(
    'create extension if not exists pgcrypto with schema extensions;',
    '-- pgcrypto installation belongs to the real Supabase platform.',
  ))
  ownerCatalog = (await db.query<{ name: string; price: number; dish_count: number; min_guests: number; max_guests: number }>('select name,price,dish_count,min_guests,max_guests from menu_sets where active order by dish_count')).rows
  // Restore the archived sample fixtures only inside this isolated test database
  // so the original payment/refund tests still exercise legacy pricing v1.
  await db.exec('update menu_sets set active=true where pricing_version=1')
  for (const table of ['dishes','drinks','desserts','event_setups','event_features','add_ons','chair_types','table_types']) await db.exec(`update ${table} set active=true`)
  for (const [name, id] of Object.entries(users))
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
      id,
      JSON.stringify({ full_name: name, role: 'super_admin' }),
    ])
  await db.exec(
    `update public.profiles set role='manager' where id='${users.manager}';update public.profiles set role='super_admin' where id='${users.super}';`,
  )
}, 60000)
afterAll(() => db.close())

async function ownerDraft(day: string, guests: number, chair = 'Monoblock', setup = 'Simple buffet setup', feature?: string, table = 'Round table') {
  await identity('customer')
  const lookup = (table: string, name: string) => scalar<string>(`select id as value from ${table} where name=$1`, [name])
  const data = {
    event_name: 'Confirmed catalog test', event_date: day, event_time: '12:00', guests,
    menu_set_id: await lookup('menu_sets', 'Set Menu No. 1'),
    drink_id: await lookup('drinks', 'Iced Tea'), dessert_id: await lookup('desserts', 'Coffee Jelly'),
    dish_ids: await Promise.all(['Chicken Cordon Bleu','Korean Beef','Fried Chicken'].map((name) => lookup('dishes', name))),
    setup_id: await lookup('event_setups', setup), table_type_id: await lookup('table_types', table), table_quantity: 10,
    chairs: [{ id: await lookup('chair_types', chair), quantity: guests }],
    feature_ids: feature ? [await lookup('event_features', feature)] : [],
    address: {street:'Test venue',barangay:'Test barangay',city:'Test city',province:'Test province',contact:'09123456789'},
  }
  return scalar<string>('select save_reservation($1::jsonb) as value', [JSON.stringify(data)])
}

describe('owner menu pricing and included seating', () => {
  it('rejects 99 and 1,001 guests through the actual save RPC', async () => {
    await expect(ownerDraft('2098-01-01',99)).rejects.toThrow(/minimum/)
    await expect(ownerDraft('2098-01-01',1001)).rejects.toThrow(/maximum/)
  })
  it('includes Monoblock chairs, both table shapes, and simple setup in the menu price', async () => {
    const round = await ownerDraft('2098-01-02',100)
    const long = await ownerDraft('2098-01-03',100,'Monoblock','Simple buffet setup',undefined,'Long table')
    for (const id of [round,long]) {
      const quote = await scalar<Record<string, number>>('select pricing as value from reservations where id=$1',[id])
      expect(quote).toMatchObject({menu:3200000,setup:0,tables:0,chair_upgrade:0,total:3200000})
    }
    const maximum = await ownerDraft('2098-01-04',1000)
    expect(await scalar('select total as value from reservations where id=$1',[maximum])).toBe(32000000)
    const quote = await scalar<Record<string,number>>('select finalize_reservation($1) as value',[round])
    expect(quote.total).toBe(3200000)
  })
  it('charges elegant chairs for every guest, including the first 100 seats', async () => {
    const id = await ownerDraft('2098-01-05',100,'Elegant chair')
    const quote = await scalar<Record<string,number>>('select pricing as value from reservations where id=$1',[id])
    expect(quote).toMatchObject({menu:3200000,chair_upgrade:100000,total:3300000})
    await identity('operator')
    await db.query('update reservation_tables_chairs set chair_quantity=1 where reservation_id=$1',[id])
    await expect(db.query('select private.calculate_price($1)',[id])).rejects.toThrow('one chair type for all guests')
  })
  it('adds fixed event fees and restricts the glass floor upgrade to weddings', async () => {
    const birthday = await ownerDraft('2098-01-06',100,'Monoblock','Birthday setup')
    expect(await scalar('select total as value from reservations where id=$1',[birthday])).toBe(4700000)
    const wedding = await ownerDraft('2098-01-07',100,'Elegant chair','Wedding setup','Glass dance floor upgrade')
    expect(await scalar('select total as value from reservations where id=$1',[wedding])).toBe(6800000)
    const trusses = await ownerDraft('2098-01-08',100,'Monoblock','Simple buffet setup','Trusses')
    expect(await scalar('select total as value from reservations where id=$1',[trusses])).toBe(7700000)
    await expect(ownerDraft('2098-01-09',100,'Monoblock','Birthday setup','Glass dance floor upgrade')).rejects.toThrow(/matching event setup/)
  })
})
describe('clean migrations and actual PostgreSQL business rules', () => {
  it('installs the owner-confirmed four menus with the guest limits and current prices', () => {
    expect(ownerCatalog.map((menu) => [menu.price,menu.dish_count,menu.min_guests,menu.max_guests])).toEqual([[32000,3,100,1000],[35000,4,100,1000],[38000,5,100,1000],[42000,6,100,1000]])
  })
  it('rejects the first three Manila dates and accepts the third day ahead in the real save RPC', async () => {
    await identity('operator')
    const today = await scalar<string>("select ((now() at time zone 'Asia/Manila')::date)::text as value")
    const day = (offset: number) => { const value = new Date(today! + 'T00:00:00Z'); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10) }
    for (const offset of [0, 1, 2]) await expect(completeDraft(day(offset))).rejects.toThrow('at least 3 days ahead')
    const id = await completeDraft(day(3))
    expect(id).toBeTruthy()
    await identity('operator')
    await db.query('delete from reservations where id=$1', [id])
  })
  it('stores structured signup names and mobile while ignoring privileged metadata', async () => {
    await identity('operator')
    const id = '90000000-0000-0000-0000-000000000010'
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, JSON.stringify({ first_name: ' Test ', middle_name: '', last_name: ' Customer ', phone: '0912 345 6789', role: 'super_admin' })])
    const profile = (await db.query('select full_name,first_name,middle_name,last_name,phone,role from profiles where id=$1', [id])).rows[0]
    expect(profile).toMatchObject({ full_name: 'Test Customer', first_name: 'Test', middle_name: '', last_name: 'Customer', phone: '+639123456789', role: 'customer' })
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    await db.exec('set role authenticated')
    await db.query("update profiles set middle_name='Middle' where id=$1", [id])
    expect(await scalar('select full_name as value from profiles where id=$1', [id])).toBe('Test Middle Customer')
    await expect(db.query("update profiles set phone='1234' where id=$1", [id])).rejects.toThrow()
    await expect(db.query("update profiles set last_name='' where id=$1", [id])).rejects.toThrow()
    await expect(db.query("update profiles set role='super_admin' where id=$1", [id])).rejects.toThrow()
    await identity('operator')
    expect(await scalar('select full_name as value from profiles where id=$1', [users.customer])).toBe('customer')
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
      await upgradeDb.query('insert into auth.users values($1,$2),($3,$4)', [legacyId, JSON.stringify({ full_name: 'Preserved Legacy Name' }), metadataId, JSON.stringify({ first_name: ' Explicit ', middle_name: ' Middle ', last_name: ' Name ', phone: '09123456789' })])
      await upgradeDb.query('insert into profiles(id,full_name) values($1,$2),($3,$4)', [legacyId, 'Preserved Legacy Name', metadataId, 'Explicit Middle Name'])
      const update = await readFile('supabase/updates/0013_profile_names.sql', 'utf8')
      await upgradeDb.exec(update)
      await upgradeDb.exec(update)
      const result = (await upgradeDb.query('select id,full_name,first_name,middle_name,last_name,phone from profiles order by id')).rows
      expect(result[0]).toMatchObject({ full_name: 'Preserved Legacy Name', first_name: '', middle_name: '', last_name: '' })
      expect(result[1]).toMatchObject({ full_name: 'Explicit Middle Name', first_name: 'Explicit', middle_name: 'Middle', last_name: 'Name', phone: '+639123456789' })
    } finally {
      await upgradeDb.close()
    }
  })
  it('bootstraps customer role even with malicious registration metadata', async () => {
    await identity('operator')
    expect(
      await scalar('select role::text as value from profiles where id=$1', [users.customer]),
    ).toBe('customer')
  })
  it('saves server-priced reservation and ignores forged total', async () => {
    await identity('customer')
    const data = {
      event_name: 'Test celebration',
      event_date: '2099-05-10',
      event_time: '12:00',
      guests: 50,
      menu_set_id: '10000000-0000-0000-0000-000000000001',
      address: {
        street: 'Test street',
        province: 'Test province',
        city: 'Test city',
        barangay: 'Test barangay',
      },
      total: 1,
    }
    draft = await scalar<string>('select save_reservation($1::jsonb) as value', [
      JSON.stringify(data),
    ])
    expect(await scalar('select total as value from reservations where id=$1', [draft])).toBe(
      1750000,
    )
    await identity('operator')
    const chair = await scalar<string>("select id as value from chair_types where name='Monoblock (legacy)'")
    const setup = await scalar<string>(
      "select id as value from event_setups where name='Classic ivory'",
    )
    await db.query(
      'insert into reservation_tables_chairs(reservation_id,chair_type_id,chair_quantity) values($1,$2,60)',
      [draft, chair],
    )
    await db.query('insert into reservation_event_setups values($1,$2)', [draft, setup])
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
          address: {},
        }),
      ]),
    ).rejects.toThrow(/one_active_customer_date/)
  })
  it('denies direct role, payment, reservation status and audit writes', async () => {
    await identity('customer')
    await expect(
      db.query("update profiles set role='super_admin' where id=$1", [users.customer]),
    ).rejects.toThrow(/permission denied/)
    await expect(db.query("select admin_set_role($1,'manager')", [users.other])).rejects.toThrow(
      /not permitted/,
    )
    await expect(
      db.query(
        "insert into payments(reservation_id,amount,intent,status) values($1,100,'full','fully_paid')",
        [draft],
      ),
    ).rejects.toThrow(/permission denied/)
    await expect(db.query("select confirm_provider_payment('x','x','x',100)")).rejects.toThrow(
      /permission denied/,
    )
    await expect(
      db.query("update reservations set status='approved' where id=$1", [draft]),
    ).rejects.toThrow(/permission denied/)
    await expect(db.exec("insert into audit_logs(action) values('forged')")).rejects.toThrow(
      /permission denied/,
    )
  })
  it('hides another customer’s reservations through RLS', async () => {
    await identity('other')
    expect(
      await scalar('select count(*)::int as value from reservations where id=$1', [draft]),
    ).toBe(0)
  })
  it('keeps an archived menu visible through the owner summary without exposing it to another customer', async () => {
    await identity('operator')
    await db.exec("update menu_sets set active=false where id='10000000-0000-0000-0000-000000000001'")
    await identity('customer')
    expect(await scalar('select count(*)::int as value from reservation_summary where id=$1',[draft])).toBe(1)
    await identity('other')
    expect(await scalar("select count(*)::int as value from menu_sets where id='10000000-0000-0000-0000-000000000001'")).toBe(0)
    await identity('operator')
    await db.exec("update menu_sets set active=true where id='10000000-0000-0000-0000-000000000001'")
  })
  it('rejects incomplete menu finalization', async () => {
    await identity('customer')
    await expect(db.query('select finalize_reservation($1)', [draft])).rejects.toThrow(
      /exactly 3 dishes/,
    )
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
  it('uses canonical 30% of down payment and 70% of full payment refunds', async () => {
    await identity('customer')
    expect(await scalar('select refund_eligibility(1000000,500000) as value')).toBe(150000)
    expect(await scalar('select refund_eligibility(1000000,1000000) as value')).toBe(700000)
    await expect(db.exec('select refund_eligibility(1000000,600000)')).rejects.toThrow(/manual/)
  })
  it('enforces the monthly reschedule history limit', async () => {
    await identity('operator')
    await db.query("update reservations set status='approved' where id=$1", [draft])
    for (let i = 0; i < 3; i++)
      await db.query(
        "insert into reservation_reschedules(reservation_id,old_date,new_date) values($1,'2099-05-10','2099-05-11')",
        [draft],
      )
    await identity('customer')
    await expect(
      db.query("select request_reschedule($1,'2099-05-20','Another date please')", [draft]),
    ).rejects.toThrow(/Monthly reschedule limit/)
  })
  it('finalizes a complete wizard and stores the canonical quote', async () => {
    flow = await completeDraft('2099-08-01')
    const pricing = await scalar<Record<string, number>>(
      'select finalize_reservation($1) as value',
      [flow],
    )
    expect(pricing.total).toBe(2050000)
    expect(await scalar('select status::text as value from reservations where id=$1', [flow])).toBe(
      'for_approval',
    )
    expect(
      await scalar('select amount as value from balances where reservation_id=$1', [flow]),
    ).toBe(2050000)
  })
  it('computes checkout amounts server-side and freezes pending checkout edits', async () => {
    await identity('operator')
    const p = await scalar<{ amount: number; id: string }>(
      "select to_jsonb(begin_checkout($1,$2,'partial')) as value",
      [flow, users.customer],
    )
    expect(p.amount).toBe(1025000)
    await db.query("update payments set external_session_id='cs_test_partial' where id=$1", [p.id])
    await identity('customer')
    await expect(
      db.query('select save_reservation($1::jsonb)', [
        JSON.stringify({ id: flow, event_date: '2099-08-01' }),
      ]),
    ).rejects.toThrow(/open checkout/)
    await expect(
      db.query("select request_cancellation($1,'Change of plans')", [flow]),
    ).rejects.toThrow(/open checkout/)
  })
  it('confirms a provider payment exactly once and updates balance/approval atomically', async () => {
    await identity('operator')
    await expect(
      db.query("select confirm_provider_payment('evt_bad','cs_test_partial','pay_test',1)"),
    ).rejects.toThrow(/does not match/)
    await db.exec(
      "select confirm_provider_payment('evt_partial','cs_test_partial','pay_partial',1025000)",
    )
    await db.exec(
      "select confirm_provider_payment('evt_partial','cs_test_partial','pay_partial',1025000)",
    )
    expect(await scalar('select paid as value from reservations where id=$1', [flow])).toBe(1025000)
    expect(await scalar('select status::text as value from reservations where id=$1', [flow])).toBe(
      'approved',
    )
    expect(
      await scalar('select count(*)::int as value from transactions where reservation_id=$1', [
        flow,
      ]),
    ).toBe(1)
    expect(
      await scalar('select amount as value from balances where reservation_id=$1', [flow]),
    ).toBe(1025000)
  })
  it('calculates a balance payment and reaches fully paid', async () => {
    await identity('operator')
    await expect(
      db.query("select begin_checkout($1,$2,'partial')", [flow, users.customer]),
    ).rejects.toThrow(/Invalid payment intent/)
    const p = await scalar<{ amount: number; id: string }>(
      "select to_jsonb(begin_checkout($1,$2,'balance')) as value",
      [flow, users.customer],
    )
    expect(p.amount).toBe(1025000)
    await db.query("update payments set external_session_id='cs_test_balance' where id=$1", [p.id])
    await db.exec(
      "select confirm_provider_payment('evt_balance','cs_test_balance','pay_balance',1025000)",
    )
    expect(
      await scalar('select payment_status::text as value from reservations where id=$1', [flow]),
    ).toBe('fully_paid')
    await identity('customer')
    await expect(db.query('select finalize_reservation($1)', [flow])).rejects.toThrow(
      /unpaid draft/,
    )
  })
  it('reviews cancellation, releases capacity and freezes policy refund amount', async () => {
    await identity('customer')
    const cid = await scalar<string>(
      "select request_cancellation($1,'Changed celebration plans') as value",
      [flow],
    )
    expect(
      await scalar('select holds_capacity as value from reservations where id=$1', [flow]),
    ).toBe(true)
    await identity('manager')
    await db.query('select review_cancellation($1,true)', [cid])
    expect(
      await scalar('select holds_capacity as value from reservations where id=$1', [flow]),
    ).toBe(false)
    await identity('customer')
    const fid = await scalar<string>('select request_refund($1) as value', [flow])
    expect(await scalar('select eligible_amount as value from refunds where id=$1', [fid])).toBe(
      1435000,
    )
    expect(
      await scalar('select holds_capacity as value from reservations where id=$1', [flow]),
    ).toBe(false)
    await identity('manager')
    await db.query('select review_refund($1,true)', [fid])
  })
  it('allocates refunds across payments, locks ambiguous retries and requires provider confirmation', async () => {
    await identity('operator')
    const fid = await scalar<string>('select id as value from refunds where reservation_id=$1', [
      flow,
    ])
    const planned = await scalar<{ operations: { id: string; amount: number }[] }>(
      'select claim_refund($1) as value',
      [fid],
    )
    expect(planned.operations.reduce((s, o) => s + o.amount, 0)).toBe(1435000)
    expect(planned.operations).toHaveLength(2)
    const operation = planned.operations[0]
    await db.query('select claim_refund_operation($1)', [operation.id])
    await expect(db.query('select claim_refund_operation($1)', [operation.id])).rejects.toThrow(
      /ambiguous/,
    )
    await expect(db.query('select finish_refund($1)', [fid])).rejects.toThrow(/not confirmed/)
    for (const [i, op] of planned.operations.entries())
      await db.query(
        "update refund_operations set external_refund_id=$1,status='succeeded' where id=$2",
        ['re_' + i, op.id],
      )
    await db.query('select finish_refund($1)', [fid])
    await db.query('select finish_refund($1)', [fid])
    expect(await scalar('select refunded as value from reservations where id=$1', [flow])).toBe(
      1435000,
    )
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
    const tiffany = await scalar<string>("select id as value from chair_types where name='Tiffany (legacy)'")
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
    await expect(db.exec("select update_setting('maintenance','true')")).rejects.toThrow(
      /Super admin/,
    )
    await expect(
      db.exec("insert into gallery_images(name,image_url) values('forged','/forged.jpg')"),
    ).rejects.toThrow(/row-level security/)
    await identity('manager')
    await expect(
      db.exec("insert into menu_sets(name,price,dish_count) values('forged',100,3)"),
    ).rejects.toThrow(/row-level security/)
    const metrics = await scalar<{ customers: number }>('select dashboard_metrics() as value')
    expect(metrics.customers).toBeGreaterThan(0)
  })
  it('keeps a new same-date booking valid while an older cancelled booking is refunded', async () => {
    const rid = await completeDraft('2099-08-01')
    expect(rid).not.toBe(flow)
  })
  it('enforces ownership of avatar paths and super-admin gallery storage writes', async () => {
    await identity('customer')
    await db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
      users.customer + '/avatar.png',
    ])
    await expect(
      db.query("insert into storage.objects(bucket_id,name) values('avatars',$1)", [
        users.other + '/avatar.png',
      ]),
    ).rejects.toThrow(/row-level security/)
    await expect(
      db.exec("insert into storage.objects(bucket_id,name) values('gallery','events/forged.png')"),
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
      await scalar('select event_date::text as value from reservations where id=$1', [rid]),
    ).toBe('2099-10-02')
    expect(
      await scalar(
        'select count(*)::int as value from reservation_reschedules where reservation_id=$1',
        [rid],
      ),
    ).toBe(1)
  })
  it('records a verified full payment without auto-approving a full event date', async () => {
    const rid = await completeDraft('2099-06-10')
    await db.query('select finalize_reservation($1)', [rid])
    await identity('operator')
    const payment = await scalar<{ id: string; amount: number }>(
      "select to_jsonb(begin_checkout($1,$2,'full')) as value",
      [rid, users.customer],
    )
    expect(payment.amount).toBe(2050000)
    await db.query("update payments set external_session_id='cs_at_capacity' where id=$1", [
      payment.id,
    ])
    await db.exec(
      "select confirm_provider_payment('evt_capacity','cs_at_capacity','pay_capacity',2050000)",
    )
    expect(await scalar('select paid as value from reservations where id=$1', [rid])).toBe(2050000)
    expect(await scalar('select status::text as value from reservations where id=$1', [rid])).toBe(
      'for_approval',
    )
  })
  it('keeps support threads private and prevents notification recipient changes', async () => {
    await identity('customer')
    const tid = await scalar<string>(
      "select create_ticket('Question about setup','Can we discuss the venue?') as value",
    )
    await identity('other')
    expect(
      await scalar('select count(*)::int as value from support_messages where ticket_id=$1', [tid]),
    ).toBe(0)
    await expect(db.query("select reply_ticket($1,'Forged reply')", [tid])).rejects.toThrow(
      /Access denied/,
    )
    await identity('customer')
    await expect(db.query('update notifications set user_id=$1', [users.other])).rejects.toThrow(
      /permission denied/,
    )
    await identity('manager')
    await db.query("select reply_ticket($1,'We can help with the venue.')", [tid])
    await db.query('select resolve_ticket($1)', [tid])
    await identity('customer')
    await expect(db.query("select reply_ticket($1,'Late reply')", [tid])).rejects.toThrow(/closed/)
  })
  it('blocks maintenance customer operations and permits super-admin role assignment', async () => {
    await identity('super')
    await db.exec("select update_setting('maintenance','true'::jsonb)")
    await identity('customer')
    await expect(db.exec("select create_ticket('Help please','Need assistance')")).rejects.toThrow(
      /maintenance/,
    )
    await identity('super')
    await db.query("select admin_set_role($1,'manager')", [users.other])
    expect(
      await scalar('select role::text as value from profiles where id=$1', [users.other]),
    ).toBe('manager')
    await db.exec("select update_setting('maintenance','false'::jsonb)")
  })
  it('rejects rerunning the hosted installer and preserves existing records', async () => {
    await identity('operator')
    const before = await scalar<number>('select count(*)::int as value from profiles')
    const menusBefore = await scalar<number>('select count(*)::int as value from menu_sets')
    await expect(db.exec(setupSql)).rejects.toThrow(/Setup requires an empty public schema/)
    await db.exec('rollback')
    expect(await scalar<number>('select count(*)::int as value from profiles')).toBe(before)
    expect(await scalar<number>('select count(*)::int as value from menu_sets')).toBe(menusBefore)
  })
})
