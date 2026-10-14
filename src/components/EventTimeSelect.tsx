import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rpc } from '../lib/supabase'
import { ErrorState } from './ui'
export interface BookingWindow {
  available: boolean
  closed: boolean
  opens: string | null
  closes: string | null
  remaining: number
  times: string[]
  reason: string
}
export const timeLabel = (time: string) =>
  new Date('2000-01-01T' + time.slice(0, 5) + ':00+08:00').toLocaleTimeString(
    'en-PH',
    { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' },
  )
export function validWindowTime(
  window: BookingWindow | undefined,
  time: string,
) {
  return (
    !!window?.available &&
    !!window.opens &&
    !!window.closes &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    time >= window.opens.slice(0, 5) &&
    time <= window.closes.slice(0, 5)
  )
}
export function EventTimeSelect({
  day,
  rid,
  value,
  onChange,
  inputRef,
}: {
  day: string
  rid?: string
  value: string
  onChange: (value: string) => void
  inputRef?: (element: HTMLSelectElement | HTMLInputElement | null) => void
}) {
  const [custom, setCustom] = useState(false)
  const query = useQuery({
    queryKey: ['booking-window', day, rid],
    enabled: !!day,
    queryFn: () =>
      rpc<BookingWindow>('booking_window', { day, rid: rid || null }),
    refetchInterval: 30000,
  })
  useEffect(() => {
    if (query.data && value && !validWindowTime(query.data, value)) onChange('')
  }, [query.data, value, onChange])
  const choices = query.data?.times || []
  const withExisting =
    value && validWindowTime(query.data, value) && !choices.includes(value)
      ? [...choices, value].sort()
      : choices
  return (
    <label>
      Event start time (Manila)
      <select
        name={custom ? undefined : 'event_time'}
        ref={custom ? undefined : inputRef}
        value={custom ? 'other' : value}
        disabled={!query.data?.available || query.isFetching}
        onChange={(e) => {
          setCustom(e.target.value === 'other')
          if (e.target.value !== 'other') onChange(e.target.value)
        }}
        required
      >
        <option value="">
          {query.isFetching
            ? 'Checking availability…'
            : 'Choose an available start time'}
        </option>
        {withExisting.map((t) => (
          <option value={t} key={t}>
            {timeLabel(t)}
          </option>
        ))}
        {query.data?.available && (
          <option value="other">Other start time within these hours</option>
        )}
      </select>
      {custom && query.data?.available && (
        <input
          ref={inputRef}
          name="event_time"
          type="time"
          aria-label="Other event start time (Manila)"
          min={query.data.opens?.slice(0, 5)}
          max={query.data.closes?.slice(0, 5)}
          step={60}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      )}
      {query.data?.available ? (
        <small className="date-help">
          {timeLabel(query.data.opens!)}–{timeLabel(query.data.closes!)}.{' '}
          {query.data.remaining} date slots available. Choose a listed start or
          another time within these hours. Confirm service duration with the
          team.
        </small>
      ) : query.data ? (
        <small className="field-error" role="alert">
          {query.data.reason}
        </small>
      ) : (
        <small className="date-help">
          Choose an event date to view available times.
        </small>
      )}
      {query.error && (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      )}
    </label>
  )
}
