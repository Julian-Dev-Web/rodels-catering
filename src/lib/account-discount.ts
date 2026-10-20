export type DiscountUsage = 'ongoing' | 'one_time'
export type DiscountExpiration = 'none' | '30_days' | '90_days' | 'specific_date'
export const expirationOptions: {value:DiscountExpiration;label:string}[] = [
  {value:'none',label:'No expiration'},{value:'30_days',label:'30 days'},
  {value:'90_days',label:'90 days'},{value:'specific_date',label:'Specific date'},
]
export function discountExpiryPreview(option:DiscountExpiration,specific:string,today:string):string|null {
  if(option==='none')return null
  if(option==='specific_date')return specific||null
  // Calendar arithmetic on the server-provided Manila day, independent of the
  // browser's timezone and daylight-saving rules. The server rechecks on save.
  const day=new Date(today+'T00:00:00Z')
  day.setUTCDate(day.getUTCDate()+(option==='30_days'?30:90))
  return day.toISOString().slice(0,10)
}
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
