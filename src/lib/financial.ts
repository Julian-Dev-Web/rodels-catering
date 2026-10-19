export interface TaxPolicy { mode: 'non_vat' | 'vat_inclusive' | 'vat_exclusive'; rate_bps: number; business_confirmed: boolean }
export interface FinancialSnapshot extends TaxPolicy {
  gross_subtotal: number; discount_amount: number; discounted_subtotal: number; taxable_basis: number; vat_amount: number; total: number
  discount_name?: string | null; discount_reason?: string | null
  discount_kind?: string | null; discount_value?: number | null; discount_percent?: number | null
  discount_source?: 'account' | 'promotion' | null; captured_at?: string
  discount_usage_type?: 'ongoing' | 'one_time' | null; discount_expires_on?:string|null; discount_assignment_id?:string|null
  tax_mode: TaxPolicy['mode']
}
export function effectiveDiscount(promotion: {kind:string;value:number;name?:string;reason?:string;source?:string}|null|undefined, account?: {account_discount_bps?:number;account_discount_reason?:string;usage_type?:'ongoing'|'one_time'|null;expires_on?:string|null}|null) {
  if(promotion&&promotion.source!=='account')return promotion
  return account?.account_discount_bps ? {kind:'percentage',value:account.account_discount_bps,name:account.usage_type==='one_time'?'One-time account offer':'Account discount',reason:account.account_discount_reason,source:'account',usage_type:account.usage_type,expires_on:account.expires_on} : null
}
export function financialQuote(gross: number, discount: {kind:string;value:number;name?:string;reason?:string;source?:string;usage_type?:'ongoing'|'one_time'|null;expires_on?:string|null}|null, tax: TaxPolicy): FinancialSnapshot {
  if (!Number.isSafeInteger(gross)||gross<0) throw Error('Invalid subtotal')
  const amount = !discount ? 0 : discount.kind==='fixed' ? discount.value : Math.round(gross*discount.value/10000)
  if (!Number.isSafeInteger(amount)||amount<0||amount>gross) throw Error('Discount exceeds eligible subtotal')
  const net=gross-amount, vat=tax.mode==='non_vat'?0:Math.round(net*tax.rate_bps/(tax.mode==='vat_inclusive'?10000+tax.rate_bps:10000))
  return {...tax,tax_mode:tax.mode,gross_subtotal:gross,discount_amount:amount,discounted_subtotal:net,taxable_basis:tax.mode==='vat_inclusive'?net-vat:net,vat_amount:vat,total:tax.mode==='vat_exclusive'?net+vat:net,discount_name:discount?.name,discount_reason:discount?.reason,discount_kind:discount?.kind,discount_value:discount?.value,discount_percent:discount?.kind==='percentage'?discount.value/100:null,discount_source:discount?.source==='account'?'account':discount?'promotion':null,discount_usage_type:discount?.usage_type,discount_expires_on:discount?.expires_on}
}
export function financialRows(f: FinancialSnapshot|null|undefined,total:number,paid=0,balance?:number): [string,number|string][] {
  const rows:[string,number|string][]=[]
  if(f){rows.push(['Subtotal before discount',f.gross_subtotal],['Discount'+(f.discount_name?' · '+f.discount_name:''),-f.discount_amount],['After discount',f.discounted_subtotal],[f.tax_mode==='non_vat'?'Non-VAT basis':'VAT-exclusive taxable basis',f.taxable_basis],[f.tax_mode==='non_vat'?'VAT · non-VAT treatment':`VAT (${f.rate_bps/100}% ${f.tax_mode==='vat_inclusive'?'included':'added'})`,f.vat_amount]);if(f.discount_reason)rows.push(['Discount reason',f.discount_reason]);if(!f.business_confirmed)rows.push(['Tax status','Illustrative tax breakdown; business/accounting confirmation pending'])}
  else rows.push(['Tax status','Tax was not separately recorded on this historical quote'])
  if(f?.discount_percent!=null)rows.splice(1,0,['Discount percentage',f.discount_percent+'%'])
  if(f?.discount_usage_type)rows.push(['Account offer',f.discount_usage_type==='one_time'?'One-time offer; first verified payment redeems this booking':'Every future booking'])
  if(f?.discount_expires_on)rows.push(['Offer deadline (Manila)',f.discount_expires_on+' · end of day; saved paid terms retained'])
  return [...rows,['Total',total],['50% down payment',Math.ceil(total/2)],['Verified paid',paid],['Balance',balance??Math.max(total-paid,0)]]
}
