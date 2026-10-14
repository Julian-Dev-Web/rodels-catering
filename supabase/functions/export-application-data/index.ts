import { admin, authenticated } from '../_shared/http.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const appOrigin = new URL(Deno.env.get('APP_URL') || 'http://localhost:5173').origin
  const allowed = !origin || [appOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
  } })
  if (!allowed) return respond({ error: 'Origin not allowed' }, 403)
  if (req.method === 'OPTIONS') return respond({})
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  let identity
  try { identity = await authenticated(req) } catch { return respond({ error: 'Authentication required' }, 401) }
  try {
    const { data: role, error: roleError } = await identity.client.rpc('current_app_role')
    if (roleError || role !== 'super_admin') return respond({ error: 'Super admin required' }, 403)
    const service = admin()
    const { data: recent, error: recentError } = await service.from('audit_logs').select('id').eq('actor_id', identity.user.id).eq('action', 'backup.application_export_created').gte('created_at', new Date(Date.now() - 60000).toISOString()).limit(1)
    if (recentError) throw new Error('Could not check export history')
    if (recent?.length) return respond({ error: 'An export was just generated. Wait one minute before creating another.' }, 429)
    const { data: snapshot, error } = await service.rpc('export_application_snapshot')
    if (error || !snapshot) throw new Error('Could not generate the export. Large datasets require a PostgreSQL backup.')
    const file_content = JSON.stringify(snapshot)
    const bytes = new TextEncoder().encode(file_content)
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
    const filename = `RodelConnect_application_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const counts = Object.values(snapshot.counts) as number[]
    const row_count = counts.reduce((sum, n) => sum + n, 0), table_count = counts.length
    const { error: auditError } = await service.from('audit_logs').insert({ actor_id: identity.user.id, action: 'backup.application_export_created', entity_id: crypto.randomUUID(), details: { filename, sha256, row_count, table_count, bytes: bytes.length } })
    if (auditError) throw new Error('Could not record the export audit. Try again later.')
    return respond({ filename, file_content, sha256, row_count, table_count })
  } catch (e) { return respond({ error: e instanceof Error ? e.message : 'Export failed' }, 400) }
})
