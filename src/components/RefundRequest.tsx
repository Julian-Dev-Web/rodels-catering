import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { rpc } from '../lib/supabase'
import { dateTime, money } from '../lib/format'
import { Action, ErrorState, Loading } from './ui'
import type { Reservation } from '../types'
export interface RefundPreview {
  eligible: boolean
  reason: string
  cutoff_at: string
  gross_amount: number
  fee_amount: number
  eligible_amount: number
  previously_refunded: number
  policy_version: string
}
export function RefundRequest({ reservation }: { reservation: Reservation }) {
  const query = useQuery({
    queryKey: [
      'refund-preview',
      reservation.id,
      reservation.status,
      reservation.refunded,
    ],
    queryFn: () =>
      rpc<RefundPreview>('refund_preview', { rid: reservation.id }),
    refetchInterval: 30000,
  })
  if (query.isPending) return <Loading />
  if (query.error) return <ErrorState error={query.error} />
  const amount = query.data
  return (
    <section className="refund-preview">
      <h3>Refund policy review</h3>
      <p>
        Request cutoff: <strong>{dateTime(amount.cutoff_at)} Manila</strong>.
        Requests require an approved cancellation and staff review.
      </p>
      <dl className="system-counts">
        <div>
          <dt>Amount paid</dt>
          <dd>{money(reservation.paid)}</dd>
        </div>
        <div>
          <dt>Previously refunded</dt>
          <dd>{money(amount.previously_refunded)}</dd>
        </div>
        <div>
          <dt>Unrefunded paid amount</dt>
          <dd>{money(amount.gross_amount)}</dd>
        </div>
        <div>
          <dt>Policy fee remaining (10% once)</dt>
          <dd>{money(amount.fee_amount)}</dd>
        </div>
        <div>
          <dt>Requested refund</dt>
          <dd>{money(amount.eligible_amount)}</dd>
        </div>
      </dl>
      {amount.eligible ? (
        <Action
          label="Request refund"
          confirm={`Request ${money(amount.eligible_amount)} after the disclosed fee? Staff must review it; completion requires provider confirmation.`}
          run={() => rpc('request_refund', { rid: reservation.id })}
        />
      ) : (
        <p className="policy-explanation">
          {amount.reason} <Link to="/customer/support">Contact support</Link>
        </p>
      )}
    </section>
  )
}
