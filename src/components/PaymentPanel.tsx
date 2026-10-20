import {useEffect,useState} from 'react'
import {useLocation} from 'react-router-dom'
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query'
import {usePaymentSummary,usePaymentHistory} from '../features/payments'
import {edge,rpc,records} from '../lib/supabase'
import {date,dateTime,human,money} from '../lib/format'
import {manilaLocalTimestamp,paymentActions,paymentMethod,pesoAmount,type PaymentEntry,type PaymentSummary} from '../lib/payments'
import type {Reservation} from '../types'
import {FinancialBreakdown} from './FinancialBreakdown'
import {financialRows} from '../lib/financial'
import {downloadReportPdf} from '../lib/reports'
import {Badge,ErrorState,Loading,Modal} from './ui'
import {FeedbackNotice} from './FeedbackNotice'

export function PaymentTotals({id}:{id:string}){
 const query=usePaymentSummary(id)
 if(query.isPending)return <Loading/>
 if(query.error)return <ErrorState error={query.error}/>
 const s=query.data
 return <><FinancialBreakdown snapshot={s.financial_snapshot} total={s.total} paid={s.net_paid} balance={s.remaining}/><dl className="detail-list"><dt>Gross verified received</dt><dd>{money(s.received)}</dd><dt>Refunds completed</dt><dd>{money(s.refunded)}</dd>{s.reversed>0&&<><dt>Corrected/voided entries</dt><dd>{money(s.reversed)}</dd></>}<dt>Deposit requirement met</dt><dd>{s.deposit_met?'Yes':'No'} · {money(s.deposit_target)}</dd>{s.refund_due>0&&<><dt>Overpayment / refund due</dt><dd>{money(s.refund_due)} · payout not yet completed</dd></>}{s.additional_payment_due&&s.remaining>0&&<><dt>Additional payment due</dt><dd>{money(s.remaining)}</dd></>}</dl><Badge value={s.display_status}/></>
}
export function CustomerPaymentPanel({reservation:r}:{reservation:Reservation}){
 const summary=usePaymentSummary(r.id),qc=useQueryClient(),location=useLocation()
 const [phase,setPhase]=useState<'idle'|'verifying'|'unknown'>('idle'),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0),[intent,setIntent]=useState<string|null>(null)
 const returned=new URLSearchParams(location.search).has('payment'),pending=summary.data?.pending_checkout
 const checkout=useMutation({mutationFn:(intent:string)=>edge<{url?:string;quote_updated?:boolean;already_verified?:boolean;state?:string;message?:string}>('create-paymongo-checkout',{reservation_id:r.id,intent,expected_total:summary.data?.total??r.total,expected_quote_at:r.financial_snapshot?.captured_at}),onSuccess:async data=>{
  setIntent(null)
  if(data.url){const url=new URL(data.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.paymongo.com'))throw Error('Unexpected checkout address');window.location.assign(url.toString());return}
  await qc.invalidateQueries()
  if(data.already_verified){setNotice('Your verified payment status is up to date. Review the payment summary and receipt below.');return}
  if(data.quote_updated){setNotice('Your quotation was updated. Review the total and down payment before continuing.');return}
  setPhase('verifying');setRetry(n=>n+1);setNotice(data.message||'Checking your payment. Please wait before paying again.')
 }})
 useEffect(()=>{
  if(!returned&&!pending&&retry===0)return
  let cancelled=false
  const run=async()=>{
   setPhase('verifying');const deadline=Date.now()+60000
   while(!cancelled&&Date.now()<deadline){
    try{
     const result=await edge<{state:string;summary?:PaymentSummary}>('reconcile-paymongo-checkout',{reservation_id:r.id})
     if(cancelled)return
     await qc.invalidateQueries({predicate:q=>['reservation','reservations','payment-summary','payment-history','notifications'].includes(String(q.queryKey[0]))})
     if(['paid','released','none'].includes(result.state)){setPhase('idle');return}
     if(result.state==='active'&&!returned){setPhase('idle');return}
    }catch{/* An unknown outcome is kept pending, never treated as failed. */}
    await new Promise(resolve=>setTimeout(resolve,2500))
   }
   if(!cancelled)setPhase('unknown')
  };void run();return()=>{cancelled=true}
 },[r.id,returned,pending,retry,qc])
 if(summary.isPending)return <Loading/>
 if(summary.error)return <ErrorState error={summary.error}/>
 const s=summary.data,payable=['pending','for_approval','approved'].includes(r.status)&&s.remaining>0
 return <section className="payment-box" aria-label="Payment summary and actions"><h3>Payment summary</h3><p><Badge value={s.display_status}/> · Balance due: <strong>{money(s.remaining)}</strong></p>
  {notice&&<FeedbackNotice text={notice} close={()=>setNotice('')}/>}
  {phase==='verifying'&&<p role="status">Verifying payment with PayMongo… Please wait; your balance will update after verification.</p>}
  {phase==='unknown'&&<div className="alert"><p>We cannot confirm the outcome yet. Do not make another payment while this checkout is unresolved. Your existing payment is still being checked.</p><button className="button secondary" onClick={()=>setRetry(n=>n+1)}>Check payment again</button></div>}
  {payable&&phase==='idle'&&<div className="actions">{(s.pending_checkout?['resume']:paymentActions(s)).map(value=><button className="button" key={value} disabled={checkout.isPending} onClick={()=>setIntent(value==='resume'?(s.net_paid>0?'balance':'partial'):value)}>{checkout.isPending?'Preparing secure checkout…':value==='resume'?'Continue existing payment':value==='partial'?'Pay 50% down payment · '+money(s.deposit_target):value==='balance'?'Pay '+(s.additional_payment_due?'additional payment':'remaining balance')+' · '+money(s.remaining):'Pay full · '+money(s.remaining)}</button>)}</div>}
  {s.remaining===0&&<p>No additional payment is due. Your verified receipt/history is shown below.</p>}<p className="date-help">Payment confirmations use the email on your RodelConnect account and include your reservation details.</p>{checkout.error&&<ErrorState error={checkout.error}/>}
  {intent&&<Modal title="Continue to secure checkout" close={()=>!checkout.isPending&&setIntent(null)}><p>We will check your current payment first, then open PayMongo for the amount still due. Your return URL alone does not confirm payment.</p><button className="button" disabled={checkout.isPending} onClick={()=>checkout.mutate(intent)}>{checkout.isPending?'Checking payment…':'Continue to PayMongo'}</button></Modal>}
 </section>
}
export function ManualPaymentDialog({reservation:r,customer,close,onSaved}:{reservation:Reservation;customer:string;close:()=>void;onSaved:(message:string)=>void}){
 const summary=usePaymentSummary(r.id),qc=useQueryClient(),[amount,setAmount]=useState(''),[method,setMethod]=useState('cash'),[received,setReceived]=useState(()=>manilaLocalTimestamp()),[reference,setReference]=useState(''),[note,setNote]=useState(''),[confirmed,setConfirmed]=useState(false),[key]=useState(()=>crypto.randomUUID()),[validation,setValidation]=useState('')
 const mutation=useMutation({mutationFn:()=>rpc<PaymentSummary>('record_manual_payment',{rid:r.id,amount:pesoAmount(amount),method,received_at:new Date(received+':00+08:00').toISOString(),idempotency_key:key,receipt_reference:reference,note}),onSuccess:s=>{void qc.invalidateQueries();onSaved(`${money(pesoAmount(amount))} ${paymentMethod(method)} payment recorded successfully for ${s.reference}. Balance: ${money(s.remaining)}.`);close()}})
 return <Modal title={confirmed?'Confirm payment received':'Record in-person payment'} close={()=>!mutation.isPending&&close()}>{summary.isPending?<Loading/>:summary.error?<ErrorState error={summary.error}/>:<form className="form" onSubmit={e=>{e.preventDefault();try{const value=pesoAmount(amount);if(value>summary.data.remaining)throw Error('Amount exceeds the current outstanding balance.');setValidation('');setConfirmed(true)}catch(e){setValidation(e instanceof Error?e.message:'Check the amount')}}}>
  <p><strong>{r.reservation_reference}</strong> · {customer} · {r.event_name}</p><p>Total {money(summary.data.total)} · Net verified paid {money(summary.data.net_paid)} · Balance {money(summary.data.remaining)}</p>
  {summary.data.pending_checkout&&<p className="allergy-warning">An online checkout is unfinished. Check/close it in the staff payment diagnostics before recording an offline receipt.</p>}
  {confirmed?<><p>Record <strong>{money(pesoAmount(amount))}</strong> received from <strong>{customer}</strong> for reservation <strong>{r.reservation_reference}</strong> by {paymentMethod(method)} on {dateTime(new Date(received+':00+08:00').toISOString())} Manila?</p><div className="actions"><button type="button" className="button" disabled={mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'Recording…':'Confirm received payment'}</button><button type="button" className="text-button" disabled={mutation.isPending} onClick={()=>setConfirmed(false)}>Edit details</button></div></>:<><label>Amount received (PHP)<input name="manual_amount" required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="cash">Cash on Hand</option><option value="bank_transfer">Bank Transfer</option></select></label><label>Date/time received (Manila)<input required type="datetime-local" value={received} onChange={e=>setReceived(e.target.value)}/></label><label>Proof / reference · optional<input maxLength={150} value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Note · optional<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label><p>A payment below the 50% deposit target is recorded as received; the deposit requirement remains unmet.</p><button className="button" disabled={summary.data.remaining<=0||summary.data.pending_checkout}>Review payment</button></>}
  {validation&&<p className="field-error" role="alert">{validation}</p>}{mutation.error&&<ErrorState error={mutation.error}/>}</form>}</Modal>
}
export function PaymentHistory({reservation:r,staff=false}:{reservation:Reservation;staff?:boolean}){
 const query=usePaymentHistory(r.id),qc=useQueryClient(),[selected,setSelected]=useState<PaymentEntry|null>(null),[reason,setReason]=useState(''),[key,setKey]=useState(()=>crypto.randomUUID()),[downloadError,setDownloadError]=useState<unknown>(null)
 const correction=useMutation({mutationFn:()=>rpc('void_manual_payment',{payment_id:selected!.payment_id,reason,idempotency_key:key}),onSuccess:()=>{setSelected(null);setReason('');void qc.invalidateQueries()}})
 if(query.isPending)return <Loading/>
 if(query.error)return <ErrorState error={query.error}/>
 return <section className="payment-history"><h3>Payment history & receipts</h3>{!query.data.some(p=>p.kind==='payment')&&<p>No verified payments yet.</p>}{query.data.map(p=><article className="payment-history-entry" key={p.id}><div className="actions"><strong>{p.reference}</strong><Badge value={p.status}/></div><h4>{p.kind==='payment'?'Payment':p.kind==='refund'?'Completed refund':p.kind==='reversal'?'Correction / reversal':'Checkout attempt'} · {money(p.amount)}</h4><p>{paymentMethod(p.method)} · Recorded {dateTime(p.recorded_at)} Manila</p>{p.received_at&&<p>Received {dateTime(p.received_at)} Manila</p>}{p.recorded_by&&<p>Recorded by {p.recorded_by}</p>}{p.receipt_reference&&<p>Reference: {p.receipt_reference}</p>}{p.note&&<p>{p.note}</p>}{p.void_reason&&<p>Correction reason: {p.void_reason}</p>}{p.source==='paymongo'&&p.provider_reference?.startsWith('pay_')&&<p>Provider reference: {p.provider_reference}</p>}
  {p.kind!=='checkout'&&<button className="text-button" onClick={async()=>{try{const q=p.quote_snapshot;await downloadReportPdf({title:p.kind==='payment'?'Payment receipt / record':'Payment adjustment record',filters:'System-generated payment record; not an official BIR tax invoice',generated:dateTime(new Date().toISOString())+' Manila',summary:[r.reservation_reference||'Reservation',r.event_name,date(r.event_date),p.reference,paymentMethod(p.method),human(p.status)],headers:['Description','Recorded information'],rows:[['Receipt amount',money(p.amount)],['Recorded',dateTime(p.recorded_at)+' Manila'],...(p.received_at?[['Received',dateTime(p.received_at)+' Manila']]:[]),...(p.recorded_by?[['Recorded by',p.recorded_by]]:[]),...(q?financialRows(q.financial_snapshot,q.total,q.net_paid??p.amount,q.remaining).map(([key,value])=>[key,typeof value==='number'?money(value):value]):[['Historical quotation','A receipt-time quote snapshot was not recorded. Current booking totals are displayed separately.']])],filename:'RodelConnect-'+p.reference})}catch(e){setDownloadError(e)}}}>Download receipt / record</button>}
  {staff&&p.source==='manual'&&p.kind==='payment'&&p.status==='verified'&&<button className="text-button" onClick={()=>{setSelected(p);setReason('');setKey(crypto.randomUUID());correction.reset()}}>Void mistaken entry</button>}
 </article>)}{!!downloadError&&<ErrorState error={downloadError}/>}{selected&&<Modal title="Correct a mistaken payment entry" close={()=>!correction.isPending&&setSelected(null)}><form className="form" onSubmit={e=>{e.preventDefault();correction.mutate()}}><p>Void {selected.reference} ({money(selected.amount)}) only if the receipt was recorded in error. The original entry remains in history. Use the refund workflow for an actual payout.</p><label>Reason for correction<textarea required minLength={5} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="button" disabled={correction.isPending}>{correction.isPending?'Recording correction…':'Confirm correction'}</button>{correction.error&&<ErrorState error={correction.error}/>}</form></Modal>}</section>
}
export function PaymentEmailStatus({id}:{id:string}){
 const qc=useQueryClient(),query=useQuery({queryKey:['payment-email-status',id],queryFn:()=>records<{id:string;status:string;attempts:number;last_error:string|null;accepted_at:string|null}>('payment_email_outbox','created_at',true,{reservation_id:id}),refetchInterval:30000})
 const retry=useMutation({mutationFn:(delivery_id:string)=>rpc('retry_payment_email',{delivery_id}),onSuccess:()=>void qc.invalidateQueries({queryKey:['payment-email-status',id]})})
 return <details className="payment-email-status"><summary>Customer payment email delivery</summary><p>Provider acceptance confirms dispatch, not inbox delivery. Only verified ledger events create these jobs.</p>{query.error&&<ErrorState error={query.error}/>} {!query.isPending&&!query.data?.length&&<p>No payment email jobs for this booking.</p>}{query.data?.map((d,i)=><p key={d.id}>Message {i+1}: <strong>{human(d.status)}</strong> · {d.attempts} attempts{d.accepted_at?' · Accepted '+dateTime(d.accepted_at)+' Manila':''}{d.last_error?' · '+d.last_error:''}{['failed','blocked','uncertain'].includes(d.status)&&<button className="text-button" disabled={retry.isPending} onClick={()=>retry.mutate(d.id)}>Retry safely</button>}</p>)}{retry.error&&<ErrorState error={retry.error}/>}</details>
}
