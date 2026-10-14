import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { date, earliestEventDate, todayManila } from '../lib/format'
import {
  eligibleRescheduleDay,
  initialRescheduleMonth,
  monthDays,
  moveMonth,
} from '../lib/calendar'
import { rpc } from '../lib/supabase'
import { records } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { ErrorState } from './ui'
import type { Reservation } from '../types'

export function RescheduleForm({
  reservation,
  close,
}: {
  reservation: Reservation
  close: () => void
}) {
  const [month, setMonth] = useState(() =>
    initialRescheduleMonth(reservation.event_date, todayManila()),
  )
  const [selected, setSelected] = useState(''),
    [reason, setReason] = useState('')
  const calendar = monthDays(month),
    earliest = earliestEventDate(),
    qc = useQueryClient()
  const availability = useQuery({
    queryKey: ['reschedule-availability', month],
    queryFn: () =>
      rpc<{ event_date: string; remaining: number }[]>('available_dates', {
        start_date: month + '-01',
        end_date: calendar.days.at(-1),
      }),
  })
  const remaining = (day: string) =>
    availability.data?.find((item) => item.event_date === day)?.remaining
  const pending = useQuery({
    queryKey: ['pending-reschedule', reservation.id],
    queryFn: () =>
      records('reschedule_requests', 'created_at', true, {
        reservation_id: reservation.id,
        status: 'pending',
      }),
  })
  const canRequest =
    reservation.status === 'approved' &&
    reservation.event_date > todayManila() &&
    !pending.isPending &&
    !pending.error &&
    !pending.data?.length
  const request = useMutation({
    mutationFn: async () => {
      if (
        !canRequest ||
        !eligibleRescheduleDay(
          selected,
          reservation.event_date,
          earliest,
          remaining(selected),
        )
      )
        throw new Error(
          'An approved future booking without a pending request and a different available date are required.',
        )
      if (reason.trim().length < 5)
        throw new Error('Please give a reason of at least 5 characters.')
      return rpc('request_reschedule', {
        rid: reservation.id,
        new_date: selected,
        reason: reason.trim(),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries()
      close()
    },
  })
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault()
        request.mutate()
      }}
    >
      <p>
        Original event: <strong>{date(reservation.event_date)}</strong>. Your
        confirmed date stays unchanged while the request is pending.
      </p>
      <p className="date-help">
        Choose another available date from {date(earliest)} onward. Up to three
        approved changes per calendar month.
      </p>
      {reservation.event_date <= todayManila() && (
        <p className="alert">
          The original event is no longer a future booking.{' '}
          <Link to="/customer/support">Contact support</Link> for review.
        </p>
      )}
      {!!pending.data?.length && (
        <p className="alert">
          A reschedule request is already pending. Your original date remains
          unchanged.
        </p>
      )}
      {pending.error && <ErrorState error={pending.error} />}
      <div className="reschedule-calendar">
        <div className="calendar-toolbar">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous month"
            disabled={month <= todayManila().slice(0, 7)}
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            <ChevronLeft />
          </button>
          <strong aria-live="polite">
            {new Date(month + '-01T00:00:00Z').toLocaleDateString('en-PH', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="reschedule-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span className="calendar-weekday" key={day}>
              {day}
            </span>
          ))}
          {Array.from({ length: calendar.offset }, (_, i) => (
            <span key={'empty' + i} />
          ))}
          {calendar.days.map((day) => {
            const original = day === reservation.event_date,
              available = eligibleRescheduleDay(
                day,
                reservation.event_date,
                earliest,
                remaining(day),
              )
            return (
              <button
                type="button"
                key={day}
                className={
                  'calendar-day ' +
                  (original ? 'original ' : '') +
                  (selected === day ? 'selected' : '')
                }
                disabled={
                  !available || request.isPending || availability.isFetching
                }
                aria-pressed={selected === day}
                aria-label={
                  date(day) +
                  (original
                    ? ' · Original event'
                    : available
                      ? ' · ' + remaining(day) + ' event slots available'
                      : ' · Unavailable')
                }
                onClick={() => setSelected(day)}
              >
                <strong>{Number(day.slice(8))}</strong>
                <small>
                  {original
                    ? 'Original'
                    : day < earliest
                      ? ''
                      : availability.isFetching
                        ? '…'
                        : remaining(day) === 0
                          ? 'Full'
                          : remaining(day) + ' slots'}
                </small>
              </button>
            )
          })}
        </div>
      </div>
      {availability.error && (
        <ErrorState
          error={availability.error}
          retry={() => void availability.refetch()}
        />
      )}
      <p aria-live="polite">
        {selected
          ? 'Requested new date: ' + date(selected)
          : 'No replacement date selected.'}
      </p>
      <label>
        Reason
        <textarea
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={5}
          maxLength={2000}
          required
        />
      </label>
      <button
        className="button"
        disabled={
          !canRequest ||
          !selected ||
          reason.trim().length < 5 ||
          request.isPending ||
          !eligibleRescheduleDay(
            selected,
            reservation.event_date,
            earliest,
            remaining(selected),
          )
        }
      >
        {request.isPending ? 'Sending…' : 'Send reschedule request'}
      </button>
      {request.error && <ErrorState error={request.error} />}
    </form>
  )
}
