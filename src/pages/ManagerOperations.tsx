import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Hourglass, RotateCcw, Wallet } from 'lucide-react'
import { useReservations } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { rpc } from '../lib/supabase'
import { date, human, money, todayManila } from '../lib/format'
import { monthDays, moveMonth } from '../lib/calendar'
import { DataTable, ErrorState, Loading, PageHeading } from '../components/ui'
import { Stat } from './Customer'
import type { RecordRow } from '../types'
import { timeLabel } from '../components/EventTimeSelect'
interface Operations {
  active: number
  pending: number
  upcoming: number
  confirmed: number
  cancellations: number
  refunds: number
  reschedules: number
  payments: Record<string, number>
}
export function OperationalSummary() {
  const query = useQuery({
    queryKey: ['operational-metrics'],
    queryFn: () => rpc<Operations>('operational_metrics'),
    refetchInterval: 60000,
  })
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  const data = query.data
  return (
    <>
      <div className="stat-grid four">
        {[
          ['Active reservations', data.active, CalendarDays],
          ['Pending bookings', data.pending, Hourglass],
          ['Upcoming events', data.upcoming, CalendarDays],
          ['Confirmed events', data.confirmed, CalendarDays],
          ['Pending cancellations', data.cancellations, RotateCcw],
          ['Pending refunds', data.refunds, Wallet],
          ['Pending reschedules', data.reschedules, RotateCcw],
        ].map(([label, value, Icon]) => {
          const Symbol = Icon as typeof CalendarDays
          return (
            <Stat
              key={String(label)}
              label={String(label)}
              value={Number(value)}
              icon={<Symbol />}
            />
          )
        })}
      </div>
      <section className="panel">
        <h2>Reservation payment status</h2>
        <div className="payment-status-summary">
          {Object.entries(data.payments).map(([status, count]) => (
            <span key={status}>
              {human(status)} <strong>{count}</strong>
            </span>
          ))}
        </div>
      </section>
    </>
  )
}
export function ManagerCalendar() {
  const [month, setMonth] = useState(todayManila().slice(0, 7)),
    reservations = useReservations(),
    calendar = monthDays(month)
  return (
    <>
      <PageHeading
        eyebrow="MANAGER · EVENT OPERATIONS"
        title="Your event calendar."
      >
        Approved/completed events and pending requests remain attached to their
        saved event dates until a reschedule is approved.
      </PageHeading>
      <section className="panel">
        <div className="calendar-toolbar">
          <button
            className="button secondary small"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            Previous month
          </button>
          <strong>
            {new Date(month + '-01T00:00:00Z').toLocaleDateString('en-PH', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </strong>
          <button
            className="button secondary small"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            Next month
          </button>
        </div>
        {reservations.isPending ? (
          <Loading />
        ) : reservations.error ? (
          <ErrorState error={reservations.error} />
        ) : (
          <div className="manager-calendar-list">
            {calendar.days.map((day) => {
              const rows = reservations.data.filter(
                (r) =>
                  r.event_date === day &&
                  ['approved', 'completed', 'pending_cancellation'].includes(
                    r.status,
                  ),
              )
              return rows.length ? (
                <div className="manager-calendar-day" key={day}>
                  <strong>{date(day)}</strong>
                  {rows.map((r) => (
                    <p key={r.id}>
                      {r.reservation_reference} · {timeLabel(r.event_time)} Manila · {r.event_name} · {r.guests}{' '}
                      guests · {human(r.status)}
                    </p>
                  ))}
                </div>
              ) : null
            })}
            {!reservations.data.some(
              (r) =>
                r.event_date.startsWith(month) &&
                ['approved', 'completed', 'pending_cancellation'].includes(
                  r.status,
                ),
            ) && <p>No confirmed events this month.</p>}
          </div>
        )}
      </section>
    </>
  )
}
export function ManagerCatalog({ setups = false }: { setups?: boolean }) {
  const query = useCatalog()
  return (
    <>
      <PageHeading
        eyebrow="MANAGER · CATALOG REFERENCE"
        title={
          setups
            ? 'Event setups and optional extras.'
            : 'Catering packages and menus.'
        }
      >
        Review current offerings. Pricing, packages, setup fees and publishing
        are administered by the super admin; managers can edit the menu library.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        Object.entries(query.data)
          .filter(([table]) =>
            setups
              ? [
                  'event_setups',
                  'event_features',
                  'add_ons',
                  'chair_types',
                  'table_types',
                ].includes(table)
              : ['menu_sets', 'dishes', 'drinks', 'desserts'].includes(table),
          )
          .map(([table, rows]) => (
            <section className="panel" key={table}>
              <h2>{human(table)}</h2>
              <DataTable
                rows={rows as unknown as RecordRow[]}
                columns={[
                  { key: 'name', label: 'Name' },
                  {
                    key: 'price',
                    label:
                      table === 'menu_sets'
                        ? 'Price / guest'
                        : table === 'chair_types'
                          ? 'Upgrade / selected guest chair'
                          : 'Catalog price',
                    render: (r) =>
                      r.price === undefined
                        ? 'Included in selected menu'
                        : money(Number(r.price)),
                  },
                  { key: 'description', label: 'Details' },
                ]}
              />
            </section>
          ))
      )}
    </>
  )
}
