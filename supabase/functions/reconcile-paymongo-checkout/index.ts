import { authenticated, endpoint, json } from '../_shared/http.ts'
import { reconcilePayment } from '../_shared/reconcile-payment.ts'
endpoint(async req=>{
  const {client,user}=await authenticated(req)
  const {reservation_id,close_unpaid}=await req.json()
  if(typeof reservation_id!=='string')throw Error('Choose a reservation')
  const {data:r,error:reservationError}=await client.from('reservations').select('customer_id').eq('id',reservation_id).single()
  if(reservationError||!r)throw Error('Reservation access required')
  const {data:staff,error:staffError}=await client.rpc('is_staff')
  if(staffError||(!staff&&r.customer_id!==user.id))throw Error('Reservation access required')
  if(close_unpaid&&!staff)throw Error('Staff access required to close a checkout')
  const {data:p,error}=await client.from('payments').select('id,reservation_id,amount,external_session_id,provider_claimed_at').eq('reservation_id',reservation_id).eq('status','pending').maybeSingle()
  if(error)throw error
  let state='none';if(p){try{state=await reconcilePayment(p,!!close_unpaid)}catch{return json({state:'unknown',message:'Payment verification is not complete. Do not make another payment while this checkout is unresolved.'},202)}}
  const summary=await client.rpc('payment_summary',{rid:reservation_id});if(summary.error)throw summary.error
  return json({state,summary:summary.data})
})
