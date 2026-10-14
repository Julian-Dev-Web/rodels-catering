import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { records, rpc } from '../lib/supabase'
import {
  Action,
  DataTable,
  ErrorState,
  Loading,
  PageHeading,
} from '../components/ui'
import { Form } from '../components/Form'
import { timeLabel } from '../components/EventTimeSelect'
import type { RecordRow } from '../types'
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
const validateHours = (v: Record<string, string>): Record<string, string> =>
  v.closed === 'false' && (!v.opening || !v.closing || v.opening >= v.closing)
    ? { closing: 'Closing time must be after opening time.' }
    : {}
export function OperatingHours() {
  const query = useQuery({
      queryKey: ['operating-hours'],
      queryFn: async () => {
        const [hours, exceptions] = await Promise.all([
          records<RecordRow>('business_hours', 'weekday', true),
          records<RecordRow>('business_date_overrides', 'event_date', true),
        ])
        return { hours, exceptions }
      },
    }),
    [selected, setSelected] = useState(1)
  return (
    <>
      <PageHeading
        eyebrow="STAFF · SCHEDULING"
        title="Operating hours and closed dates."
      >
        Owner-confirmed baseline: Monday–Saturday 7 AM–10 PM; Sunday 8 AM–9 PM,
        Manila. Changes apply to new bookings, checkout and approval; existing
        records stay intact and may need staff review. No event duration or
        hourly conflict rule was supplied; the existing three-event daily limit
        remains.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <>
          <section className="panel">
            <h2>Weekly hours</h2>
            <DataTable
              rows={query.data.hours.map((h) => ({
                ...h,
                id: String(h.weekday),
                day: weekdays[Number(h.weekday)],
                hours: h.closed
                  ? 'Closed'
                  : timeLabel(String(h.opens)) +
                    '–' +
                    timeLabel(String(h.closes)),
              }))}
              columns={[
                { key: 'day', label: 'Day' },
                { key: 'hours', label: 'Hours (Manila)' },
              ]}
            />
            <label>
              Change weekday
              <select
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {weekdays.map((d, i) => (
                  <option value={i} key={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <Form
              key={
                selected +
                ':' +
                query.data.hours.find((h) => h.weekday === selected)?.updated_at
              }
              fields={[
                {
                  name: 'closed',
                  label: 'Availability',
                  options: [
                    { value: 'false', label: 'Open' },
                    { value: 'true', label: 'Closed' },
                  ],
                  required: true,
                },
                { name: 'opening', label: 'Opens (Manila)', type: 'time' },
                { name: 'closing', label: 'Closes (Manila)', type: 'time' },
              ]}
              initial={(() => {
                const h = query.data.hours.find((h) => h.weekday === selected)
                return {
                  closed: String(h?.closed),
                  opening: String(h?.opens || '').slice(0, 5),
                  closing: String(h?.closes || '').slice(0, 5),
                }
              })()}
              label="Save weekday hours"
              validate={validateHours}
              submit={(v) =>
                rpc('configure_business_hours', {
                  day_of_week: selected,
                  is_closed: v.closed === 'true',
                  opening: v.closed === 'true' ? null : v.opening,
                  closing: v.closed === 'true' ? null : v.closing,
                })
              }
            />
          </section>
          <section className="panel">
            <h2>Holiday/blocked date or hours exception</h2>
            <p>
              No holiday closures are assumed. Add only approved dates; an open
              exception replaces that day’s normal hours.
            </p>
            <Form
              fields={[
                { name: 'day', label: 'Date', type: 'date', required: true },
                {
                  name: 'closed',
                  label: 'Availability',
                  required: true,
                  options: [
                    { value: 'true', label: 'Closed / blocked' },
                    { value: 'false', label: 'Open with special hours' },
                  ],
                },
                { name: 'opening', label: 'Special opening', type: 'time' },
                { name: 'closing', label: 'Special closing', type: 'time' },
                {
                  name: 'message',
                  label: 'Public reason · optional',
                  max: 500,
                },
              ]}
              initial={{ closed: 'true' }}
              label="Save date exception"
              validate={validateHours}
              submit={(v) =>
                rpc('configure_business_date', {
                  day: v.day,
                  is_closed: v.closed === 'true',
                  opening: v.closed === 'true' ? null : v.opening,
                  closing: v.closed === 'true' ? null : v.closing,
                  message: v.message,
                })
              }
            />
            <DataTable
              rows={query.data.exceptions.map((x) => ({
                ...x,
                id: String(x.event_date),
                hours: x.closed
                  ? 'Closed'
                  : timeLabel(String(x.opens)) +
                    '–' +
                    timeLabel(String(x.closes)),
              }))}
              columns={[
                { key: 'event_date', label: 'Date' },
                { key: 'hours', label: 'Override' },
                { key: 'note', label: 'Public note' },
              ]}
              actions={(r) => (
                <Action
                  label="Remove exception"
                  confirm="Restore the usual weekday hours for this date?"
                  run={() => rpc('remove_business_date', { day: r.event_date })}
                />
              )}
            />
          </section>
        </>
      )}
    </>
  )
}
