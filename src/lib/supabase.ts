import { createClient } from '@supabase/supabase-js'
import { callbackStatus } from './account'
export const authCallback = callbackStatus(
  window.location.hash,
  window.location.search,
)
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configured = Boolean(url && key)
export const supabase = createClient(
  url || 'https://unconfigured.supabase.co',
  key || 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
export function requireConfiguration() {
  if (!configured)
    throw new Error(
      'Connect Supabase first. Follow README.md and set the two VITE_SUPABASE environment variables.',
    )
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
) {
  requireConfiguration()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as T
}
export async function records<T>(
  table: string,
  order = 'created_at',
  ascending = false,
  filters: Record<string, unknown> = {},
) {
  requireConfiguration()
  const result: T[] = []
  const noId = [
    'app_settings',
    'balances',
    'reservation_items',
    'reservation_event_setups',
    'reservation_event_features',
    'reservation_tables_chairs',
    'reservation_add_ons',
  ]
  for (let offset = 0; ; offset += 500) {
    let query = supabase
      .from(table)
      .select('*')
      .order(order, { ascending })
      .range(offset, offset + 499)
    if (table === 'business_hours') {
      if (order !== 'weekday')
        query = query.order('weekday', { ascending: true })
    } else if (table === 'business_date_overrides') {
      if (order !== 'event_date')
        query = query.order('event_date', { ascending: true })
    } else if (!noId.includes(table) && order !== 'id')
      query = query.order('id', { ascending: true })
    const compositeOrder: Record<string, string> = {
      reservation_items: 'dish_id',
      reservation_event_features: 'event_feature_id',
      reservation_tables_chairs: 'chair_type_id',
      reservation_add_ons: 'add_on_id',
    }
    if (compositeOrder[table] && order !== compositeOrder[table])
      query = query.order(compositeOrder[table], { ascending: true })
    for (const [key, value] of Object.entries(filters))
      query = query.eq(key, value)
    const { data, error } = await query
    if (error) throw error
    result.push(...(data as T[]))
    if (data.length < 500) return result
  }
}
export async function edge<T>(name: string, body: Record<string, unknown>) {
  requireConfiguration()
  const sessionResult = await supabase.auth.getSession()
  let session = sessionResult.data.session
  const sessionError = sessionResult.error
  if (sessionError) throw sessionError
  const publicEndpoint = name === 'public-assistant'
  if (!session && !publicEndpoint)
    throw new Error('Your session has ended. Sign in again to continue.')
  if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 60000) {
    const refreshed = await supabase.auth.refreshSession()
    if (refreshed.error) throw refreshed.error
    session = refreshed.data.session
  }
  if (!session && !publicEndpoint)
    throw new Error('Your session has ended. Sign in again to continue.')
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    ...(session
      ? { headers: { Authorization: 'Bearer ' + session.access_token } }
      : {}),
  })
  if (error) {
    const context = error.context
    if (context instanceof Response) {
      const detail = await context.json().catch(() => null)
      if (detail?.error) throw new Error(detail.error)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}
