import { financialRows, type FinancialSnapshot } from '../lib/financial'
import { money } from '../lib/format'
export function FinancialBreakdown({snapshot,total,paid=0,balance}:{snapshot?:FinancialSnapshot|null;total:number;paid?:number;balance?:number}) {
  return <div className="financial-breakdown" aria-label="Tax and discount breakdown">{financialRows(snapshot,total,paid,balance).map(([label,value])=><div className={label==='Total'?'price-total':'price-line'} key={label}><span>{label}</span>{typeof value==='number'?<strong>{money(value)}</strong>:<small>{value}</small>}</div>)}<small>Booking quotation / payment record; not an official BIR tax invoice.</small></div>
}
