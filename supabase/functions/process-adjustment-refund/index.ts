import { admin, authenticated, endpoint, json, paymongo, secret } from '../_shared/http.ts'
endpoint(async req=>{
 const {client,user}=await authenticated(req),role=await client.rpc('current_app_role')
 if(role.error||!['manager','super_admin'].includes(role.data))throw Error('Active staff access required')
 const {refund_id}=await req.json(),db=admin()
 const planned=await db.rpc('claim_adjustment_refund',{fid:refund_id,actor:user.id});if(planned.error)throw planned.error
 if(planned.data.completed)return json({status:'completed'})
 for(const op of planned.data.operations){
  const claim=await db.rpc('claim_adjustment_operation',{operation_id:op.id});if(claim.error)throw claim.error
  let result
  if(claim.data.newly_claimed){
   // Only a definite validation rejection can release a never-created refund.
   // A timeout/5xx/unknown result retains the claim to prevent double payouts.
   const response=await fetch('https://api.paymongo.com/v1/refunds',{method:'POST',headers:{Authorization:'Basic '+btoa(secret('PAYMONGO_SECRET_KEY')+':'),'Content-Type':'application/json'},body:JSON.stringify({data:{attributes:{amount:op.amount,payment_id:op.external_payment_id,reason:'requested_by_customer',notes:'Approved RodelConnect price adjustment; operation '+op.id}}}),signal:AbortSignal.timeout(20000)})
   const data=await response.json().catch(()=>null)
   if(!response.ok){
    if([400,422].includes(response.status)&&!data?.data?.id){const released=await db.rpc('release_rejected_adjustment_operation',{operation_id:op.id});if(released.error)throw released.error;return json({status:'provider_rejected',message:'The provider did not accept this refund. Review the payment method/test-mode restrictions. No refund is recorded; an explicit cash/bank payout may be used only after checking for other pending provider operations.'})}
    throw Error('Provider refund outcome is uncertain. Reconcile before another payout.')
   }
   result=data.data
  }else result=await paymongo('refunds/'+encodeURIComponent(claim.data.external_refund_id))
  if(!result?.id||result.attributes.amount!==op.amount||result.attributes.payment_id!==op.external_payment_id||result.attributes.currency!=='PHP'||result.attributes.livemode!==secret('PAYMONGO_SECRET_KEY').startsWith('sk_live_')||!['pending','processing','succeeded','failed'].includes(result.attributes.status))throw Error('Provider refund does not match the approved allocation')
  const recorded=await db.rpc('record_adjustment_operation',{operation_id:op.id,provider_id:result.id,provider_status:result.attributes.status});if(recorded.error)throw recorded.error
 }
 const operations=await db.from('adjustment_refund_operations').select('status').eq('refund_id',refund_id);if(operations.error)throw operations.error
 if(operations.data.length&&operations.data.every(o=>o.status==='succeeded')){const finish=await db.rpc('finish_adjustment_refund',{fid:refund_id});if(finish.error)throw finish.error;return json({status:'completed'})}
 return json({status:'processing',message:'The provider has not completed every allocation. Use Check provider refund status; manual payouts remain blocked until the provider outcome is resolved.'})
})
