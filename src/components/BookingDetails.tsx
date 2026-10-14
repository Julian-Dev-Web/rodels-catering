import { useReservation } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { setupItems } from '../lib/booking'
import { dateTime } from '../lib/format'
import { ErrorState, Loading } from './ui'
import type { Catalog, RecordRow, Reservation } from '../types'
import { useQuery } from '@tanstack/react-query'
import { records, rpc } from '../lib/supabase'
import { date, money, human } from '../lib/format'
import { timeLabel } from './EventTimeSelect'
import { birthdayKeys, weddingKeys } from '../lib/booking'
import { downloadReportPdf, type ReportDocument } from '../lib/reports'
import { useState } from 'react'
type Children = Record<
  | 'reservation_items'
  | 'reservation_event_setups'
  | 'reservation_event_features'
  | 'reservation_tables_chairs'
  | 'reservation_add_ons',
  RecordRow[]
>
function removedSetupLabel(r:Reservation,kind:string|undefined|null){
 if(r.booking_version===0)return 'Historical bundle; individual choices not recorded'
 const keys=kind==='birthday'?birthdayKeys:kind==='wedding'?weddingKeys:[]
 return keys.filter(key=>!r.event_preferences?.setup_inclusions?.includes(key)).map(key=>setupItems.find(item=>item.key===key)?.label||key).join(', ')||'None / not applicable'
}
export function BookingSelections({
  reservation: r,
  children,
  catalog,
}: {
  reservation: Reservation
  children: Children
  catalog: Catalog
}) {
  const prefs = r.event_preferences
  const selectedSetup=catalog.event_setups.find(item=>children.reservation_event_setups.some(row=>row.event_setup_id===item.id))
  return (
    <dl className="detail-list booking-preferences">
      <dt>Event contact</dt>
      <dd>{r.address.contact || 'Not recorded'}</dd>
      <dt>Event setup</dt>
      <dd>
        {catalog.event_setups.find((item) =>
          children.reservation_event_setups.some(
            (row) => row.event_setup_id === item.id,
          ),
        )?.name || 'Not selected'}
      </dd>
      <dt>Setup inclusions</dt>
      <dd>
        {r.booking_version === 0
          ? 'Historical bundle; item choices were not recorded'
          : prefs?.setup_inclusions
              ?.map(
                (key) =>
                  setupItems.find((item) => item.key === key)?.label || key,
              )
              .join(', ') || 'None selected'}
      </dd>
      <dt>Removed setup elements</dt>
      <dd>
        {removedSetupLabel(r,selectedSetup?.setup_kind)}
      </dd>
      <dt>Celebrant age</dt>
      <dd>{prefs?.celebrant_age || 'Not provided'}</dd>
      <dt>Preferred theme</dt>
      <dd>{prefs?.theme || 'No preference'}</dd>
      <dt>Preferred colors</dt>
      <dd>{prefs?.colors || 'No preference'}</dd>
      <dt>Optional features</dt>
      <dd>
        {catalog.event_features
          .filter((item) =>
            children.reservation_event_features.some(
              (row) => row.event_feature_id === item.id,
            ),
          )
          .map((item) => item.name)
          .join(', ') || 'None'}
      </dd>
      <dt>Add-ons</dt>
      <dd>
        {children.reservation_add_ons
          .map(
            (row) =>
              (catalog.add_ons.find((item) => item.id === row.add_on_id)
                ?.name || 'Archived add-on') +
              ' × ' +
              row.quantity,
          )
          .join(', ') || 'None'}
      </dd>
      <dt>Table preference</dt>
      <dd>
        {catalog.table_types.find((item) =>
          children.reservation_tables_chairs.some(
            (row) => row.table_type_id === item.id,
          ),
        )?.name || 'Not selected'}
      </dd>
      <dt>Guest chairs</dt>
      <dd>
        {children.reservation_tables_chairs
          .map(
            (row) =>
              (catalog.chair_types.find((item) => item.id === row.chair_type_id)
                ?.name || 'Archived chair') +
              ' · ' +
              row.chair_quantity +
              ' guests',
          )
          .join(', ') || 'Not selected'}
      </dd>
      <dt>Terms/privacy consent</dt>
      <dd>
        {r.consent_at
          ? r.consent_version + ' · ' + dateTime(r.consent_at) + ' Manila'
          : 'Historical booking; consent not recorded'}
      </dd>
      <dt>Saved seating / extra charges</dt>
      <dd>
        {r.selection_snapshot?.length ? r.selection_snapshot.map((item, i) => (
          <p key={i}>
            {item.name} × {item.quantity} ·{' '}
            {item.unit_amount === null
              ? 'Unit price not recorded'
              : money(item.unit_amount) + ' each'}{' '}
            ·{' '}
            {item.subtotal === null
              ? 'Subtotal not recorded'
              : money(item.subtotal)}
            <small> {item.basis}</small>
          </p>
        )) : r.selection_snapshot ? 'No item charge rows recorded for these selections.' :
          'Historical item charges were not recorded; the saved quote remains authoritative.'}
      </dd>
    </dl>
  )
}
export function StaffBookingDetails({ id }: { id: string }) {
  const query = useReservation(id),
    catalog = useCatalog({ includeArchived: true })
  const contact = useQuery({
      queryKey: ['staff-customer-contact', id],
      queryFn: () =>
        rpc<{ name: string; primary_phone: string; email: string | null }>(
          'staff_customer_contact',
          { rid: id },
        ),
    }),
    payments = useQuery({
      queryKey: ['booking-ledger', id],
      queryFn: () =>
        records<RecordRow>('transactions', 'created_at', true, {
          reservation_id: id,
        }),
    })
  const balance = useQuery({
    queryKey: ['booking-balance', id],
    queryFn: () =>
      records<RecordRow>('balances', 'reservation_id', true, {
        reservation_id: id,
      }),
  })
  const [downloadError, setDownloadError] = useState<unknown>(null),
    [downloading, setDownloading] = useState(false)
  if (
    query.isPending ||
    catalog.isPending ||
    contact.isPending ||
    payments.isPending ||
    balance.isPending
  )
    return <Loading />
  if (
    query.error ||
    catalog.error ||
    contact.error ||
    payments.error ||
    balance.error
  )
    return (
      <ErrorState
        error={
          query.error ||
          catalog.error ||
          contact.error ||
          payments.error ||
          balance.error
        }
      />
    )
  const r = query.data.reservation
  const menu =
      catalog.data.menu_sets.find((m) => m.id === r.menu_set_id)?.name ||
      'Selected package unavailable',
    setup = catalog.data.event_setups.find((s) =>
      query.data.children.reservation_event_setups.some(
        (x) => x.event_setup_id === s.id,
      ),
    )
  const document: ReportDocument = {
    title:
      'Reservation ' + (r.reservation_reference || 'Reference unavailable'),
    generated: dateTime(new Date().toISOString()) + ' Manila',
    filters: 'Single authorized reservation; saved quote and selections',
    summary: [
      r.event_name +
        ' | ' +
        date(r.event_date) +
        ' ' +
        timeLabel(r.event_time) +
        ' Manila | ' +
        r.guests +
        ' guests',
      `Total PHP ${(r.total / 100).toFixed(2)}; verified paid PHP ${(r.paid / 100).toFixed(2)}; refunded PHP ${(r.refunded / 100).toFixed(2)}.`,
    ],
    headers: ['Detail', 'Saved value'],
    rows: [
      ['Customer', contact.data.name || 'Not provided'],
      ['Event contact', r.address.contact || 'Not provided'],
      [
        'Current balance',
        balance.data[0]
          ? 'PHP ' + (Number(balance.data[0].amount) / 100).toFixed(2)
          : 'Balance ledger not yet created',
      ],
      [
        'Location',
        ['street', 'barangay', 'city', 'province']
          .map((k) => r.address[k])
          .filter(Boolean)
          .join(', '),
      ],
      ['Package', menu],
      ['Selected dishes',catalog.data.dishes.filter(d=>query.data.children.reservation_items.some(x=>x.dish_id===d.id)).map(d=>d.name).join(', ')||'Not provided'],
      [
        'Drink',
        catalog.data.drinks.find((d) => d.id === r.drink_id)?.name ||
          'Not provided',
      ],
      [
        'Dessert',
        catalog.data.desserts.find((d) => d.id === r.dessert_id)?.name ||
          'Not provided',
      ],
      ['Event setup', setup?.name || 'Not selected'],
      ['Removed setup elements',removedSetupLabel(r,setup?.setup_kind)],
      ['Celebrant age',r.event_preferences?.celebrant_age||'Not provided'],
      [
        'Theme / colors',
        [
          r.event_preferences?.theme || 'No preference',
          r.event_preferences?.colors || 'No preference',
        ].join(' / '),
      ],
      [
        'Setup inclusions',
        (r.event_preferences?.setup_inclusions || [])
          .map((k) => setupItems.find((i) => i.key === k)?.label || k)
          .join(', ') || 'None recorded',
      ],
      ...Object.entries(r.pricing).map(([key, value]) => [
        human(key),
        'PHP ' + (value / 100).toFixed(2),
      ]),
      ...(r.selection_snapshot || []).map((s) => [
        s.name,
        s.quantity +
          ' x ' +
          (s.unit_amount === null
            ? 'Not recorded'
            : 'PHP ' + (s.unit_amount / 100).toFixed(2)) +
          '; ' +
          s.basis,
      ]),
    ],
    filename: 'rodelconnect-' + (r.reservation_reference || 'booking'),
  }
  return (
    <div className="staff-booking-detail">
      <section>
        <h3>Booking overview</h3>
        <dl className="detail-list">
          <dt>Reservation reference</dt>
          <dd>{r.reservation_reference || 'Reference unavailable'}</dd>
          <dt>Event</dt>
          <dd>{r.event_name}</dd>
          <dt>Event type</dt>
          <dd>
            {human(
              r.event_preferences?.occasion_type ||
                setup?.setup_kind ||
                'other',
            )}
          </dd>
          <dt>Event date/time</dt>
          <dd>
            {date(r.event_date)} · {timeLabel(r.event_time)} Manila
          </dd>
          <dt>Guests / status</dt>
          <dd>
            {r.guests} · {human(r.status)}
          </dd>
          <dt>Booked</dt>
          <dd>{dateTime(r.created_at)} Manila</dd>
        </dl>
      </section>
      <section>
        <h3>Customer and contact</h3>
        <dl className="detail-list">
          <dt>Customer</dt>
          <dd>{contact.data.name || 'Not provided'}</dd>
          <dt>Email</dt>
          <dd>{contact.data.email || 'Not provided'}</dd>
          <dt>Primary account number</dt>
          <dd>{contact.data.primary_phone || 'Not provided'}</dd>
          <dt>Chosen event number</dt>
          <dd>{r.address.contact || 'Not provided'}</dd>
        </dl>
      </section>
      <section>
        <h3>Event location</h3>
        <dl className="detail-list">
          {[
            ['street', 'Street / venue'],
            ['barangay', 'Barangay'],
            ['city', 'City / municipality'],
            ['province', 'Province'],
            ['notes', 'Directions / notes'],
          ].map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{r.address[key] || 'Not provided'}</dd>
            </div>
          ))}
        </dl>
        {!['Bulacan', 'Pampanga'].includes(r.address.province) && (
          <p className="policy-explanation">
            Historical event outside current coverage: review with the customer.
            Its saved address has not been changed.
          </p>
        )}
      </section>
      <section>
        <h3>Catering selection</h3>
        <p>{menu}</p>
        <p>
          {catalog.data.dishes
            .filter((item) =>
              query.data.children.reservation_items.some(
                (row) => row.dish_id === item.id,
              ),
            )
            .map((item) => item.name)
            .join(', ')}
        </p>
        <p>
          Drink:{' '}
          {catalog.data.drinks.find((d) => d.id === r.drink_id)?.name ||
            'Not provided'}{' '}
          · Dessert:{' '}
          {catalog.data.desserts.find((d) => d.id === r.dessert_id)?.name ||
            'Not provided'}
        </p>
      </section>
      <section>
        <h3>Styling, seating and optional extras</h3>
        <BookingSelections
          reservation={r}
          children={query.data.children}
          catalog={catalog.data}
        />
      </section>
      <section>
        <h3>Payment summary</h3>
        <dl className="detail-list">
          <dt>Saved total</dt>
          <dd>{money(r.total)}</dd>
          <dt>50% down-payment requirement</dt>
          <dd>{money(Math.ceil(r.total / 2))}</dd>
          <dt>Verified paid</dt>
          <dd>{money(r.paid)}</dd>
          <dt>Previously refunded</dt>
          <dd>{money(r.refunded)}</dd>
          <dt>Payment status</dt>
          <dd>{human(r.payment_status)}</dd>
          <dt>Current balance</dt>
          <dd>
            {balance.data[0]
              ? money(Number(balance.data[0].amount))
              : 'No balance ledger yet; unpaid quoted amount ' +
                money(Math.max(r.total - r.paid, 0))}
          </dd>
        </dl>
        {payments.data.map((p) => (
          <p key={p.id}>
            {p.kind === 'refund' ? 'Completed refund' : 'Verified payment'} ·{' '}
            {money(Number(p.amount))} · {dateTime(String(p.created_at))} Manila
          </p>
        ))}
      </section>
      <section>
        <h3>Recorded activity</h3>
        <BookingActivity id={id} />
      </section>
      <button
        className="button secondary"
        disabled={downloading}
        onClick={async () => {
          setDownloading(true)
          setDownloadError(null)
          try {
            await downloadReportPdf(document)
          } catch (e) {
            setDownloadError(e)
          } finally {
            setDownloading(false)
          }
        }}
      >
        {downloading ? 'Preparing PDF…' : 'Download booking PDF'}
      </button>
      {!!downloadError && <ErrorState error={downloadError} />}
    </div>
  )
}
export function BookingActivity({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['reservation-activity', id],
    queryFn: () =>
      rpc<
        {
          created_at: string
          kind: string
          description: string
          reason: string | null
          amount: number | null
        }[]
      >('reservation_activity', { rid: id }),
  })
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  return query.data.length ? (
    <ol className="booking-activity">
      {query.data.map((entry, i) => (
        <li key={i}>
          <strong>{entry.description}</strong>
          <time>{dateTime(entry.created_at)} Manila</time>
          {entry.reason && <p>Reason: {entry.reason}</p>}
          {entry.amount !== null && <p>{money(entry.amount)}</p>}
        </li>
      ))}
    </ol>
  ) : (
    <p>
      No recorded activity yet. Historical decision times are not inferred from
      current status.
    </p>
  )
}
