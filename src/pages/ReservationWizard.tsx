import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { useCatalog } from '../features/catalog'
import { useReservation } from '../features/reservations'
import { rpc, supabase } from '../lib/supabase'
import { money, date, human, earliestEventDate } from '../lib/format'
import {
  LocationFields,
  EventPreferenceFields,
  ConsentField,
} from '../components/BookingFields'
import {
  defaultPreferences,
  birthdayKeys,
  weddingKeys,
  setupItems,
  estimateBooking,
  POLICY_VERSION,
  validMobile,
} from '../lib/booking'
import { ErrorState, Loading, PageHeading } from '../components/ui'
import {
  EventTimeSelect,
  validWindowTime,
  timeLabel,
  type BookingWindow,
} from '../components/EventTimeSelect'
import type { CatalogItem } from '../types'
const schema = z.object({
  event_name: z.string().min(2).max(150),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an event date')
    .refine(
      (value) => value >= earliestEventDate(),
      'Choose a date at least 3 days ahead for preparation',
    ),
  event_time: z.string().min(5),
  guests: z.number().int().min(1).max(10000),
  menu_set_id: z.string().min(1, 'Choose a package'),
  drink_id: z.string(),
  dessert_id: z.string(),
  setup_id: z.string(),
  dish_ids: z.array(z.string()),
  feature_ids: z.array(z.string()),
  table_type_id: z.string(),
  event_preferences: z.object({
    occasion_type: z.enum(['birthday', 'wedding', 'other']),
    theme: z.string().max(200),
    colors: z.string().max(200),
    celebrant_age: z.number().int().min(1).max(120).nullable(),
    setup_inclusions: z.array(z.string()),
  }),
  consent_accepted: z.boolean(),
  consent_version: z.string(),
  save_contact: z.boolean(),
  chair_quantities: z.record(z.string(), z.number().int().min(0).max(10000)),
  chair_type_id: z.string(),
  elegant_chair_quantity: z.number().int().min(0).max(10000),
  addon_quantities: z.record(z.string(), z.number().int().min(0).max(1000)),
  address: z.object({
    street: z.string(),
    province: z.string(),
    city: z.string(),
    barangay: z.string(),
    province_code: z.string(),
    city_code: z.string(),
    barangay_code: z.string(),
    contact: z.string(),
    notes: z.string().max(2000),
  }),
})
export type Values = z.infer<typeof schema>
const defaults: Values = {
  event_name: '',
  event_date: '',
  event_time: '12:00',
  guests: 100,
  menu_set_id: '',
  drink_id: '',
  dessert_id: '',
  setup_id: '',
  dish_ids: [],
  feature_ids: [],
  table_type_id: '',
  event_preferences: defaultPreferences,
  consent_accepted: false,
  consent_version: POLICY_VERSION,
  save_contact: false,
  chair_quantities: {},
  chair_type_id: '',
  elegant_chair_quantity: 0,
  addon_quantities: {},
  address: {
    street: '',
    province: '',
    city: '',
    barangay: '',
    province_code: '',
    city_code: '',
    barangay_code: '',
    contact: '',
    notes: '',
  },
}
function Select({
  items,
  register,
  label,
  priced = false,
  unit = '',
  error,
}: {
  items: CatalogItem[]
  register: ReturnType<UseFormReturn<Values>['register']>
  label: string
  priced?: boolean
  unit?: string
  error?: string
}) {
  return (
    <label>
      {label}
      <select {...register}>
        <option value="">Select {label.toLowerCase()}</option>
        {items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {priced
              ? ' · ' + (p.price ? money(p.price) + unit : 'Included')
              : ''}
          </option>
        ))}
      </select>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
