import { describe, it, expect } from 'vitest'
import { canVisit, roleHome } from '../src/lib/permissions'
import { paymentAmount } from '../src/lib/rules'
import { verifySignature } from '../supabase/functions/_shared/signature'
import { dayManila } from '../src/lib/format'
describe('Philippine report dates', () => {
  it('uses Manila calendar boundaries when UTC is still the previous date', () => {
    expect(dayManila('2026-10-13T16:30:00Z')).toBe('2026-10-14')
    expect(dayManila('2026-10-13T15:59:59Z')).toBe('2026-10-13')
  })
})
describe('role decisions', () => {
  it('limits customer, manager and super admin routes', () => {
    expect(canVisit('customer', '/manager/dashboard')).toBe(false)
    expect(canVisit('manager', '/super-admin/users')).toBe(false)
    expect(canVisit('super_admin', '/manager/reservations')).toBe(true)
    expect(canVisit('manager', '/customer/reservations')).toBe(false)
    expect(roleHome.customer).toBe('/customer/reservations')
  })
})
describe('payment previews', () => {
  it('calculates partial/full/balance amounts in centavos', () => {
    expect(paymentAmount(100000, 0, 'partial')).toBe(50000)
    expect(paymentAmount(100001, 0, 'partial')).toBe(50001)
    expect(paymentAmount(100000, 0, 'full')).toBe(100000)
    expect(paymentAmount(100000, 50000, 'balance')).toBe(50000)
  })
  it('rejects repeated partial payments and overpayments', () => {
    expect(() => paymentAmount(100, 50, 'partial')).toThrow()
    expect(() => paymentAmount(100, 100, 'balance')).toThrow()
  })
})
describe('PayMongo HMAC verification', () => {
  it('accepts signed raw bodies and rejects tampering, wrong mode and replay', async () => {
    const body = '{"data":{"id":"evt_test"}}',
      timestamp = 1234567890,
      key = 'test-only-webhook-secret'
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = Array.from(
      new Uint8Array(
        await crypto.subtle.sign(
          'HMAC',
          cryptoKey,
          new TextEncoder().encode(timestamp + '.' + body),
        ),
      ),
      (v) => v.toString(16).padStart(2, '0'),
    ).join('')
    const header = `t=${timestamp},te=${signature},li=`
    expect(await verifySignature(body, header, key, false, timestamp)).toBe(true)
    expect(await verifySignature(body + ' ', header, key, false, timestamp)).toBe(false)
    expect(await verifySignature(body, header, key, true, timestamp)).toBe(false)
    expect(await verifySignature(body, header, key, false, timestamp + 301)).toBe(false)
  })
})
