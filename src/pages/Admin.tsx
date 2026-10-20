import { useEffect,useState } from 'react'
import {CancellationPayout} from '../components/CancellationPayout'
import { Link,useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarDays,
  Download,
  Plus,
  Users,
  Wallet,
  Hourglass,
} from 'lucide-react'
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
import type { Field } from '../components/Form'
import { FoodPhoto } from '../components/FoodPhoto'
import { CatalogPhotoEditor } from '../components/CatalogPhotoEditor'
import { DishAllergenEditor } from '../components/AllergyFields'
import { recipeStatus } from '../lib/allergy'
import { isFoodKind } from '../lib/menu-photos'
import type { CatalogItem } from '../types'
import { Stat } from './Customer'
import { StaffBookingDetails } from '../components/BookingDetails'
import { OperationalSummary } from './ManagerOperations'
import { useAuth } from '../features/auth'
import { useReservations } from '../features/reservations'
import {
  date,
  dayManila,
  exportCsv,
  human,
  money,
  todayManila,
} from '../lib/format'
import { edge, records, rpc, supabase } from '../lib/supabase'
import type { CatalogTable, Metrics, RecordRow } from '../types'
import { refundProcessing } from '../lib/refunds'
import { RejectionAction } from '../components/DecisionAction'
import { timeLabel } from '../components/EventTimeSelect'
export function Dashboard() {
  const query = useQuery({
    queryKey: ['metrics'],
    queryFn: () => rpc<Metrics>('dashboard_metrics'),
    refetchInterval: 60000,
  })
  const reservations = useReservations()
  const { profile } = useAuth()
  if (query.isPending) return <Loading />
  if (query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const m = query.data
  return (
    <>
      <PageHeading
        title="Every celebration, in view."
        eyebrow={
          profile?.role === 'super_admin'
            ? 'THE BIGGER PICTURE'
            : 'THE DAY AT A GLANCE'
        }
        action={
          <span className="today-label">
            <CalendarDays size={16} />
            {date(todayManila())}
          </span>
        }
      >
        A thoughtful overview of your catering business.
      </PageHeading>
      <OperationalSummary />
      <div className="stat-grid four">
        <Stat
          label="Today’s verified receipts"
          value={money(m.today_revenue)}
          icon={<Wallet />}
        />
        <Stat
          label="New bookings today"
          value={m.today_bookings}
          icon={<CalendarDays />}
        />
        <Stat label="Total customers" value={m.customers} icon={<Users />} />
        <Stat label="Awaiting review" value={m.pending} icon={<Hourglass />} />
      </div>
      <div className="chart-grid">
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">CELEBRATIONS OVER TIME</span>
              <h2>Monthly approved bookings</h2>
            </div>
            <span className="badge">Last 12 months</span>
          </div>
          {m.monthly.length ? (
            <div
              className="chart"
              role="img"
              aria-label="Monthly approved booking counts"
            >
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={m.monthly}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#bca06b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#bca06b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(v) => String(v).slice(0, 7)}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="bookings"
                    stroke="#8a693c"
                    fill="url(#areaFill)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="The next chapter is ahead">
              Approved bookings will appear in your analytics.
            </Empty>
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">GUEST FAVORITES</span>
          <h2>Most-loved packages</h2>
          {m.top_packages.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={m.top_packages} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="bookings" fill="#681f32" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty title="Favorites in the making" />
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>This month, compared</h2>
          <span className="muted">Current / previous month</span>
        </div>
        <div className="comparison-grid">
          <div>
            <small>Approved event bookings</small>
            <strong>
              {m.current_month_bookings}{' '}
              <span>/ {m.previous_month_bookings}</span>
            </strong>
          </div>
          <div>
            <small>Customers with approved events</small>
            <strong>
              {m.current_month_users} <span>/ {m.previous_month_users}</span>
            </strong>
          </div>
          <div>
            <small>Verified gross receipts</small>
            <strong>
              {money(m.current_month_revenue)}{' '}
              <span>/ {money(m.previous_month_revenue)}</span>
            </strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <h2>Weekly approved bookings</h2>
        {m.weekly.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={m.weekly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="bookings" fill="#bca06b" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="muted">No approved events in the last twelve weeks.</p>
        )}
      </section>
      <div className="section-title">
        <h2>Recent reservations</h2>
        <Link className="text-button" to="/manager/reservations">
          View all reservations →
        </Link>
      </div>
      {reservations.error ? (
        <ErrorState error={reservations.error} />
      ) : (
        reservations.data && (
          <DataTable
            rows={reservations.data.slice(0, 10) as unknown as RecordRow[]}
            columns={reservationColumns}
          />
        )
      )}
    </>
  )
}
const reservationColumns = [
  { key: 'reservation_reference', label: 'Reference' },
  { key: 'event_name', label: 'Event' },
  { key: 'customer_name', label: 'Customer' },
  {
    key: 'event_date',
    label: 'Event date',
    render: (r: RecordRow) => date(String(r.event_date)),
  },
  { key: 'guests', label: 'Guests' },
  {
    key: 'total',
    label: 'Total',
    render: (r: RecordRow) => money(Number(r.total)),
  },
  {
    key: 'status',
    label: 'Status',
    render: (r: RecordRow) => <Badge value={String(r.status)} />,
  },
]
export function ManageReservations() {
  const [params,setParams]=useSearchParams()
  const query = useReservations()
  const [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<RecordRow | null>(null)
  useEffect(()=>{const id=params.get('reservation');const row=query.data?.find(r=>r.id===id);if(row)setSelected({...row})},[params,query.data])
  return (
    <>
      <PageHeading title="Make every celebration count.">
        Review reservations, confirm dates, and keep the team in sync.
      </PageHeading>
      <div className="filter-bar">
        <label>
          Reservation status{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {[
              'all',
              'draft',
              'for_approval',
              'approved',
              'pending_cancellation',
              'cancelled',
              'completed',
              'rejected',
              'pending_refund',
              'refund_approved',
              'refunded',
            ].map((s) => (
              <option value={s} key={s}>
                {human(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={
            query.data.filter(
              (r) => status === 'all' || r.status === status,
            ) as unknown as RecordRow[]
          }
          columns={[
            ...reservationColumns,
            {
              key: 'payment_status',
              label: 'Payment',
              render: (r) => <Badge value={String(r.payment_status)} />,
            },
          ]}
          actions={(r) => (
            <>
              <button className="text-button" onClick={() => setSelected(r)}>
                Details
              </button>
              {['pending', 'for_approval'].includes(String(r.status)) && (
                <>
                  <Action
                    label="Approve"
                    kind="small secondary"
                    confirm="Confirm this event date? The database will enforce date capacity and prevent conflicting reservations."
                    run={() =>
                      rpc('manager_reservation_status', {
                        rid: r.id,
                        new_status: 'approved',
                      })
                    }
                  />
                  {Number(r.paid)-Number(r.refunded)-Number(r.payment_reversed||0) === 0 && (
                    <RejectionAction
                      run={(decision_reason) =>
                        rpc('manager_reservation_status', {
                          rid: r.id,
                          new_status: 'rejected',
                          decision_reason,
                        })
                      }
                    />
                  )}
                </>
              )}
              {r.status === 'approved' &&
                String(r.event_date) <= todayManila() &&
                Number(r.paid)-Number(r.refunded)-Number(r.payment_reversed||0) >= Number(r.total) && (
                  <Action
                    label="Complete"
                    kind="small secondary"
                    confirm="Mark the catered event complete? The customer will be able to leave feedback."
                    run={() =>
                      rpc('manager_reservation_status', {
                        rid: r.id,
                        new_status: 'completed',
                      })
                    }
                  />
                )}
            </>
          )}
        />
      )}{' '}
      {selected && (
        <Modal
          title={String(selected.event_name)}
          close={() => {setSelected(null);setParams({}, {replace:true})}}
        >
          <StaffBookingDetails id={selected.id} />
        </Modal>
      )}
    </>
  )
}
export function ReviewRequests({
  kind,
}: {
  kind: 'cancellations' | 'refunds' | 'reschedule'
}) {
  const table = kind === 'reschedule' ? 'reschedule_requests' : kind
  const query = useQuery({
    queryKey: [table],
    queryFn: () => records<RecordRow>(table),
  })
  const reservations = useReservations()
  const review = (
    row: RecordRow,
    approve: boolean,
    decision_reason: string | null = null,
  ) =>
    rpc(
      kind === 'cancellations'
        ? 'review_cancellation'
        : kind === 'refunds'
          ? 'review_refund'
          : 'review_reschedule',
      {
        [kind === 'cancellations'
          ? 'cid'
          : kind === 'refunds'
            ? 'fid'
            : 'request_id']: row.id,
        approve,
        decision_reason,
      },
    )
  return (
    <>
      <PageHeading title={human(kind) + ' review'}>
        {kind === 'refunds'
          ? 'Approve the frozen policy amount, then process it securely through PayMongo.'
          : 'Review each request with care. Every decision is recorded and the customer is notified.'}
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data.map(r=>({...r,reservation_reference:reservations.data?.find(x=>x.id===r.reservation_id)?.reservation_reference||'Reference unavailable'}))}
          columns={[
            {
              key: 'reservation_id',
              label: 'Event',
              render: (r) =>
                reservations.data?.find((x) => x.id === r.reservation_id)
                  ?.reservation_reference || 'Reference unavailable',
            },
            {
              key: 'created_at',
              label: 'Requested',
              render: (r) => date(String(r.created_at)),
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
                  {
                    key: 'eligible_amount',
                    label: 'Eligible amount',
                    render: (r: RecordRow) => money(Number(r.eligible_amount)),
                  },
                ]
              : [{ key: 'reason', label: 'Reason' }]),
            ...(kind === 'reschedule'
              ? [
                  {
                    key: 'new_date',
                    label: 'Requested date',
                    render: (r: RecordRow) => date(String(r.new_date)),
                  },
                  {key:'new_time',label:'Requested time (Manila)',render:(r:RecordRow)=>r.new_time?timeLabel(String(r.new_time)):'Not separately recorded'},
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
          actions={(r) => (
            <>
              {r.status === 'pending' && (
                <>
                  <Action
                    label="Approve"
                    kind="small secondary"
                    confirm={`Approve this ${kind === 'reschedule' ? 'reschedule' : 'request'}? This decision will be audited and the customer notified.`}
                    run={() => review(r, true)}
                  />
                  <RejectionAction run={(reason) => review(r, false, reason)} />
                </>
              )}
              {kind === 'refunds' && r.status === 'approved' && (
                <>
                <Action
                  label={
                    r.processing ? 'Check provider status' : 'Process refund'
                  }
                  kind="small secondary"
                  confirm="Continue the approved refund with PayMongo? This uses the stored eligible amount and original payment references."
                  run={() => edge('process-refund', { refund_id: r.id })}
                />
                {!r.processing&&<CancellationPayout id={r.id} amount={Number(r.eligible_amount)}/>}
                </>
              )}
            </>
          )}
        />
      )}
    </>
  )
}
export function ManagePayments() {
  const query = useQuery({
    queryKey: ['payment-report'],
    queryFn: () => records<RecordRow>('transactions'),
  })
  const attempts = useQuery({
    queryKey: ['payment-attempts'],
    queryFn: () => records<RecordRow>('payments'),
  })
  const [start, setStart] = useState(''),
    [end, setEnd] = useState('')
  const filtered =
    query.data?.filter(
      (r) =>
        (!start || dayManila(String(r.created_at)) >= start) &&
        (!end || dayManila(String(r.created_at)) <= end),
    ) || []
  return (
    <>
      <PageHeading
        title="Payments, with a clear paper trail."
        action={
          <button
            className="button secondary"
            disabled={!query.data}
            onClick={() => exportCsv('rodels-payment-report.csv', filtered)}
          >
            <Download size={16} />
            Export CSV
          </button>
        }
      >
        Provider-confirmed receipts and refunds. Payment confirmation is handled
        by the server.
      </PageHeading>
      <div className="filter-bar">
        <label>
          From
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <strong>
          Net receipts:{' '}
          {money(
            filtered.reduce(
              (sum, r) =>
                sum + (r.kind === 'refund' ? -1 : 1) * Number(r.amount),
              0,
            ),
          )}
        </strong>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={filtered}
          columns={[
            {
              key: 'created_at',
              label: 'Date',
              render: (r) => date(String(r.created_at)),
            },
            { key: 'reservation_id', label: 'Reservation' },
            { key: 'kind', label: 'Type' },
            {
              key: 'amount',
              label: 'Amount',
              render: (r) => money(Number(r.amount)),
            },
            { key: 'reference', label: 'Provider reference' },
          ]}
        />
      )}
      <div className="section-title">
        <h2>Checkout attempts</h2>
      </div>
      {attempts.error ? (
        <ErrorState error={attempts.error} />
      ) : (
        attempts.data && (
          <DataTable
            rows={attempts.data}
            columns={[
              {
                key: 'created_at',
                label: 'Created',
                render: (r) => date(String(r.created_at)),
              },
              { key: 'reservation_id', label: 'Reservation' },
              {
                key: 'amount',
                label: 'Amount',
                render: (r) => money(Number(r.amount)),
              },
              { key: 'intent', label: 'Intent' },
              {
                key: 'status',
                label: 'State',
                render: (r) => <Badge value={String(r.status)} />,
              },
            ]}
          />
        )
      )}
    </>
  )
}
export function CatalogManager({
  area,
}: {
  area: 'menu' | 'packages' | 'extras' | 'food-photos'
}) {
  const tabs: CatalogTable[] =
    area === 'food-photos' ? ['dishes', 'drinks', 'desserts'] : area === 'menu'
      ? ['dishes', 'menu_categories', 'drinks', 'desserts']
      : area === 'packages'
        ? ['menu_sets', 'event_setups', 'chair_types', 'table_types']
        : ['add_ons', 'event_features']
  const [table, setTable] = useState<CatalogTable>(tabs[0]),
    [editing, setEditing] = useState<RecordRow | null | undefined>(undefined),
    [photoEditing, setPhotoEditing] = useState<RecordRow | null>(null)
  const [allergenEditing,setAllergenEditing]=useState<RecordRow|null>(null)
  const [recipeFilter,setRecipeFilter]=useState('all'),[recipeFeedback,setRecipeFeedback]=useState('')
  useEffect(()=>{const saved=(event:Event)=>setRecipeFeedback('Ingredients and allergens saved for '+String((event as CustomEvent).detail)+'.');window.addEventListener('recipe-saved',saved);return()=>window.removeEventListener('recipe-saved',saved)},[])
  const recipeQueue=useQuery({queryKey:['recipe-review-queue'],enabled:table==='dishes'&&area==='menu',queryFn:()=>rpc<RecordRow[]>('recipe_review_queue')})
  const query = useQuery({
    queryKey: ['manage-catalog', table],
    queryFn: () => records<RecordRow>(table, 'name', true),
  })
  const categories = useQuery({
    queryKey: ['categories'],
    enabled: area === 'menu',
    queryFn: () => records<RecordRow>('menu_categories', 'name', true),
  })
  const priced = !['dishes', 'menu_categories', 'drinks', 'desserts'].includes(
    table,
  )
  const legacyMenu = table === 'menu_sets' && editing?.pricing_version === 1
  const setups = useQuery({
    queryKey: ['catalog-setup-options'],
    enabled: table === 'event_features',
    queryFn: () =>
      records<RecordRow>('event_setups', 'name', true, { active: true }),
  })
  const fields: Field[] = [
    { name: 'name', label: 'Name', required: true, max: 150 },
    ...(table === 'menu_sets' || table === 'dishes' || table === 'event_setups'
      ? [
          {
            name: 'description',
            label: 'Description',
            type: 'textarea',
            max: 2000,
          },
        ]
      : []),
    ...(priced
      ? [
          {
            name: 'price',
            label:
              table === 'menu_sets'
                ? 'Menu price per guest (PHP)'
                : table === 'chair_types'
                  ? 'Upgrade per selected guest chair (PHP; 0 = included)'
                  : table === 'table_types'
                    ? 'Additional charge per table (PHP; 0 = included)'
                    : 'Additional event fee (PHP)',
            type: 'number',
            required: true,
            min: 0,
          },
        ]
      : []),
    ...(table === 'menu_sets'
      ? [
          {
            name: 'dish_count',
            label: 'Required dish count',
            type: 'number',
            required: true,
            min: legacyMenu ? 1 : 3,
            max: legacyMenu ? 20 : 6,
          },
          {
            name: 'min_guests',
            label: 'Minimum guests',
            type: 'number',
            required: true,
            min: legacyMenu ? 1 : 100,
            max: legacyMenu ? 10000 : 1000,
          },
          {
            name: 'max_guests',
            label: 'Maximum guests',
            type: 'number',
            required: !legacyMenu,
            min: 100,
            max: 1000,
          },
          {
            name: 'inclusions',
            label: 'Included items (one per line)',
            type: 'textarea',
            max: 2000,
          },
        ]
      : []),
    ...(table === 'dishes'
      ? [
          {
            name: 'category_id',
            label: 'Category',
            options:
              categories.data?.map((c) => ({
                label: String(c.name),
                value: c.id,
              })) || [],
          },
        ]
      : []),
    ...(table === 'event_features'
      ? [
          {
            name: 'required_setup_id',
            label: 'Required event setup (optional)',
            options:
              setups.data?.map((setup) => ({
                label: String(setup.name),
                value: setup.id,
              })) || [],
          },
        ]
      : []),
  ]
  return (
    <>
      <PageHeading
        title={
          area === 'food-photos' ? 'Menu photography.' : area === 'menu'
            ? 'Flavors for every table.'
            : area === 'packages'
              ? 'Give every occasion a starting point.'
              : 'The little extras that make it yours.'
        }
        action={area === 'food-photos' ? undefined :
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Add {human(table).replace(/s$/, '').toLowerCase()}
          </button>
        }
      >
        {area === 'food-photos' ? 'Replace representative menu photos with your own serving photos. Food images are separate from the event gallery.' : 'Maintain your live catalog. Archive items to keep historical reservations intact.'}
      </PageHeading>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            className={t === table ? 'active' : ''}
            key={t}
            onClick={() => setTable(t)}
          >
            {human(t)}
          </button>
        ))}
      </div>
      {table==='dishes'&&area==='menu'&&<><p>Confirm actual recipes before marking Verified. Missing lists never mean allergen-free. Review priority uses booking frequency; historical booking allergy data stays private.</p><label>Ingredient review queue<select aria-label="Ingredient review queue" value={recipeFilter} onChange={e=>setRecipeFilter(e.target.value)}><option value="all">All dishes</option><option value="needs_review">Needs review / missing ingredients</option><option value="verified">Verified recipes</option></select></label>{recipeFeedback&&<p className="feedback-notice" role="status">{recipeFeedback}</p>}{recipeQueue.error&&<ErrorState error={recipeQueue.error}/>}</>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={table==='dishes'&&area==='menu'?query.data.map(r=>({...r,...recipeQueue.data?.find(x=>x.id===r.id)})).filter(r=>recipeFilter==='all'||(recipeFilter==='verified'?r.ingredient_review_state==='verified':r.ingredient_review_state!=='verified')).sort((a,b)=>Number(b.booking_count||0)-Number(a.booking_count||0)||String(a.name).localeCompare(String(b.name))):query.data}
          columns={[
            ...(isFoodKind(table) ? [{ key:'image_url',label:'Photo',render:(row:RecordRow)=><div className="food-table-photo"><FoodPhoto item={{name:String(row.name),image_url:row.image_url?String(row.image_url):undefined}} kind={table as 'dishes'|'drinks'|'desserts'}/></div> }] : []),
            { key: 'name', label: 'Name' },
            ...(table==='dishes'&&area==='menu'?[{key:'ingredient_review_state',label:'Ingredients',render:(r:RecordRow)=><span className={'badge '+(r.ingredient_review_state==='verified'?'status-active':'status-pending')}>{recipeStatus(r.ingredient_review_state,Number(r.ingredient_count??0))}</span>},{key:'booking_count',label:'Booking selections'}]:[]),
            ...(priced
              ? [
                  {
                    key: 'price',
                    label: 'Price',
                    render: (r: RecordRow) => money(Number(r.price)),
                  },
                ]
              : []),
            ...(table === 'menu_sets'
              ? [
                  { key: 'dish_count', label: 'Dish count' },
                  { key: 'min_guests', label: 'Minimum guests' },
                  { key: 'max_guests', label: 'Maximum guests' },
                ]
              : []),
            {
              key: 'active',
              label: 'Availability',
              render: (r) => <Badge value={r.active ? 'active' : 'archived'} />,
            },
          ]}
          actions={(r) => (
            <>
              {area !== 'food-photos' && <button className="text-button" onClick={() => setEditing(r)}>
                Edit
              </button>}
              {isFoodKind(table)&&<button className="text-button" onClick={()=>setPhotoEditing(r)}>Photo</button>}
              {table==='dishes'&&area==='menu'&&<button className="text-button" onClick={()=>setAllergenEditing(r)}>Edit Ingredients & Allergens</button>}
              {area !== 'food-photos' && <Action
                kind="small secondary"
                label={r.active ? 'Archive' : 'Activate'}
                confirm={
                  r.active
                    ? 'Hide this item from new bookings? Existing reservations and financial history are preserved.'
                    : 'Make this item available for new bookings?'
                }
                run={async () => {
                  const { error } = await supabase
                    .from(table)
                    .update({ active: !r.active })
                    .eq('id', r.id)
                  if (error) throw error
                }}
              />}
            </>
          )}
        />
      )}{' '}
      {photoEditing&&isFoodKind(table)&&<Modal title={'Photo for '+String(photoEditing.name)} close={()=>setPhotoEditing(null)}><CatalogPhotoEditor table={table} item={photoEditing as unknown as CatalogItem} close={()=>setPhotoEditing(null)}/></Modal>}
      {allergenEditing&&<Modal title={'Ingredients & Allergens — '+String(allergenEditing.name)} close={()=>setAllergenEditing(null)}><DishAllergenEditor dish={allergenEditing as unknown as CatalogItem} close={()=>setAllergenEditing(null)}/></Modal>}
      {editing !== undefined && (
        <Modal
          title={(editing ? 'Edit ' : 'Add ') + human(table).replace(/s$/, '')}
          close={() => setEditing(undefined)}
        >
          <Form
            key={table + (editing?.id || 'new')}
            fields={fields}
            initial={
              editing
                ? Object.fromEntries(
                    fields.map((f) => [
                      f.name,
                      f.name === 'price'
                        ? Number(editing.price) / 100
                        : f.name === 'inclusions' &&
                            Array.isArray(editing.inclusions)
                          ? editing.inclusions.join('\n')
                          : String(editing[f.name] ?? ''),
                    ]),
                  )
                : table === 'menu_sets'
                  ? { min_guests: 100, max_guests: 1000, dish_count: 3 }
                  : {}
            }
            label="Save item"
            submit={async (v) => {
              const payload: Record<string, unknown> = { ...v }
              if (priced) {
                const number = Number(v.price)
                if (!Number.isFinite(number) || number < 0)
                  throw new Error('Enter a valid price')
                payload.price = Math.round(number * 100)
              }
              if (table === 'menu_sets') {
                payload.dish_count = Number(v.dish_count)
                payload.min_guests = Number(v.min_guests)
                payload.max_guests = v.max_guests ? Number(v.max_guests) : null
                payload.inclusions = v.inclusions
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
                if (
                  !legacyMenu &&
                  (!Number.isInteger(payload.dish_count) ||
                    Number(payload.dish_count) < 3 ||
                    Number(payload.dish_count) > 6 ||
                    !Number.isInteger(payload.min_guests) ||
                    Number(payload.min_guests) < 100 ||
                    !Number.isInteger(payload.max_guests) ||
                    Number(payload.max_guests) > 1000 ||
                    Number(payload.max_guests) < Number(payload.min_guests))
                )
                  throw new Error(
                    'Menus require 3–6 dishes and a guest range within 100–1,000.',
                  )
              }
              if (table === 'event_features')
                payload.required_setup_id = v.required_setup_id || null
              if (table === 'dishes' && !v.category_id)
                payload.category_id = null
              const { error } = editing
                ? await supabase
                    .from(table)
                    .update(payload)
                    .eq('id', editing.id)
                : await supabase.from(table).insert(payload)
              if (error) throw error
            }}
            onSuccess={() => setEditing(undefined)}
          />
        </Modal>
      )}
    </>
  )
}
export { UserManagement } from './UserAdministration'
export { GalleryManagement } from './GalleryManagement'
export { Maintenance } from './AdministrationControls'
export function AuditLogs() {
  const query = useQuery({
    queryKey: ['audit'],
    queryFn: () => records<RecordRow>('audit_logs'),
  })
  return (
    <>
      <PageHeading title="Every important action, accounted for.">
        Append-only records, attributed to authenticated users or verified
        server processing.
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
              key: 'created_at',
              label: 'Time',
              render: (r) =>
                new Date(String(r.created_at)).toLocaleString('en-PH', {
                  timeZone: 'Asia/Manila',
                }),
            },
            { key: 'action', label: 'Action' },
            {
              key: 'actor_id',
              label: 'Actor',
              render: (r) =>
                r.actor_id ? String(r.actor_id) : 'Server / operator',
            },
            { key: 'entity_id', label: 'Entity' },
            {
              key: 'details',
              label: 'Details',
              render: (r) => <code>{JSON.stringify(r.details)}</code>,
            },
          ]}
        />
      )}
    </>
  )
}
