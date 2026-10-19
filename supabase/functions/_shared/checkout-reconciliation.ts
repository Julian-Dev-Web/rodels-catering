// Release only after a provider-confirmed terminal session. A failed attempt or
// a local 24-hour timestamp alone cannot invalidate a payable checkout URL.
export interface CheckoutRecord {id:string;external_session_id:string|null;provider_claimed_at:string|null}
interface ProviderPayment {id:string;attributes:{status:string;currency?:string;amount?:number}}
export interface CheckoutSession {id:string;attributes:{status:string;livemode:boolean;payments?:ProviderPayment[]}}
interface Reconciliation {
  retrieve:(id:string)=>Promise<CheckoutSession>
  expire:(id:string)=>Promise<unknown>
  confirm:(session:string,payment:string,amount:number)=>Promise<void>
  release:(payment:string,session:string|null)=>Promise<void>
  live:boolean
}
export async function reconcileCheckout(p:CheckoutRecord,api:Reconciliation):Promise<'paid'|'released'|'pending'> {
  if(!p.external_session_id){
    if(p.provider_claimed_at)throw Error('Checkout creation needs provider reconciliation. Contact the manager before retrying.')
    await api.release(p.id,null);return 'released'
  }
  const check=async()=>{
    const s=await api.retrieve(p.external_session_id!)
    if(s.id!==p.external_session_id||s.attributes.livemode!==api.live)throw Error('Provider session mismatch; checkout remains held.')
    const paid=(s.attributes.payments||[]).find(x=>x.attributes.status==='paid')
    if(paid){
      if(paid.attributes.currency!=='PHP'||!Number.isSafeInteger(paid.attributes.amount)||Number(paid.attributes.amount)<=0)throw Error('Provider payment mismatch; reconciliation required.')
      await api.confirm(s.id,paid.id,Number(paid.attributes.amount));return 'paid' as const
    }
    if((s.attributes.payments||[]).some(x=>['pending','processing'].includes(x.attributes.status)))return 'pending' as const
    if(s.attributes.status==='expired'){await api.release(p.id,s.id);return 'released' as const}
    return 'active' as const
  }
  const before=await check();if(before!=='active')return before
  // Expiry can lose a race to payment. Re-fetch even after a provider rejection;
  // only independently fetched paid/expired state permits a database transition.
  try{await api.expire(p.external_session_id)}catch{/* Keep held unless fresh provider state proves otherwise. */}
  const after=await check();return after==='active'?'pending':after
}
