import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bookingDraftKey,
  readBookingDraft,
  writeBookingDraft,
  clearBookingDraft,
  clearBookingDrafts,
} from '../src/lib/booking-draft'

describe('temporary booking draft restoration', () => {
  const defaults = {
    event_name: '',
    guests: 100,
    address: { contact: '', city_code: '' },
    consent_accepted: false,
    dish_ids: [] as string[],
    addon_quantities: {} as Record<string, number>,
    age: null as number | null,
  }
  const key = bookingDraftKey('customer-a')!
  beforeEach(() => {
    const storage: Record<string, string> = {}
    Object.defineProperties(storage, {
      getItem: { value: (key: string) => storage[key] ?? null },
      setItem: {
        value: (key: string, value: string) => {
          storage[key] = value
        },
      },
      removeItem: {
        value: (key: string) => {
          delete storage[key]
        },
      },
    })
    vi.stubGlobal('sessionStorage', storage)
  })
  afterEach(() => vi.unstubAllGlobals())
  it('restores unfinished input and nested contact/location/consent without requiring a valid submission', () => {
    const input = {
      ...defaults,
      event_name: 'A',
      guests: 0,
      address: { contact: '09123', city_code: 'saved-city' },
      consent_accepted: true,
      dish_ids: ['dish-a'],
      addon_quantities: { addon: 2 },
      age: 18,
    }
    writeBookingDraft(key, input, null)
    expect(readBookingDraft(key, defaults, null)).toEqual(input)
  })
  it('separates users and reservations and discards unsaved edits when the server record changed', () => {
    const savedKey = bookingDraftKey('customer-a', 'booking-a')!
    writeBookingDraft(
      savedKey,
      { ...defaults, event_name: 'Unsaved edits' },
      'revision-1',
    )
    expect(readBookingDraft(savedKey, defaults, 'revision-1').event_name).toBe(
      'Unsaved edits',
    )
    expect(readBookingDraft(savedKey, defaults, 'revision-2')).toEqual(defaults)
    expect(readBookingDraft(key, defaults, null)).toEqual(defaults)
    expect(
      readBookingDraft(
        bookingDraftKey('customer-b', 'booking-a'),
        defaults,
        'revision-1',
      ),
    ).toEqual(defaults)
  })
  it('ignores malformed storage and unexpected field types without introducing unknown form fields', () => {
    sessionStorage.setItem(key, '{broken')
    expect(readBookingDraft(key, defaults, null)).toEqual(defaults)
    writeBookingDraft(
      key,
      {
        event_name: 42,
        guests: '100',
        address: null,
        consent_accepted: 'yes',
        dish_ids: {},
        addon_quantities: { valid: 2, bad: 'text' },
        extra: 'ignored',
      },
      null,
    )
    expect(readBookingDraft(key, defaults, null)).toEqual({
      ...defaults,
      addon_quantities: { valid: 2 },
    })
  })
  it('clears completed drafts and removes only booking drafts on sign out', () => {
    writeBookingDraft(key, defaults, null)
    clearBookingDraft(key)
    expect(sessionStorage.getItem(key)).toBeNull()
    writeBookingDraft(key, defaults, null)
    writeBookingDraft(
      bookingDraftKey('customer-a', 'booking-a'),
      defaults,
      'revision',
    )
    sessionStorage.setItem('unrelated', 'keep')
    clearBookingDrafts()
    expect(Object.keys(sessionStorage)).toEqual(['unrelated'])
  })
  it('keeps the form usable when browser storage is unavailable', () => {
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => writeBookingDraft(key, defaults, null)).not.toThrow()
    expect(() => clearBookingDrafts()).not.toThrow()
    expect(readBookingDraft(key, defaults, null)).toEqual(defaults)
  })
  it('keeps entered details but requires fresh consent when the policy version changes', () => {
    const current = { ...defaults, consent_version: 'current-policy' }
    writeBookingDraft(
      key,
      {
        ...current,
        event_name: 'Keep my event',
        consent_version: 'older-policy',
        consent_accepted: true,
      },
      null,
    )
    const restored = readBookingDraft(key, current, null)
    expect(restored.event_name).toBe('Keep my event')
    expect(restored.consent_version).toBe('current-policy')
    expect(restored.consent_accepted).toBe(false)
  })
})
