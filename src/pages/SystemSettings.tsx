import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  setupItems,
  validateWeddingPrices,
  POLICY_VERSION,
} from '../lib/booking'
import { rpc } from '../lib/supabase'
import { money } from '../lib/format'
import { ErrorState, Loading, PageHeading } from '../components/ui'
export function SystemSettings() {
  const query = useQuery({
    queryKey: ['wedding-prices'],
    queryFn: () =>
      rpc<Record<string, number> | null>('wedding_price_configuration'),
  })
  const [prices, setPrices] = useState<Record<string, string>>({}),
    [approved, setApproved] = useState(false),
    qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      const values = Object.fromEntries(
        setupItems.map((item) => [
          item.key,
          Math.round(
            Number(
              prices[item.key] ??
                (query.data?.[item.key] === undefined
                  ? ''
                  : query.data[item.key] / 100),
            ) * 100,
          ),
        ]),
      )
      if (
        !approved ||
        setupItems.some(
          (item) =>
            (prices[item.key] ??
              (query.data?.[item.key] === undefined
                ? ''
                : String(query.data[item.key] / 100))) === '',
        ) ||
        !validateWeddingPrices(values)
      )
        throw new Error(
          'Enter six owner-approved prices totalling exactly ₱30,000, then confirm owner approval.',
        )
      return rpc('configure_wedding_prices', {
        prices: values,
        owner_approved: approved,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries()
      setApproved(false)
    },
  })
  return (
    <>
      <PageHeading
        eyebrow="SUPER ADMIN · SYSTEM SETTINGS"
        title="Approved policy and setup configuration."
      >
        Current booking/refund policy is version {POLICY_VERSION}. Changes to
        commercial/legal policy require owner review.
      </PageHeading>
      <section className="panel">
        <h2>Current customer policy</h2>
        <p>
          50% down payment or 100% full payment; a later balance checkout
          settles the remainder. Refund requests require an approved
          cancellation and at least five full calendar days before the scheduled
          event start in Manila. The policy fee is 10% of paid money, with
          previous refunds deducted from the single cumulative entitlement.
        </p>
        <p>
          Existing reviewed refund amounts remain frozen; this release does not
          overwrite them.
        </p>
        <div className="actions">
          <Link className="text-button" to="/terms">
            Terms and Conditions
          </Link>
          <Link className="text-button" to="/privacy">
            Privacy Notice
          </Link>
          <Link className="text-button" to="/super-admin/maintenance">
            Website maintenance
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Wedding component prices</h2>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} />
        ) : (
          <>
            <p>
              {query.data
                ? 'An owner-approved breakdown is configured.'
                : 'Price breakdown pending. Full six-item bundle: ₱30,000. Partial configurations are blocked until approved prices are supplied.'}
            </p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault()
                mutation.mutate()
              }}
            >
              <div className="form-grid">
                {setupItems.map((item) => (
                  <label key={item.key}>
                    {item.label} · PHP
                    <input
                      type="number"
                      min={0}
                      max={30000}
                      step="0.01"
                      required
                      value={
                        prices[item.key] ??
                        (query.data?.[item.key] === undefined
                          ? ''
                          : String(query.data[item.key] / 100))
                      }
                      onChange={(e) =>
                        setPrices({ ...prices, [item.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <p>
                Required total: {money(3000000)}. No automatic equal-price split
                is applied.
              </p>
              <label className="consent-check">
                <input
                  type="checkbox"
                  required
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />
                <span>
                  The business owner approved this exact six-item breakdown.
                </span>
              </label>
              <button className="button" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : 'Save approved breakdown'}
              </button>
              {mutation.error && <ErrorState error={mutation.error} />}
              {mutation.isSuccess && (
                <p role="status">Approved breakdown saved and audited.</p>
              )}
            </form>
          </>
        )}
      </section>
    </>
  )
}
