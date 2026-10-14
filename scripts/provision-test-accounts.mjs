import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadEnvFile } from 'node:process'

try { loadEnvFile('.env') } catch { /* An environment variable can supply the URL. */ }
try { loadEnvFile('.env.operator') } catch { /* An environment variable can supply the key. */ }
const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL in .env and SUPABASE_SERVICE_ROLE_KEY in the ignored .env.operator file first.')
if (new URL(url).origin !== 'https://azjzapendjsfouysueiw.supabase.co')
  throw new Error('This script is scoped to the Supabase project authorized for this application.')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const { error: schemaError } = await db.from('profiles').select('first_name,last_name').limit(1)
if (schemaError) throw new Error('Apply supabase/updates/0013_profile_names.sql before creating the test accounts.')

const requested = [
  { email: 'superadmin@test.com', first_name: 'Test', last_name: 'Administrator', role: 'super_admin' },
  { email: 'manger@test.com', first_name: 'Test', last_name: 'Manager', role: 'manager' },
  { email: 'guest@test.com', first_name: 'Test', last_name: 'Guest', role: 'customer' },
]
await mkdir('.private', { recursive: true })
const credentialFile = '.private/test-account-credentials.json'
let saved = []
try { saved = JSON.parse(await readFile(credentialFile, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw new Error('The local credentials file is unreadable; keep it and resolve the error before retrying.')
}
const persist = () => writeFile(credentialFile, JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 })
const existing = new Map()
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw new Error('Supabase Auth admin access failed. Check the local service-role key.')
  for (const user of data.users) if (requested.some((account) => account.email === user.email?.toLowerCase())) existing.set(user.email.toLowerCase(), user)
  if (data.users.length < 200 || existing.size === requested.length) break
}

for (const account of requested) {
  let user = existing.get(account.email)
  let credential = saved.find((entry) => entry.email === account.email)
  if (!user) {
    if (!credential) {
      credential = { email: account.email, role: account.role, password: randomBytes(24).toString('base64url') + 'aA9!', status: 'planned' }
      saved.push(credential)
      await persist()
    }
    const { data, error } = await db.auth.admin.createUser({
      email: account.email, password: credential.password, email_confirm: true,
      user_metadata: { first_name: account.first_name, middle_name: '', last_name: account.last_name, full_name: `${account.first_name} ${account.last_name}` },
    })
    if (error || !data.user) throw new Error(`Could not create the ${account.role} account. Earlier successful accounts are retained; inspect Supabase Auth before retrying.`)
    user = data.user
    credential.user_id = user.id
    credential.status = 'created'
    await persist()
  } else if (!credential) {
    // Never reset the password of an existing account just to rerun this script.
    credential = { email: account.email, role: account.role, password: null, user_id: user.id, status: 'existing account; password unchanged' }
    saved.push(credential)
    await persist()
  }
  if (!user.email_confirmed_at) throw new Error(`The existing ${account.role} account must be confirmed before assigning staff access.`)
  const { data: profile, error: roleError } = await db.from('profiles').update({ role: account.role }).eq('id', user.id).select('id,role').single()
  if (roleError || profile.role !== account.role) throw new Error(`The ${account.role} account exists, but its profile role could not be assigned. Resolve this before testing.`)
  const { error: auditError } = await db.from('audit_logs').insert({ action: 'role.operator_test_account', entity_id: user.id, details: { role: account.role, test_account: true } })
  if (auditError) throw new Error(`Role assigned for ${account.role}, but the audit record failed. Inspect before retrying.`)
  const login = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  if (credential.password) {
    const { data, error } = await login.auth.signInWithPassword({ email: account.email, password: credential.password })
    if (error || data.user?.id !== user.id) throw new Error(`The ${account.role} account was created, but its password login could not be verified.`)
    const { data: ownProfile, error: profileError } = await login.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || ownProfile.role !== account.role) throw new Error(`The ${account.role} account login succeeded but its authenticated profile read failed.`)
    await login.auth.signOut({ scope: 'local' })
    credential.status = 'created; login and role verified'
    await persist()
  }
  console.log(`${account.role}: ready (${credential.password ? 'login verified' : 'existing password retained'})`)
}
console.log(`Credentials saved privately in ${credentialFile}; passwords are not printed. These test addresses have no inbox for recovery emails.`)