export function ReservationWizard() {
  const { id } = useParams()
  const location = useLocation(),
    navigate = useNavigate(),
    qc = useQueryClient()
  const weddingConfiguration = useQuery({
    queryKey: ['wedding-prices'],
    queryFn: () =>
      rpc<Record<string, number> | null>('wedding_price_configuration'),
  })
  const catalog = useCatalog(),
    detail = useReservation(id)
  const initialized = useRef<string>('')
  const [quote, setQuote] = useState<Record<string, number> | null>(null)
  const [foodSearch, setFoodSearch] = useState('')
  const [foodCategory, setFoodCategory] = useState('all')
  const step = location.pathname.endsWith('/menu')
    ? 1
    : location.pathname.endsWith('/event-setup')
      ? 2
      : location.pathname.endsWith('/confirm')
        ? 3
        : 0
  const initial = {
    ...defaults,
    event_date: new URLSearchParams(location.search).get('date') || '',
    menu_set_id: new URLSearchParams(location.search).get('package') || '',
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = form
  useEffect(() => {
    if (!id && initialized.current) {
      initialized.current = ''
      reset(defaults)
      setQuote(null)
    }
    if (detail.data && catalog.data && initialized.current !== id) {
      const { reservation: r, children: c } = detail.data
      const seating = c.reservation_tables_chairs
      initialized.current = id!
      setQuote(r.pricing)
      reset({
        ...defaults,
        event_name: r.event_name,
        event_date: r.event_date,
        event_time: r.event_time.slice(0, 5),
        guests: r.guests,
        menu_set_id: r.menu_set_id,
        drink_id: r.drink_id || '',
        dessert_id: r.dessert_id || '',
        setup_id: String(c.reservation_event_setups[0]?.event_setup_id || ''),
        dish_ids: c.reservation_items.map((x) => String(x.dish_id)),
        feature_ids: c.reservation_event_features.map((x) =>
          String(x.event_feature_id),
        ),
        table_type_id: String(seating[0]?.table_type_id || ''),
        chair_type_id: String(
          seating.find(
            (row) =>
              (catalog.data!.chair_types.find((c) => c.id === row.chair_type_id)
                ?.price || 0) > 0,
          )?.chair_type_id ||
            seating[0]?.chair_type_id ||
            '',
        ),
        elegant_chair_quantity: Number(
          seating.find(
            (row) =>
              (catalog.data!.chair_types.find((c) => c.id === row.chair_type_id)
                ?.price || 0) > 0,
          )?.chair_quantity || 0,
        ),
        event_preferences: {
          ...defaultPreferences,
          ...r.event_preferences,
          setup_inclusions:
            r.event_preferences?.setup_inclusions ??
            (catalog.data.event_setups.find(
              (setup) =>
                setup.id === c.reservation_event_setups[0]?.event_setup_id,
            )?.setup_kind === 'birthday'
              ? birthdayKeys
              : catalog.data.event_setups.find(
                    (setup) =>
                      setup.id ===
                      c.reservation_event_setups[0]?.event_setup_id,
                  )?.setup_kind === 'wedding'
                ? weddingKeys
                : []),
        },
        consent_accepted:
          r.consent_version === POLICY_VERSION && !!r.consent_at,
        consent_version: POLICY_VERSION,
        save_contact: false,
        chair_quantities: Object.fromEntries(
          seating.map((x) => [x.chair_type_id, Number(x.chair_quantity)]),
        ),
        addon_quantities: Object.fromEntries(
          c.reservation_add_ons.map((x) => [x.add_on_id, Number(x.quantity)]),
        ),
        address: { ...defaults.address, ...r.address },
      })
    }
  }, [detail.data, catalog.data, id, reset])
  const values = useWatch({ control: form.control }) as Values
  const selected = catalog.data?.menu_sets.find(
    (p) => p.id === values.menu_set_id,
  )
  const includedSeating = selected?.pricing_version === 2
  useEffect(() => {
    if (!catalog.data) return
    const valid = values.feature_ids.filter((id) => {
      const feature = catalog.data?.event_features.find(
        (item) => item.id === id,
      )
      return (
        !!feature &&
        (!feature.required_setup_id ||
          feature.required_setup_id === values.setup_id)
      )
    })
    if (valid.length !== values.feature_ids.length)
      form.setValue('feature_ids', valid, { shouldDirty: true })
    const dishes = values.dish_ids.filter((id) =>
      catalog.data!.dishes.some((dish) => dish.id === id),
    )
    if (dishes.length !== values.dish_ids.length)
      form.setValue('dish_ids', dishes, { shouldDirty: true })
    const choices = {
      drink_id: 'drinks',
      dessert_id: 'desserts',
      setup_id: 'event_setups',
      table_type_id: 'table_types',
      chair_type_id: 'chair_types',
    } as const
    for (const field of Object.keys(choices) as (keyof typeof choices)[]) {
      if (
        values[field] &&
        !catalog.data[choices[field]].some((item) => item.id === values[field])
      ) {
        form.setValue(field, '', { shouldDirty: true })
        if (field === 'setup_id')
          form.setValue('event_preferences.setup_inclusions', [], {
            shouldDirty: true,
          })
      }
    }
  }, [values, catalog.data, form])
  const save = useMutation({
    mutationFn: async (v: Values) => {
      if (!v.consent_accepted)
        throw new Error(
          'Accept the current Terms and Privacy Notice in the occasion step.',
        )
      if (!validMobile(v.address.contact))
        throw new Error('Enter a reachable Philippine mobile number.')
      if (!selected)
        throw new Error('Choose a current set menu before continuing.')
      if (selected && v.guests < (selected.min_guests || 1))
        throw new Error(
          `This package requires at least ${selected.min_guests} guests.`,
        )
      if (selected?.max_guests && v.guests > selected.max_guests)
        throw new Error(
          `This menu allows at most ${selected.max_guests} guests.`,
        )
      if (
        step === 1 &&
        (v.dish_ids.length !== selected?.dish_count ||
          !v.drink_id ||
          !v.dessert_id)
      )
        throw new Error(
          `Choose exactly ${selected?.dish_count} dishes, a drink and dessert.`,
        )
      if (
        step === 2 &&
        (!v.setup_id ||
          !v.table_type_id ||
          (includedSeating
            ? !v.chair_type_id
            : Object.values(v.chair_quantities).reduce((s, q) => s + q, 0) <
              v.guests))
      )
        throw new Error(
          includedSeating
            ? 'Choose a buffet/event setup, table type and guest chair type.'
            : 'Choose your setup, table type and enough chairs for your guests.',
        )
      const rid = await rpc<string>('save_reservation', {
        data: {
          ...v,
          id,
          chairs: includedSeating
            ? v.chair_type_id
              ? (c.chair_types.find((chair) => chair.id === v.chair_type_id)
                  ?.price || 0) > 0
                ? [
                    { id: v.chair_type_id, quantity: v.elegant_chair_quantity },
                    ...(v.guests > v.elegant_chair_quantity
                      ? [
                          {
                            id: c.chair_types.find(
                              (chair) =>
                                chair.name === 'Monoblock' && chair.price === 0,
                            )?.id,
                            quantity: v.guests - v.elegant_chair_quantity,
                          },
                        ]
                      : []),
                  ]
                : [{ id: v.chair_type_id, quantity: v.guests }]
              : []
            : Object.entries(v.chair_quantities)
                .filter(([, q]) => q > 0)
                .map(([key, q]) => ({ id: key, quantity: q })),
          add_ons: Object.entries(v.addon_quantities)
            .filter(
              ([key, q]) =>
                q > 0 && catalog.data!.add_ons.some((item) => item.id === key),
            )
            .map(([key, q]) => ({ id: key, quantity: q })),
        },
      })
      const { data, error } = await supabase
        .from('reservations')
        .select('pricing')
        .eq('id', rid)
        .single()
      if (error) throw error
      setQuote(data.pricing)
      void qc.invalidateQueries({ queryKey: ['reservations'] })
      void qc.invalidateQueries({ queryKey: ['reservation', rid] })
      if (v.save_contact)
        void qc.invalidateQueries({ queryKey: ['saved-contacts'] })
      navigate(
        `/customer/reservations/${rid}/${['menu', 'event-setup', 'confirm', 'confirm'][step]}`,
      )
    },
    onSuccess: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  })
  const finalize = useMutation({
    mutationFn: () => rpc('finalize_reservation', { rid: id }),
    onSuccess: () => {
      void qc.invalidateQueries()
      navigate('/customer/reservations/' + id)
    },
  })
  if (catalog.isPending || (id && detail.isPending)) return <Loading />
  if (catalog.error || detail.error)
    return <ErrorState error={catalog.error || detail.error} />
  if (
    detail.data &&
    (!['draft', 'pending', 'for_approval'].includes(
      detail.data.reservation.status,
    ) ||
      detail.data.reservation.paid > 0)
  )
    return (
      <ErrorState
        error={
          new Error(
            'This reservation is locked. Contact support to request a change.',
          )
        }
      />
    )
  const c = catalog.data!
  const estimated = estimateBooking(
    c,
    values,
    weddingConfiguration.data || null,
  )
  const displayedQuote = step === 3 ? quote : estimated
  return (
    <>
      <PageHeading title="Let’s plan your celebration." eyebrow="MAKE IT YOURS">
        A few thoughtful choices. A celebration to remember.
      </PageHeading>
      {detail.data && !selected && (
        <div className="alert">
          <p>
            This draft uses an archived menu. Choose one of the current set
            menus and update your guest count before continuing. Your saved
            quote remains available in the reservation details.
          </p>
        </div>
      )}
      <div className="wizard-steps">
        {['The occasion', 'Your menu', 'The details', 'Review & confirm'].map(
          (label, i) => (
            <button
              key={label}
              type="button"
              disabled={i > step || !id}
              className={i === step ? 'current' : i < step ? 'complete' : ''}
              onClick={() =>
                navigate(
                  `/customer/reservations/${id}/${['edit', 'menu', 'event-setup', 'confirm'][i]}`,
                )
              }
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              {label}
            </button>
          ),
        )}
      </div>
      <div className="wizard-layout">
        <section className="panel">
          <form
            className="form"
            noValidate
            onSubmit={handleSubmit(async (v) => {
              const fields: [Parameters<typeof form.setFocus>[0], string][] = []
              if (!v.consent_accepted)
                fields.push([
                  'consent_accepted',
                  'Accept the current Terms and Privacy Notice.',
                ])
              if (!validMobile(v.address.contact))
                fields.push([
                  'address.contact',
                  'Enter a valid Philippine mobile number.',
                ])
              for (const key of [
                'province_code',
                'city_code',
                'barangay_code',
                'street',
              ] as const)
                if (!v.address[key])
                  fields.push([
                    `address.${key}`,
                    'Complete this event location field.',
                  ])
              if (!selected)
                fields.push(['menu_set_id', 'Choose a current set menu.'])
              if (
                selected &&
                (v.guests < (selected.min_guests || 1) ||
                  v.guests > (selected.max_guests || 10000))
              )
                fields.push([
                  'guests',
                  `Choose ${selected.min_guests}–${selected.max_guests || 10000} guests.`,
                ])
              const upgraded =
                (c.chair_types.find((chair) => chair.id === v.chair_type_id)
                  ?.price || 0) > 0
              if (
                upgraded &&
                (!Number.isInteger(v.elegant_chair_quantity) ||
                  v.elegant_chair_quantity < 1 ||
                  v.elegant_chair_quantity > v.guests)
              )
                fields.push([
                  'elegant_chair_quantity',
                  'Choose a whole chair count from 1 to your guest count.',
                ])
              if (
                upgraded &&
                v.elegant_chair_quantity < v.guests &&
                !c.chair_types.some(
                  (chair) => chair.name === 'Monoblock' && chair.price === 0,
                )
              )
                fields.push([
                  'chair_type_id',
                  'Included Monoblock seating is currently unavailable. Contact support.',
                ])
              if (step === 1) {
                if (v.dish_ids.length !== selected?.dish_count)
                  fields.push([
                    'dish_ids',
                    `Choose exactly ${selected?.dish_count} dishes.`,
                  ])
                if (!v.drink_id) fields.push(['drink_id', 'Choose one drink.'])
                if (!v.dessert_id)
                  fields.push(['dessert_id', 'Choose one dessert.'])
              }
              if (step === 2) {
                if (!v.setup_id)
                  fields.push(['setup_id', 'Choose an event setup.'])
                if (!v.table_type_id)
                  fields.push(['table_type_id', 'Choose the table shape.'])
                if (includedSeating && !v.chair_type_id)
                  fields.push(['chair_type_id', 'Choose guest seating.'])
              }
              if (fields.length) {
                fields.forEach(([key, message]) =>
                  form.setError(key, { type: 'manual', message }),
                )
                form.setFocus(fields[0][0])
                return
              }
              try {
                const availability = await rpc<BookingWindow>(
                  'booking_window',
                  { day: v.event_date, rid: id || null },
                )
                if (!validWindowTime(availability, v.event_time)) {
                  form.setError('event_time', {
                    type: 'manual',
                    message:
                      availability.reason ||
                      'Choose a start time within the configured hours.',
                  })
                  form.setFocus('event_time')
                  return
                }
              } catch {
                form.setError('event_time', {
                  type: 'manual',
                  message:
                    'Could not verify this event date/time. Retry before continuing.',
                })
                return
              }
              save.mutate(v)
            })}
          >
            {step === 0 && (
              <>
                <h2>Tell us about the occasion.</h2>
                <label>
                  Event name
                  <input
                    placeholder="e.g. Maria’s birthday celebration"
                    {...register('event_name')}
                  />
                  {errors.event_name && (
                    <small className="field-error">
                      {errors.event_name.message}
                    </small>
                  )}
                </label>
                <div className="form-grid">
                  <label>
                    Event date
                    <input
                      type="date"
                      min={earliestEventDate()}
                      aria-describedby="booking-date-help"
                      aria-invalid={!!errors.event_date}
                      {...register('event_date')}
                    />
                    <small id="booking-date-help" className="date-help">
                      Please book at least 3 days ahead for preparation.
                      Earliest date: {date(earliestEventDate())} (Manila).
                    </small>
                    {errors.event_date && (
                      <span className="field-error">
                        {errors.event_date.message}
                      </span>
                    )}
                  </label>
                  <div>
                    <EventTimeSelect
                      day={values.event_date}
                      rid={id}
                      value={values.event_time}
                      inputRef={register('event_time').ref}
                      onChange={(value) =>
                        form.setValue('event_time', value, {
                          shouldDirty: true,
                        })
                      }
                    />
                    {errors.event_time && (
                      <span className="field-error">
                        {errors.event_time.message}
                      </span>
                    )}
                  </div>
                  <label>
                    Number of guests
                    <input
                      type="number"
                      min={selected?.min_guests || 1}
                      max={selected?.max_guests || 10000}
                      {...register('guests', { valueAsNumber: true })}
                    />
                    {errors.guests && (
                      <span className="field-error">
                        {errors.guests.message}
                      </span>
                    )}
                    {values.elegant_chair_quantity > values.guests && (
                      <span className="field-error">
                        Your saved Elegant Chair count exceeds the new guest
                        count. Reduce it below.
                      </span>
                    )}
                  </label>
                  {values.elegant_chair_quantity > values.guests && (
                    <label>
                      Adjust Elegant Chair count
                      <input
                        type="number"
                        min={1}
                        max={values.guests}
                        {...register('elegant_chair_quantity', {
                          valueAsNumber: true,
                        })}
                      />
                    </label>
                  )}
                </div>
                <Select
                  label="Set menu"
                  error={errors.menu_set_id?.message}
                  items={c.menu_sets}
                  register={register('menu_set_id')}
                  priced
                  unit=" / guest"
                />
                {!!selected?.inclusions?.length && (
                  <div className="menu-inclusions">
                    <strong>Included in your menu</strong>
                    <p>{selected.inclusions.join(' · ')}</p>
                    <small>
                      {selected.min_guests}–{selected.max_guests} guests.
                      Seating and event upgrades are optional additions.
                    </small>
                  </div>
                )}
                <label>
                  Occasion type
                  <select {...register('event_preferences.occasion_type')}>
                    <option value="other">Gathering / other occasion</option>
                    <option value="birthday">Birthday</option>
                    <option value="wedding">Wedding</option>
                  </select>
                </label>
                <LocationFields form={form} />
                <ConsentField form={form} />
              </>
            )}
            {step === 1 && (
              <>
                <h2>A menu everyone will love.</h2>
                <p>
                  Choose exactly <strong>{selected?.dish_count}</strong> dishes.{' '}
                  <span className="badge">
                    {values.dish_ids.length} selected
                  </span>
                </p>
                {!!selected?.suggested_dishes?.length && (
                  <div className="suggested-menu">
                    <strong>Suggested dishes for {selected.name}</strong>
                    <p>
                      {selected.suggested_dishes
                        .map((choices) => choices.join(' or '))
                        .join(' · ')}
                    </p>
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => {
                        const dishes = selected
                          .suggested_dishes!.map(
                            (choices) =>
                              c.dishes.find((dish) =>
                                choices.includes(dish.name),
                              )?.id,
                          )
                          .filter((dish): dish is string => !!dish)
                        form.setValue('dish_ids', [...new Set(dishes)], {
                          shouldDirty: true,
                        })
                      }}
                    >
                      Use suggested dishes
                    </button>
                    <small>
                      You may change any dish using the choices below.
                    </small>
                  </div>
                )}
                <div className="menu-filters">
                  <label>
                    Find a dish
                    <input
                      type="search"
                      value={foodSearch}
                      placeholder="Search chicken, beef, seafood…"
                      onChange={(event) => setFoodSearch(event.target.value)}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={foodCategory}
                      onChange={(event) => setFoodCategory(event.target.value)}
                    >
                      <option value="all">All categories</option>
                      {c.menu_categories.map((category) => (
                        <option value={category.id} key={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="selection-grid">
                  {c.dishes
                    .filter(
                      (dish) =>
                        (foodCategory === 'all' ||
                          dish.category_id === foodCategory) &&
                        dish.name
                          .toLowerCase()
                          .includes(foodSearch.toLowerCase().trim()),
                    )
                    .map((d) => (
                      <label className="selection" key={d.id}>
                        <input
                          type="checkbox"
                          value={d.id}
                          disabled={
                            !values.dish_ids.includes(d.id) &&
                            values.dish_ids.length >=
                              (selected?.dish_count || 0)
                          }
                          {...register('dish_ids')}
                        />
                        <span>
                          <strong>{d.name}</strong>
                          <small>
                            {
                              c.menu_categories.find(
                                (x) => x.id === d.category_id,
                              )?.name
                            }
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
                <div className="form-grid">
                  <Select
                    label="Drink"
                    error={errors.drink_id?.message}
                    items={c.drinks}
                    register={register('drink_id')}
                  />
                  <Select
                    label="Dessert"
                    error={errors.dessert_id?.message}
                    items={c.desserts}
                    register={register('dessert_id')}
                  />
                </div>
                <p className="date-help">
                  One drink and one dessert are included in the per-head menu
                  price.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <h2>It’s all in the details.</h2>
                <label>
                  Buffet / event setup
                  <select
                    {...register('setup_id')}
                    onChange={(e) => {
                      form.setValue('setup_id', e.target.value, {
                        shouldDirty: true,
                      })
                      const setup = c.event_setups.find(
                        (item) => item.id === e.target.value,
                      )
                      if (
                        setup?.setup_kind === 'birthday' ||
                        setup?.setup_kind === 'wedding'
                      )
                        form.setValue(
                          'event_preferences.occasion_type',
                          setup.setup_kind,
                          { shouldDirty: true },
                        )
                      form.setValue(
                        'event_preferences.setup_inclusions',
                        setup?.setup_kind === 'birthday'
                          ? birthdayKeys
                          : setup?.setup_kind === 'wedding'
                            ? weddingKeys
                            : [],
                        { shouldDirty: true },
                      )
                    }}
                  >
                    <option value="">Select setup</option>
                    {c.event_setups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ·{' '}
                        {item.price
                          ? money(item.price) + ' full bundle'
                          : 'Included'}
                      </option>
                    ))}
                  </select>
                </label>
                <EventPreferenceFields
                  form={form}
                  setup={c.event_setups.find(
                    (item) => item.id === values.setup_id,
                  )}
                  weddingPrices={weddingConfiguration.data || null}
                />
                {weddingConfiguration.error && (
                  <ErrorState
                    error={weddingConfiguration.error}
                    retry={() => void weddingConfiguration.refetch()}
                  />
                )}
                <h3>A little extra magic</h3>
                <div className="selection-grid">
                  {c.event_features
                    .filter(
                      (feature) =>
                        !feature.required_setup_id ||
                        feature.required_setup_id === values.setup_id,
                    )
                    .map((f) => (
                      <label className="selection" key={f.id}>
                        <input
                          type="checkbox"
                          value={f.id}
                          {...register('feature_ids')}
                        />
                        <span>
                          <strong>{f.name}</strong>
                          <small>{money(f.price || 0)}</small>
                        </span>
                      </label>
                    ))}
                </div>
                <h3>Optional add-ons</h3>
                {!c.add_ons.length && (
                  <p className="date-help">
                    No quantity-based add-ons are currently published. You can
                    choose the available optional event features above.
                  </p>
                )}
                {c.add_ons.map((a) => (
                  <label className="quantity-row" key={a.id}>
                    <span>
                      {a.name}
                      <small>
                        {money(a.price || 0)} each ·{' '}
                        {a.description || 'Optional add-on'}
                      </small>
                    </span>
                    <input
                      aria-label={a.name + ' quantity'}
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={0}
                      {...register(`addon_quantities.${a.id}`, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.addon_quantities?.[a.id]?.message && (
                      <small className="field-error">
                        {errors.addon_quantities[a.id]?.message}
                      </small>
                    )}
                  </label>
                ))}
                <h3>A place for everyone</h3>
                <div className="form-grid">
                  <Select
                    label="Table type"
                    error={errors.table_type_id?.message}
                    items={c.table_types}
                    register={register('table_type_id')}
                  />
                </div>
                {includedSeating ? (
                  <>
                    <p>
                      Round and long tables are included. Monoblock chairs are
                      included for all {values.guests} guests.
                    </p>
                    <label>
                      Guest chair type
                      <select
                        {...register('chair_type_id')}
                        onChange={(e) => {
                          form.setValue('chair_type_id', e.target.value, {
                            shouldDirty: true,
                          })
                          form.setValue(
                            'elegant_chair_quantity',
                            (c.chair_types.find(
                              (chair) => chair.id === e.target.value,
                            )?.price || 0) > 0
                              ? Math.max(values.elegant_chair_quantity, 1)
                              : 0,
                            { shouldDirty: true },
                          )
                        }}
                      >
                        <option value="">Choose guest seating</option>
                        {c.chair_types.map((chair) => (
                          <option value={chair.id} key={chair.id}>
                            {chair.name} ·{' '}
                            {chair.price
                              ? money(chair.price) + ' per selected chair'
                              : 'Included'}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(c.chair_types.find(
                      (chair) => chair.id === values.chair_type_id,
                    )?.price || 0) > 0 && (
                      <label>
                        Number of Elegant Chairs
                        <input
                          type="number"
                          step={1}
                          min={1}
                          max={values.guests}
                          {...register('elegant_chair_quantity', {
                            valueAsNumber: true,
                          })}
                          aria-invalid={!!errors.elegant_chair_quantity}
                        />
                        {errors.elegant_chair_quantity && (
                          <span className="field-error">
                            {errors.elegant_chair_quantity.message}
                          </span>
                        )}
                        <small className="date-help">
                          {Math.max(
                            values.guests - values.elegant_chair_quantity,
                            0,
                          )}{' '}
                          remaining guests use included Monoblock chairs. This
                          is separate from fixed event setup inclusions.
                        </small>
                      </label>
                    )}
                    <p className="date-help">
                      Upgrade prices apply only to the selected guest chair
                      quantity.
                      {values.chair_type_id &&
                        ` Chair upgrade total: ${money((c.chair_types.find((chair) => chair.id === values.chair_type_id)?.price || 0) * values.elegant_chair_quantity)}.`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Your first {values.guests} chairs are included. Extra
                      chairs are charged by type, starting with the
                      highest-priced type.
                    </p>
                    {c.chair_types.map((a) => (
                      <label className="quantity-row" key={a.id}>
                        <span>
                          {a.name}
                          <small>{money(a.price || 0)} per extra chair</small>
                        </span>
                        <input
                          aria-label={a.name + ' chair quantity'}
                          type="number"
                          min={0}
                          max={10000}
                          defaultValue={0}
                          {...register(`chair_quantities.${a.id}`, {
                            valueAsNumber: true,
                          })}
                        />
                      </label>
                    ))}
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <h2>Here’s to your celebration.</h2>
                <div className="review-summary">
                  <h3>{values.event_name}</h3>
                  <p>
                    {date(values.event_date)} · {timeLabel(values.event_time)}{' '}
                    Manila · {values.guests} guests
                  </p>
                  <p>
                    {Object.entries(values.address)
                      .filter(([k]) =>
                        ['street', 'barangay', 'city', 'province'].includes(k),
                      )
                      .map(([, v]) => v)
                      .join(', ')}
                  </p>
                  <h3>{selected?.name}</h3>
                  <p>
                    {c.dishes
                      .filter((d) => values.dish_ids.includes(d.id))
                      .map((d) => d.name)
                      .join(' · ')}
                  </p>
                  <p>
                    {c.drinks.find((d) => d.id === values.drink_id)?.name} ·{' '}
                    {c.desserts.find((d) => d.id === values.dessert_id)?.name}
                  </p>
                  <p>
                    {c.event_setups.find((d) => d.id === values.setup_id)?.name}
                  </p>
                  <p>
                    Event contact: <strong>{values.address.contact}</strong>
                  </p>
                  <p>
                    Theme: {values.event_preferences.theme || 'No preference'} ·
                    Colors: {values.event_preferences.colors || 'No preference'}
                    {values.event_preferences.celebrant_age
                      ? ' · Celebrant age: ' +
                        values.event_preferences.celebrant_age
                      : ''}
                  </p>
                  <p>
                    Setup inclusions:{' '}
                    {values.event_preferences.setup_inclusions
                      .map(
                        (key) =>
                          setupItems.find((item) => item.key === key)?.label ||
                          key,
                      )
                      .join(', ') || 'None selected'}
                  </p>
                  <p>
                    Optional extras:{' '}
                    {c.event_features
                      .filter((item) => values.feature_ids.includes(item.id))
                      .map((item) => item.name)
                      .join(', ') || 'None'}
                  </p>
                  <p>
                    Add-ons:{' '}
                    {c.add_ons
                      .filter((item) => values.addon_quantities[item.id] > 0)
                      .map(
                        (item) =>
                          item.name + ' × ' + values.addon_quantities[item.id],
                      )
                      .join(', ') || 'None'}
                  </p>
                  {includedSeating && (
                    <p>
                      {
                        c.table_types.find(
                          (table) => table.id === values.table_type_id,
                        )?.name
                      }{' '}
                      ·{' '}
                      {
                        c.chair_types.find(
                          (chair) => chair.id === values.chair_type_id,
                        )?.name
                      }{' '}
                      · {values.elegant_chair_quantity || values.guests} chairs
                      {values.elegant_chair_quantity > 0
                        ? `; ${values.guests - values.elegant_chair_quantity} included Monoblock chairs`
                        : ''}
                    </p>
                  )}
                </div>
                <div className="alert">
                  <ShieldCheck />
                  <p>
                    Review your server-calculated quote. Finalizing sends your
                    booking for review. Payment and date confirmation follow.
                  </p>
                </div>
                <p>
                  Consent version:{' '}
                  {detail.data?.reservation.consent_version || 'Not recorded'}.{' '}
                  <Link to="/terms" target="_blank">
                    Terms
                  </Link>{' '}
                  ·{' '}
                  <Link to="/privacy" target="_blank">
                    Privacy
                  </Link>
                </p>
                {!values.consent_accepted && (
                  <p className="field-error">
                    Return to The occasion to accept the current policies.
                  </p>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={finalize.isPending || !values.consent_accepted}
                  onClick={() => finalize.mutate()}
                >
                  {finalize.isPending
                    ? 'Finalizing…'
                    : 'Finalize my reservation'}
                  <Check size={17} />
                </button>
                {finalize.error && <ErrorState error={finalize.error} />}
              </>
            )}
            {save.error && <ErrorState error={save.error} />}{' '}
            {Object.keys(errors).length > 0 && (
              <p className="field-error" role="alert">
                Please complete the required event details with valid
                quantities.
              </p>
            )}
            <div className="wizard-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    navigate(
                      `/customer/reservations/${id}/${['edit', 'menu', 'event-setup'][step - 1]}`,
                    )
                  }
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  className="button"
                  disabled={
                    save.isPending || (step === 2 && estimated === null)
                  }
                >
                  {save.isPending ? 'Saving…' : 'Save & continue'}
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </form>
        </section>
        <aside className="quote-panel">
          <span className="eyebrow">YOUR CELEBRATION AT A GLANCE</span>
          <h3>{selected?.name || 'Your perfect package'}</h3>
          <p>
            {values.guests} guests
            {selected ? ' · ' + money(selected.price || 0) + ' / guest' : ''}
          </p>
          {!!selected?.inclusions?.length && (
            <p className="date-help">
              Basic tables, Monoblock chairs and simple buffet setup included.
            </p>
          )}
          {includedSeating && values.chair_type_id && (
            <p className="date-help">
              Guest chair upgrade: {values.elegant_chair_quantity} selected
              chairs ×{' '}
              {money(
                c.chair_types.find((chair) => chair.id === values.chair_type_id)
                  ?.price || 0,
              )}{' '}
              each. Remaining Monoblock seating is included.
            </p>
          )}
          {displayedQuote ? (
            <>
              <hr />
              {Object.entries(displayedQuote)
                .filter(([k]) => k !== 'total')
                .map(([k, v]) => (
                  <div className="price-line" key={k}>
                    <span>{human(k)}</span>
                    <strong>{money(v)}</strong>
                  </div>
                ))}
              <div className="price-total">
                <span>
                  {step === 3 ? 'Server-calculated total' : 'Current estimate'}
                </span>
                <strong>{money(displayedQuote.total)}</strong>
              </div>
              <small>
                {step === 3
                  ? 'Finalization recalculates this quote using the current catalog.'
                  : 'This estimate updates as you choose. Save & continue to obtain a server-checked quote.'}
              </small>
            </>
          ) : (
            <div className="quote-placeholder">
              <UtensilsIcon />
              <p>
                {(c.chair_types.find(chair=>chair.id===values.chair_type_id)?.price||0)>0&&(!Number.isInteger(values.elegant_chair_quantity)||values.elegant_chair_quantity<1||values.elegant_chair_quantity>values.guests)?'Choose a whole Elegant Chair quantity between 1 and your guest count. The quote is paused until corrected.':'Choose a current menu and setup. Partial wedding pricing remains pending until configured.'}
              </p>
            </div>
          )}
          <Link className="text-button" to="/customer/support">
            Need a helping hand? <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
    </>
  )
}
function UtensilsIcon() {
  return <span className="empty-icon">✧</span>
}
