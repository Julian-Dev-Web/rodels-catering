import {BookingChanges,AdjustmentRefunds} from '../components/BookingChanges'
import { useState } from 'react'
import { Link, useParams,useLocation } from 'react-router-dom'
import {FeedbackNotice} from '../components/FeedbackNotice'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarDays,
  Plus,
  Users,
  Wallet,
} from 'lucide-react'
import { useReservations, useReservation, useSavedDrafts } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { useAuth } from '../features/auth'
import {
  Badge,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
} from '../components/ui'
import { Form } from '../components/Form'
import {
  BookingSelections,
  BookingActivity,
} from '../components/BookingDetails'
import { RefundRequest } from '../components/RefundRequest'
import { CustomerPaymentPanel, PaymentHistory, PaymentTotals } from '../components/PaymentPanel'
import { financialRows } from '../lib/financial'
import { downloadReportPdf, savedFinancialLabel } from '../lib/reports'
import { RescheduleForm } from '../components/RescheduleForm'
import { timeLabel } from '../components/EventTimeSelect'
import {
  date,
  earliestEventDate,
  human,
  money,
  todayManila,
} from '../lib/format'
import { records, rpc } from '../lib/supabase'
import { refundProcessing } from '../lib/refunds'
import type { RecordRow, Reservation } from '../types'
export function Reservations() {
  const query = useReservations()
  const drafts = useSavedDrafts()
  const { profile } = useAuth()
  if (query.isPending) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
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
        <Stat
          label="Your reservations"
          value={rows.length}
          icon={<CalendarDays />}
        />
        <Stat
          label="Upcoming celebrations"
          value={
            rows.filter(
              (r) => r.event_date >= todayManila() && r.status === 'approved',
            ).length
          }
          icon={<Users />}
        />
        <Stat
          label="Total paid"
          value={money(rows.reduce((s, r) => s + r.paid - r.refunded - (r.payment_reversed||0), 0))}
          icon={<Wallet />}
        />
      </div>
      <div className="section-title">
        <h2>My drafts</h2>
      </div>
      {drafts.error&&<ErrorState error={drafts.error}/>}
      <div className="reservation-grid">{drafts.data?.filter(d=>!d.submitted_at).map(d=><article className="reservation-card" key={d.id}><Badge value="draft"/><h3>{String(d.data.event_name||'Untitled event')}</h3><p>Saved incomplete · no date or equipment reserved</p><Link className="button secondary" to={`/customer/drafts/${d.id}/${['edit','menu','event-setup','confirm'][d.wizard_step]}`}>Continue editing</Link></article>)}</div>
      <div className="section-title">
        <h2>My reservations</h2>
        <Link className="text-button" to="/customer/available-dates">
          Explore available dates <ArrowRight size={15} />
        </Link>
      </div>
      {rows.length ? (
        <div className="reservation-grid">
          {rows.filter(r=>r.status!=='draft'||!drafts.data?.some(d=>!d.submitted_at&&d.reservation_id===r.id)).map((r) => (
            <article key={r.id} className="reservation-card">
              <div className="reservation-card-head">
                <span className="date-block">
                  <strong>{r.event_date.slice(8)}</strong>
                  <small>
                    {new Date(
                      r.event_date + 'T00:00:00+08:00',
                    ).toLocaleDateString('en-PH', {
                      month: 'short',
                      timeZone: 'Asia/Manila',
                    })}
                  </small>
                </span>
                <Badge value={r.status} />
              </div>
              <h3>{r.event_name}</h3>
              <small className="eyebrow">{r.reservation_reference||'Reference unavailable'}</small>
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
          Explore our packages, find your date, and start planning your first
          celebration.{' '}
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
  const location=useLocation(),[notice,setNotice]=useState<string>(location.state?.notice||'')
  const { id } = useParams(),
    query = useReservation(id),
    catalog = useCatalog({ includeArchived: true })
  const [modal, setModal] = useState<'cancel' | 'reschedule' | null>(null)
  const [statementError,setStatementError]=useState<unknown>(null),[statementBusy,setStatementBusy]=useState(false)
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  const { reservation: r, children: c } = query.data
  const editable =
    ['draft', 'pending', 'for_approval'].includes(r.status) && r.paid === 0
  return (
    <>
      <PageHeading
        title={r.event_name}
        eyebrow={r.reservation_reference || 'RESERVATION'}
        action={
          <Link className="button secondary" to="/customer/reservations">
            All reservations
          </Link>
        }
      >
        {date(r.event_date)} · {timeLabel(r.event_time)} Manila · {r.guests}{' '}
        guests
      </PageHeading>
      {notice&&<FeedbackNotice text={notice} close={()=>setNotice('')}/>}
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
              {catalog.data?.menu_sets.find((p) => p.id === r.menu_set_id)
                ?.name || 'Selected package unavailable'}
            </dd>
            <dt>Location</dt>
            <dd>
              {['street', 'barangay', 'city', 'province']
                .map((k) => r.address[k])
                .filter(Boolean)
                .join(', ')}
            </dd>
            <dt>Menu</dt>
            <dd>
              {catalog.data?.dishes
                .filter((d) =>
                  c.reservation_items.some((x) => x.dish_id === d.id),
                )
                .map((d) => d.name)
                .join(', ') || 'Not selected'}
            </dd>
            <dt>Drink & dessert</dt>
            <dd>
              {catalog.data?.drinks.find((d) => d.id === r.drink_id)?.name} ·{' '}
              {catalog.data?.desserts.find((d) => d.id === r.dessert_id)?.name}
            </dd>
            <dt>Notes</dt>
            <dd>{r.address.notes || '—'}</dd>
          </dl>
          {catalog.data && (
            <BookingSelections
              reservation={r}
              children={c}
              catalog={catalog.data}
            />
          )}
          <h3>Recorded activity</h3>
          <button className="button secondary" disabled={statementBusy} onClick={async()=>{setStatementBusy(true);setStatementError(null);try{await downloadReportPdf({title:'Booking and payment record',filters:'System-generated record; not an official BIR tax invoice',generated:date(new Date().toISOString())+' Manila',summary:[r.reservation_reference||'Reservation',r.event_name,date(r.event_date)+' '+timeLabel(r.event_time)+' Asia/Manila',['street','barangay','city','province'].map(key=>r.address[key]).filter(Boolean).join(', ')],headers:['Description','Saved amount / information'],rows:financialRows(r.financial_snapshot,r.total,r.paid-r.refunded-(r.payment_reversed||0),['cancelled','rejected','pending_refund','refund_approved','refunded'].includes(r.status)?0:undefined).map(([label,value])=>[label,typeof value==='number'?money(value):value]),filename:'RodelConnect-booking-'+(r.reservation_reference||'record')})}catch(error){setStatementError(error)}finally{setStatementBusy(false)}}}>{statementBusy?'Preparing record…':'Download booking / payment record'}</button>
          {!!statementError&&<ErrorState error={statementError}/>}
          <BookingActivity id={r.id} /><BookingChanges reservation={r}/><AdjustmentRefunds reservation={r}/>
          <div className="actions">
            {editable && (
              <Link
                className="button secondary"
                to={`/customer/reservations/${r.id}/edit`}
              >
                Edit reservation
              </Link>
            )}
            {r.status === 'draft' && (
              <Link
                className="button"
                to={`/customer/reservations/${r.id}/edit`}
              >
                Continue editing draft
              </Link>
            )}
            {['draft', 'pending', 'for_approval', 'approved'].includes(
              r.status,
            ) && (
              <button
                className="text-button"
                onClick={() => setModal('cancel')}
              >
                Request cancellation
              </button>
            )}
            {r.status === 'approved' && (
              <button
                className="text-button"
                onClick={() => setModal('reschedule')}
              >
                Request reschedule
              </button>
            )}
          </div>
          {r.paid > 0 &&
            [
              'cancelled',
              'pending_refund',
              'refund_approved',
              'refunded',
            ].includes(r.status) && <RefundRequest reservation={r} />}
          <CustomerPaymentPanel reservation={r}/>
          <PaymentHistory reservation={r}/>
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
          <PaymentTotals id={r.id}/>
        </aside>
      </div>
      {modal && (
        <RequestModal
          kind={modal}
          reservation={r}
          close={() => setModal(null)}
        />
      )}
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
    <Modal
      title={kind === 'cancel' ? 'Request cancellation' : 'Request a new date'}
      close={close}
    >
      {kind === 'reschedule' ? (
        <RescheduleForm reservation={reservation} close={close} />
      ) : (
        <>
          <p>
            Requests must be made more than 72 hours before your event date
            begins.
          </p>
          <Form
            fields={[
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
              rpc('request_cancellation', {
                rid: reservation.id,
                reason: v.reason,
              })
            }
            onSuccess={close}
          />
        </>
      )}
    </Modal>
  )
}
export function AvailableDates() {
  const [month, setMonth] = useState(todayManila().slice(0, 7))
  const end = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate()
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
        Up to three approved events per date. Availability is confirmed when
        your reservation is approved. Please reserve at least 3 days ahead for
        preparation. The earliest date is {date(earliestEventDate())} (Manila).
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
                  className={
                    'calendar-day ' +
                    (d.event_date < earliestEventDate()
                      ? 'blocked'
                      : d.remaining === 0
                        ? 'full'
                        : '')
                  }
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
                          : 'Unavailable'}
                  </span>
                  {d.remaining > 0 && d.event_date >= earliestEventDate() && (
                    <Link
                      to={'/customer/reservations/new?date=' + d.event_date}
                    >
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
export function CustomerWorkflow({
  kind,
}: {
  kind: 'cancellations' | 'refunds' | 'reschedule'
}) {
  const reservations = useReservations()
  const [selected, setSelected] = useState<Reservation | null>(null)
  const table = kind === 'reschedule' ? 'reschedule_requests' : kind
  const query = useQuery({
    queryKey: [table],
    queryFn: () => records<RecordRow>(table),
  })
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
                    : ['draft', 'pending', 'for_approval', 'approved'].includes(
                        r.status,
                      ),
              )
              .map((r) => (
                <div key={r.id}>
                  <span>
                    <strong>{r.event_name}</strong>
                    <small>{date(r.event_date)}</small>
                  </span>
                  {kind === 'refunds' ? (
                    <RefundRequest reservation={r} />
                  ) : (
                    <button
                      className="button small secondary"
                      onClick={() => setSelected(r)}
                    >
                      Send request <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            <p className="muted">
              Only eligible reservations appear here.{' '}
              <Link to="/customer/support">Contact support</Link> if you need
              help.
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
                  {reservations.data?.find((x) => x.id === r.reservation_id)
                    ?.reservation_reference || 'Reference unavailable'}
                </Link>
              ),
            },
            {
              key: 'created_at',
              label: 'Requested',
              render: (r) => date(String(r.created_at)),
            },
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
            ...(kind === 'refunds'
              ? [
                  {
                    key: 'gross_amount',
                    label: 'Unrefunded paid',
                    render: (r: RecordRow) =>
                      r.gross_amount === null
                        ? 'Historical policy'
                        : money(Number(r.gross_amount)),
                  },
                  {
                    key: 'fee_amount',
                    label: 'Policy fee',
                    render: (r: RecordRow) =>
                      r.fee_amount === null
                        ? 'Historical policy'
                        : money(Number(r.fee_amount)),
                  },
                ]
              : []),
            ...(kind === 'refunds'
              ? [
                  {
                    key: 'processing',
                    label: 'Provider processing',
                    render: (r: RecordRow) => refundProcessing(r),
                  },
                ]
              : []),
            {
              key: 'status',
              label: 'Status',
              render: (r) => <Badge value={String(r.status)} />,
            },
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
    queryFn: () =>
      records<RecordRow>(transactions ? 'transactions' : 'payments'),
  })
  const reservations = useReservations()
  return (
    <>
      <PageHeading
        title={transactions ? 'Transaction history' : 'Payments & balances'}
      >
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
                  r.total > r.paid-r.refunded-(r.payment_reversed||0) &&
                  ['approved', 'pending', 'for_approval'].includes(r.status),
              )
              .map((r) => (
                <div className="balance-row" key={r.id}>
                  <div>
                    <strong>{r.event_name}</strong>
                    <small>{date(r.event_date)}</small>
                  </div>
                  <strong>{money(Math.max(r.total-r.paid+r.refunded+(r.payment_reversed||0),0))}</strong>
                  <Link
                    className="button small secondary"
                    to={'/customer/reservations/' + r.id}
                  >
                    View & pay <ArrowRight size={14} />
                  </Link>
                </div>
              ))
          )}
          <p className="muted">
            Open a reservation to pay a down payment, pay in full, or settle its
            balance.
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
            {
              key: 'created_at',
              label: 'Date',
              render: (r) => date(String(r.created_at)),
            },
            {
              key: 'reservation_id',
              label: 'Reservation',
              render: (r) => (
                <Link to={'/customer/reservations/' + r.reservation_id}>
                  {reservations.data?.find((x) => x.id === r.reservation_id)
                    ?.reservation_reference || 'Reference unavailable'}
                </Link>
              ),
            },
            {
              key: 'amount',
              label: 'Amount',
              render: (r) => money(Number(r.amount)),
            },
            {key:'tax',label:'Saved VAT / discount',render:row=>savedFinancialLabel(reservations.data?.find(r=>r.id===row.reservation_id)?.financial_snapshot)},
            {
              key: transactions ? 'kind' : 'intent',
              label: 'Type',
              render: (r) => human(String(r[transactions ? 'kind' : 'intent'])),
            },
            {
              key: transactions ? 'reference' : 'status',
              label: transactions ? 'Ledger reference' : 'Status',
              render: (r) =>
                transactions ? (
                  String(r.record_reference||'Reference unavailable')
                ) : (
                  <Badge value={String(r.status)} />
                ),
            },
          ]}
        />
      )}
    </>
  )
}
export function Feedback({ staff = false }: { staff?: boolean }) {
  const reservations = useReservations()
  const query = useQuery({
    queryKey: ['feedback'],
    queryFn: () => records<RecordRow>('feedback'),
  })
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
              render: (r) => (
                <span className="rating">{'★'.repeat(Number(r.rating))}</span>
              ),
            },
            { key: 'message', label: 'Feedback' },
            {
              key: 'reservation_id',
              label: 'Reservation',
              render: (r) =>
                reservations.data?.find((x) => x.id === r.reservation_id)
                  ?.reservation_reference || 'Reference unavailable',
            },
            {
              key: 'created_at',
              label: 'Submitted',
              render: (r) => date(String(r.created_at)),
            },
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
                options: [1, 2, 3, 4, 5].map((n) => ({
                  label: n + ' stars',
                  value: String(n),
                })),
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
              rpc('submit_feedback', {
                rid: v.rid,
                rating: Number(v.rating),
                message: v.message,
              })
            }
            onSuccess={() => setOpen(false)}
          />
        </Modal>
      )}
    </>
  )
}
