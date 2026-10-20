import {describe,it,expect,vi} from 'vitest'
import {reconcileCheckout,type CheckoutSession} from '../supabase/functions/_shared/checkout-reconciliation'
import {pesoAmount,manilaLocalTimestamp,paymentActions,type PaymentSummary} from '../src/lib/payments'
import {paymentReportRows,paymentSummary} from '../src/lib/reports'
import type {Reservation} from '../src/types'
import {bookingPayloadKey,type Values} from '../src/lib/booking-validation'
import {paymentEmailText} from '../supabase/functions/_shared/payment-email'
const p={id:'fixture',reservation_id:'booking',amount:12345,external_session_id:'cs_fixture',provider_claimed_at:'2026-10-20'}
const session=(status='active',amount?:number):CheckoutSession=>({id:'cs_fixture',attributes:{livemode:false,status,reference_number:'fixture',metadata:{payment_id:'fixture',reservation_id:'booking'},payments:amount?[{id:'pay_fixture',attributes:{status:'paid',currency:'PHP',amount}}]:[]}})
const api=(s:CheckoutSession)=>({live:false,retrieve:vi.fn(async()=>s),expire:vi.fn(async()=>{}),release:vi.fn(async()=>{}),confirm:vi.fn(async()=>{})})
describe('background payment verification',()=>{
 it('inspects active checkouts without expiring a payment that the customer is still completing',async()=>{const a=api(session());expect(await reconcileCheckout(p,a,false)).toBe('active');expect(a.expire).not.toHaveBeenCalled();expect(a.release).not.toHaveBeenCalled()})
 it('rejects altered references, metadata, amounts and live/test mismatches',async()=>{
  for(const s of [session('active',12346),{...session(),attributes:{...session().attributes,metadata:{payment_id:'other',reservation_id:'booking'}}},{...session(),attributes:{...session().attributes,livemode:true}}]){const a=api(s);await expect(reconcileCheckout(p,a,false)).rejects.toThrow(/mismatch/);expect(a.confirm).not.toHaveBeenCalled();expect(a.release).not.toHaveBeenCalled()}
 })
 it('only confirms independently retrieved paid funds and safely repeats the same provider identity',async()=>{const a=api(session('active',12345));await reconcileCheckout(p,a,false);await reconcileCheckout(p,a,false);expect(a.confirm).toHaveBeenCalledTimes(2);expect(a.confirm).toHaveBeenLastCalledWith('cs_fixture','pay_fixture',12345);expect(a.expire).not.toHaveBeenCalled()})
})
describe('receipt values and reports',()=>{
 it('includes the recipient reservation details, verified amount, VAT and balance in the server email',()=>{
  const text=paymentEmailText('Payment confirmed','Verified payment received',{reservation_reference:'RC-test',event_name:'Sandbox event',event_date:'2095-11-20',event_time:'12:00',guests:100,package:'Set Menu No. 1',dishes:['Staff-confirmed dish'],drink:'Iced tea',dessert:'Fruit salad',setup:'Simple buffet',total:3300000,net_paid:1650000,remaining:1650000,financial_snapshot:{gross_subtotal:3300000,discount_amount:0,vat_amount:353571,tax_mode:'vat_inclusive',business_confirmed:false}},1650000,'card','/customer/reservations/fixture','https://www.rodelscatering.online')
  for(const expected of ['RC-test','2095-11-20 12:00 Asia/Manila','Guests: 100','Set Menu No. 1','Staff-confirmed dish','Iced tea','Fruit salad','Card via PayMongo','Remaining balance at this receipt','not an official BIR tax invoice','https://www.rodelscatering.online/customer/reservations/fixture'])expect(text).toContain(expected)
 })
 it('does not invalidate a displayed quote just because step validation reordered the same selections',()=>{
  const a={event_name:'Fixture',address:{street:'Venue',city:'City'},guests:100,chair_quantities:{b:50,a:50}} as Values
  const b={chair_quantities:{a:50,b:50},guests:100,address:{city:'City',street:'Venue'},event_name:'Fixture'} as Values
  expect(bookingPayloadKey(a)).toBe(bookingPayloadKey(b));expect(bookingPayloadKey({...b,guests:101})).not.toBe(bookingPayloadKey(a))
 })
 it('parses money without floating point rounding or accepting disguised values',()=>{expect(pesoAmount('5000.01')).toBe(500001);expect(pesoAmount('0.01')).toBe(1);for(const value of['0','-1','1e3','1.001','Infinity','5,000','9007199254740992'])expect(()=>pesoAmount(value)).toThrow()})
 it('uses Manila dates at UTC midnight boundaries and offers only the true remaining payment',()=>{expect(manilaLocalTimestamp(new Date('2026-10-19T16:05:00Z'))).toBe('2026-10-20T00:05');for(const [remaining,net_paid,actions]of [[0,500,[]],[100,50,['balance']],[500,0,['partial','full']]] as const)expect(paymentActions({remaining,net_paid} as PaymentSummary)).toEqual(actions)})
 it('separates received receipts, corrections and actual refunds exactly once in reports',()=>{
  const r={id:'r',reservation_reference:'RC-fixture',status:'approved',paid:100000,refunded:10000,payment_reversed:20000,total:60000,event_name:'Fixture',event_date:'2100-01-01'} as Reservation
  const tx=[{id:'one',reservation_id:'r',kind:'payment',amount:100000,source:'manual',method:'cash',created_at:'2026-10-20T01:00:00Z'},{id:'two',reservation_id:'r',kind:'reversal',amount:20000,source:'manual',method:'cash',created_at:'2026-10-20T01:00:00Z'},{id:'three',reservation_id:'r',kind:'refund',amount:10000,source:'manual',method:'bank_transfer',created_at:'2026-10-20T01:00:00Z'}]
  const rows=paymentReportRows([r],tx,[],[]);expect(paymentSummary(rows)).toMatchObject({received:1000,refunded:100,reversed:200,net:700,outstanding:0});expect(rows[0]).toMatchObject({method:'Cash on Hand',refund_due:100})
 })
})
