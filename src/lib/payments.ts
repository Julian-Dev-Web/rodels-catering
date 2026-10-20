import type { FinancialSnapshot } from './financial'
export interface PaymentSummary {reservation_id:string;reference:string;total:number;received:number;refunded:number;reversed:number;net_paid:number;remaining:number;refund_due:number;deposit_target:number;deposit_met:boolean;display_status:string;financial_snapshot:FinancialSnapshot|null;pending_checkout:boolean;additional_payment_due?:boolean}
export interface PaymentEntry {id:string;payment_id:string|null;kind:string;amount:number;reference:string;source:string;method:string;recorded_at:string;received_at:string|null;status:string;recorded_by:string|null;receipt_reference:string|null;note:string|null;void_reason:string|null;provider_reference:string|null;quote_snapshot:{total:number;financial_snapshot:FinancialSnapshot|null;net_paid?:number;remaining?:number}|null}
export function pesoAmount(value:string){
 if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value))throw Error('Enter a positive peso amount with up to two decimal places.')
 const [whole,fraction='']=value.split('.'),amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
 if(amount<=0n||amount>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Enter a valid positive payment amount.')
 return Number(amount)
}
export function manilaLocalTimestamp(at=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).map(x=>[x.type,x.value]))
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export const paymentMethod=(value:string)=>({cash:'Cash on Hand',bank_transfer:'Bank Transfer',gcash:'GCash via PayMongo',card:'Card via PayMongo',paymongo:'PayMongo',not_recorded:'Method not recorded'}[value]||value)
export const paymentActions=(s:PaymentSummary)=>s.remaining<=0?[]:s.net_paid>0?['balance'] as const:['partial','full'] as const
