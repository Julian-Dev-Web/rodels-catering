import { authenticated, endpoint, json } from '../_shared/http.ts'
endpoint(async (req) => {
  const { client } = await authenticated(req)
  const { target_id, target_role } = await req.json()
  if (!['customer', 'manager'].includes(target_role) || typeof target_id !== 'string')
    throw new Error('Invalid role assignment')
  const { error } = await client.rpc('admin_set_role', { target_id, target_role })
  if (error) throw error
  return json({ success: true })
})
