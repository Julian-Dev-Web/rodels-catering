import { describe, expect, it } from 'vitest'
import { addDays, earliestBookingDate, validDate } from '../supabase/functions/_shared/booking-date'
import { answerFromFacts, parseIntent, parseRequest, quickIntent } from '../supabase/functions/_shared/assistant'
import type { Intent } from '../supabase/functions/_shared/assistant'

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
})
