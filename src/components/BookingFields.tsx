import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { useAuth } from '../features/auth'
import { records } from '../lib/supabase'
import {
  coveragePlaces,
  normalizeMobile,
  validMobile,
  setupItems,
  birthdayKeys,
  weddingKeys,
} from '../lib/booking'
import { money } from '../lib/format'
import { ErrorState } from './ui'
import {
  mobileInput,
  validMobileEdit,
} from '../../supabase/functions/_shared/phone'
import type { Values } from '../pages/ReservationWizard'
import type { CatalogItem } from '../types'

export function LocationFields({ form }: { form: UseFormReturn<Values> }) {
  const { register, control, setValue } = form,
    { profile } = useAuth()
  const address = useWatch({ control, name: 'address' })
  const contacts = useQuery({
    queryKey: ['saved-contacts', profile?.id],
    enabled: !!profile,
    queryFn: () =>
      records<{ id: string; name: string; phone: string }>('customer_contacts'),
  })
  const numbers = [
    ...(profile?.phone && validMobile(profile.phone)
      ? [
          {
            id: 'primary',
            name: 'Primary account number',
            phone: normalizeMobile(profile.phone),
          },
        ]
      : []),
    ...(contacts.data || []).filter(
      (item) =>
        validMobile(item.phone) &&
        normalizeMobile(item.phone) !== normalizeMobile(profile?.phone || ''),
    ),
  ]
  const contact = normalizeMobile(address.contact),
    selected = numbers.some((item) => normalizeMobile(item.phone) === contact)
      ? contact
      : 'other'
  useEffect(() => {
    if (
      !form.getValues('address.contact') &&
      profile?.phone &&
      validMobile(profile.phone)
    )
      setValue('address.contact', normalizeMobile(profile.phone))
  }, [form, profile?.phone, setValue])
  const choose = (field: 'province' | 'city' | 'barangay', code: string) => {
    const item = coveragePlaces(
      field === 'province'
        ? null
        : field === 'city'
          ? address.province_code
          : address.city_code,
    ).find((item) => item.code === code)
    setValue(`address.${field}_code`, code, { shouldDirty: true })
    setValue(`address.${field}`, item?.name || '', { shouldDirty: true })
    if (field === 'province') {
      setValue('address.city', '')
      setValue('address.city_code', '')
    }
    if (field !== 'barangay') {
      setValue('address.barangay', '')
      setValue('address.barangay_code', '')
    }
  }
  return (
    <>
      <div className="form-grid">
        {(['province', 'city', 'barangay'] as const).map((field) => (
          <label key={field}>
            {field === 'province'
              ? 'Service province'
              : field === 'city'
                ? 'City / municipality'
                : 'Barangay'}
            <select
              name={`address.${field}_code`}
              ref={register(`address.${field}_code`).ref}
              aria-invalid={!!form.formState.errors.address?.[`${field}_code`]}
              aria-label={
                field === 'province'
                  ? 'Service province'
                  : field === 'city'
                    ? 'City / municipality'
                    : 'Barangay'
              }
              value={address[`${field}_code`]}
              disabled={
                field === 'city'
                  ? !address.province_code
                  : field === 'barangay'
                    ? !address.city_code
                    : false
              }
              onChange={(e) => choose(field, e.target.value)}
            >
              <option value="">Select {field}</option>
              {coveragePlaces(
                field === 'province'
                  ? null
                  : field === 'city'
                    ? address.province_code
                    : address.city_code,
              ).map((place) => (
                <option key={place.code} value={place.code}>
                  {place.name}
                </option>
              ))}
            </select>
            {form.formState.errors.address?.[`${field}_code`]?.message && (
              <span className="field-error">
                {form.formState.errors.address[`${field}_code`]?.message}
              </span>
            )}
          </label>
        ))}
      </div>
      <p className="date-help">
        Event coverage: Bulacan and Pampanga only. Cities and barangays come
        from the saved PSGC directory.
      </p>
      <label>
        Street, building & venue
        <input maxLength={500} {...register('address.street')} required />
        {form.formState.errors.address?.street && (
          <span className="field-error">
            {form.formState.errors.address.street.message}
          </span>
        )}
      </label>
      <label>
        Event contact number
        <select
          aria-label="Event contact number"
          value={selected}
          onChange={(e) => {
            setValue(
              'address.contact',
              e.target.value === 'other' ? '' : e.target.value,
              { shouldDirty: true },
            )
            setValue('save_contact', false)
          }}
        >
          {numbers.map((item) => (
            <option key={item.id} value={normalizeMobile(item.phone)}>
              {item.name} · {item.phone}
            </option>
          ))}
          <option value="other">Other contact number</option>
        </select>
      </label>
      {selected === 'other' && (
        <>
          <label>
            Other reachable mobile number
            <input
              type="tel"
              inputMode="tel"
              maxLength={13}
              placeholder="09XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX"
              {...register('address.contact')}
              onPaste={(e) => {
                const input = e.currentTarget,
                  combined =
                    input.value.slice(0, input.selectionStart ?? 0) +
                    e.clipboardData.getData('text') +
                    input.value.slice(input.selectionEnd ?? input.value.length)
                if (!validMobileEdit(combined)) {
                  e.preventDefault()
                  form.setError('address.contact', {
                    type: 'manual',
                    message:
                      'Invalid or overlong pasted mobile number; the previous value was kept.',
                  })
                }
              }}
              aria-invalid={!!form.formState.errors.address?.contact}
              aria-describedby="event-contact-help"
              onChange={(e) =>
                setValue(
                  'address.contact',
                  mobileInput(e.target.value, address.contact),
                  { shouldDirty: true, shouldValidate: true },
                )
              }
              required
            />
            <span
              id="event-contact-help"
              className={
                address.contact && !validMobile(address.contact)
                  ? 'field-error'
                  : 'date-help'
              }
            >
              {form.formState.errors.address?.contact?.message ||
                'Use 09XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX. A valid format does not verify reachability.'}
            </span>
          </label>
          <label className="consent-check">
            <input type="checkbox" {...register('save_contact')} />
            <span>
              Save this alternate number to my contact list. My account’s
              primary number stays unchanged.
            </span>
          </label>
        </>
      )}
      {contacts.error && (
        <ErrorState
          error={contacts.error}
          retry={() => void contacts.refetch()}
        />
      )}
      <label>
        Dietary needs & notes
        <textarea
          maxLength={2000}
          placeholder="Allergies, access instructions, special requests…"
          {...register('address.notes')}
        />
      </label>
    </>
  )
}
export function EventPreferenceFields({
  form,
  setup,
  weddingPrices,
}: {
  form: UseFormReturn<Values>
  setup: CatalogItem | undefined
  weddingPrices: Record<string, number> | null
}) {
  const prefs = useWatch({ control: form.control, name: 'event_preferences' })
  const keys =
    setup?.setup_kind === 'birthday'
      ? birthdayKeys
      : setup?.setup_kind === 'wedding'
        ? weddingKeys
        : []
  const pending = setup?.setup_kind === 'wedding' && !weddingPrices
  return (
    <>
      {(prefs.occasion_type === 'birthday' ||
        setup?.setup_kind === 'birthday') && (
        <label>
          Celebrant age · optional
          <input
            type="number"
            min={1}
            max={120}
            {...form.register('event_preferences.celebrant_age', {
              setValueAs: (v) => (v === '' ? null : Number(v)),
            })}
          />
        </label>
      )}
      <div className="form-grid">
        <label>
          Preferred theme · optional
          <input
            maxLength={200}
            placeholder="e.g. Garden celebration"
            {...form.register('event_preferences.theme')}
          />
        </label>
        <label>
          Preferred colors · optional
          <input
            maxLength={200}
            placeholder="e.g. Ivory and sage green"
            {...form.register('event_preferences.colors')}
          />
        </label>
      </div>
      {!!keys.length && (
        <>
          <h3>Setup inclusions</h3>
          {pending && (
            <p className="alert">
              Wedding price breakdown pending. The full six-item bundle is
              ₱30,000. Partial selection cannot be priced or submitted until the
              owner-approved breakdown is configured.
            </p>
          )}
          <div className="selection-grid">
            {setupItems
              .filter((item) => keys.includes(item.key))
              .map((item) => (
                <label className="selection" key={item.key}>
                  <input
                    type="checkbox"
                    value={item.key}
                    {...form.register('event_preferences.setup_inclusions')}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>
                      {setup?.setup_kind === 'birthday'
                        ? '₱5,000 each'
                        : weddingPrices
                          ? money(weddingPrices[item.key])
                          : 'Included in full bundle · item price pending'}
                    </small>
                  </span>
                </label>
              ))}
          </div>
          {setup?.setup_kind === 'birthday' && (
            <p className="date-help">
              All three selected: ₱15,000. Each unchecked inclusion removes
              ₱5,000; all unchecked adds ₱0. “Elegant Chair” here is a setup
              inclusion; guest seating upgrades are priced separately.
            </p>
          )}
        </>
      )}
    </>
  )
}
export function ConsentField({ form }: { form: UseFormReturn<Values> }) {
  return (
    <label className="consent-check">
      <input type="checkbox" {...form.register('consent_accepted')} required />
      <span>
        I have read and accept the current{' '}
        <Link target="_blank" rel="noopener noreferrer" to="/terms">
          Terms and Conditions
        </Link>{' '}
        and{' '}
        <Link target="_blank" rel="noopener noreferrer" to="/privacy">
          Privacy Notice
        </Link>
        . This acceptance and its version are recorded with my booking.
        {form.formState.errors.consent_accepted && (
          <strong className="field-error" role="alert">
            {form.formState.errors.consent_accepted.message}
          </strong>
        )}
      </span>
    </label>
  )
}
