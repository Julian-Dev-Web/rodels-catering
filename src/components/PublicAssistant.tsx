import { useEffect, useRef, useState } from 'react'
import { CalendarDays, MessageCircle, Send, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { edge } from '../lib/supabase'
import { date, earliestEventDate, money } from '../lib/format'
import type { AssistantAnswer, Topic } from '../../supabase/functions/_shared/assistant.ts'

interface ChatMessage { role: 'user' | 'assistant'; content: string; answer?: AssistantAnswer }
const quickQuestions: { topic: Topic; label: string }[] = [
  { topic: 'packages', label: 'Package prices' },
  { topic: 'availability', label: 'Available dates' },
  { topic: 'booking_rules', label: '3-day booking rule' },
  { topic: 'upgrades', label: 'Setups & chairs' },
]
export function PublicAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const transcript = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  useEffect(() => { if (open) input.current?.focus() }, [open])
  useEffect(() => { transcript.current?.scrollTo({ top: transcript.current.scrollHeight, behavior: 'smooth' }) }, [messages, pending])
  function close() { setOpen(false); toggle.current?.focus() }
  async function ask(message: string, quick?: Topic) {
    if (!message.trim() || busy.current) return
    busy.current = true; setPending(true); setError(''); setQuestion('')
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 800) }))
    setMessages((current) => [...current.slice(-19), { role: 'user', content: message }])
    try {
      const answer = await edge<AssistantAnswer>('public-assistant', { message, quick, history, ...(selectedDate ? { event_date: selectedDate } : {}) })
      setMessages((current) => [...current, { role: 'assistant', content: answer.reply, answer }])
    } catch { setError('The assistant is unavailable right now. Please try again, or view our packages and contact the team.') }
    finally { busy.current = false; setPending(false) }
  }
  return (
    <div className="public-assistant">
      {open && <section id="catering-assistant" className="assistant-panel" role="dialog" aria-modal="false" aria-label="Rodel’s reservation assistant" onKeyDown={(event) => { if (event.key === 'Escape') close() }}>
        <header className="assistant-header">
          <div><strong>Ask Rodel’s</strong><span>Packages, prices & available dates</span></div>
          <button className="icon-button" aria-label="Close assistant" onClick={close}><X size={20} /></button>
        </header>
        <div className="assistant-messages" role="log" aria-live="polite" aria-relevant="additions" ref={transcript}>
          <div className="assistant-message assistant"><p>Hello! I can help you explore our packages and check dates. We need at least 3 days to prepare your event.</p></div>
          {messages.map((item, index) => <div key={index} className={'assistant-message ' + item.role}>
            <span className="sr-only">{item.role === 'user' ? 'You:' : 'Assistant:'}</span>
            <p>{item.content}</p>
            {item.answer?.packages.map((pack) => <article className="assistant-package" key={pack.id}>
              <strong>{pack.name}</strong><span>{money(pack.price)} / guest</span><small>{pack.min_guests}{pack.max_guests ? '–' + pack.max_guests : '+'} guests · {pack.dish_count} dishes</small>
            </article>)}
            {!!item.answer?.packages.length && <Link className="assistant-link" to="/packages">Explore package details</Link>}
            {Object.entries(item.answer?.options ?? {}).map(([kind, options]) => <div key={kind}><strong className="assistant-option-heading">{kind.replaceAll('_', ' ')}</strong>{options.map((option) => <article className="assistant-package" key={option.id}><strong>{option.name}</strong><span>{option.price === 0 ? 'Included' : money(option.price) + (kind === 'chair_types' ? ' / guest' : kind === 'table_types' ? ' / table' : ' / event')}</span>{option.description && <small>{option.description}</small>}{option.required_setup_id && <small>Wedding setup required</small>}</article>)}</div>)}
            {item.answer?.dates.map((day) => <div className="assistant-date" key={day.event_date}><span>{date(day.event_date)}</span><strong>{day.remaining > 0 ? `${day.remaining} ${day.remaining === 1 ? 'slot' : 'slots'} available` : 'Fully booked'}</strong></div>)}
            {!!item.answer?.dates.some((day) => day.remaining > 0) && <Link className="assistant-link" to={'/customer/reservations/new?date=' + item.answer.dates.find((day) => day.remaining > 0)!.event_date}>Sign in to plan your event</Link>}
            {item.answer && <small className="assistant-source">{item.answer.engine !== 'quick_answers' ? 'AI assisted · current catalog/calendar' : 'Quick answer · current catalog/calendar'}</small>}
          </div>)}
          {pending && <p className="assistant-status" role="status">Checking your question…</p>}
          {error && <p className="error assistant-error" role="alert">{error} <Link to="/packages">View packages</Link></p>}
        </div>
        <div className="assistant-controls">
          <div className="assistant-quick" aria-label="Quick questions">{quickQuestions.map(({ topic, label }) => <button key={topic} disabled={pending} onClick={() => void ask(label, topic)}>{label}</button>)}</div>
          <label className="assistant-date-picker"><span><CalendarDays size={15} aria-hidden="true" /> Check a specific date <small>(optional)</small></span><input type="date" min={earliestEventDate()} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
          <form onSubmit={(event) => { event.preventDefault(); void ask(question) }}>
            <label className="sr-only" htmlFor="assistant-question">Ask about packages or dates</label>
            <input ref={input} id="assistant-question" value={question} maxLength={800} placeholder="e.g. Magkano for 50 guests?" onChange={(event) => setQuestion(event.target.value)} />
            <button className="button" aria-label="Send question" disabled={pending || !question.trim()}><Send size={18} /></button>
          </form>
          <small className="assistant-privacy">AI may interpret questions imperfectly. Please don’t share passwords, payment details, or personal information. Chat is not a reservation.</small>
        </div>
      </section>}
      <button ref={toggle} className="assistant-toggle" aria-expanded={open} aria-controls="catering-assistant" onClick={() => open ? close() : setOpen(true)}><MessageCircle size={22} /><span>{open ? 'Close chat' : 'Ask Rodel’s'}</span></button>
    </div>
  )
}
