import {describe,it,expect} from 'vitest'
import {discountExpiryPreview,expirationOptions} from '../src/lib/account-discount'
describe('discount expiration calendar preview',()=>{
 it('offers four choices and uses the server Manila day for presets',()=>{
  expect(expirationOptions.map(o=>o.label)).toEqual(['No expiration','30 days','90 days','Specific date'])
  expect(discountExpiryPreview('none','2099-12-31','2026-10-20')).toBeNull()
  expect(discountExpiryPreview('30_days','2099-12-31','2026-10-20')).toBe('2026-11-19')
  expect(discountExpiryPreview('90_days','','2026-10-20')).toBe('2027-01-18')
  expect(discountExpiryPreview('specific_date','2026-10-20','2026-10-20')).toBe('2026-10-20')
  expect(discountExpiryPreview('specific_date','','2026-10-20')).toBeNull()
 })
 it('adds calendar days across month/year and leap-day boundaries',()=>{
  expect(discountExpiryPreview('30_days','','2028-01-31')).toBe('2028-03-01')
  expect(discountExpiryPreview('30_days','','2026-12-20')).toBe('2027-01-19')
 })
})
