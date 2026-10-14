import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { secret } from '../_shared/http.ts'
import { addDays, earliestBookingDate } from '../_shared/booking-date.ts'
import { answerFromFacts, parseRequest, quickIntent } from '../_shared/assistant.ts'
import { extractIntent, providerConfig } from '../_shared/assistant-provider.ts'
import type { AssistantAnswer, Intent, PublicDate, PublicPackage, PublicOptions } from '../_shared/assistant.ts'

// Ephemeral limits per Edge instance. These are not a durable global quota.
const requests = new Map<string, { count: number; expires: number }>()
let inflight = 0
let aiWindow = { count: 0, expires: 0 }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const appOrigin = Deno.env.get('APP_URL') || 'http://localhost:5173'
  const allowed = [appOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173']
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : appOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  } })
  if (origin && !allowed.includes(origin)) return respond({ error: 'Origin not allowed' }, 403)
  if (req.method === 'OPTIONS') return respond({})
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  if (Number(req.headers.get('content-length') || 0) > 12000) return respond({ error: 'Question is too long.' }, 413)
  const now = Date.now()
  for (const [ip, entry] of requests) if (entry.expires <= now) requests.delete(ip)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const entry = requests.get(ip) ?? { count: 0, expires: now + 60000 }
  if (entry.count >= 12 || requests.size >= 5000 || inflight >= 8) return respond({ error: 'Please wait a minute before asking again.' }, 429)
  entry.count++; requests.set(ip, entry); inflight++
  try {
    const raw = await req.text()
    if (raw.length > 12000) return respond({ error: 'Question is too long.' }, 413)
    const request = parseRequest(JSON.parse(raw))
    // Public anon client: no service-role access, no private reservation/customer data.
    const client = createClient(secret('SUPABASE_URL'), secret('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
    const setting = await client.from('app_settings').select('value').eq('key', 'maintenance').single()
    if (setting.error) return respond({ error: 'The reservation assistant is temporarily unavailable.' }, 503)
    if (setting.data.value === true) return respond({ error: 'Reservations are temporarily under maintenance.' }, 503)
    let intent: Intent = quickIntent(request)
    let engine: AssistantAnswer['engine'] = 'quick_answers'
    const provider = providerConfig({ AI_PROVIDER: Deno.env.get('AI_PROVIDER'), GROQ_API_KEY: Deno.env.get('GROQ_API_KEY'), GROQ_MODEL: Deno.env.get('GROQ_MODEL'), OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'), OPENAI_MODEL: Deno.env.get('OPENAI_MODEL') })
    if (provider && !request.quick) {
      if (aiWindow.expires <= now) aiWindow = { count: 0, expires: now + 60000 }
      if (aiWindow.count >= 20) return respond({ error: 'The assistant is busy. Please try the quick answers or wait a minute.' }, 429)
      aiWindow.count++
      try {
        intent = await extractIntent(request, provider); engine = provider.provider
      } catch {
        // No provider error bodies, keys, or user text are logged or returned.
        intent = quickIntent(request)
      }
    }
    let packages: PublicPackage[] = [], dates: PublicDate[] = []
    let options: PublicOptions | undefined
    if (intent.topics.includes('packages')) {
      const result = await client.from('menu_sets').select('id,name,price,min_guests,max_guests,pricing_version,inclusions,dish_count').eq('active', true).order('price').limit(30)
      if (result.error) throw new Error('Catalog unavailable')
      packages = result.data
    }
    if (intent.topics.includes('upgrades')) {
      const result = await Promise.all((['event_setups', 'chair_types', 'table_types', 'event_features'] as const).map(async (table) => {
        const value = await client.from(table).select('id,name,price' + (table === 'event_setups' ? ',description' : table === 'event_features' ? ',required_setup_id' : '')).eq('active', true).order('price').limit(30)
        if (value.error) throw new Error('Upgrades unavailable')
        return [table, value.data]
      }))
      options = Object.fromEntries(result) as PublicOptions
    }
    const earliest = earliestBookingDate()
    if (intent.topics.includes('availability') && (!intent.event_date || intent.event_date >= earliest)) {
      const start = intent.event_date || earliest
      const result = await client.rpc('available_dates', { start_date: start, end_date: intent.event_date || addDays(start, 29) })
      if (result.error) throw new Error('Calendar unavailable')
      dates = intent.event_date ? result.data : result.data.filter((day: PublicDate) => day.remaining > 0)
    }
    return respond(answerFromFacts(intent, packages, dates, engine, new Date(), options))
  } catch (error) {
    const safe = error instanceof Error && /^(Enter a question|Use a question|Unknown quick|Choose a valid|Conversation is too long)/.test(error.message)
    return respond({ error: safe ? error.message : 'The assistant could not answer right now. Please try again shortly.' }, safe ? 400 : 503)
  } finally { inflight-- }
})
