import {admin,json} from '../_shared/http.ts'
import {sendReminderEmail} from '../_shared/reminder-email.ts'
Deno.serve(async req=>{
  if(req.method!=='POST')return json({error:'Method not allowed'},405)
  const worker=Deno.env.get('REMINDER_WORKER_SECRET')
  if(!worker)return json({error:'Reminder worker configuration missing'},503)
  if(req.headers.get('Authorization')!=='Bearer '+worker)return json({error:'Internal worker authentication required'},401)
  const db=admin(),ready=Boolean(Deno.env.get('RESEND_API_KEY')&&Deno.env.get('EMAIL_FROM')&&Deno.env.get('APP_URL'))
  try{
    const flag=await db.rpc('set_reminder_email_status',{ready});if(flag.error)throw Error('Could not update email configuration status')
    const enqueued=await db.rpc('enqueue_event_reminders');if(enqueued.error)throw Error('Could not enqueue eligible event reminders')
    if(!ready)return json({queued:enqueued.data,email:'not_configured',sent:0})
    const claim=await db.rpc('claim_event_reminder_emails',{batch_size:10});if(claim.error)throw Error('Could not claim reminder deliveries')
    let accepted=0,failed=0
    for(const job of claim.data||[]){
      try{
        const prepared=await db.rpc('prepare_reminder_email',{delivery_id:job.id});if(prepared.error)continue
        let payload=prepared.data.provider_payload
        if(!payload){
          if(typeof job.recipient_id!=='string')throw Error('Recipient unavailable')
          const user=await db.auth.admin.getUserById(job.recipient_id);if(user.error||!user.data.user?.email)throw Error('Recipient unavailable')
          payload={from:Deno.env.get('EMAIL_FROM'),to:[user.data.user.email],subject:job.title,text:job.body+'\n\n'+Deno.env.get('APP_URL')+job.href}
          const bound=await db.rpc('prepare_reminder_email',{delivery_id:job.id,payload});if(bound.error)continue;payload=bound.data.provider_payload
        }
        // Revalidate immediately before contacting the provider. Previously
        // accepted/in-flight email cannot be recalled after cancellation.
        const current=await db.rpc('prepare_reminder_email',{delivery_id:job.id});if(current.error)continue
        const result=await sendReminderEmail({id:job.id,payload},Deno.env.get('RESEND_API_KEY')!)
        const saved=await db.rpc('finish_reminder_email',{delivery_id:job.id,result:result.status,provider:result.provider});if(saved.error)throw Error('Provider state requires reconciliation')
        if(result.status==='sent')accepted++;else failed++
      }catch{await db.rpc('finish_reminder_email',{delivery_id:job.id,result:'uncertain'});failed++}
    }
    return json({queued:enqueued.data,provider_accepted:accepted,failed_or_uncertain:failed})
  }catch{return json({error:'Reminder processing failed; inspect protected server logs and delivery status'},500)}
})
