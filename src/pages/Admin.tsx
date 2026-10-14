import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { CalendarDays, Download, Plus, Users, Wallet, Hourglass } from 'lucide-react'
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
import { Stat } from './Customer'
import { useAuth } from '../features/auth'
import { useReservations } from '../features/reservations'
import { date, dayManila, exportCsv, human, money, todayManila } from '../lib/format'
import { edge, records, rpc, supabase } from '../lib/supabase'
import type { CatalogTable, Metrics, Profile, RecordRow } from '../types'
export function Dashboard() {
  const query = useQuery({
    queryKey: ['metrics'],
    queryFn: () => rpc<Metrics>('dashboard_metrics'),
    refetchInterval: 60000,
  })
  const reservations = useReservations()
  const { profile } = useAuth()
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />
  const m = query.data
  return (
    <>
      <PageHeading
        title="Every celebration, in view."
        eyebrow={profile?.role === 'super_admin' ? 'THE BIGGER PICTURE' : 'THE DAY AT A GLANCE'}
        action={
          <span className="today-label">
            <CalendarDays size={16} />
            {date(todayManila())}
          </span>
        }
      >
        A thoughtful overview of your catering business.
      </PageHeading>
      <div className="stat-grid four">
        <Stat label="Today’s received revenue" value={money(m.today_revenue)} icon={<Wallet />} />
        <Stat label="New bookings today" value={m.today_bookings} icon={<CalendarDays />} />
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
            <div className="chart" role="img" aria-label="Monthly approved booking counts">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={m.monthly}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#bca06b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#bca06b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" tickFormatter={(v) => String(v).slice(0, 7)} />
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
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
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
              {m.current_month_bookings} <span>/ {m.previous_month_bookings}</span>
            </strong>
          </div>
          <div>
            <small>Customers with approved events</small>
            <strong>
              {m.current_month_users} <span>/ {m.previous_month_users}</span>
            </strong>
          </div>
          <div>
            <small>Received revenue</small>
            <strong>
              {money(m.current_month_revenue)} <span>/ {money(m.previous_month_revenue)}</span>
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
  { key: 'event_name', label: 'Event' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'event_date', label: 'Event date', render: (r: RecordRow) => date(String(r.event_date)) },
  { key: 'guests', label: 'Guests' },
  { key: 'total', label: 'Total', render: (r: RecordRow) => money(Number(r.total)) },
  { key: 'status', label: 'Status', render: (r: RecordRow) => <Badge value={String(r.status)} /> },
]
export function ManageReservations() {
  const query = useReservations()
  const [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<RecordRow | null>(null)
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
                      rpc('manager_reservation_status', { rid: r.id, new_status: 'approved' })
                    }
                  />
                  {Number(r.paid) === 0 && (
                    <Action
                      label="Reject"
                      kind="small secondary"
                      confirm="Reject this unpaid reservation and release its customer/date slot?"
                      run={() =>
                        rpc('manager_reservation_status', { rid: r.id, new_status: 'rejected' })
                      }
                    />
                  )}
                </>
              )}
              {r.status === 'approved' &&
                String(r.event_date) <= todayManila() &&
                r.paid === r.total && (
                  <Action
                    label="Complete"
                    kind="small secondary"
                    confirm="Mark the catered event complete? The customer will be able to leave feedback."
                    run={() =>
                      rpc('manager_reservation_status', { rid: r.id, new_status: 'completed' })
                    }
                  />
                )}
            </>
          )}
        />
      )}{' '}
      {selected && (
        <Modal title={String(selected.event_name)} close={() => setSelected(null)}>
          <dl className="detail-list">
            {Object.entries(selected).map(([k, v]) => (
              <div key={k}>
                <dt>{human(k)}</dt>
                <dd>
                  {['total', 'paid', 'refunded'].includes(k)
                    ? money(Number(v))
                    : typeof v === 'object'
                      ? JSON.stringify(v)
                      : String(v ?? '—')}
                </dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </>
  )
}
export function ReviewRequests({ kind }: { kind: 'cancellations' | 'refunds' | 'reschedule' }) {
  const table = kind === 'reschedule' ? 'reschedule_requests' : kind
  const query = useQuery({ queryKey: [table], queryFn: () => records<RecordRow>(table) })
  const reservations = useReservations()
  const review = (row: RecordRow, approve: boolean) =>
    rpc(
      kind === 'cancellations'
        ? 'review_cancellation'
        : kind === 'refunds'
          ? 'review_refund'
          : 'review_reschedule',
      {
        [kind === 'cancellations' ? 'cid' : kind === 'refunds' ? 'fid' : 'request_id']: row.id,
        approve,
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
          rows={query.data}
          columns={[
            {
              key: 'reservation_id',
              label: 'Event',
              render: (r) =>
                reservations.data?.find((x) => x.id === r.reservation_id)?.event_name ||
                String(r.reservation_id).slice(0, 8),
            },
            { key: 'created_at', label: 'Requested', render: (r) => date(String(r.created_at)) },
            ...(kind === 'refunds'
              ? [
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
                ]
              : []),
            { key: 'status', label: 'Status', render: (r) => <Badge value={String(r.status)} /> },
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
                  <Action
                    label="Reject"
                    kind="small secondary"
                    confirm="Reject this request? The customer will be notified."
                    run={() => review(r, false)}
                  />
                </>
              )}
              {kind === 'refunds' && r.status === 'approved' && (
                <Action
                  label={r.processing ? 'Check provider status' : 'Process refund'}
                  kind="small secondary"
                  confirm="Continue the approved refund with PayMongo? This uses the stored eligible amount and original payment references."
                  run={() => edge('process-refund', { refund_id: r.id })}
                />
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
        Provider-confirmed receipts and refunds. Payment confirmation is handled by the server.
      </PageHeading>
      <div className="filter-bar">
        <label>
          From
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        <strong>
          Net receipts:{' '}
          {money(
            filtered.reduce((sum, r) => sum + (r.kind === 'refund' ? -1 : 1) * Number(r.amount), 0),
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
            { key: 'created_at', label: 'Date', render: (r) => date(String(r.created_at)) },
            { key: 'reservation_id', label: 'Reservation' },
            { key: 'kind', label: 'Type' },
            { key: 'amount', label: 'Amount', render: (r) => money(Number(r.amount)) },
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
              { key: 'created_at', label: 'Created', render: (r) => date(String(r.created_at)) },
              { key: 'reservation_id', label: 'Reservation' },
              { key: 'amount', label: 'Amount', render: (r) => money(Number(r.amount)) },
              { key: 'intent', label: 'Intent' },
              { key: 'status', label: 'State', render: (r) => <Badge value={String(r.status)} /> },
            ]}
          />
        )
      )}
    </>
  )
}
export function CatalogManager({ area }: { area: 'menu' | 'packages' | 'extras' }) {
  const tabs: CatalogTable[] =
    area === 'menu'
      ? ['dishes', 'menu_categories', 'drinks', 'desserts']
      : area === 'packages'
        ? ['menu_sets', 'event_setups', 'chair_types', 'table_types']
        : ['add_ons', 'event_features']
  const [table, setTable] = useState<CatalogTable>(tabs[0]),
    [editing, setEditing] = useState<RecordRow | null | undefined>(undefined)
  const query = useQuery({
    queryKey: ['manage-catalog', table],
    queryFn: () => records<RecordRow>(table, 'name', true),
  })
  const categories = useQuery({
    queryKey: ['categories'],
    enabled: area === 'menu',
    queryFn: () => records<RecordRow>('menu_categories', 'name', true),
  })
  const priced = !['dishes', 'menu_categories', 'drinks', 'desserts'].includes(table)
  const fields: Field[] = [
    { name: 'name', label: 'Name', required: true, max: 150 },
    ...(table === 'menu_sets' || table === 'dishes'
      ? [{ name: 'description', label: 'Description', type: 'textarea', max: 2000 }]
      : []),
    ...(priced
      ? [
          {
            name: 'price',
            label: 'Price in PHP (e.g. 350.00)',
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
            min: 1,
            max: 20,
          },
          {
            name: 'min_guests',
            label: 'Minimum guests',
            type: 'number',
            required: true,
            min: 1,
            max: 10000,
          },
        ]
      : []),
    ...(table === 'dishes'
      ? [
          {
            name: 'category_id',
            label: 'Category',
            options: categories.data?.map((c) => ({ label: String(c.name), value: c.id })) || [],
          },
        ]
      : []),
  ]
  return (
    <>
      <PageHeading
        title={
          area === 'menu'
            ? 'Flavors for every table.'
            : area === 'packages'
              ? 'Give every occasion a starting point.'
              : 'The little extras that make it yours.'
        }
        action={
          <button className="button" onClick={() => setEditing(null)}>
            <Plus size={16} />
            Add {human(table).replace(/s$/, '').toLowerCase()}
          </button>
        }
      >
        Maintain your live catalog. Archive items to keep historical reservations intact.
      </PageHeading>
      <div className="tabs">
        {tabs.map((t) => (
          <button className={t === table ? 'active' : ''} key={t} onClick={() => setTable(t)}>
            {human(t)}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data}
          columns={[
            { key: 'name', label: 'Name' },
            ...(priced
              ? [{ key: 'price', label: 'Price', render: (r: RecordRow) => money(Number(r.price)) }]
              : []),
            ...(table === 'menu_sets'
              ? [
                  { key: 'dish_count', label: 'Dish count' },
                  { key: 'min_guests', label: 'Minimum guests' },
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
              <button className="text-button" onClick={() => setEditing(r)}>
                Edit
              </button>
              <Action
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
              />
            </>
          )}
        />
      )}{' '}
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
                        : String(editing[f.name] ?? ''),
                    ]),
                  )
                : {}
            }
            label="Save item"
            submit={async (v) => {
              const payload: Record<string, unknown> = { ...v }
              if (priced) {
                const number = Number(v.price)
                if (!Number.isFinite(number) || number < 0) throw new Error('Enter a valid price')
                payload.price = Math.round(number * 100)
              }
              if (table === 'menu_sets') {
                payload.dish_count = Number(v.dish_count)
                payload.min_guests = Number(v.min_guests)
              }
              if (table === 'dishes' && !v.category_id) payload.category_id = null
              const { error } = editing
                ? await supabase.from(table).update(payload).eq('id', editing.id)
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
export function UserManagement() {
  const query = useQuery({ queryKey: ['users'], queryFn: () => records<Profile>('profiles') })
  const [target, setTarget] = useState<Profile | null>(null)
  return (
    <>
      <PageHeading title="The right access, for the right people.">
        Assign customer and manager roles securely. Super-admin access is controlled by a database
        operator.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data as unknown as RecordRow[]}
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'role', label: 'Role', render: (r) => <Badge value={String(r.role)} /> },
            { key: 'created_at', label: 'Joined', render: (r) => date(String(r.created_at)) },
          ]}
          actions={(r) =>
            r.role !== 'super_admin' && (
              <button
                className="text-button"
                onClick={() => setTarget(query.data.find((p) => p.id === r.id)!)}
              >
                Change role
              </button>
            )
          }
        />
      )}{' '}
      {target && (
        <Modal title={'Change access for ' + target.full_name} close={() => setTarget(null)}>
          <p>
            Confirm the intended role for <strong>{target.full_name}</strong>. Managers can access
            customer reservation, payment and support records. This change is audited.
          </p>
          <Form
            fields={[
              {
                name: 'target_role',
                label: 'Assign role',
                required: true,
                options: [
                  { label: 'Customer', value: 'customer' },
                  { label: 'Manager', value: 'manager' },
                ],
              },
            ]}
            initial={{ target_role: target.role }}
            label="Confirm role change"
            submit={(v) =>
              edge('admin-set-role', { target_id: target.id, target_role: v.target_role })
            }
            onSuccess={() => setTarget(null)}
          />
        </Modal>
      )}
    </>
  )
}
export function GalleryManagement() {
  const [editing, setEditing] = useState<RecordRow | null>(null)
  const query = useQuery({
    queryKey: ['manage-gallery'],
    queryFn: () => records<RecordRow>('gallery_images'),
  })
  const [file, setFile] = useState<File | null>(null),
    [caption, setCaption] = useState('')
  const qc = useQueryClient()
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || caption.trim().length < 2)
        throw new Error('Choose an image and add a descriptive caption')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760)
        throw new Error('Use a JPG, PNG or WebP smaller than 10 MB.')
      const path = `events/${crypto.randomUUID()}.${file.type.split('/')[1]}`
      const { error } = await supabase.storage.from('gallery').upload(path, file)
      if (error) throw error
      const url = supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl
      const { error: e } = await supabase
        .from('gallery_images')
        .insert({ name: caption, image_url: url })
      if (e) throw e
    },
    onSuccess: () => {
      void qc.invalidateQueries()
      setFile(null)
      setCaption('')
    },
  })
  return (
    <>
      <PageHeading title="A gallery of good memories.">
        Share the celebrations that tell your story. Use photos you have permission to publish.
      </PageHeading>
      <section className="panel upload-panel">
        <h2>Add a celebration</h2>
        <label>
          Image caption
          <input maxLength={150} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </label>
        <label>
          Photo · up to 10 MB
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button className="button" disabled={upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? 'Uploading…' : 'Upload to gallery'}
        </button>
        {upload.error && <ErrorState error={upload.error} />}
      </section>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <DataTable
          rows={query.data}
          columns={[
            {
              key: 'image_url',
              label: 'Photo',
              render: (r) => (
                <img className="table-thumbnail" src={String(r.image_url)} alt={String(r.name)} />
              ),
            },
            { key: 'name', label: 'Caption' },
            {
              key: 'active',
              label: 'Visibility',
              render: (r) => <Badge value={r.active ? 'active' : 'archived'} />,
            },
          ]}
          actions={(r) => (
            <>
              <button className="text-button" onClick={() => setEditing(r)}>
                Edit caption
              </button>
              <Action
                label={r.active ? 'Unpublish' : 'Publish'}
                kind="small secondary"
                run={async () => {
                  const { error } = await supabase
                    .from('gallery_images')
                    .update({ active: !r.active })
                    .eq('id', r.id)
                  if (error) throw error
                }}
              />
              <Action
                label="Delete"
                kind="small secondary"
                confirm="Delete this gallery entry? Its image remains in Storage for recovery and can be removed there by an operator."
                run={async () => {
                  const { error } = await supabase.from('gallery_images').delete().eq('id', r.id)
                  if (error) throw error
                }}
              />
            </>
          )}
        />
      )}
      {editing && (
        <Modal title="Edit gallery caption" close={() => setEditing(null)}>
          <Form
            fields={[{ name: 'name', label: 'Caption', required: true, max: 150 }]}
            initial={{ name: String(editing.name) }}
            submit={async (values) => {
              const { error } = await supabase
                .from('gallery_images')
                .update({ name: values.name })
                .eq('id', editing.id)
              if (error) throw error
            }}
            onSuccess={() => setEditing(null)}
          />
        </Modal>
      )}
    </>
  )
}
export function Maintenance() {
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => records<{ key: string; value: unknown }>('app_settings', 'key', true),
  })
  const enabled = query.data?.find((s) => s.key === 'maintenance')?.value === true
  return (
    <>
      <PageHeading title="Take a little time behind the scenes.">
        Maintenance closes public and customer access. Super admins can always sign in to manage the
        system.
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="settings-grid">
          <section className="panel">
            <h2>Maintenance mode</h2>
            <Badge value={enabled ? 'active' : 'disabled'} />
            <p>
              {enabled
                ? 'Customers see the maintenance page and cannot perform normal operations.'
                : 'Your public website and customer booking service are open.'}
            </p>
            <Action
              label={enabled ? 'Reopen the service' : 'Enable maintenance'}
              confirm={
                enabled
                  ? 'Restore customer access and public catalog browsing?'
                  : 'Block normal public/customer use until you reopen the service? Staff can still inspect operational records.'
              }
              run={() =>
                rpc('update_setting', { setting_key: 'maintenance', setting_value: !enabled })
              }
            />
          </section>
          <section className="panel">
            <h2>Refund policy configuration</h2>
            <p>
              Changes apply to new refund requests. Existing requests keep their stored eligible
              amount.
            </p>
            <Form
              initial={{
                partial: String(
                  Number(query.data.find((s) => s.key === 'refund_partial_rate')?.value) * 100,
                ),
                full: String(
                  Number(query.data.find((s) => s.key === 'refund_full_rate')?.value) * 100,
                ),
              }}
              fields={[
                {
                  name: 'partial',
                  label: 'Refund % of a 50% down payment',
                  type: 'number',
                  required: true,
                  min: 0,
                  max: 100,
                },
                {
                  name: 'full',
                  label: 'Refund % of a fully paid amount',
                  type: 'number',
                  required: true,
                  min: 0,
                  max: 100,
                },
              ]}
              label="Update refund policy"
              submit={async (v) => {
                await rpc('update_setting', {
                  setting_key: 'refund_partial_rate',
                  setting_value: Number(v.partial) / 100,
                })
                await rpc('update_setting', {
                  setting_key: 'refund_full_rate',
                  setting_value: Number(v.full) / 100,
                })
              }}
            />
          </section>
        </div>
      )}
    </>
  )
}
export function AuditLogs() {
  const query = useQuery({ queryKey: ['audit'], queryFn: () => records<RecordRow>('audit_logs') })
  return (
    <>
      <PageHeading title="Every important action, accounted for.">
        Append-only records, attributed to authenticated users or verified server processing.
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
                new Date(String(r.created_at)).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
            },
            { key: 'action', label: 'Action' },
            {
              key: 'actor_id',
              label: 'Actor',
              render: (r) => (r.actor_id ? String(r.actor_id) : 'Server / operator'),
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
