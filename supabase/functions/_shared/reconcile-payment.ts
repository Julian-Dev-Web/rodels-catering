import { admin, paymongo, secret } from './http.ts'
import { reconcileCheckout, type CheckoutRecord } from './checkout-reconciliation.ts'
export function reconcilePayment(p:CheckoutRecord) {
  const db=admin()
  return reconcileCheckout(p,{
    live:secret('PAYMONGO_SECRET_KEY').startsWith('sk_live_'),
    retrieve:id=>paymongo(`checkout_sessions/${encodeURIComponent(id)}`),
    expire:id=>paymongo(`checkout_sessions/${encodeURIComponent(id)}/expire`,{}),
    confirm:async(session,payment,amount)=>{const{error}=await db.rpc('confirm_provider_payment',{event_id:`reconcile:${session}:${payment}`,session_id:session,provider_payment_id:payment,amount});if(error)throw error},
    release:async(payment,session)=>{const{error}=await db.rpc('release_checkout',{payment_id:payment,confirmed_session_id:session});if(error)throw error},
  })
}
