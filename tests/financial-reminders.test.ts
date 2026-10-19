import {describe,it,expect} from 'vitest'
import {effectiveDiscount,financialQuote,financialRows} from '../src/lib/financial'
import {paymentReportRows,reservationReportRows,savedFinancialLabel} from '../src/lib/reports'
import type {Reservation} from '../src/types'
import {sendReminderEmail} from '../supabase/functions/_shared/reminder-email'
describe('visible financial snapshot calculations',()=>{
 const inclusive={mode:'vat_inclusive' as const,rate_bps:1200,business_confirmed:false}
 it('extracts VAT without adding it again and handles discounts/rounding',()=>{
  expect(financialQuote(11200,null,inclusive)).toMatchObject({total:11200,taxable_basis:10000,vat_amount:1200})
  expect(financialQuote(11200,{kind:'percentage',value:1000},inclusive)).toMatchObject({total:10080,vat_amount:1080,discount_amount:1120})
  expect(financialQuote(10000,null,{...inclusive,mode:'vat_exclusive'})).toMatchObject({total:11200,vat_amount:1200})
  expect(financialQuote(11200,null,{...inclusive,mode:'non_vat'})).toMatchObject({total:11200,vat_amount:0})
  expect(financialQuote(1,null,inclusive).vat_amount).toBe(0)
  expect(()=>financialQuote(100,{kind:'fixed',value:101},inclusive)).toThrow()
 })
 it('does not invent VAT for historical records and keeps deposit/balance amounts consistent',()=>{
  const rows=financialRows(null,10001,5001);expect(rows).toContainEqual(['50% down payment',5001]);expect(rows).toContainEqual(['Balance',5000]);expect(rows.some(([k])=>k.includes('VAT ('))).toBe(false)
 })
 it('shows the account percentage and saved amounts consistently in quotes, receipts and reports',()=>{
  const account={account_discount_bps:1500,account_discount_reason:'Approved account benefit'}
  const discount=effectiveDiscount(null,account),snapshot=financialQuote(11201,discount,inclusive)
  expect(snapshot).toMatchObject({discount_amount:1680,discount_percent:15,discount_source:'account',total:9521})
  const rows=financialRows(snapshot,snapshot.total)
  expect(rows[0]).toEqual(['Subtotal before discount',11201]);expect(rows[1]).toEqual(['Discount percentage','15%'])
  expect(rows).toContainEqual(['50% down payment',4761]);expect(rows).toContainEqual(['VAT (12% included)',1020])
  expect(savedFinancialLabel(snapshot)).toContain('Account discount (15%): PHP 16.80')
  const reservation={id:'discount-fixture',event_name:'Discount report fixture',event_date:'2084-01-01',event_time:'12:00',guests:100,status:'approved',total:snapshot.total,paid:4761,financial_snapshot:snapshot} as Reservation
  expect(reservationReportRows([reservation])[0]).toMatchObject({total:95.21,paid:47.61,remaining:47.6,tax_discount:savedFinancialLabel(snapshot)})
  expect(paymentReportRows([reservation],[{id:'verified-fixture',reservation_id:reservation.id,kind:'payment',amount:4761,created_at:'2026-10-19T00:00:00Z'}],[],[])[0]).toMatchObject({received:47.61,balance:47.6,tax_discount:savedFinancialLabel(snapshot)})
  const promo={kind:'percentage',value:500,name:'Explicit promotion',source:'promotion'}
  expect(effectiveDiscount(promo,account)).toBe(promo)
  expect(effectiveDiscount({...promo,source:'account'},account)?.value).toBe(1500)
  expect(effectiveDiscount({...promo,source:'account'},{account_discount_bps:0})).toBeNull()
 })
})
describe('email provider acceptance and retry identity',()=>{
 it('reuses the exact provider payload/idempotency key and reports success only with an acceptance ID',async()=>{
  const calls:{key:string|null;body:BodyInit|null|undefined}[]=[]
  const request:typeof fetch=async(_url,init)=>{calls.push({key:new Headers(init?.headers).get('Idempotency-Key'),body:init?.body});return Response.json({id:'provider-test-fixture'})}
  const job={id:'fixture-delivery',payload:{to:['test@example.invalid'],subject:'Fixture',text:'Fixture only'}}
  expect(await sendReminderEmail(job,'unit-fixture',request)).toMatchObject({status:'sent',provider:'provider-test-fixture'});await sendReminderEmail(job,'unit-fixture',request);expect(calls[0]).toEqual(calls[1])
  expect(await sendReminderEmail(job,'unit-fixture',async()=>Response.json({}))).toMatchObject({status:'uncertain',provider:null})
  expect(await sendReminderEmail(job,'unit-fixture',async()=>new Response('',{status:429}))).toMatchObject({status:'failed'})
  expect(await sendReminderEmail(job,'unit-fixture',async()=>{throw Error('Timeout')})).toMatchObject({status:'uncertain'})
 })
})
