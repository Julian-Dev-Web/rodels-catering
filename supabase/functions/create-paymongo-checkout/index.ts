import {
  admin,
  authenticated,
  endpoint,
  json,
  paymongo,
  secret,
} from '../_shared/http.ts'
import { reconcilePayment } from '../_shared/reconcile-payment.ts'
endpoint(async (req) => {
  const { client, user } = await authenticated(req)
  const { data: role, error: roleError } = await client.rpc('current_app_role')
  if (roleError || role !== 'customer')
    throw new Error('Active customer access required')
  secret('PAYMONGO_SECRET_KEY')
  const base = new URL(secret('APP_URL')).origin
  const { reservation_id, intent, expected_total, expected_quote_at } = await req.json()
  if (
    typeof reservation_id !== 'string' ||
    !['partial', 'full', 'balance'].includes(intent)
  )
    throw new Error('Invalid checkout request')
  const {data:pending,error:pendingError}=await client.from('payments').select('id,reservation_id,amount,external_session_id,provider_claimed_at,expires_at,checkout_url').eq('reservation_id',reservation_id).eq('status','pending').maybeSingle()
  if(pendingError)throw pendingError
  if(pending){
    let state;try{state=await reconcilePayment(pending)}catch{return json({state:'checking',message:'Your existing payment needs verification. Please wait before trying another payment.'},202)}
    if(state==='paid')return json({already_verified:true,state:'updated'})
    if(state==='pending')return json({state:'checking',message:'PayMongo is still processing your payment.'},202)
    if(state==='active'&&pending.checkout_url)return json({url:pending.checkout_url,payment_id:pending.id,resumed:true,amount:pending.amount})
  }
  const current=await client.rpc('payment_summary',{rid:reservation_id});if(current.error)throw current.error
  if(current.data.remaining<=0||(['partial','full'].includes(intent)&&current.data.net_paid>0))return json({already_verified:true,state:'updated',summary:current.data})
  const {data:quote,error:quoteError}=await client.rpc('prepare_checkout_quote',{
    rid:reservation_id,
    expected_total:Number.isSafeInteger(expected_total)?expected_total:null,
    expected_quote_at:typeof expected_quote_at==='string'&&expected_quote_at.length<100?expected_quote_at:null,
  })
  if(quoteError)throw quoteError
  // Persist and display the refreshed quote before reserving a provider payment.
  if(quote.quote_updated)return json({quote_updated:true,total:quote.total})
  const profile=await client.from('profiles').select('full_name').eq('id',user.id).single()
  if(profile.error)throw Error('Could not load your account billing details')
  const db = admin()
  const { data: p, error } = await db.rpc('begin_checkout', {
    rid: reservation_id,
    customer: user.id,
    payment_intent: intent,
  })
  if (error) {
    const settled=await client.rpc('payment_summary',{rid:reservation_id})
    if(!settled.error&&(settled.data.remaining<=0||(['partial','full'].includes(intent)&&settled.data.net_paid>0)))return json({already_verified:true,state:'updated',summary:settled.data})
    throw error
  }
  if (p.checkout_url) return json({ url: p.checkout_url, payment_id: p.id })
  const { data: claim, error: claimError } = await db
    .from('payments')
    .update({ provider_claimed_at: new Date().toISOString() })
    .eq('id', p.id)
    .eq('status', 'pending')
    .is('provider_claimed_at', null)
    .select('id')
    .maybeSingle()
  if(claimError)throw claimError
  if(!claim)return json({state:'checking',message:'Your checkout is being prepared. Please wait while we check its status.'},202)
  const session = await paymongo('checkout_sessions', {
    data: {
      attributes: {
        billing: {email:user.email,name:profile.data.full_name||'RodelConnect customer'},
        description: `Rodel's Catering reservation ${current.data.reference}`,
        reference_number: p.id,
        line_items: [
          {
            name: `Catering ${intent} payment`,
            amount: p.amount,
            currency: 'PHP',
            quantity: 1,
          },
        ],
        payment_method_types: ['gcash', 'card'],
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        success_url: `${base}/customer/reservations/${reservation_id}?payment=return`,
        cancel_url: `${base}/customer/reservations/${reservation_id}?payment=cancelled`,
        metadata: { payment_id: p.id, reservation_id },
      },
    },
  })
  const url = new URL(session.attributes.checkout_url)
  if (
    url.protocol !== 'https:' ||
    !(
      url.hostname === 'checkout.paymongo.com' ||
      url.hostname.endsWith('.paymongo.com')
    )
  )
    throw new Error('Unexpected provider URL')
  const { error: saveError } = await db
    .from('payments')
    .update({ external_session_id: session.id, checkout_url: url.toString() })
    .eq('id', p.id)
  if (saveError)
    throw new Error(
      'Checkout created but could not be saved. Contact support before retrying.',
    )
  return json({ url: url.toString(), payment_id: p.id })
})
