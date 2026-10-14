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
import { places } from '../services/psgc'
import { ErrorState, Loading, PageHeading } from '../components/ui'
import type { CatalogItem } from '../types'
const schema = z.object({
  event_name: z.string().min(2).max(150),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose an event date').refine((value) => value >= earliestEventDate(), 'Choose a date at least 3 days ahead for preparation'),
  event_time: z.string().min(5),
  guests: z.number().int().min(1).max(10000),
  menu_set_id: z.string().min(1, 'Choose a package'),
  drink_id: z.string(),
  dessert_id: z.string(),
  setup_id: z.string(),
  dish_ids: z.array(z.string()),
  feature_ids: z.array(z.string()),
  table_type_id: z.string(),
  table_quantity: z.number().int().min(0).max(1000),
  chair_quantities: z.record(z.string(), z.number().int().min(0).max(10000)),
  chair_type_id: z.string(),
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
type Values = z.infer<typeof schema>
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
  table_quantity: 10,
  chair_quantities: {},
  chair_type_id: '',
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
function LocationFields({ form }: { form: UseFormReturn<Values> }) {
  const { register, control, setValue } = form
  const province = useWatch({ control, name: 'address.province_code' }),
    city = useWatch({ control, name: 'address.city_code' })
  const provinces = useQuery({
    queryKey: ['psgc', 'provinces'],
    queryFn: () => places('provinces'),
    staleTime: 86400000,
  })
  const cities = useQuery({
    queryKey: ['psgc', 'cities', province],
    enabled: !!province,
    queryFn: () =>
      places(
        province === '130000000'
          ? 'regions/130000000/cities-municipalities'
          : `provinces/${province}/cities-municipalities`,
      ),
    staleTime: 86400000,
  })
  const barangays = useQuery({
    queryKey: ['psgc', 'barangays', city],
    enabled: !!city,
    queryFn: () => places(`cities-municipalities/${city}/barangays`),
    staleTime: 86400000,
  })
  return (
    <>
      <div className="form-grid">
        <label>
          Province / region
          <select
            value={province}
            disabled={provinces.isPending}
            onChange={(e) => {
              setValue('address.province_code', e.target.value)
              setValue('address.province', e.target.selectedOptions[0].text)
              setValue('address.city', '')
              setValue('address.city_code', '')
              setValue('address.barangay', '')
              setValue('address.barangay_code', '')
            }}
          >
            <option value="">
              {provinces.isPending ? 'Loading locations…' : 'Select province'}
            </option>
            <option value="130000000">Metro Manila (NCR)</option>
            {provinces.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          City / municipality
          <select
            disabled={!province || cities.isFetching}
            value={city}
            onChange={(e) => {
              setValue('address.city_code', e.target.value)
              setValue('address.city', e.target.selectedOptions[0].text)
              setValue('address.barangay', '')
              setValue('address.barangay_code', '')
            }}
          >
            <option value="">{cities.isFetching ? 'Loading…' : 'Select city'}</option>
            {cities.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Barangay
          <select
            disabled={!city || barangays.isFetching}
            {...register('address.barangay_code')}
            onChange={(e) => {
              setValue('address.barangay_code', e.target.value)
              setValue('address.barangay', e.target.selectedOptions[0].text)
            }}
          >
            <option value="">{barangays.isFetching ? 'Loading…' : 'Select barangay'}</option>
            {barangays.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(provinces.isError || cities.isError || barangays.isError) && (
        <div className="alert">
          <p>
            The location directory is unavailable. Enter the resolved names below, or retry the
            directory.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              void provinces.refetch()
              if (province) void cities.refetch()
              if (city) void barangays.refetch()
            }}
          >
            Retry directory
          </button>
        </div>
      )}
      <details>
        <summary>Review location names / enter address manually</summary>
        <div className="form-grid">
          <label>
            Province name
            <input {...register('address.province')} />
          </label>
          <label>
            City name
            <input {...register('address.city')} />
          </label>
          <label>
            Barangay name
            <input {...register('address.barangay')} />
          </label>
        </div>
      </details>
      <label>
        Street, building & venue
        <input placeholder="House / building, street, venue name" {...register('address.street')} />
      </label>
      <div className="form-grid">
        <label>
          Event contact number
          <input type="tel" placeholder="09XX XXX XXXX" {...register('address.contact')} />
        </label>
        <label>
          Dietary needs & notes
          <textarea
            placeholder="Allergies, access instructions, special requests…"
            {...register('address.notes')}
          />
        </label>
      </div>
    </>
  )
}
function Select({
  items,
  register,
  label,
  priced = false,
  unit = '',
}: {
  items: CatalogItem[]
  register: ReturnType<UseFormReturn<Values>['register']>
  label: string
  priced?: boolean
  unit?: string
}) {
  return (
    <label>
      {label}
      <select {...register}>
        <option value="">Select {label.toLowerCase()}</option>
        {items.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {priced ? ' · ' + (p.price ? money(p.price) + unit : 'Included') : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
export function ReservationWizard() {
  const { id } = useParams()
  const location = useLocation(),
    navigate = useNavigate(),
    qc = useQueryClient()
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
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial })
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
    if (detail.data && initialized.current !== id) {
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
        feature_ids: c.reservation_event_features.map((x) => String(x.event_feature_id)),
        table_type_id: String(seating[0]?.table_type_id || ''),
        chair_type_id: String(seating[0]?.chair_type_id || ''),
        table_quantity: seating.reduce((s, x) => s + Number(x.table_quantity), 0) || 10,
        chair_quantities: Object.fromEntries(
          seating.map((x) => [x.chair_type_id, Number(x.chair_quantity)]),
        ),
        addon_quantities: Object.fromEntries(
          c.reservation_add_ons.map((x) => [x.add_on_id, Number(x.quantity)]),
        ),
        address: { ...defaults.address, ...r.address },
      })
    }
  }, [detail.data, id, reset])
  const values = useWatch({ control: form.control }) as Values
  const selected = catalog.data?.menu_sets.find((p) => p.id === values.menu_set_id)
  const includedSeating = selected?.pricing_version === 2
  useEffect(() => {
    if (!catalog.data) return
    const valid = values.feature_ids.filter((id) => {
      const feature = catalog.data?.event_features.find((item) => item.id === id)
      return !!feature && (!feature.required_setup_id || feature.required_setup_id === values.setup_id)
    })
    if (valid.length !== values.feature_ids.length) form.setValue('feature_ids', valid, { shouldDirty: true })
    const dishes = values.dish_ids.filter((id) => catalog.data!.dishes.some((dish) => dish.id === id))
    if (dishes.length !== values.dish_ids.length) form.setValue('dish_ids', dishes, { shouldDirty: true })
    const choices = { drink_id: 'drinks', dessert_id: 'desserts', setup_id: 'event_setups', table_type_id: 'table_types', chair_type_id: 'chair_types' } as const
    for (const field of Object.keys(choices) as (keyof typeof choices)[]) {
      if (values[field] && !catalog.data[choices[field]].some((item) => item.id === values[field])) form.setValue(field, '', { shouldDirty: true })
    }
  }, [values, catalog.data, form])
  const save = useMutation({
    mutationFn: async (v: Values) => {
      if (!selected) throw new Error('Choose a current set menu before continuing.')
      if (selected && v.guests < (selected.min_guests || 1))
        throw new Error(`This package requires at least ${selected.min_guests} guests.`)
      if (selected?.max_guests && v.guests > selected.max_guests)
        throw new Error(`This menu allows at most ${selected.max_guests} guests.`)
      if (
        step === 1 &&
        (v.dish_ids.length !== selected?.dish_count || !v.drink_id || !v.dessert_id)
      )
        throw new Error(`Choose exactly ${selected?.dish_count} dishes, a drink and dessert.`)
      if (
        step === 2 &&
        (!v.setup_id ||
          !v.table_type_id ||
          (includedSeating ? !v.chair_type_id : Object.values(v.chair_quantities).reduce((s, q) => s + q, 0) < v.guests))
      )
        throw new Error(includedSeating ? 'Choose a buffet/event setup, table type and guest chair type.' : 'Choose your setup, table type and enough chairs for your guests.')
      const rid = await rpc<string>('save_reservation', {
        data: {
          ...v,
          id,
          chairs: includedSeating
            ? (v.chair_type_id ? [{ id: v.chair_type_id, quantity: v.guests }] : [])
            : Object.entries(v.chair_quantities)
            .filter(([, q]) => q > 0)
            .map(([key, q]) => ({ id: key, quantity: q })),
          add_ons: Object.entries(v.addon_quantities)
            .filter(([key, q]) => q > 0 && catalog.data!.add_ons.some((item) => item.id === key))
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
  if (catalog.error || detail.error) return <ErrorState error={catalog.error || detail.error} />
  if (
    detail.data &&
    (!['draft', 'pending', 'for_approval'].includes(detail.data.reservation.status) ||
      detail.data.reservation.paid > 0)
  )
    return (
      <ErrorState
        error={new Error('This reservation is locked. Contact support to request a change.')}
      />
    )
  const c = catalog.data!
  return (
    <>
      <PageHeading title="Let’s plan your celebration." eyebrow="MAKE IT YOURS">
        A few thoughtful choices. A celebration to remember.
      </PageHeading>
      {detail.data && !selected && <div className="alert"><p>This draft uses an archived menu. Choose one of the current set menus and update your guest count before continuing. Your saved quote remains available in the reservation details.</p></div>}
      <div className="wizard-steps">
        {['The occasion', 'Your menu', 'The details', 'Review & confirm'].map((label, i) => (
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
        ))}
      </div>
      <div className="wizard-layout">
        <section className="panel">
          <form className="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
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
                    <small className="field-error">{errors.event_name.message}</small>
                  )}
                </label>
                <div className="form-grid">
                  <label>
                    Event date
                    <input type="date" min={earliestEventDate()} aria-describedby="booking-date-help" aria-invalid={!!errors.event_date} {...register('event_date')} />
                    <small id="booking-date-help" className="date-help">Please book at least 3 days ahead for preparation. Earliest date: {date(earliestEventDate())} (Manila).</small>
                    {errors.event_date && <span className="field-error">{errors.event_date.message}</span>}
                  </label>
                  <label>
                    Event time (Manila)
                    <input type="time" min="07:00" max="22:00" {...register('event_time')} />
                  </label>
                  <label>
                    Number of guests
                    <input
                      type="number"
                      min={selected?.min_guests || 1}
                      max={selected?.max_guests || 10000}
                      {...register('guests', { valueAsNumber: true })}
                    />
                  </label>
                </div>
                <Select
                  label="Set menu"
                  items={c.menu_sets}
                  register={register('menu_set_id')}
                  priced
                  unit=" / guest"
                />
                {!!selected?.inclusions?.length && <div className="menu-inclusions"><strong>Included in your menu</strong><p>{selected.inclusions.join(' · ')}</p><small>{selected.min_guests}–{selected.max_guests} guests. Seating and event upgrades are optional additions.</small></div>}
                <LocationFields form={form} />
              </>
            )}
            {step === 1 && (
              <>
                <h2>A menu everyone will love.</h2>
                <p>
                  Choose exactly <strong>{selected?.dish_count}</strong> dishes.{' '}
                  <span className="badge">{values.dish_ids.length} selected</span>
                </p>
                {!!selected?.suggested_dishes?.length && <div className="suggested-menu"><strong>Suggested dishes for {selected.name}</strong><p>{selected.suggested_dishes.map((choices) => choices.join(' or ')).join(' · ')}</p><button type="button" className="button secondary small" onClick={() => {
                  const dishes = selected.suggested_dishes!.map((choices) => c.dishes.find((dish) => choices.includes(dish.name))?.id).filter((dish): dish is string => !!dish)
                  form.setValue('dish_ids', [...new Set(dishes)], { shouldDirty: true })
                }}>Use suggested dishes</button><small>You may change any dish using the choices below.</small></div>}
                <div className="menu-filters"><label>Find a dish<input type="search" value={foodSearch} placeholder="Search chicken, beef, seafood…" onChange={(event) => setFoodSearch(event.target.value)} /></label><label>Category<select value={foodCategory} onChange={(event) => setFoodCategory(event.target.value)}><option value="all">All categories</option>{c.menu_categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div>
                <div className="selection-grid">
                  {c.dishes.filter((dish) => (foodCategory === 'all' || dish.category_id === foodCategory) && dish.name.toLowerCase().includes(foodSearch.toLowerCase().trim())).map((d) => (
                    <label className="selection" key={d.id}>
                      <input type="checkbox" value={d.id} disabled={!values.dish_ids.includes(d.id) && values.dish_ids.length >= (selected?.dish_count || 0)} {...register('dish_ids')} />
                      <span>
                        <strong>{d.name}</strong>
                        <small>{c.menu_categories.find((x) => x.id === d.category_id)?.name}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="form-grid">
                  <Select label="Drink" items={c.drinks} register={register('drink_id')} />
                  <Select label="Dessert" items={c.desserts} register={register('dessert_id')} />
                </div>
                <p className="date-help">One drink and one dessert are included in the per-head menu price.</p>
              </>
            )}
            {step === 2 && (
              <>
                <h2>It’s all in the details.</h2>
                <Select
                  label="Buffet / event setup"
                  items={c.event_setups}
                  register={register('setup_id')}
                  priced
                  unit=" / event"
                />
                <p className="date-help">{c.event_setups.find((setup) => setup.id === values.setup_id)?.description || 'Simple buffet setup is included. Birthday and wedding setups have an additional fixed event fee.'}</p>
                <h3>A little extra magic</h3>
                <div className="selection-grid">
                  {c.event_features.filter((feature) => !feature.required_setup_id || feature.required_setup_id === values.setup_id).map((f) => (
                    <label className="selection" key={f.id}>
                      <input type="checkbox" value={f.id} {...register('feature_ids')} />
                      <span>
                        <strong>{f.name}</strong>
                        <small>{money(f.price || 0)}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {!!c.add_ons.length && <h3>Optional add-ons</h3>}
                {c.add_ons.map((a) => (
                  <label className="quantity-row" key={a.id}>
                    <span>
                      {a.name}
                      <small>{money(a.price || 0)} each</small>
                    </span>
                    <input
                      aria-label={a.name + ' quantity'}
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={0}
                      {...register(`addon_quantities.${a.id}`, { valueAsNumber: true })}
                    />
                  </label>
                ))}
                <h3>A place for everyone</h3>
                <div className="form-grid">
                  <Select
                    label="Table type"
                    items={c.table_types}
                    register={register('table_type_id')}
                    priced
                  />
                  <label>
                    Number of tables
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      {...register('table_quantity', { valueAsNumber: true })}
                    />
                  </label>
                </div>
                {includedSeating ? <>
                  <p>Round and long tables are included. Monoblock chairs are included for all {values.guests} guests.</p>
                  <Select label="Guest chair type" items={c.chair_types} register={register('chair_type_id')} priced unit=" / guest" />
                  <p className="date-help">Chair prices shown are additional charges per guest. Your choice applies to all {values.guests} guests.{values.chair_type_id && ` Chair upgrade total: ${money((c.chair_types.find((chair) => chair.id === values.chair_type_id)?.price || 0) * values.guests)}.`}</p>
                </> : <><p className="muted">
                  Your first {values.guests} chairs are included. Extra chairs are charged by type,
                  starting with the highest-priced type.
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
                      {...register(`chair_quantities.${a.id}`, { valueAsNumber: true })}
                    />
                  </label>
                ))}</>}
              </>
            )}
            {step === 3 && (
              <>
                <h2>Here’s to your celebration.</h2>
                <div className="review-summary">
                  <h3>{values.event_name}</h3>
                  <p>
                    {date(values.event_date)} · {values.event_time} Manila · {values.guests} guests
                  </p>
                  <p>
                    {Object.entries(values.address)
                      .filter(([k]) => ['street', 'barangay', 'city', 'province'].includes(k))
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
                  <p>{c.event_setups.find((d) => d.id === values.setup_id)?.name}</p>
                  {includedSeating && <p>{c.table_types.find((table) => table.id === values.table_type_id)?.name} · {c.chair_types.find((chair) => chair.id === values.chair_type_id)?.name} for {values.guests} guests</p>}
                </div>
                <div className="alert">
                  <ShieldCheck />
                  <p>
                    Review your server-calculated quote. Finalizing sends your booking for review.
                    Payment and date confirmation follow.
                  </p>
                </div>
                <p>
                  By finalizing, you accept our{' '}
                  <Link to="/policies" target="_blank">
                    reservation and refund policies
                  </Link>
                  .
                </p>
                <button
                  type="button"
                  className="button"
                  disabled={finalize.isPending}
                  onClick={() => finalize.mutate()}
                >
                  {finalize.isPending ? 'Finalizing…' : 'Finalize my reservation'}
                  <Check size={17} />
                </button>
                {finalize.error && <ErrorState error={finalize.error} />}
              </>
            )}
            {save.error && <ErrorState error={save.error} />}{' '}
            {Object.keys(errors).length > 0 && (
              <p className="field-error" role="alert">
                Please complete the required event details with valid quantities.
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
                <button className="button" disabled={save.isPending}>
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
            {values.guests} guests{selected ? ' · ' + money(selected.price || 0) + ' / guest' : ''}
          </p>
          {!!selected?.inclusions?.length && <p className="date-help">Basic tables, Monoblock chairs and simple buffet setup included.</p>}
          {includedSeating && values.chair_type_id && <p className="date-help">Menu + selected chairs: {money((selected?.price || 0) + (c.chair_types.find((chair) => chair.id === values.chair_type_id)?.price || 0))} / guest. Event upgrades are added separately.</p>}
          {quote ? (
            <>
              <hr />
              {Object.entries(quote)
                .filter(([k]) => k !== 'total')
                .map(([k, v]) => (
                  <div className="price-line" key={k}>
                    <span>{human(k)}</span>
                    <strong>{money(v)}</strong>
                  </div>
                ))}
              <div className="price-total">
                <span>Server-calculated total</span>
                <strong>{money(quote.total)}</strong>
              </div>
              <small>
                Quote updates after Save & continue. Finalization recalculates using the current
                catalog.
              </small>
            </>
          ) : (
            <div className="quote-placeholder">
              <UtensilsIcon />
              <p>Save your occasion to get your first server-calculated quote.</p>
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
