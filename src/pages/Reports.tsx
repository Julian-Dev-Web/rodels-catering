import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReservations } from '../features/reservations'
import { useCatalog } from '../features/catalog'
import { records } from '../lib/supabase'
import { date, dateTime, dayManila, human } from '../lib/format'
import {
  filterReportRows,
  paymentReportRows,
  paymentSummary,
  reservationReportRows,
  reservationSummary,
  downloadReportCsv,
  downloadReportPdf,
  printReport,
  type ReportDocument,
} from '../lib/reports'
import { DataTable, ErrorState, Loading, PageHeading } from '../components/ui'
import type { RecordRow } from '../types'
export function Reports({ paymentsOnly = false }: { paymentsOnly?: boolean }) {
  const bookings = useReservations(),
    catalog = useCatalog({ includeArchived: true }),
    data = useQuery({
      queryKey: ['complete-report-data'],
      queryFn: async () => {
        const [transactions, payments, balances, seating, extras, addons] =
          await Promise.all(
            [
              'transactions',
              'payments',
              'balances',
              'reservation_tables_chairs',
              'reservation_event_features',
              'reservation_add_ons',
            ].map((t) =>
              records<RecordRow>(
                t,
                [
                  'balances',
                  'reservation_tables_chairs',
                  'reservation_event_features',
                  'reservation_add_ons',
                ].includes(t)
                  ? 'reservation_id'
                  : 'created_at',
              ),
            ),
          )
        return { transactions, payments, balances, seating, extras, addons }
      },
    })
  const [mode, setMode] = useState(paymentsOnly ? 'payments' : 'reservations'),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState('all'),
    [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState<unknown>(null)
  useEffect(
    () => setMode(paymentsOnly ? 'payments' : 'reservations'),
    [paymentsOnly],
  )
  const rows = useMemo(() => {
    if (!bookings.data || !data.data) return []
    return mode === 'payments'
      ? paymentReportRows(
          bookings.data,
          data.data.transactions,
          data.data.payments,
          data.data.balances,
        )
      : reservationReportRows(bookings.data).map((r) => ({
          ...r,
          chair_quantity:
            data.data.seating
              .filter((s) => s.reservation_id === r.id)
              .map(
                (s) =>
                  (catalog.data?.chair_types.find(
                    (c) => c.id === s.chair_type_id,
                  )?.name || 'Archived chair') +
                  ' × ' +
                  s.chair_quantity,
              )
              .join('; ') || 'Not selected',
          extras: bookings.data.find((b) => b.id === r.id)?.selection_snapshot
            ? r.extras
            : [
                ...data.data.extras
                  .filter((x) => x.reservation_id === r.id)
                  .map(
                    (x) =>
                      catalog.data?.event_features.find(
                        (c) => c.id === x.event_feature_id,
                      )?.name || 'Archived feature',
                  ),
                ...data.data.addons
                  .filter((x) => x.reservation_id === r.id)
                  .map(
                    (x) =>
                      (catalog.data?.add_ons.find((c) => c.id === x.add_on_id)
                        ?.name || 'Archived add-on') +
                      ' × ' +
                      x.quantity,
                  ),
              ].join('; ') + ' · Historical unit charges not recorded',
        }))
  }, [bookings.data, data.data, catalog.data, mode])
  const filtered = filterReportRows(
      rows,
      start,
      end,
      search,
      kind,
      mode === 'payments' ? 'created_at' : 'event_date',
    ),
    invalid = !!start && !!end && end < start
  if (bookings.isPending || data.isPending || catalog.isPending)
    return <Loading />
  if (bookings.error || data.error || catalog.error)
    return <ErrorState error={bookings.error || data.error || catalog.error} />
  const numeric = (n: number) =>
    n.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  const ps = paymentSummary(filtered),
    rs = reservationSummary(filtered)
  const summary =
    mode === 'payments'
      ? [
          `Verified receipts: PHP ${numeric(ps.received)}. Completed refunds: PHP ${numeric(ps.refunded)}. Net received: PHP ${numeric(ps.net)}.`,
          `Current outstanding balance for ${ps.bookings} unique included bookings: PHP ${numeric(ps.outstanding)}. Pending attempts contribute no receipts.`,
        ]
      : [
          `${filtered.length} bookings: ${rs.pending} pending, ${rs.confirmed} approved/completed, ${rs.upcoming} upcoming approved events.`,
          `Saved reservation totals: PHP ${numeric(rs.total)}. These totals include expected amounts; they are not verified receipts.`,
        ]
  const columns =
    mode === 'payments'
      ? [
          { key: 'reservation', label: 'Reservation reference' },
          { key: 'reference', label: 'Ledger reference' },
          { key: 'customer', label: 'Customer' },
          { key: 'event', label: 'Event' },
          {
            key: 'event_date',
            label: 'Event date',
            render: (r: RecordRow) =>
              r.event_date ? date(String(r.event_date)) : 'Not provided',
          },
          { key: 'paid_at', label: 'Verified date (Manila)' },
          { key: 'payment_type', label: 'Payment type' },
          { key: 'method', label: 'Processor / method' },
          { key: 'status', label: 'Status' },
          { key: 'received', label: 'Received (PHP)' },
          { key: 'refunded', label: 'Refund (PHP)' },
          { key: 'balance', label: 'Current balance (PHP)' },
        ]
      : [
          { key: 'reservation', label: 'Reservation reference' },
          { key: 'customer', label: 'Customer' },
          { key: 'event', label: 'Event' },
          { key: 'event_type', label: 'Type' },
          {
            key: 'event_date',
            label: 'Event date',
            render: (r: RecordRow) => date(String(r.event_date)),
          },
          { key: 'event_time', label: 'Start time' },
          { key: 'guests', label: 'Guests' },
          { key: 'status', label: 'Status' },
          { key: 'total', label: 'Total (PHP)' },
          { key: 'chair_quantity', label: 'Guest chairs' },
          { key: 'theme', label: 'Theme' },
          { key: 'colors', label: 'Colors' },
          { key: 'extras', label: 'Saved seating / extras (PHP)' },
        ]
  const report: ReportDocument = {
    title:
      mode === 'payments'
        ? 'Verified payments and refunds'
        : 'Reservation report',
    generated: dateTime(new Date().toISOString()) + ' Manila',
    filters: `${mode === 'payments' ? 'Ledger date' : 'Event date'} ${start || 'All'} to ${end || 'All'}; ${human(kind)}; search: ${search || 'None'}`,
    summary,
    headers: columns.map((c) => c.label),
    rows: filtered.map((r) =>
      columns.map((c) =>
        typeof r[c.key] === 'number'
          ? (r[c.key] as number)
          : String(
              c.key === 'event_date'
                ? r.event_date
                  ? date(r.event_date)
                  : 'Not provided'
                : (r[c.key] ?? 'Not provided'),
            ),
      ),
    ),
    filename:
      'rodelconnect-' + mode + '-' + (start || 'all') + '-to-' + (end || 'all'),
  }
  async function exportFile(format: 'csv' | 'pdf' | 'print') {
    setExportError(null)
    setExporting(true)
    try {
      if (format === 'csv') downloadReportCsv(report)
      else if (format === 'pdf') await downloadReportPdf(report)
      else await printReport(report)
    } catch (e) {
      setExportError(e)
    } finally {
      setExporting(false)
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MANAGER · REPORTS"
        title={
          mode === 'payments'
            ? 'Payments, with a clear paper trail.'
            : 'Understand your reservations.'
        }
      >
        Exports include all matching authorized records across every page.
        Amounts are in PHP; times use Manila.
      </PageHeading>
      <div className="filter-bar">
        {!paymentsOnly && (
          <label>
            Report
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value)
                setKind('all')
              }}
            >
              <option value="reservations">Reservations</option>
              <option value="payments">Verified payments/refunds</option>
            </select>
          </label>
        )}
        <label>
          From
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          {mode === 'payments' ? 'Ledger type' : 'Booking status'}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {(mode === 'payments'
              ? ['all', 'payment', 'refund']
              : [
                  'all',
                  'Draft',
                  'Pending',
                  'For approval',
                  'Approved',
                  'Completed',
                  'Rejected',
                  'Cancelled',
                  'Pending cancellation',
                  'Pending refund',
                  'Refund approved',
                  'Refunded',
                ]
            ).map((k) => (
              <option value={k} key={k}>
                {human(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {invalid ? (
        <p className="field-error" role="alert">
          The end date must be on or after the start date.
        </p>
      ) : (
        <>
          <section className="panel report-summary">
            <h2>Filtered analysis</h2>
            {summary.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </section>
          <div className="actions">
            {(['csv', 'pdf', 'print'] as const).map((f) => (
              <button
                className="button secondary"
                key={f}
                disabled={exporting}
                onClick={() => void exportFile(f)}
              >
                {f === 'print' ? 'Print report' : 'Download ' + f.toUpperCase()}
              </button>
            ))}
          </div>
          {exportError && <ErrorState error={exportError} />}
          <DataTable
            rows={filtered}
            columns={columns}
            searchValue={search}
            onSearchChange={setSearch}
          />
        </>
      )}
      {paymentsOnly && (
        <section className="panel">
          <h2>Checkout attempts · not verified receipts</h2>
          <p>
            Pending/failed attempts are excluded from the financial totals and
            receipt exports above. Checkout method is not stored; no card/wallet
            method is assumed.
          </p>
          <DataTable
            rows={(data.data?.payments || [])
              .filter(
                (p) =>
                  (!start || dayManila(String(p.created_at)) >= start) &&
                  (!end || dayManila(String(p.created_at)) <= end),
              )
              .map((p) => ({
                ...p,
                reservation:
                  bookings.data?.find((r) => r.id === p.reservation_id)
                    ?.reservation_reference || 'Reference unavailable',
                amount_php: Number(p.amount) / 100,
              }))}
            columns={[
              { key: 'reservation', label: 'Reservation' },
              { key: 'record_reference', label: 'Checkout reference' },
              { key: 'intent', label: 'Intent' },
              { key: 'status', label: 'State' },
              { key: 'amount_php', label: 'Attempted (PHP)' },
              {
                key: 'created_at',
                label: 'Created (Manila)',
                render: (r) => dateTime(String(r.created_at)),
              },
            ]}
          />
        </section>
      )}
    </>
  )
}
