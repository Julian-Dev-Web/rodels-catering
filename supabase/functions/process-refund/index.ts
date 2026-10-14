import {
  admin,
  authenticated,
  endpoint,
  json,
  paymongo,
  secret,
} from '../_shared/http.ts'
type ProviderRefund = { id: string; amount: number; status: string }
endpoint(async (req) => {
  const { client } = await authenticated(req)
  const { data: role, error: roleError } = await client.rpc('current_app_role')
  if (roleError || !['manager', 'super_admin'].includes(role))
    throw new Error('Active staff access required')
  secret('PAYMONGO_SECRET_KEY')
  const { refund_id } = await req.json()
  const db = admin()
  const { data: claim, error } = await db.rpc('claim_refund', {
    fid: refund_id,
  })
  if (error) throw error
  const ids: ProviderRefund[] = []
  for (const op of claim.operations) {
    const { data: operation, error: claimError } = await db.rpc(
      'claim_refund_operation',
      {
        operation_id: op.id,
      },
    )
    if (claimError) throw claimError
    const result = operation.newly_claimed
      ? await paymongo('refunds', {
          data: {
            attributes: {
              amount: op.amount,
              payment_id: op.external_payment_id,
              reason: 'requested_by_customer',
              notes: `Rodel refund ${refund_id}; operation ${op.id}`,
            },
          },
        })
      : await paymongo(
          `refunds/${encodeURIComponent(operation.external_refund_id)}`,
        )
    if (
      result.attributes.amount !== op.amount ||
      result.attributes.payment_id !== op.external_payment_id ||
      result.attributes.currency !== 'PHP' ||
      result.attributes.livemode !==
        secret('PAYMONGO_SECRET_KEY').startsWith('sk_live_')
    )
      throw new Error('Provider refund does not match the planned allocation')
    const status = result.attributes.status
    if (!['pending', 'processing', 'succeeded', 'failed'].includes(status))
      throw new Error(
        'Unrecognized provider refund status; reconcile before retry',
      )
    const { error: opError } = await db
      .from('refund_operations')
      .update({ external_refund_id: result.id, status })
      .eq('id', op.id)
    if (opError)
      throw new Error(
        'Provider refund needs manual reconciliation before retry',
      )
    ids.push({ id: result.id, amount: op.amount, status })
  }
  const { error: saveError } = await db
    .from('refunds')
    .update({ external_refund_ids: ids })
    .eq('id', refund_id)
  if (saveError) throw saveError
  if (
    ids.reduce(
      (sum, r) => sum + (r.status === 'succeeded' ? r.amount : 0),
      0,
    ) === claim.refund.eligible_amount
  ) {
    const { error: finishError } = await db.rpc('finish_refund', {
      fid: refund_id,
    })
    if (finishError) throw finishError
    return json({ status: 'completed' })
  }
  return json({
    status: 'pending',
    message:
      'Provider refund pending. Use Check provider status to reconcile; no duplicate refund is created.',
  })
})
