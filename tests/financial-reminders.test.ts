import {describe,it,expect} from 'vitest'
import {financialQuote,financialRows} from '../src/lib/financial'
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
