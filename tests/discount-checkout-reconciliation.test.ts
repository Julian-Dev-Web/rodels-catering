import {describe,it,expect,vi} from 'vitest'
import {reconcileCheckout,type CheckoutSession} from '../supabase/functions/_shared/checkout-reconciliation'
import {discountSummary} from '../src/lib/account-discount'
import {financialQuote,financialRows,effectiveDiscount} from '../src/lib/financial'

const record={id:'fixture',external_session_id:'cs_fixture',provider_claimed_at:'2026-10-20'}
const session=(status='active',payments:CheckoutSession['attributes']['payments']=[]):CheckoutSession=>({id:'cs_fixture',attributes:{livemode:false,status,payments}})
function api(states:CheckoutSession[]) {
  return {live:false,retrieve:vi.fn(async()=>states.shift()!),expire:vi.fn(async()=>({})),confirm:vi.fn(async()=>{}),release:vi.fn(async()=>{})}
}
describe('safe checkout reconciliation and one-time offer display',()=>{
 it('does not release on failure or a local timeout while the provider remains payable',async()=>{
  const x=api([session(),session()]);x.expire.mockRejectedValue(Error('Timeout'))
  expect(await reconcileCheckout(record,x)).toBe('pending');expect(x.release).not.toHaveBeenCalled()
 })
 it('releases only after terminal expiry was independently retrieved',async()=>{
  const x=api([session(),session('expired')]);expect(await reconcileCheckout(record,x)).toBe('released')
  expect(x.expire).toHaveBeenCalledWith('cs_fixture');expect(x.release).toHaveBeenCalledWith('fixture','cs_fixture');expect(x.confirm).not.toHaveBeenCalled()
 })
 it('keeps pending/processing holds and never attempts to expire them',async()=>{
  for(const status of['pending','processing']){const x=api([session('active',[{id:'p',attributes:{status}}])]);expect(await reconcileCheckout(record,x)).toBe('pending');expect(x.expire).not.toHaveBeenCalled();expect(x.release).not.toHaveBeenCalled()}
 })
 it('reconciles a paid race instead of releasing the offer',async()=>{
  const x=api([session(),session('active',[{id:'pay_fixture',attributes:{status:'paid',currency:'PHP',amount:1280000}}])]);x.expire.mockRejectedValue(Error('Already paid'))
  expect(await reconcileCheckout(record,x)).toBe('paid');expect(x.confirm).toHaveBeenCalledWith('cs_fixture','pay_fixture',1280000);expect(x.release).not.toHaveBeenCalled()
 })
 it('retains ambiguous creation claims and rejects wrong provider state',async()=>{
  const x=api([]);await expect(reconcileCheckout({...record,external_session_id:null},x)).rejects.toThrow(/reconciliation/);expect(x.release).not.toHaveBeenCalled()
  await expect(reconcileCheckout(record,api([{...session(),id:'wrong'}]))).rejects.toThrow(/mismatch/)
  await expect(reconcileCheckout(record,{...api([session()]),live:true})).rejects.toThrow(/mismatch/)
  await expect(reconcileCheckout(record,api([session('active',[{id:'p',attributes:{status:'paid',currency:'USD',amount:10}}])]))).rejects.toThrow(/mismatch/)
 })
 it('can release a never-claimed attempt and propagates database failures',async()=>{
  const p={...record,external_session_id:null,provider_claimed_at:null},x=api([])
  expect(await reconcileCheckout(p,x)).toBe('released');expect(x.release).toHaveBeenCalledWith('fixture',null)
  x.release.mockRejectedValue(Error('Database rejected'));await expect(reconcileCheckout(p,x)).rejects.toThrow(/Database rejected/)
 })
 it('labels lifecycle and saved VAT/payment totals consistently without stacking',()=>{
  expect(discountSummary('one_time','2026-11-30')).toContain('One-time only · Valid until November 30, 2026')
  expect(discountSummary('ongoing',null)).toContain('Every future booking · No expiration')
  const d=effectiveDiscount(null,{account_discount_bps:2000,usage_type:'one_time',expires_on:'2026-11-30'})
  const f=financialQuote(3200000,d,{mode:'vat_inclusive',rate_bps:1200,business_confirmed:false})
  expect(f).toMatchObject({total:2560000,discount_amount:640000,vat_amount:274286,discount_usage_type:'one_time',discount_expires_on:'2026-11-30'})
  expect(financialRows(f,f.total,1280000)).toContainEqual(['Balance',1280000])
  expect(effectiveDiscount({kind:'percentage',value:500,source:'promotion'}, {account_discount_bps:2000})?.value).toBe(500)
 })
})
