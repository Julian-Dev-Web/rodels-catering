import { admin, paymongo, secret } from './http.ts'
import { reconcileCheckout, type CheckoutRecord,type CheckoutSession } from './checkout-reconciliation.ts'
export function reconcilePayment(p:CheckoutRecord,closeUnpaid=false) {
  const db=admin()
  let current:CheckoutSession|undefined
  return reconcileCheckout(p,{
    live:secret('PAYMONGO_SECRET_KEY').startsWith('sk_live_'),
    retrieve:async id=>{current=await paymongo(`checkout_sessions/${encodeURIComponent(id)}`);return current!},
    expire:id=>paymongo(`checkout_sessions/${encodeURIComponent(id)}/expire`,{}),
    confirm:async(session,payment,amount)=>{const attributes=current?.attributes.payments?.find(p=>p.id===payment)?.attributes;const at=attributes?.paid_at??attributes?.created_at;const{error}=await db.rpc('confirm_provider_receipt',{event_id:`reconcile:${session}:${payment}`,session_id:session,provider_payment_id:payment,amount,method:attributes?.source?.type||attributes?.sources?.[0]?.type||'paymongo',received_at:at?new Date(at*1000).toISOString():null,provider_metadata:current?.attributes.metadata});if(error)throw error},
    release:async(payment,session)=>{const{error}=await db.rpc('release_checkout',{payment_id:payment,confirmed_session_id:session});if(error)throw error},
  },closeUnpaid)
}
