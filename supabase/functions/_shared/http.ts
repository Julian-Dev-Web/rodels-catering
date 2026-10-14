import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

export function secret(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Server configuration missing: ${name}`)
  return value
}
export const admin = () =>
  createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
export async function authenticated(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /i, '')
  if (!token) throw new Error('Authentication required')
  const client = createClient(secret('SUPABASE_URL'), secret('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) throw new Error('Authentication required')
  return { client, user: data.user }
}
export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  })
}
export function endpoint(fn: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return json({})
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    if (
      req.headers.get('origin') &&
      req.headers.get('origin') !== (Deno.env.get('APP_URL') || 'http://localhost:5173')
    )
      return json({ error: 'Origin not allowed' }, 403)
    try {
      return await fn(req)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'Request failed' }, 400)
    }
  })
}
export async function paymongo(path: string, body?: unknown) {
  const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Basic ${btoa(secret('PAYMONGO_SECRET_KEY') + ':')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  const value = await res.json()
  if (!res.ok)
    throw new Error('PayMongo could not complete this operation. Contact support before retrying.')
  return value.data
}
