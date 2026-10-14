import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Plus, ShieldCheck, Users, Wallet } from 'lucide-react'
import { useReservations, useReservation } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { useAuth } from '../features/auth'
import {
  Action,
  Badge,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import { Form } from '../components/Form'
import { date, earliestEventDate, human, money, todayManila } from '../lib/format'
import { edge, records, rpc } from '../lib/supabase'
import { paymentAmount } from '../lib/rules'
import type { RecordRow, Reservation } from '../types'
export function Reservations() {
  const query = useReservations()
  const { profile } = useAuth()
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const rows = query.data
  return (
    <>
      <PageHeading
        title={`A little room for celebration, ${profile?.full_name.split(' ')[0] || 'friend'}.`}
        eyebrow="WELCOME TO YOUR TABLE"
        action={
          <Link className="button" to="/customer/reservations/new">
            <Plus size={17} />
            Plan an event
          </Link>
        }
      >
        Your upcoming moments, all in one place.
      </PageHeading>
      <div className="stat-grid">
        <Stat label="Your reservations" value={rows.length} icon={<CalendarDays />} />
        <Stat
          label="Upcoming celebrations"
          value={
            rows.filter((r) => r.event_date >= todayManila() && r.status === 'approved').length
          }
          icon={<Users />}
        />
        <Stat
          label="Total paid"
          value={money(rows.reduce((s, r) => s + r.paid - r.refunded, 0))}
          icon={<Wallet />}
        />
      </div>
      <div className="section-title">
        <h2>My reservations</h2>
        <Link className="text-button" to="/customer/available-dates">
          Explore available dates <ArrowRight size={15} />
        </Link>
      </div>
      {rows.length ? (
        <div className="reservation-grid">
          {rows.map((r) => (
            <article key={r.id} className="reservation-card">
              <div className="reservation-card-head">
                <span className="date-block">
                  <strong>{r.event_date.slice(8)}</strong>
                  <small>
                    {new Date(r.event_date + 'T00:00:00+08:00').toLocaleDateString('en-PH', {
                      month: 'short',
                      timeZone: 'Asia/Manila',
                    })}
                  </small>
                </span>
                <Badge value={r.status} />
              </div>
              <h3>{r.event_name}</h3>
              <p>
                {r.package_name} · {r.guests} guests
              </p>
              <div className="reservation-card-bottom">
                <div>
                  <small>Total package & extras</small>
                  <strong>{money(r.total)}</strong>
                </div>
                <Link
                  className="round-link"
                  to={'/customer/reservations/' + r.id}
                  aria-label={'View ' + r.event_name}
                >
                  <ArrowRight size={20} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Your next memory starts here.">
          Explore our packages, find your date, and start planning your first celebration.{' '}
          <Link to="/customer/reservations/new">Plan an event</Link>
        </Empty>
      )}
    </>
  )
}
export function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
}) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
export function ReservationDetail() {
  const { id } = useParams(),
    query = useReservation(id),
    catalog = useCatalog({ includeArchived: true })
  const [modal, setModal] = useState<'cancel' | 'reschedule' | null>(null)
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  const { reservation: r, children: c } = query.data
  const editable = ['draft', 'pending', 'for_approval'].includes(r.status) && r.paid === 0
  const payable = ['for_approval', 'pending', 'approved'].includes(r.status) && r.paid < r.total
  return (
    <>
      <PageHeading
        title={r.event_name}
        eyebrow={'RESERVATION ' + r.id.slice(0, 8).toUpperCase()}
        action={
          <Link className="button secondary" to="/customer/reservations">
            All reservations
          </Link>
        }
      >
        {date(r.event_date)} · {r.event_time.slice(0, 5)} Manila · {r.guests} guests
      </PageHeading>
      <div className="detail-layout">
        <section className="panel">
          <div className="actions">
            <Badge value={r.status} />
            <Badge value={r.payment_status} />
          </div>
          <h2>Your celebration</h2>
          <dl className="detail-list">
            <dt>Package</dt>
            <dd>
              {catalog.data?.menu_sets.find((p) => p.id === r.menu_set_id)?.name || r.menu_set_id}
            </dd>
            <dt>Location</dt>
            <dd>
              {['street', 'barangay', 'city', 'province']
                .map((k) => r.address[k])
                .filter(Boolean)
                .join(', ')}
            </dd>
            <dt>Event contact</dt>
            <dd>{r.address.contact || '—'}</dd>
            <dt>Menu</dt>
            <dd>
              {catalog.data?.dishes
                .filter((d) => c.reservation_items.some((x) => x.dish_id === d.id))
                .map((d) => d.name)
                .join(', ') || 'Not selected'}
            </dd>
            <dt>Drink & dessert</dt>
            <dd>
              {catalog.data?.drinks.find((d) => d.id === r.drink_id)?.name} ·{' '}
              {catalog.data?.desserts.find((d) => d.id === r.dessert_id)?.name}
            </dd>
            <dt>Setup</dt>
            <dd>
              {catalog.data?.event_setups.find((d) =>
                c.reservation_event_setups.some((x) => x.event_setup_id === d.id),
              )?.name || 'Not selected'}
            </dd>
            <dt>Notes</dt>
            <dd>{r.address.notes || '—'}</dd>
          </dl>
          <div className="actions">
            {editable && (
              <Link className="button secondary" to={`/customer/reservations/${r.id}/edit`}>
                Edit reservation
              </Link>
            )}
            {r.status === 'draft' && (
              <Link className="button" to={`/customer/reservations/${r.id}/confirm`}>
                Review & finalize
              </Link>
            )}
            {['draft', 'pending', 'for_approval', 'approved'].includes(r.status) && (
              <button className="text-button" onClick={() => setModal('cancel')}>
                Request cancellation
              </button>
            )}
            {r.status === 'approved' && (
              <button className="text-button" onClick={() => setModal('reschedule')}>
                Request reschedule
              </button>
            )}
            {r.status === 'cancelled' && r.paid > 0 && (
              <Action
                label="Request policy refund"
                confirm="We will store your eligible refund amount using the current refund policy and send it for manager review."
                run={() => rpc('request_refund', { rid: r.id })}
              />
            )}
          </div>
          {payable && (
            <div className="payment-box">
              <h3>A little closer to your celebration.</h3>
              <p>
                Choose how you’d like to pay. Your confirmed payment state appears here after
                verified server processing.
              </p>
              <div className="actions">
                {(r.paid === 0 ? ['partial', 'full'] : ['balance']).map((intent) => (
                  <Action
                    key={intent}
                    label={`${human(intent === 'partial' ? '50% down payment' : intent)} · ${money(paymentAmount(r.total, r.paid, intent as 'partial' | 'full' | 'balance'))}`}
                    kind="primary"
                    confirm="You will continue to PayMongo’s secure checkout. A redirect alone does not confirm payment or your event date."
                    run={async () => {
                      const data = await edge<{ url: string }>('create-paymongo-checkout', {
                        reservation_id: r.id,
                        intent,
                      })
                      const url = new URL(data.url)
                      if (url.protocol !== 'https:' || !url.hostname.endsWith('.paymongo.com'))
                        throw new Error('Invalid checkout URL')
                      window.location.assign(url.toString())
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="alert">
            <ShieldCheck size={22} />
            <p>
              Payment confirmation is read from the server. If you’ve just returned from checkout,
              use Refresh status while your payment is verified.
            </p>
          </div>
          <button className="text-button" onClick={() => void query.refetch()}>
            Refresh status
          </button>
        </section>
        <aside className="quote-panel">
          <span className="eyebrow">YOUR CONFIRMED QUOTE</span>
          {Object.entries(r.pricing)
            .filter(([k]) => k !== 'total')
            .map(([k, v]) => (
              <div className="price-line" key={k}>
                <span>{human(k)}</span>
                <strong>{money(v)}</strong>
              </div>
            ))}
          <div className="price-total">
            <span>Total</span>
            <strong>{money(r.total)}</strong>
          </div>
          <div className="price-line">
            <span>Paid</span>
            <strong>{money(r.paid)}</strong>
          </div>
          <div className="price-line">
            <span>Refunded</span>
            <strong>{money(r.refunded)}</strong>
          </div>
          <div className="price-line">
            <span>Balance</span>
            <strong>
              {money(
                ['cancelled', 'pending_refund', 'refund_approved', 'refunded', 'rejected'].includes(
                  r.status,
                )
                  ? 0
                  : Math.max(0, r.total - r.paid),
              )}
            </strong>
          </div>
        </aside>
      </div>
      {modal && <RequestModal kind={modal} reservation={r} close={() => setModal(null)} />}
    </>
  )
}
function RequestModal({
  kind,
  reservation,
  close,
}: {
  kind: 'cancel' | 'reschedule'
  reservation: Reservation
  close: () => void
}) {
  return (
    <Modal title={kind === 'cancel' ? 'Request cancellation' : 'Request a new date'} close={close}>
      <p>
        {kind === 'cancel'
          ? 'Requests must be made more than 72 hours before your event date begins.'
          : 'Up to three approved reschedules per calendar month, subject to date availability. New date must be at least three days ahead.'}
      </p>
      <Form
        fields={[
          ...(kind === 'reschedule'
            ? [{ name: 'new_date', label: 'New event date', type: 'date', required: true }]
            : []),
          {
            name: 'reason',
            label: 'Tell us a little more',
            type: 'textarea',
            required: true,
            max: 2000,
          },
        ]}
        label="Send request"
        submit={(v) =>
          kind === 'cancel'
            ? rpc('request_cancellation', { rid: reservation.id, reason: v.reason })
            : rpc('request_reschedule', {
                rid: reservation.id,
                new_date: v.new_date,
                reason: v.reason,
              })
        }
        onSuccess={close}
      />
    </Modal>
  )
}
export function AvailableDates() {
  const [month, setMonth] = useState(todayManila().slice(0, 7))
  const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const query = useQuery({
    queryKey: ['dates', month],
    queryFn: () =>
      rpc<{ event_date: string; remaining: number }[]>('available_dates', {
        start_date: month + '-01',
        end_date: month + '-' + end,
      }),
  })
  const first = new Date(month + '-01T00:00:00+08:00').getUTCDay()
  const offset = (first + 1) % 7
  return (
    <>
      <PageHeading title="Find room for your celebration.">
        Up to three approved events per date. Availability is confirmed when your reservation is
        approved. Please reserve at least 3 days ahead for preparation. The earliest date is {date(earliestEventDate())} (Manila).
      </PageHeading>
      <section className="panel">
        <div className="section-title">
          <h2>Available dates</h2>
          <input
            aria-label="Choose month"
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
            }}
          />
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : (
          <>
            <div className="calendar weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar">
              {Array.from({ length: offset }, (_, i) => (
                <span key={'blank' + i} />
              ))}
              {query.data?.map((d) => (
                <div
                  className={'calendar-day ' + (d.event_date < earliestEventDate() ? 'blocked' : d.remaining === 0 ? 'full' : '')}
                  key={d.event_date}
                >
                  <strong>{Number(d.event_date.slice(8))}</strong>
                  <span>
                    {d.event_date < todayManila()
                      ? 'Past date'
                      : d.event_date < earliestEventDate()
                        ? '3-day notice required'
                        : d.remaining > 0
                        ? `${d.remaining} spots available`
                        : 'Fully booked'}
                  </span>
                  {d.remaining > 0 && d.event_date >= earliestEventDate() && (
                    <Link to={'/customer/reservations/new?date=' + d.event_date}>
                      Plan event <ArrowRight size={12} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
export function CustomerWorkflow({ kind }: { kind: 'cancellations' | 'refunds' | 'reschedule' }) {
  const reservations = useReservations()
  const [selected, setSelected] = useState<Reservation | null>(null)
  const table = kind === 'reschedule' ? 'reschedule_requests' : kind
  const query = useQuery({ queryKey: [table], queryFn: () => records<RecordRow>(table) })
  return (
    <>
      <PageHeading title={human(kind)}>
        {kind === 'refunds'
          ? 'Your policy-calculated refund requests and provider processing status.'
          : 'Requests are reviewed by our team. Track every update here.'}
      </PageHeading>
      <section className="panel">
        <h2>
          {kind === 'refunds'
            ? 'Request an eligible refund'
            : kind === 'reschedule'
              ? 'Request a different date'
              : 'Request cancellation'}
        </h2>
        {reservations.isPending ? (
          <Loading />
        ) : reservations.error ? (
          <ErrorState error={reservations.error} />
        ) : (
          <div className="request-list">
            {reservations.data
              ?.filter((r) =>
                kind === 'refunds'
                  ? r.status === 'cancelled' && r.paid > 0
                  : kind === 'reschedule'
                    ? r.status === 'approved'
                    : ['draft', 'pending', 'for_approval', 'approved'].includes(r.status),
              )
              .map((r) => (
                <div key={r.id}>
                  <span>
                    <strong>{r.event_name}</strong>
                    <small>{date(r.event_date)}</small>
                  </span>
                  {kind === 'refunds' ? (
                    <Action
                      label="Request refund"
                      run={() => rpc('request_refund', { rid: r.id })}
                      confirm="Your eligible refund amount will be calculated and stored using the current policy."
                    />
                  ) : (
                    <button className="button small secondary" onClick={() => setSelected(r)}>
                      Send request <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            <p className="muted">
              Only eligible reservations appear here.{' '}
              <Link to="/customer/support">Contact support</Link> if you need help.
            </p>
          </div>
        )}
      </section>
      <div className="section-title">
        <h2>Request history</h2>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data}
          columns={[
            {
              key: 'reservation_id',
              label: 'Reservation',
              render: (r) => (
                <Link to={'/customer/reservations/' + r.reservation_id}>
                  {reservations.data?.find((x) => x.id === r.reservation_id)?.event_name ||
                    String(r.reservation_id).slice(0, 8)}
                </Link>
              ),
            },
            { key: 'created_at', label: 'Requested', render: (r) => date(String(r.created_at)) },
            {
              key:
                kind === 'refunds'
                  ? 'eligible_amount'
                  : kind === 'reschedule'
                    ? 'new_date'
                    : 'reason',
              label:
                kind === 'refunds'
                  ? 'Eligible refund'
                  : kind === 'reschedule'
                    ? 'Requested date'
                    : 'Reason',
              render: (r) =>
                kind === 'refunds'
                  ? money(Number(r.eligible_amount))
                  : kind === 'reschedule'
                    ? date(String(r.new_date))
                    : String(r.reason),
            },
            { key: 'status', label: 'Status', render: (r) => <Badge value={String(r.status)} /> },
          ]}
        />
      )}{' '}
      {selected && (
        <RequestModal
          kind={kind === 'reschedule' ? 'reschedule' : 'cancel'}
          reservation={selected}
          close={() => setSelected(null)}
        />
      )}
    </>
  )
}
export function Payments({ transactions = false }: { transactions?: boolean }) {
  const query = useQuery({
    queryKey: [transactions ? 'transactions' : 'payments'],
    queryFn: () => records<RecordRow>(transactions ? 'transactions' : 'payments'),
  })
  const reservations = useReservations()
  return (
    <>
      <PageHeading title={transactions ? 'Transaction history' : 'Payments & balances'}>
        {transactions
          ? 'A record of your server-confirmed payments and refunds.'
          : 'All amounts are in Philippine pesos. Manage a payment from its reservation.'}
      </PageHeading>
      {!transactions && (
        <section className="panel">
          <h2>Open balances</h2>
          {reservations.error ? (
            <ErrorState error={reservations.error} />
          ) : (
            reservations.data
              ?.filter(
                (r) =>
                  r.total > r.paid && ['approved', 'pending', 'for_approval'].includes(r.status),
              )
              .map((r) => (
                <div className="balance-row" key={r.id}>
                  <div>
                    <strong>{r.event_name}</strong>
                    <small>{date(r.event_date)}</small>
                  </div>
                  <strong>{money(r.total - r.paid)}</strong>
                  <Link className="button small secondary" to={'/customer/reservations/' + r.id}>
                    View & pay <ArrowRight size={14} />
                  </Link>
                </div>
              ))
          )}
          <p className="muted">
            Open a reservation to pay a down payment, pay in full, or settle its balance.
          </p>
        </section>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data}
          columns={[
            { key: 'created_at', label: 'Date', render: (r) => date(String(r.created_at)) },
            {
              key: 'reservation_id',
              label: 'Reservation',
              render: (r) => (
                <Link to={'/customer/reservations/' + r.reservation_id}>
                  {reservations.data?.find((x) => x.id === r.reservation_id)?.event_name ||
                    String(r.reservation_id).slice(0, 8)}
                </Link>
              ),
            },
            { key: 'amount', label: 'Amount', render: (r) => money(Number(r.amount)) },
            {
              key: transactions ? 'kind' : 'intent',
              label: 'Type',
              render: (r) => human(String(r[transactions ? 'kind' : 'intent'])),
            },
            {
              key: transactions ? 'reference' : 'status',
              label: transactions ? 'Reference' : 'Status',
              render: (r) =>
                transactions ? String(r.reference) : <Badge value={String(r.status)} />,
            },
          ]}
        />
      )}
    </>
  )
}
export function Feedback({ staff = false }: { staff?: boolean }) {
  const reservations = useReservations()
  const query = useQuery({ queryKey: ['feedback'], queryFn: () => records<RecordRow>('feedback') })
  const [open, setOpen] = useState(false)
  return (
    <>
      <PageHeading
        title={staff ? 'Customer feedback' : 'A few words from you.'}
        action={
          !staff && (
            <button className="button" onClick={() => setOpen(true)}>
              <Plus size={16} />
              Share feedback
            </button>
          )
        }
      >
        {staff
          ? 'Listen to the people behind every celebration.'
          : 'Tell us about your completed celebration. Your thoughts help us make the next one special.'}
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data}
          columns={[
            {
              key: 'rating',
              label: 'Rating',
              render: (r) => <span className="rating">{'★'.repeat(Number(r.rating))}</span>,
            },
            { key: 'message', label: 'Feedback' },
            {
              key: 'reservation_id',
              label: 'Reservation',
              render: (r) =>
                reservations.data?.find((x) => x.id === r.reservation_id)?.event_name ||
                String(r.reservation_id).slice(0, 8),
            },
            { key: 'created_at', label: 'Submitted', render: (r) => date(String(r.created_at)) },
          ]}
        />
      )}{' '}
      {open && (
        <Modal title="How was your celebration?" close={() => setOpen(false)}>
          <Form
            fields={[
              {
                name: 'rid',
                label: 'Completed reservation',
                required: true,
                options:
                  reservations.data
                    ?.filter((r) => r.status === 'completed')
                    .map((r) => ({ label: r.event_name, value: r.id })) || [],
              },
              {
                name: 'rating',
                label: 'Your rating',
                required: true,
                options: [1, 2, 3, 4, 5].map((n) => ({ label: n + ' stars', value: String(n) })),
              },
              {
                name: 'message',
                label: 'Your experience',
                type: 'textarea',
                required: true,
                max: 3000,
              },
            ]}
            label="Share feedback"
            submit={(v) =>
              rpc('submit_feedback', { rid: v.rid, rating: Number(v.rating), message: v.message })
            }
            onSuccess={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  )
}
