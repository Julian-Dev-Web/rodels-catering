import {BookingChanges,AdjustmentRefunds} from './BookingChanges'
import { useReservation } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { setupItems, setupItemLabel } from '../lib/booking'
import { dateTime } from '../lib/format'
import { ErrorState, Loading } from './ui'
import type { Catalog, RecordRow, Reservation } from '../types'
import { useQuery } from '@tanstack/react-query'
import { edge, records, rpc } from '../lib/supabase'
import { date, money, human } from '../lib/format'
import { timeLabel } from './EventTimeSelect'
import { birthdayKeys, weddingKeys } from '../lib/booking'
import { downloadReportPdf, type ReportDocument } from '../lib/reports'
import { useState } from 'react'
import { useMutation,useQueryClient } from '@tanstack/react-query'
import { ManualPaymentDialog,PaymentHistory,PaymentTotals,PaymentEmailStatus } from './PaymentPanel'
import { financialRows } from '../lib/financial'
import { AllergyRiskText,useAllergyWarnings } from './AllergyFields'
import { DiscountAssignment } from '../pages/PanelOperations'
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
  const allergyWarnings=useAllergyWarnings(r.allergy_allergen_ids||[],r.allergy_notes||'',children.reservation_items.map(i=>String(i.dish_id)))
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
      <dt>{selectedSetup?.setup_kind==='buffet'?'Optional setup extras':'Setup inclusions'}</dt>
      <dd>
        {r.booking_version === 0
          ? 'Historical bundle; item choices were not recorded'
          : prefs?.setup_inclusions
              ?.map(
                (key) =>
                  setupItemLabel(key,selectedSetup?.setup_kind),
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
      <dt>Allergy declarations and acknowledgment</dt>
      <dd className="allergy-panel"><strong>Food allergy / preparation caution</strong><p>Declared: {(r.allergy_allergen_ids||[]).join(', ')||'None declared'}. {r.allergy_notes}</p>{r.allergy_warning_snapshot?.length?<><h4>Recorded at booking submission</h4>{r.allergy_warning_snapshot.map(w=><div className="allergy-warning" key={w.token}><strong>{w.dish}</strong><AllergyRiskText warning={w}/><p>{w.acknowledged?'Customer explicitly acknowledged this warning.':'No acknowledgment required for this reviewed recipe result.'} {w.acknowledged_at&&dateTime(w.acknowledged_at)}</p><small>Recipe reference: {w.recipe_hash}</small></div>)}</>:<p>No ingredient-warning snapshot was recorded for this historical booking, or no allergies were declared. Existing declarations and acknowledgment records are retained.</p>}<details><summary>Current recipe review and staff follow-up</summary>{allergyWarnings.error&&<ErrorState error={allergyWarnings.error}/>} {allergyWarnings.data?.map(w=><div className="allergy-warning" key={w.token}><strong>{w.dish}</strong><AllergyRiskText warning={w}/><p>{(r.allergy_acknowledgments||[]).some(a=>a.token===w.token)?'Customer acknowledgment matches this recipe.':'Review current risks with the customer; historical booking terms and payments remain unchanged.'}</p></div>)}</details><p>Confirm ingredients and cross-contact risks with the catering team. Acknowledgment does not make a dish allergen-free.</p></dd>
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
  const [manual,setManual]=useState(false),[paymentNotice,setPaymentNotice]=useState(''),qc=useQueryClient()
  const diagnostics=useMutation({mutationFn:()=>edge<{state:string}>('reconcile-paymongo-checkout',{reservation_id:id,close_unpaid:true}),onSuccess:result=>{setPaymentNotice(result.state==='unknown'||result.state==='pending'?'The provider outcome is still unresolved. Do not record another payment yet.':'Payment status checked. Review the current balance.');void qc.invalidateQueries()}})
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
      `Total PHP ${(r.total / 100).toFixed(2)}; net verified paid PHP ${((r.paid-r.refunded-(r.payment_reversed||0)) / 100).toFixed(2)}; completed refunds PHP ${(r.refunded / 100).toFixed(2)}.`,
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
          .map((k) => setupItemLabel(k,setup?.setup_kind))
          .join(', ') || 'None recorded',
      ],
      ...Object.entries(r.pricing).map(([key, value]) => [
        human(key),
        'PHP ' + (value / 100).toFixed(2),
      ]),
      ...financialRows(r.financial_snapshot,r.total,r.paid-r.refunded-(r.payment_reversed||0),Number(balance.data?.[0]?.amount??Math.max(r.total-r.paid,0))).map(([label,value])=>[label,typeof value==='number'?money(value):value]),
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
        <DiscountAssignment reservation={r}/>
        <BookingSelections
          reservation={r}
          children={query.data.children}
          catalog={catalog.data}
        />
      </section>
      <section>
        <h3>Payment summary</h3><PaymentTotals id={id}/>
        {paymentNotice&&<p className="feedback-notice" role="status">{paymentNotice}</p>}
        {['for_approval','pending','approved'].includes(r.status)&&<button className="button" onClick={()=>setManual(true)}>Record manual payment</button>}
        <details><summary>Staff payment diagnostics</summary><p>Check the provider first. Only a confirmed unpaid/expired checkout can be closed; processing payments remain held.</p><button className="button secondary" disabled={diagnostics.isPending} onClick={()=>diagnostics.mutate()}>{diagnostics.isPending?'Checking provider…':'Check / close unfinished checkout'}</button>{diagnostics.error&&<ErrorState error={diagnostics.error}/>}</details>
        <PaymentHistory reservation={r} staff/><BookingChanges reservation={r} staff/><AdjustmentRefunds reservation={r} staff/><PaymentEmailStatus id={r.id}/>
        {manual&&<ManualPaymentDialog reservation={r} customer={contact.data.name} close={()=>setManual(false)} onSaved={setPaymentNotice}/>}
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
