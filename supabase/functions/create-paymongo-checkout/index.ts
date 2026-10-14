import { admin, authenticated, endpoint, json, paymongo, secret } from '../_shared/http.ts'
endpoint(async (req) => {
  const { client, user } = await authenticated(req)
  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'customer') throw new Error('Customer access required')
  secret('PAYMONGO_SECRET_KEY')
  const base = new URL(secret('APP_URL')).origin
  const { reservation_id, intent } = await req.json()
  if (typeof reservation_id !== 'string' || !['partial', 'full', 'balance'].includes(intent))
    throw new Error('Invalid checkout request')
  const db = admin()
  const { data: p, error } = await db.rpc('begin_checkout', {
    rid: reservation_id,
    customer: user.id,
    payment_intent: intent,
  })
  if (error) throw error
  if (p.checkout_url) return json({ url: p.checkout_url, payment_id: p.id })
  const { data: claim, error: claimError } = await db
    .from('payments')
    .update({ provider_claimed_at: new Date().toISOString() })
    .eq('id', p.id)
    .is('provider_claimed_at', null)
    .select('id')
    .maybeSingle()
  if (claimError || !claim)
    throw new Error(
      'Checkout creation is in progress or needs provider reconciliation. Contact support.',
    )
  const session = await paymongo('checkout_sessions', {
    data: {
      attributes: {
        description: `Rodel's Catering reservation ${reservation_id}`,
        reference_number: p.id,
        line_items: [
          { name: `Catering ${intent} payment`, amount: p.amount, currency: 'PHP', quantity: 1 },
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
    !(url.hostname === 'checkout.paymongo.com' || url.hostname.endsWith('.paymongo.com'))
  )
    throw new Error('Unexpected provider URL')
  const { error: saveError } = await db
    .from('payments')
    .update({ external_session_id: session.id, checkout_url: url.toString() })
    .eq('id', p.id)
  if (saveError)
    throw new Error('Checkout created but could not be saved. Contact support before retrying.')
  return json({ url: url.toString(), payment_id: p.id })
})
