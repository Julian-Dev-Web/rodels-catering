import {admin,json} from '../_shared/http.ts'
import {paymentEmailText} from '../_shared/payment-email.ts'
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405)
 const token=Deno.env.get('REMINDER_WORKER_SECRET')
 if(!token||req.headers.get('Authorization')!=='Bearer '+token)return json({error:'Internal worker authentication required'},401)
 const db=admin();let accepted=0,failed=0
 try{
  const jobs=await db.rpc('claim_payment_emails',{batch_size:10});if(jobs.error)throw Error('Could not lease payment email jobs')
  for(const job of jobs.data||[]){
   try{
    const ready=await db.rpc('prepare_payment_email',{delivery_id:job.id});if(ready.error)continue
    if(!Deno.env.get('RESEND_API_KEY')||!Deno.env.get('EMAIL_FROM')||!Deno.env.get('APP_URL')){await db.rpc('finish_payment_email',{delivery_id:job.id,result:'blocked',error_code:'email_configuration_missing'});failed++;continue}
    let payload=ready.data.provider_payload
    if(!payload){
     const n=await db.from('notifications').select('user_id,title,body,href').eq('id',job.notification_id).single();if(n.error||n.data.user_id!==job.recipient_id)throw Error('Recipient binding failed')
     const recipient=await db.auth.admin.getUserById(job.recipient_id),email=recipient.data.user?.email
     if(recipient.error||!email)throw Error('Recipient unavailable')
     if(/@[^@]*\.invalid$/i.test(email)||/@test\.com$/i.test(email)){await db.rpc('finish_payment_email',{delivery_id:job.id,result:'blocked',error_code:'non_deliverable_test_recipient'});continue}
     const transaction=await db.from('transactions').select('amount,method,payment_id').eq('id',job.transaction_id).eq('reservation_id',job.reservation_id).single();if(transaction.error)throw Error('Transaction binding failed')
     const payment=transaction.data.payment_id?await db.from('payments').select('quote_snapshot').eq('id',transaction.data.payment_id).eq('reservation_id',job.reservation_id).single():null
     if(payment?.error)throw Error('Receipt binding failed')
     payload={from:Deno.env.get('EMAIL_FROM'),to:[email],subject:n.data.title,text:paymentEmailText(n.data.title,n.data.body,payment?.data?.quote_snapshot||null,transaction.data.amount,transaction.data.method||'paymongo',n.data.href,Deno.env.get('APP_URL')!)}
     const bound=await db.rpc('prepare_payment_email',{delivery_id:job.id,payload});if(bound.error)continue;payload=bound.data.provider_payload
    }
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'payment-confirmation-'+job.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)})
    const result=await response.json().catch(()=>null)
    const status=response.ok&&typeof result?.id==='string'?'accepted':response.status===429||response.status>=500?'failed':'blocked'
    const saved=await db.rpc('finish_payment_email',{delivery_id:job.id,result:status,provider:status==='accepted'?result.id:null,error_code:status==='accepted'?null:'provider_http_'+response.status});if(saved.error)throw Error('Delivery outcome requires reconciliation')
    if(status==='accepted'){accepted++;await db.from('email_deliveries').upsert({notification_id:job.notification_id,provider_id:result.id},{onConflict:'notification_id'})}else failed++
   }catch{await db.rpc('finish_payment_email',{delivery_id:job.id,result:'uncertain',error_code:'dispatch_outcome_uncertain'});failed++}
  }
  return json({provider_accepted:accepted,failed_or_uncertain:failed})
 }catch{return json({error:'Payment email dispatch failed; inspect protected delivery logs'},500)}
})
