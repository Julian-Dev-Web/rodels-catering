export type DiscountUsage = 'ongoing' | 'one_time'
export interface AccountDiscountEligibility {
  account_discount_bps:number;account_discount_reason?:string;assignment_id:string|null
  usage_type:DiscountUsage|null;expires_on:string|null;status:string;reserved_reservation_id:string|null
}
export function discountDate(day:string) {
  return new Intl.DateTimeFormat('en-PH',{month:'long',day:'numeric',year:'numeric',timeZone:'Asia/Manila'}).format(new Date(day+'T12:00:00+08:00'))
}
export function discountSummary(usage:DiscountUsage,expiry:string|null) {
  return `${usage==='one_time'?'One-time only':'Every future booking'} · ${expiry?'Valid until '+discountDate(expiry):'No expiration'}`
}
