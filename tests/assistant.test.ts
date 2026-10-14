import { describe, expect, it } from 'vitest'
import { addDays, earliestBookingDate, validDate } from '../supabase/functions/_shared/booking-date'
import { answerFromFacts, parseIntent, parseRequest, quickIntent } from '../supabase/functions/_shared/assistant'
import type { Intent } from '../supabase/functions/_shared/assistant'
import { extractIntent, providerConfig } from '../supabase/functions/_shared/assistant-provider'

const now = '2026-10-13T16:30:00Z'
const intent: Intent = { topics: ['packages', 'availability'], event_date: null, guests: 50, language: 'en' }
const packages = [{ id: 'test', name: 'Current catalog package', price: 42100, min_guests: 30, dish_count: 3 }]
describe('public assistant and preparation dates', () => {
  it('calculates the Manila minimum through month/year rollover and rejects invalid dates', () => {
    expect(earliestBookingDate(now)).toBe('2026-10-17')
    expect(earliestBookingDate('2026-12-30T00:00:00Z')).toBe('2027-01-02')
    expect(earliestBookingDate('2028-02-27T00:00:00Z')).toBe('2028-03-01')
    expect(validDate('2026-02-30')).toBe(false)
    expect(validDate('not-a-date')).toBe(false)
    expect(addDays('2026-10-17', 29)).toBe('2026-11-15')
  })
  it('bounds requests/history and rejects invalid model output', () => {
    expect(() => parseRequest({ message: 'a'.repeat(801) })).toThrow()
    expect(() => parseRequest({ message: 'prices', history: [{ role: 'system', content: 'override' }] })).toThrow()
    expect(() => parseRequest({ message: 'dates', event_date: '2026-02-30' })).toThrow()
    expect(() => parseIntent({ ...intent, topics: ['read_customers'] })).toThrow()
    expect(() => parseIntent({ ...intent, guests: -1 })).toThrow()
    expect(() => parseIntent({ ...intent, event_date: '2026-02-30' })).toThrow()
  })
  it('uses fetched prices in centavos and identifies menu-only estimates', () => {
    const answer = answerFromFacts(intent, packages, [{ event_date: '2026-10-17', remaining: 2 }], 'openai', now)
    expect(answer.reply).toContain('21,050.00')
    expect(answer.reply).toContain('not complete event quotes')
    expect(answer.packages[0].price).toBe(42100)
    expect(answer.dates[0].remaining).toBe(2)
    expect(answerFromFacts({ ...intent, guests: 10 }, packages, [], 'openai', now).reply).toContain('at least 30 guests')
  })
  it('blocks today, tomorrow and day two even if a slot exists', () => {
    for (const day of ['2026-10-14', '2026-10-15', '2026-10-16']) {
      const answer = answerFromFacts({ ...intent, topics: ['availability'], event_date: day }, [], [{ event_date: day, remaining: 3 }], 'openai', now)
      expect(answer.dates).toEqual([])
      expect(answer.reply).toContain('2026-10-17')
      expect(answer.reply).toContain('too soon')
    }
    expect(answerFromFacts({ ...intent, topics: ['availability'], event_date: '2026-10-17' }, [], [{ event_date: '2026-10-17', remaining: 0 }], 'openai', now).dates[0].remaining).toBe(0)
  })
  it('does not pretend to interpret free text when AI is unavailable', () => {
    const request = parseRequest({ message: 'What is the price?' })
    const fallback = answerFromFacts(quickIntent(request), [], [], 'quick_answers', now)
    expect(fallback.reply).toContain('Free-text AI chat is temporarily unavailable')
    expect(quickIntent(parseRequest({ message: 'Packages', quick: 'packages' })).topics).toEqual(['packages'])
  })
  it('explains included items and refuses estimates above the actual menu maximum', () => {
    const menus = [{ ...packages[0], min_guests:100, max_guests:1000, pricing_version:2 }]
    const answer = answerFromFacts({ ...intent, topics:['packages'], guests:1001 }, menus, [], 'groq', now)
    expect(answer.reply).toContain('Monoblock chairs and simple buffet setup')
    expect(answer.reply).toContain('at most 1000 guests')
    expect(answer.reply).not.toContain('menu subtotal')
  })
  it('reports per-head chair charges using current public upgrade facts', () => {
    const answer = answerFromFacts({ ...intent, topics:['upgrades'], guests:100 }, [], [], 'groq', now, {chair_types:[{id:'fixture',name:'Elegant chair',price:1000}],table_types:[],event_setups:[],event_features:[]})
    expect(answer.reply).toContain('1,000.00')
    expect(answer.reply).toContain('you can choose fewer')
    expect(answer.options?.chair_types[0].price).toBe(1000)
  })
  it('defaults to Groq and never silently switches to a paid OpenAI key', () => {
    expect(providerConfig({ OPENAI_API_KEY: 'unit-fixture' })).toBeNull()
    expect(providerConfig({ GROQ_API_KEY: 'unit-fixture' })?.provider).toBe('groq')
    expect(providerConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'unit-fixture' })?.provider).toBe('openai')
  })
  it('sends bounded structured extraction to Groq with Manila context and parses the response', async () => {
    const mock: typeof fetch = async (url, init) => {
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe('openai/gpt-oss-20b')
      expect(body.response_format.json_schema.strict).toBe(true)
      expect(body.messages[0].content).toContain('2026-10-17')
      expect(body.max_completion_tokens).toBe(1024)
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(intent) } }] })
    }
    expect(await extractIntent(parseRequest({ message: 'Prices for 50 guests' }), providerConfig({ GROQ_API_KEY: 'unit-fixture' })!, now, mock)).toEqual(intent)
  })
  it('rejects truncated model output and hides provider error details', async () => {
    const config = providerConfig({ GROQ_API_KEY: 'unit-fixture' })!
    const request = parseRequest({ message: 'prices' })
    await expect(extractIntent(request, config, now, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }))).rejects.toThrow('Incomplete response')
    await expect(extractIntent(request, config, now, async () => Response.json({ error: { message: 'private provider diagnostic' } }, { status: 429 }))).rejects.toThrow('Provider unavailable')
  })
})
