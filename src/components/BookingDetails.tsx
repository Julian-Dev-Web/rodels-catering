import { useReservation } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { setupItems } from '../lib/booking'
import { dateTime } from '../lib/format'
import { ErrorState, Loading } from './ui'
import type { Catalog, RecordRow, Reservation } from '../types'
type Children = Record<
  | 'reservation_items'
  | 'reservation_event_setups'
  | 'reservation_event_features'
  | 'reservation_tables_chairs'
  | 'reservation_add_ons',
  RecordRow[]
>
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
    </dl>
  )
}
export function StaffBookingDetails({ id }: { id: string }) {
  const query = useReservation(id),
    catalog = useCatalog({ includeArchived: true })
  if (query.isPending || catalog.isPending) return <Loading />
  if (query.error || catalog.error)
    return <ErrorState error={query.error || catalog.error} />
  const r = query.data.reservation
  return (
    <>
      <p>
        {[
          r.address.street,
          r.address.barangay,
          r.address.city,
          r.address.province,
        ]
          .filter(Boolean)
          .join(', ')}
      </p>
      <p>
        Menu:{' '}
        {catalog.data.menu_sets.find((item) => item.id === r.menu_set_id)?.name}
      </p>
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
      <BookingSelections
        reservation={r}
        children={query.data.children}
        catalog={catalog.data}
      />
    </>
  )
}
