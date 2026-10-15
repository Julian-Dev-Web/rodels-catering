import { describe, expect, it } from 'vitest'
import {
  birthdayKeys,
  buffetKeys,
  weddingKeys,
  coveragePlaces,
  setupSubtotal,
  validateWeddingPrices,
  validMobile,
} from '../src/lib/booking'
import {
  eligibleRescheduleDay,
  initialRescheduleMonth,
  monthDays,
  moveMonth,
} from '../src/lib/calendar'
import { refundProcessing } from '../src/lib/refunds'
describe('booking and reschedule previews', () => {
  it('does not equate staff approval or an ambiguous provider attempt with a completed refund', () => {
    expect(
      refundProcessing({
        id: 'fixture',
        status: 'approved',
        processing: false,
      }),
    ).toContain('awaiting provider')
    expect(
      refundProcessing({
        id: 'fixture',
        status: 'approved',
        processing: true,
        external_refund_ids: [{ status: 'failed' }],
      }),
    ).toContain('manual reconciliation')
    expect(
      refundProcessing({
        id: 'fixture',
        status: 'approved',
        processing: true,
        external_refund_ids: [],
      }),
    ).toContain('reconciliation')
    expect(refundProcessing({ id: 'fixture', status: 'completed' })).toContain(
      'provider confirmed',
    )
  })
  it('opens the original future month without selecting it and falls back after a past event', () => {
    expect(initialRescheduleMonth('2026-12-20', '2026-10-15')).toBe('2026-12')
    expect(initialRescheduleMonth('2026-09-20', '2026-10-15')).toBe('2026-10')
    expect(moveMonth('2026-12', 1)).toBe('2027-01')
    expect(monthDays('2028-02').days).toHaveLength(29)
  })
  it('requires preparation, a different day and known positive availability', () => {
    expect(
      eligibleRescheduleDay('2026-10-14', '2026-12-20', '2026-10-18', 3),
    ).toBe(false)
    expect(
      eligibleRescheduleDay('2026-12-20', '2026-12-20', '2026-10-18', 3),
    ).toBe(false)
    expect(
      eligibleRescheduleDay(
        '2026-12-21',
        '2026-12-20',
        '2026-10-18',
        undefined,
      ),
    ).toBe(false)
    expect(
      eligibleRescheduleDay('2026-12-21', '2026-12-20', '2026-10-18', 0),
    ).toBe(false)
    expect(
      eligibleRescheduleDay('2026-12-21', '2026-12-20', '2026-10-18', 1),
    ).toBe(true)
  })
  it('offers only the two service provinces and valid Philippine mobile formats', () => {
    expect(coveragePlaces(null).map((p) => p.name)).toEqual([
      'Bulacan',
      'Pampanga',
    ])
    expect(validMobile('+63 912 345 6789')).toBe(false)
    expect(validMobile('+639123456789')).toBe(true)
    expect(validMobile('639123456789')).toBe(true)
    expect(validMobile('09123456789')).toBe(true)
    expect(validMobile('021234567')).toBe(false)
  })
  it('deducts exactly PHP5,000 per birthday inclusion and does not invent wedding prices', () => {
    expect(setupSubtotal('birthday', birthdayKeys, 1500000, null)).toBe(1500000)
    expect(
      setupSubtotal('birthday', birthdayKeys.slice(0, 2), 1500000, null),
    ).toBe(1000000)
    expect(setupSubtotal('birthday', [], 1500000, null)).toBe(0)
    expect(
      setupSubtotal('wedding', ['stage_backdrop'], 3000000, null),
    ).toBeNull()
    expect(validateWeddingPrices({ stage_backdrop: 3000000 })).toBe(false)
  })
  it('prices optional buffet setup extras and configured Wedding selections without a booking pricing-approval step', () => {
    const prices = Object.fromEntries(weddingKeys.map(key=>[key,500000]))
    expect(setupSubtotal('buffet', [], 0, null)).toBe(0)
    expect(setupSubtotal('buffet', buffetKeys.slice(0,2), 0, null)).toBe(1000000)
    expect(setupSubtotal('buffet', buffetKeys, 0, null)).toBe(2500000)
    expect(()=>setupSubtotal('buffet',['elegant_chair'],0,null)).toThrow('Invalid setup')
    expect(setupSubtotal('wedding',weddingKeys,3000000,prices)).toBe(3000000)
    expect(setupSubtotal('wedding',weddingKeys.slice(0,5),3000000,prices)).toBe(2500000)
    expect(setupSubtotal('wedding',[],3000000,prices)).toBe(0)
  })
})
