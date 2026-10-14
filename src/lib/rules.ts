// Frontend previews only. The database independently enforces these rules.
export function paymentAmount(total: number, paid: number, intent: 'partial' | 'full' | 'balance') {
  if (total <= 0 || paid < 0 || paid >= total) throw new Error('Nothing to pay')
  if (intent === 'partial' && paid === 0) return Math.ceil(total / 2)
  if (intent === 'full' && paid === 0) return total
  if (intent === 'balance' && paid > 0) return total - paid
  throw new Error('Invalid payment intent')
}
