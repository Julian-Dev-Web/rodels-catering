import { earliestBookingDate, validDate } from './booking-date.ts'

export type Topic = 'packages' | 'availability' | 'booking_rules'
export interface Intent { topics: Topic[]; event_date: string | null; guests: number | null; language: 'en' | 'fil' }
export interface AssistantRequest { message: string; quick?: Topic; event_date?: string; history: { role: 'user' | 'assistant'; content: string }[] }
export interface PublicPackage { id: string; name: string; price: number; min_guests: number; dish_count: number }
export interface PublicDate { event_date: string; remaining: number }
export interface AssistantAnswer { reply: string; engine: 'openai' | 'quick_answers'; packages: PublicPackage[]; dates: PublicDate[] }
const topics: Topic[] = ['packages', 'availability', 'booking_rules']

export function parseRequest(value: unknown): AssistantRequest {
  if (!value || typeof value !== 'object') throw new Error('Enter a question about packages or dates.')
  const data = value as Record<string, unknown>
  if (typeof data.message !== 'string' || !data.message.trim() || data.message.length > 800) throw new Error('Use a question between 1 and 800 characters.')
  if (data.quick !== undefined && !topics.includes(data.quick as Topic)) throw new Error('Unknown quick question.')
  if (data.event_date !== undefined && (typeof data.event_date !== 'string' || !validDate(data.event_date))) throw new Error('Choose a valid date.')
  const history = data.history ?? []
  if (!Array.isArray(history) || history.length > 6 || history.some((item) => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length > 800)) throw new Error('Conversation is too long. Please start a new question.')
  return { message: data.message.trim(), quick: data.quick as Topic | undefined, event_date: data.event_date as string | undefined, history: history.map((item) => ({ role: item.role, content: item.content })) }
}
export function parseIntent(value: unknown): Intent {
  if (!value || typeof value !== 'object') throw new Error('Invalid assistant response')
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.topics) || data.topics.length > 3 || data.topics.some((topic) => !topics.includes(topic)) || !['en', 'fil'].includes(String(data.language)) || (data.event_date !== null && (typeof data.event_date !== 'string' || !validDate(data.event_date))) || (data.guests !== null && (!Number.isInteger(data.guests) || Number(data.guests) < 1 || Number(data.guests) > 10000))) throw new Error('Invalid assistant response')
  return { topics: [...new Set(data.topics)] as Topic[], event_date: data.event_date as string | null, guests: data.guests as number | null, language: data.language as 'en' | 'fil' }
}
export function quickIntent(request: AssistantRequest): Intent {
  // Only explicit quick buttons work without AI. Free-text interpretation requires OpenAI.
  return { topics: request.quick ? [request.quick] : [], event_date: request.event_date ?? null, guests: null, language: 'en' }
}
export function answerFromFacts(intent: Intent, packages: PublicPackage[], dates: PublicDate[], engine: AssistantAnswer['engine'], now: string | Date = new Date()): AssistantAnswer {
  const earliest = earliestBookingDate(now)
  const fil = intent.language === 'fil'
  const lines: string[] = []
  const result: AssistantAnswer = { reply: '', engine, packages: [], dates: [] }
  if (!intent.topics.length) {
    result.reply = engine === 'quick_answers'
      ? 'Free-text AI chat is temporarily unavailable. Use the buttons below for current package prices, available dates, or the booking rule.'
      : 'I can help with catering package prices, available dates, and the 3-day booking rule. Which would you like to check?'
    return result
  }
  if (intent.topics.includes('packages')) {
    result.packages = packages
    lines.push(fil ? 'Ito ang kasalukuyang packages. Ang presyo ay bawat guest; hiwalay pa ang event setup at extras.' : 'Here are our current packages. Prices are per guest; event setup and extras are added separately.')
    if (!packages.length) lines.push('No active packages are currently listed. Please contact the team.')
    if (intent.guests) {
      const money = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value / 100)
      lines.push(`For ${intent.guests} guests: ` + packages.map((item) => intent.guests! < item.min_guests ? `${item.name} needs at least ${item.min_guests} guests` : `${item.name} menu subtotal ${money(item.price * intent.guests!)}`).join('; ') + '. These are menu subtotals, not complete event quotes.')
    }
  }
  if (intent.topics.includes('availability')) {
    if (intent.event_date && intent.event_date < earliest) {
      lines.push(fil ? `Hindi pa puwedeng mag-reserve sa ${intent.event_date}. Kailangan ng 3 araw para sa preparation; pinakamaagang date ay ${earliest} (Manila).` : `Bookings require 3 days of preparation. ${intent.event_date} is too soon; the earliest date is ${earliest} (Manila).`)
    } else {
      result.dates = dates.filter((day) => day.event_date >= earliest && (!intent.event_date || day.event_date === intent.event_date)).slice(0, intent.event_date ? 1 : 7)
      lines.push(intent.event_date ? `Availability for ${intent.event_date}:` : (fil ? 'Narito ang available dates sa susunod na 30 araw:' : 'Here are available dates in the next 30 days:'))
      if (!result.dates.length) lines.push('No available dates were found in this search. Please check another date or contact the team.')
      lines.push(fil ? 'Maaaring magbago ang slots. Makukumpirma ang date kapag approved na ang reservation.' : 'Slots can change. Your date is confirmed when the reservation is approved.')
    }
  }
  if (intent.topics.includes('booking_rules')) lines.push(fil ? `Mag-reserve nang hindi bababa sa 3 araw bago ang event para sa preparation. Pinakamaagang date ngayon: ${earliest} (Manila).` : `Reserve at least 3 calendar days ahead for preparation. The earliest event date today is ${earliest} (Manila).`)
  result.reply = lines.join('\n\n')
  return result
}
