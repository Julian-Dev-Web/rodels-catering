// Run as a restricted scheduled worker. Secrets come only from environment variables.
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMAIL_WORKER_SECRET } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !EMAIL_WORKER_SECRET)
  throw new Error('Set server-only worker environment variables first')
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}
const queue = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pending_notification_emails`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ limit_count: 50 }),
})
if (!queue.ok) throw new Error('Email queue read failed')
const pending = await queue.json()
for (const item of pending) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${EMAIL_WORKER_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: item.id }),
  })
  if (!res.ok) throw new Error('Email delivery failed; retry the worker later')
}
console.log(`Processed ${pending.length} transactional notifications.`)
