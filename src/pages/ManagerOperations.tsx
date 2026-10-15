import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronDown,
  Hourglass,
  RotateCcw,
  Wallet,
} from 'lucide-react'
import { useReservations } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { rpc } from '../lib/supabase'
import { date, human, money, todayManila } from '../lib/format'
import { monthDays, moveMonth } from '../lib/calendar'
import {
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import { Stat } from './Customer'
import type { RecordRow } from '../types'
import { timeLabel } from '../components/EventTimeSelect'
import { FoodPhoto } from '../components/FoodPhoto'
import { isFoodKind } from '../lib/menu-photos'
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
    [choosingMonth, setChoosingMonth] = useState(false),
    [chosenMonth, setChosenMonth] = useState(month.slice(5, 7)),
    [chosenYear, setChosenYear] = useState(month.slice(0, 4)),
    reservations = useReservations(),
    calendar = monthDays(month)
  const validYear =
    /^\d{1,4}$/.test(chosenYear) &&
    Number(chosenYear) >= 1 &&
    Number(chosenYear) <= 9999
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
            disabled={month === '0001-01'}
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            Previous month
          </button>
          <button
            type="button"
            className="calendar-month-jump"
            aria-label="Choose calendar month and year"
            aria-haspopup="dialog"
            aria-expanded={choosingMonth}
            onClick={() => {
              setChosenMonth(month.slice(5, 7))
              setChosenYear(month.slice(0, 4))
              setChoosingMonth(true)
            }}
          >
            <strong>
              {new Date(month + '-01T00:00:00Z').toLocaleDateString('en-PH', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </strong>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <button
            className="button secondary small"
            disabled={month === '9999-12'}
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
                      {r.reservation_reference} · {timeLabel(r.event_time)}{' '}
                      Manila · {r.event_name} · {r.guests} guests ·{' '}
                      {human(r.status)}
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
      {choosingMonth && (
        <Modal
          title="Choose month and year"
          close={() => setChoosingMonth(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!validYear) return
              setMonth(chosenYear.padStart(4, '0') + '-' + chosenMonth)
              setChoosingMonth(false)
            }}
          >
            <div className="form-grid">
              <label>
                Month
                <select
                  aria-label="Calendar month"
                  value={chosenMonth}
                  onChange={(event) => setChosenMonth(event.target.value)}
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option
                      key={index}
                      value={String(index + 1).padStart(2, '0')}
                    >
                      {new Date(Date.UTC(2000, index, 1)).toLocaleDateString(
                        'en-PH',
                        { month: 'long', timeZone: 'UTC' },
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <input
                  aria-label="Calendar year"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={9999}
                  step={1}
                  required
                  value={chosenYear}
                  onChange={(event) => setChosenYear(event.target.value)}
                />
              </label>
            </div>
            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setChoosingMonth(false)}
              >
                Cancel
              </button>
              <button className="button" type="submit" disabled={!validYear}>
                Go to month
              </button>
            </div>
          </form>
        </Modal>
      )}
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
                ...(isFoodKind(table) ? [{ key:'image_url',label:'Photo',render:(row:RecordRow)=><div className="food-table-photo"><FoodPhoto item={{name:String(row.name),image_url:row.image_url?String(row.image_url):undefined}} kind={table as 'dishes'|'drinks'|'desserts'}/></div> }] : []),
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
