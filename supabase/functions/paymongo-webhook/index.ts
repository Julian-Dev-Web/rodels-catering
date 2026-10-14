import { admin, paymongo, secret } from '../_shared/http.ts'
import { verifySignature } from '../_shared/signature.ts'
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const raw = await req.text()
    if (raw.length > 1000000) return new Response('Too large', { status: 413 })
    const live = secret('PAYMONGO_SECRET_KEY').startsWith('sk_live_')
    if (
      !(await verifySignature(
        raw,
        req.headers.get('Paymongo-Signature') || '',
        secret('PAYMONGO_WEBHOOK_SECRET'),
        live,
      ))
    )
      return new Response('Invalid signature', { status: 401 })
    const event = JSON.parse(raw).data
    if (event.attributes.type !== 'checkout_session.payment.paid')
      return new Response('Ignored', { status: 200 })
    const payload = event.attributes.data
    // Independently fetch current provider state; signed payload and server API must agree.
    const session = await paymongo(`checkout_sessions/${encodeURIComponent(payload.id)}`)
    const payments = session.attributes.payments || []
    const payment = payments.find(
      (p: { attributes: { status: string } }) => p.attributes.status === 'paid',
    )
    if (!payment || payment.attributes.currency !== 'PHP' || session.attributes.livemode !== live)
      return new Response('Provider state mismatch', { status: 422 })
    const { error } = await admin().rpc('confirm_provider_payment', {
      event_id: event.id,
      session_id: session.id,
      provider_payment_id: payment.id,
      amount: payment.attributes.amount,
    })
    if (error) return new Response('Payment reconciliation failed', { status: 500 })
    return new Response('OK', { status: 200 })
  } catch {
    return new Response('Webhook processing failed; retry required', { status: 500 })
  }
})
