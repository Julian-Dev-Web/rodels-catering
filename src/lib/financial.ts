export interface TaxPolicy { mode: 'non_vat' | 'vat_inclusive' | 'vat_exclusive'; rate_bps: number; business_confirmed: boolean }
export interface FinancialSnapshot extends TaxPolicy {
  gross_subtotal: number; discount_amount: number; discounted_subtotal: number; taxable_basis: number; vat_amount: number; total: number
  discount_name?: string | null; discount_reason?: string | null
  tax_mode: TaxPolicy['mode']
}
export function financialQuote(gross: number, discount: {kind:string;value:number;name?:string;reason?:string}|null, tax: TaxPolicy): FinancialSnapshot {
  if (!Number.isSafeInteger(gross)||gross<0) throw Error('Invalid subtotal')
  const amount = !discount ? 0 : discount.kind==='fixed' ? discount.value : Math.round(gross*discount.value/10000)
  if (!Number.isSafeInteger(amount)||amount<0||amount>gross) throw Error('Discount exceeds eligible subtotal')
  const net=gross-amount, vat=tax.mode==='non_vat'?0:Math.round(net*tax.rate_bps/(tax.mode==='vat_inclusive'?10000+tax.rate_bps:10000))
  return {...tax,tax_mode:tax.mode,gross_subtotal:gross,discount_amount:amount,discounted_subtotal:net,taxable_basis:tax.mode==='vat_inclusive'?net-vat:net,vat_amount:vat,total:tax.mode==='vat_exclusive'?net+vat:net,discount_name:discount?.name,discount_reason:discount?.reason}
}
export function financialRows(f: FinancialSnapshot|null|undefined,total:number,paid=0,balance?:number): [string,number|string][] {
  const rows:[string,number|string][]=[]
  if(f){rows.push(['Subtotal before discount',f.gross_subtotal],['Discount'+(f.discount_name?' · '+f.discount_name:''),-f.discount_amount],['After discount',f.discounted_subtotal],[f.tax_mode==='non_vat'?'Non-VAT basis':'VAT-exclusive taxable basis',f.taxable_basis],[f.tax_mode==='non_vat'?'VAT · non-VAT treatment':`VAT (${f.rate_bps/100}% ${f.tax_mode==='vat_inclusive'?'included':'added'})`,f.vat_amount]);if(f.discount_reason)rows.push(['Discount reason',f.discount_reason]);if(!f.business_confirmed)rows.push(['Tax status','Illustrative tax breakdown; business/accounting confirmation pending'])}
  else rows.push(['Tax status','Tax was not separately recorded on this historical quote'])
  return [...rows,['Total',total],['50% down payment',Math.ceil(total/2)],['Verified paid',paid],['Balance',balance??Math.max(total-paid,0)]]
}
