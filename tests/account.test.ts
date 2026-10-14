import { describe, expect, it } from 'vitest'
import { callbackStatus, fullName, passwordSchema, profileSchema, registrationSchema } from '../src/lib/account'

describe('registration and password recovery input', () => {
  const input = { first_name: ' Test ', middle_name: '', last_name: ' Customer ', phone: '0912 345 6789', email: ' person@example.test ', password: 'testing-password', confirm_password: 'testing-password' }
  it('accepts an optional middle name, trims names and normalizes the mobile number', () => {
    const parsed = registrationSchema.parse(input)
    expect(fullName(parsed)).toBe('Test Customer')
    expect(parsed.phone).toBe('+639123456789')
    expect(parsed.email).toBe('person@example.test')
    expect(fullName(profileSchema.parse({ ...input, middle_name: ' Middle ' }))).toBe('Test Middle Customer')
  })
  it('rejects missing names, invalid numbers, an overlong full name and mismatching passwords', () => {
    for (const patch of [{ first_name: ' ' }, { last_name: '' }, { phone: '1234' }, { phone: '08123456789' }, { confirm_password: 'different-password' }, { first_name: 'a'.repeat(60), middle_name: 'b'.repeat(60), last_name: 'c'.repeat(60) }])
      expect(registrationSchema.safeParse({ ...input, ...patch }).success).toBe(false)
    expect(passwordSchema.safeParse({ password: 'testing-password', confirm_password: 'different-password' }).success).toBe(false)
  })
  it('detects recovery callbacks and rejects expired links without reflecting callback text', () => {
    expect(callbackStatus('#type=recovery&access_token=example', '')).toEqual({ recovery: true, failed: false })
    expect(callbackStatus('#type=recovery&error_code=otp_expired', '')).toEqual({ recovery: false, failed: true })
    expect(callbackStatus('', '?error=access_denied')).toEqual({ recovery: false, failed: true })
    expect(callbackStatus('#type=signup', '')).toEqual({ recovery: false, failed: false })
  })
})
