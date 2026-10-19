import { authenticated, endpoint, json } from '../_shared/http.ts'
import { reconcilePayment } from '../_shared/reconcile-payment.ts'
endpoint(async req=>{
  const {client,user}=await authenticated(req)
  const {reservation_id}=await req.json()
  if(typeof reservation_id!=='string')throw Error('Choose a reservation')
  const {data:r,error:reservationError}=await client.from('reservations').select('customer_id').eq('id',reservation_id).single()
  if(reservationError||!r)throw Error('Reservation access required')
  const {data:staff,error:staffError}=await client.rpc('is_staff')
  if(staffError||(!staff&&r.customer_id!==user.id))throw Error('Reservation access required')
  const {data:p,error}=await client.from('payments').select('id,external_session_id,provider_claimed_at').eq('reservation_id',reservation_id).eq('status','pending').maybeSingle()
  if(error)throw error
  return json({state:p?await reconcilePayment(p):'none'})
})
