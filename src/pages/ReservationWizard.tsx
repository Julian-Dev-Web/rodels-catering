import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import type { UseFormReturn, Resolver, FieldErrors, FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'
import { useCatalog } from '../features/catalog'
import { useReservation, useSavedDraft, type SavedDraft } from '../features/reservations'
import { useAuth } from '../features/auth'
import {
  bookingDraftKey,
  readBookingDraft,
  writeBookingDraft,
  clearBookingDraft,
  restorePersistedDraft,
} from '../lib/booking-draft'
import { rpc, supabase } from '../lib/supabase'
import { money, date, earliestEventDate } from '../lib/format'
import {
  LocationFields,
  EventPreferenceFields,
  ConsentField,
} from '../components/BookingFields'
import {
  defaultPreferences,
  birthdayKeys,
  weddingKeys,
  setupItemLabel,
  estimateBooking,
  POLICY_VERSION,
  validMobile,
} from '../lib/booking'
import { ErrorState, Loading, PageHeading } from '../components/ui'
import { FoodPhoto } from '../components/FoodPhoto'
import { AllergyFields, useAllergyWarnings } from '../components/AllergyFields'
import { FinancialBreakdown } from '../components/FinancialBreakdown'
import { MenuSelectionProgress } from '../components/MenuSelectionProgress'
import { bookingPriceLines, effectiveDiscount, financialQuote, type TaxPolicy } from '../lib/financial'
import type { AccountDiscountEligibility } from '../lib/account-discount'
import { EquipmentAvailability, type EquipmentAvailabilityRow } from '../components/EquipmentAvailability'
import {
  EventTimeSelect,
  validWindowTime,
  timeLabel,
  type BookingWindow,
} from '../components/EventTimeSelect'
import type { CatalogItem } from '../types'
import { bookingStepSchema, bookingFieldStep, bookingPayload, optionalQuantity, type Values } from '../lib/booking-validation'
export type { Values } from '../lib/booking-validation'
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
  allergy_allergen_ids: [],
  allergy_notes: '',
  allergy_acknowledgments: [],
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
  const { id, draftId } = useParams()
  const { profile } = useAuth()
  const draftKey = bookingDraftKey(profile?.id, draftId ? 'saved:'+draftId : id)
  const savedDraft = useSavedDraft(draftId)
  const reservationKey=id||savedDraft.data?.reservation_id||undefined
  const savedVersion = useRef<number|null>(null)
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
  const draftRevision = useRef<string | null>(null)
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
  const params = new URLSearchParams(location.search)
  const initial = {
    ...(!id && !draftId ? readBookingDraft(draftKey, defaults, null) : defaults),
    ...(params.has('date') ? { event_date: params.get('date')! } : {}),
    ...(params.has('package') ? { menu_set_id: params.get('package')! } : {}),
  }
  const form = useForm<Values>({
    resolver: (data,context,options)=>(zodResolver(bookingStepSchema(step,catalog.data,allergyWarnings)) as Resolver<Values>)(data,context,options),
    reValidateMode: 'onChange',
    defaultValues: initial,
  })
  useEffect(()=>{if(draftId&&savedDraft.data&&location.pathname==='/customer/drafts/'+draftId)navigate(`/customer/drafts/${draftId}/${['edit','menu','event-setup','confirm'][savedDraft.data.wizard_step]}`,{replace:true})},[draftId,savedDraft.data,location.pathname,navigate])
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = form
  useEffect(() => {
    if (!id && !draftId && initialized.current !== 'new') {
      const switchingFromSavedBooking = !!initialized.current
      initialized.current = 'new'
      draftRevision.current = null
      const restored = readBookingDraft(draftKey, defaults, null)
      const params = new URLSearchParams(location.search)
      if (switchingFromSavedBooking)
        reset({
          ...restored,
          ...(params.has('date') ? { event_date: params.get('date')! } : {}),
          ...(params.has('package')
            ? { menu_set_id: params.get('package')! }
            : {}),
        })
      setQuote(null)
    }
    if(draftId&&savedDraft.data&&initialized.current!=='saved:'+draftId){
      const d=savedDraft.data;initialized.current='saved:'+draftId;savedVersion.current=d.version;draftRevision.current=d.updated_at
      reset(readBookingDraft(draftKey,restorePersistedDraft(defaults,d.data),d.updated_at));setQuote(null)
    }
    if (detail.data && catalog.data && initialized.current !== id) {
      const { reservation: r, children: c } = detail.data
      const seating = c.reservation_tables_chairs
      initialized.current = id!
      draftRevision.current = r.updated_at
      setQuote(r.pricing)
      reset(
        readBookingDraft(
          draftKey,
          {
            ...defaults,
            event_name: r.event_name,
            event_date: r.event_date,
            event_time: r.event_time.slice(0, 5),
            guests: r.guests,
            menu_set_id: r.menu_set_id,
            drink_id: r.drink_id || '',
            dessert_id: r.dessert_id || '',
            setup_id: String(
              c.reservation_event_setups[0]?.event_setup_id || '',
            ),
            dish_ids: c.reservation_items.map((x) => String(x.dish_id)),
            allergy_allergen_ids: r.allergy_allergen_ids || [],
            allergy_notes: r.allergy_notes || '',
            allergy_acknowledgments: r.allergy_acknowledgments || [],
            feature_ids: c.reservation_event_features.map((x) =>
              String(x.event_feature_id),
            ),
            table_type_id: String(seating[0]?.table_type_id || ''),
            chair_type_id: String(
              seating.find(
                (row) =>
                  (catalog.data!.chair_types.find(
                    (c) => c.id === row.chair_type_id,
                  )?.price || 0) > 0,
              )?.chair_type_id ||
                seating[0]?.chair_type_id ||
                '',
            ),
            elegant_chair_quantity: Number(
              seating.find(
                (row) =>
                  (catalog.data!.chair_types.find(
                    (c) => c.id === row.chair_type_id,
                  )?.price || 0) > 0,
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
              c.reservation_add_ons.map((x) => [
                x.add_on_id,
                Number(x.quantity),
              ]),
            ),
            address: { ...defaults.address, ...r.address },
          },
          r.updated_at,
        ),
      )
    }
  }, [detail.data, catalog.data, id, draftId, savedDraft.data, reset, draftKey, location.search])
  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        if (initialized.current === (draftId ? 'saved:'+draftId : id || 'new'))
          writeBookingDraft(draftKey, values, draftRevision.current)
      },
    })
  }, [form, draftKey, id, draftId])
  useEffect(()=>{
    const issue=location.state?.bookingIssue as {path:FieldPath<Values>;message:string}|undefined
    if(!issue||!catalog.data||(id&&detail.isPending)||(draftId&&savedDraft.isPending))return
    form.setError(issue.path,{type:'manual',message:issue.message})
    requestAnimationFrame(()=>{const input=document.getElementsByName(issue.path)[0] as HTMLElement|undefined;input?.scrollIntoView({behavior:'smooth',block:'center'});input?.focus({preventScroll:true})})
    navigate(location.pathname+location.search,{replace:true,state:null})
  },[location.state,location.pathname,location.search,catalog.data,id,detail.isPending,draftId,savedDraft.isPending,form,navigate])
  const values = useWatch({ control: form.control }) as Values
  const persistDraft = useMutation({mutationFn:async({data,target}:{data:Values;target:number})=>rpc<SavedDraft>('save_booking_draft',{payload:bookingPayload(data),did:draftId||null,step:target,expected_version:savedVersion.current,existing_reservation:id||null}),onSuccess:(d,args)=>{
    savedVersion.current=d.version;draftRevision.current=d.updated_at
    qc.setQueryData(['saved-draft',d.id],d);void qc.invalidateQueries({queryKey:['saved-drafts']})
    writeBookingDraft(bookingDraftKey(profile?.id,'saved:'+d.id),args.data,d.updated_at)
    if(!draftId)clearBookingDraft(draftKey)
    navigate(`/customer/drafts/${d.id}/${['edit','menu','event-setup','confirm'][args.target]}`)
  }})
  const allergyWarnings = useAllergyWarnings(values.allergy_allergen_ids,values.allergy_notes,values.dish_ids)
  useEffect(()=>{
    if((step===1||step===3)&&form.getFieldState('allergy_acknowledgments').error&&!allergyWarnings.isFetching&&!allergyWarnings.error)void form.trigger('allergy_acknowledgments')
  },[step,allergyWarnings.data,allergyWarnings.isFetching,allergyWarnings.error,form])
  const taxPolicy = useQuery({queryKey:['tax-policy'],queryFn:()=>rpc<TaxPolicy>('tax_configuration')})
  const assignedDiscount = useQuery({queryKey:['assigned-discount',reservationKey],enabled:!!reservationKey,queryFn:async()=>{const r=await supabase.from('reservation_discounts').select('*').eq('reservation_id',reservationKey!).maybeSingle();if(r.error)throw r.error;return r.data}})
  const accountDiscount = useQuery({queryKey:['account-discount',profile?.id],enabled:!!profile?.id,refetchInterval:60000,queryFn:()=>rpc<AccountDiscountEligibility>('my_account_discount')})
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
          ...bookingPayload(v),
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
        .select('pricing,updated_at')
        .eq('id', rid)
        .single()
      if (error) throw error
      draftRevision.current = data.updated_at
      writeBookingDraft(bookingDraftKey(profile?.id, rid), v, data.updated_at)
      if (!id) clearBookingDraft(draftKey)
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
    mutationFn: async (v:Values) => {
      if(draftId){const d=await rpc<SavedDraft>('save_booking_draft',{payload:bookingPayload(v),did:draftId,step:3,expected_version:savedVersion.current});savedVersion.current=d.version;return rpc<string>('submit_booking_draft',{did:draftId,expected_version:d.version})}
      await rpc('finalize_reservation',{rid:id});return id!
    },
    onSuccess: (rid) => {
      clearBookingDraft(draftKey)
      void qc.invalidateQueries()
      navigate('/customer/reservations/' + rid)
    },
  })
  if (catalog.isPending || (id && detail.isPending) || (draftId&&savedDraft.isPending) || accountDiscount.isPending || taxPolicy.isPending || (reservationKey&&assignedDiscount.isPending)) return <Loading />
  if(accountDiscount.error||taxPolicy.error||assignedDiscount.error)return <ErrorState error={accountDiscount.error||taxPolicy.error||assignedDiscount.error}/>
  if (catalog.error || detail.error || savedDraft.error)
    return <ErrorState error={catalog.error || detail.error || savedDraft.error} />
  if(savedDraft.data?.submitted_at)return <section className="panel"><h2>This draft was already submitted.</h2><Link className="button" to={'/customer/reservations/'+savedDraft.data.reservation_id}>Open saved reservation</Link></section>
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
  let financialPreview = null
  try { if(estimated&&taxPolicy.data&&accountDiscount.data) financialPreview=financialQuote(estimated.total,effectiveDiscount(assignedDiscount.data,accountDiscount.data),taxPolicy.data) } catch { /* Keep incomplete drafts editable; validation runs on Next/finalize. */ }
  const financialSnapshot = step===3&&id ? detail.data?.reservation.financial_snapshot : financialPreview
  const rawQuote = step===3&&quote ? quote : estimated
  const displayedQuote = rawQuote&&Number.isSafeInteger(rawQuote.total) ? {...rawQuote,total:financialSnapshot?.total ?? rawQuote.total} : null
  const wizardPath = (target:number) => draftId ? `/customer/drafts/${draftId}/${['edit','menu','event-setup','confirm'][target]}` : `/customer/reservations/${id}/${['edit','menu','event-setup','confirm'][target]}`
  function focusErrors(errors:FieldErrors<Values>) {
    function first(value:unknown,prefix=''): {path:string;message:string}|null {
      if(!value||typeof value!=='object')return null
      const item=value as Record<string,unknown>
      if(typeof item.message==='string')return {path:prefix,message:item.message}
      for(const [key,child]of Object.entries(item)){if(key==='ref')continue;const found=first(child,prefix?prefix+'.'+key:key);if(found)return found}
      return null
    }
    const issue=first(errors);if(!issue)return
    const target=bookingFieldStep(issue.path)
    if(target>=0&&target!==step){navigate(wizardPath(target),{state:{bookingIssue:issue}});return}
    requestAnimationFrame(()=>{
      const input=[...document.getElementsByName(issue.path)].find(e=>!(e as HTMLInputElement).disabled) as HTMLElement|undefined
      const element=input||document.querySelector('.field-error')?.parentElement
      element?.scrollIntoView({behavior:'smooth',block:'center'})
      if(input)input.focus({preventScroll:true});else form.setFocus(issue.path as FieldPath<Values>)
    })
  }
  async function checkAvailability(v:Values,phase:number) {
    let errorField:'event_time'|'chair_type_id'='event_time'
              try {
                const chair=c.chair_types.find(chair=>chair.id===v.chair_type_id)
                if((phase===2||phase===3)&&includedSeating&&chair){
                  errorField='chair_type_id'
                  const stock=await rpc<EquipmentAvailabilityRow[]>('equipment_availability',{day:v.event_date,rid:id||null})
                  const upgraded=(chair.price||0)>0
                  const requests=[{id:chair.equipment_id,quantity:upgraded?v.elegant_chair_quantity:v.guests},...(upgraded&&v.guests>v.elegant_chair_quantity?[{id:c.chair_types.find(c=>c.name==='Monoblock')?.equipment_id,quantity:v.guests-v.elegant_chair_quantity}]:[])]
                  for(const request of requests){if(!request.id||!request.quantity)continue;const item=stock.find(i=>i.equipment_id===request.id);if(!item||item.total===null)throw new Error(`${item?.name||'Selected chair'} stock needs manager confirmation.`);if(!item.active||request.quantity>(item.available??0))throw new Error(`Only ${item.available??0} ${item.name} are available for this event date; ${request.quantity} requested. Review seating or choose another date.`)}
                }
                errorField='event_time'
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
                  focusErrors({event_time:{type:'manual',message:availability.reason||'Choose an available event time.'}})
                  return false
                }
              } catch (error) {
                const message=error instanceof Error?error.message:'Could not check availability. Please try again.'
                form.setError(errorField, {
                  type: 'manual',
                  message,
                })
                focusErrors({[errorField]:{type:'manual',message}})
                return false
              }

    return true
  }

  return (
    <>
      <PageHeading title="Let’s plan your celebration." eyebrow="MAKE IT YOURS">
        A few thoughtful choices. A celebration to remember.
      </PageHeading>
      {accountDiscount.data?.status==='RESERVED'&&accountDiscount.data.reserved_reservation_id!==reservationKey&&<p className="account-offer">Your one-time offer is held for an unfinished checkout. <Link to={'/customer/reservations/'+accountDiscount.data.reserved_reservation_id}>Open that booking</Link> to pay or safely close the checkout. Other bookings use their own current quote.</p>}
      {accountDiscount.data?.status==='USED'&&<p className="date-help">Your one-time account offer was already used. Its original booking keeps the agreed total for balance payments.</p>}
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
              disabled={i > step || (!id&&!draftId)}
              className={i === step ? 'current' : i < step ? 'complete' : ''}
              onClick={() =>
                navigate(
                  wizardPath(i),
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
              if(!await checkAvailability(v,step))return
              if(!id)persistDraft.mutate({data:v,target:Math.min(step+1,3)})
              else save.mutate(v)
            },focusErrors)}
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
                          shouldDirty: true, shouldValidate: true,
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
                <MenuSelectionProgress dishes={values.dish_ids} required={selected?.dish_count||0} drink={values.drink_id}/>
                <h2>A menu everyone will love.</h2>
                <p>
                  Choose exactly <strong>{selected?.dish_count}</strong> dishes.{' '}
                  <span className="badge">
                    {values.dish_ids.length} selected
                  </span>
                </p>
                <p className="date-help">Changing the set menu keeps your choices. Adjust them to the dish count shown above before continuing.</p>
                {errors.dish_ids&&<p className="field-error" role="alert">{errors.dish_ids.message}</p>}
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
                <p className="food-photo-notice">Representative photos; actual servings may differ. <Link to="/food-photo-credits" target="_blank" rel="noopener noreferrer">Photo credits</Link></p>
                <AllergyFields form={form} dishes={c.dishes}/>
                <div className="selection-grid food-choice-grid">
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
                      <label className="selection food-choice" key={d.id}>
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
                        <FoodPhoto item={d} kind="dishes" />
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
                {(['drinks','desserts'] as const).map(kind => {
                  const name = kind === 'drinks' ? 'drink_id' : 'dessert_id'
                  return <fieldset className="food-options" key={kind}><legend>{kind === 'drinks' ? 'Choose your drink' : 'Choose your dessert'}</legend><div className="selection-grid food-choice-grid">{c[kind].map(item=><label className="selection food-choice" key={item.id}><input type="radio" value={item.id} {...register(name)} /><FoodPhoto item={item} kind={kind}/><span><strong>{item.name}</strong><small>One selection included</small></span></label>)}</div>{errors[name]&&<p className="field-error" role="alert">{errors[name]?.message}</p>}</fieldset>
                })}
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
                  {errors.setup_id&&<span className="field-error" role="alert">{errors.setup_id.message}</span>}
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
                {!!c.add_ons.length && <h3>Additional quantity-based add-ons</h3>}
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
                        setValueAs: optionalQuantity,
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
                {!!c.chair_types.find(chair=>chair.id===values.chair_type_id)?.equipment_id&&<EquipmentAvailability day={values.event_date} rid={id} requested={(c.chair_types.find(chair=>chair.id===values.chair_type_id)?.price||0)>0?values.elegant_chair_quantity:0} monoblockRequested={(c.chair_types.find(chair=>chair.id===values.chair_type_id)?.price||0)>0?Math.max(values.guests-values.elegant_chair_quantity,0):values.guests}/>}
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
                            shouldDirty: true, shouldValidate: true,
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
                      {errors.chair_type_id&&<span className="field-error" role="alert">{errors.chair_type_id.message}</span>}
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
                            setValueAs: optionalQuantity,
                          })}
                        />
                        {errors.chair_quantities?.[a.id]?.message&&<small className="field-error" role="alert">{errors.chair_quantities[a.id]?.message}</small>}
                      </label>
                    ))}
                  </>
                )}
              </>
            )}
            {step === 3 && (
              <>
                <AllergyFields form={form} dishes={c.dishes} review/>
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
                          setupItemLabel(key,c.event_setups.find(item=>item.id===values.setup_id)?.setup_kind),
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
                    Review your quote. Finalizing sends your
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
                  disabled={finalize.isPending || persistDraft.isPending || !values.consent_accepted || allergyWarnings.isFetching || !!allergyWarnings.error || !!allergyWarnings.data?.some(w=>!values.allergy_acknowledgments.some(a=>a.token===w.token))}
                  onClick={()=>void handleSubmit(async v=>{if(await checkAvailability(v,3))finalize.mutate(v)},focusErrors)()}
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
            {persistDraft.error&&<ErrorState error={persistDraft.error}/>}
            {errors.root?.message&&<p className="field-error" role="alert">{errors.root.message}</p>}
            {Object.keys(errors).length > 0 && (
              <p className="field-error" role="alert">Please check the highlighted fields.</p>
            )}
            <div className="wizard-actions">
              {(!id||detail.data?.reservation.status==='draft')&&<button type="button" className="button secondary" disabled={persistDraft.isPending||finalize.isPending} onClick={()=>persistDraft.mutate({data:form.getValues(),target:step})}>{persistDraft.isPending?'Saving draft…':'Save draft'}</button>}
              {step > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    navigate(
                      wizardPath(step-1),
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
                    save.isPending || persistDraft.isPending || (step === 2 && estimated === null)
                  }
                >
                  {save.isPending||persistDraft.isPending ? 'Saving…' : 'Save & continue'}
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
          {includedSeating && (c.chair_types.find(chair=>chair.id===values.chair_type_id)?.price||0)>0 && (
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
              {bookingPriceLines(displayedQuote)
                .map(({key,label,amount}) => (
                  <div className="price-line" key={key}>
                    <span>{label}</span>
                    <strong>{amount===0?'Included':money(amount)}</strong>
                  </div>
                ))}
              <FinancialBreakdown booking snapshot={financialSnapshot} total={displayedQuote.total}/>
              <small>Review your total before confirming your booking.</small>
            </>
          ) : (
            <div className="quote-placeholder">
              <UtensilsIcon />
              <p>
                {(c.chair_types.find(
                  (chair) => chair.id === values.chair_type_id,
                )?.price || 0) > 0 &&
                (!Number.isInteger(values.elegant_chair_quantity) ||
                  values.elegant_chair_quantity < 1 ||
                  values.elegant_chair_quantity > values.guests)
                  ? 'Choose a whole Elegant Chair quantity between 1 and your guest count. The quote is paused until corrected.'
                  : 'Choose a current menu and setup to see your estimate.'}
              </p>
            </div>
          )}
          <Link className="text-button" to="/customer/support">
            Need a helping hand? <ArrowRight size={15} />
          </Link>
        </aside>
      </div>
      <details className="booking-information"><summary>Quotation and tax information</summary><p>This booking summary is a quotation, not an official BIR tax invoice. Payment records and downloadable documents include their applicable receipt information.</p>{financialSnapshot&&!financialSnapshot.business_confirmed&&<p>Tax figures use the current system settings and await business/accounting confirmation.</p>}{financialSnapshot?.tax_mode==='vat_inclusive'&&<p>VAT shown is included in the reservation total.</p>}{financialSnapshot?.tax_mode==='non_vat'&&<p>The saved tax treatment is non-VAT.</p>}</details>
    </>
  )
}
function UtensilsIcon() {
  return <span className="empty-icon">✧</span>
}
