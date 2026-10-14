import { admin, endpoint, json, secret } from '../_shared/http.ts'
// Internal worker only. Recipient and content are derived from a persisted notification.
endpoint(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${secret('EMAIL_WORKER_SECRET')}`)
    throw new Error('Internal worker authentication required')
  const { notification_id } = await req.json()
  const db = admin()
  const { data: n, error } = await db
    .from('notifications')
    .select('*')
    .eq('id', notification_id)
    .single()
  if (error) throw error
  const { data: existing } = await db
    .from('email_deliveries')
    .select('id')
    .eq('notification_id', notification_id)
    .maybeSingle()
  if (existing) return json({ status: 'already_sent' })
  const {
    data: { user },
    error: userError,
  } = await db.auth.admin.getUserById(n.user_id)
  if (userError || !user?.email) throw new Error('Recipient unavailable')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `notification-${notification_id}`,
    },
    body: JSON.stringify({
      from: secret('EMAIL_FROM'),
      to: [user.email],
      subject: n.title,
      text: `${n.body}\n\n${secret('APP_URL')}${n.href}`,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error('Email provider failed')
  const result = await res.json()
  const { error: saveError } = await db
    .from('email_deliveries')
    .upsert({ notification_id, provider_id: result.id }, { onConflict: 'notification_id' })
  if (saveError) throw saveError
  return json({ status: 'sent' })
})
