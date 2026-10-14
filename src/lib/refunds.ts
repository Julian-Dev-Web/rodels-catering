import type { RecordRow } from '../types'
export function refundProcessing(row: RecordRow) {
  if (row.status === 'completed') return 'Completed · provider confirmed'
  if (row.status === 'rejected') return 'Denied · contact support'
  if (row.status === 'pending') return 'Awaiting staff review'
  if (!row.processing) return 'Approved · awaiting provider processing'
  const operations = Array.isArray(row.external_refund_ids)
    ? row.external_refund_ids
    : []
  if (operations.some((operation) => operation?.status === 'failed'))
    return 'Provider failed · manual reconciliation required'
  if (
    operations.some((operation) =>
      ['pending', 'processing'].includes(operation?.status),
    )
  )
    return 'Provider confirmation pending'
  return 'Processing started · staff/provider reconciliation required'
}
