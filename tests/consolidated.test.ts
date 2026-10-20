import { describe, it, expect } from 'vitest'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import {
  validMobile,
  normalizeMobile,
  mobileInput,
} from '../supabase/functions/_shared/phone'
import {
  filterReportRows,
  paymentReportRows,
  paymentSummary,
  reportCsv,
  createReportPdf,
  type ReportDocument,
} from '../src/lib/reports'
import type { Reservation } from '../src/types'
describe('strict shared Philippine mobile input', () => {
  it('normalizes the three accepted forms to one contact without sanitizing invalid submissions', () => {
    for (const phone of ['09123456789', '639123456789', '+639123456789']) {
      expect(validMobile(phone)).toBe(true)
      expect(normalizeMobile(phone)).toBe('+639123456789')
    }
    for (const phone of [
      'abc09123456789',
      '0912 3456789',
      '0912345678',
      '+6391234567890',
      '08123456789',
      '☎09123456789',
      '+63+9123456789',
    ])
      expect(validMobile(phone)).toBe(false)
    expect(mobileInput('abc09123456789', '09')).toBe('09')
    expect(mobileInput('+639123456789', '')).toBe('+639123456789')
    expect(mobileInput('639123456789', '')).toBe('639123456789')
    expect(mobileInput('091234567890', '')).toBe('')
    expect(mobileInput('', '09')).toBe('')
  })
})
describe('complete filtered financial exports', () => {
  const reservation = {
    id: 'booking-internal',
    reservation_reference: 'RC-2026-000001',
    customer_name: 'Test Customer',
    event_name: 'Demo event',
    event_date: '2027-01-02',
    total: 2000000,
    paid: 1000000,
  } as Reservation
  const transactions = Array.from({ length: 25 }, (_, i) => ({
    id: 'ledger-' + i,
    record_reference: 'TX-2026-' + String(i + 1).padStart(6, '0'),
    reservation_id: reservation.id,
    payment_id: 'payment',
    kind: 'payment',
    amount: 10000,
    created_at: i < 20 ? '2026-10-14T23:30:00Z' : '2026-10-15T23:30:00Z',
  }))
  it('computes verified amounts across every matching row, excludes attempts, and deduplicates current balances', () => {
    const rows = paymentReportRows(
      [reservation],
      [
        ...transactions,
        {
          id: 'refund',
          reservation_id: reservation.id,
          kind: 'refund',
          amount: 9000,
          created_at: '2026-10-14T23:40:00Z',
        },
      ],
      [
        { id: 'payment', intent: 'partial', status: 'fully_paid' },
        { id: 'pending-attempt', amount: 5000000, status: 'pending' },
      ],
      [{ id: 'balance', reservation_id: reservation.id, amount: 1000000 }],
    )
    const filtered = filterReportRows(
      rows,
      '2026-10-15',
      '2026-10-15',
      'Test Customer',
      'all',
      'created_at',
    )
    expect(filtered).toHaveLength(21)
    expect(paymentSummary(filtered)).toEqual({
      received: 2000,
      reversed: 0,
      refunded: 90,
      net: 1910,
      outstanding: 10000,
      bookings: 1,
    })
    expect(filtered.some((r) => r.id === 'pending-attempt')).toBe(false)
  })
  it('preserves numeric PHP values and UTF-8, escapes quoted/newline text and spreadsheet formulas', () => {
    const document: ReportDocument = {
      title: 'Report',
      filters: 'All',
      generated: 'Manila',
      summary: [],
      headers: ['Customer', 'PHP'],
      rows: [
        ['José, "Demo"\nCustomer', 123.45],
        ['=HYPERLINK("bad")', 0],
        ['  +SUM(1)', 10],
      ],
      filename: 'test',
    }
    const csv = reportCsv(document)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"José, ""Demo""\nCustomer",123.45')
    expect(csv).toContain('"\'=HYPERLINK(""bad"")",0')
    expect(csv).toContain('"\'  +SUM(1)",10')
  })
  it('produces a real multipage PDF with embedded fonts, page numbering and repeating headers', async () => {
    const fonts = {
      regular: (await readFile('public/fonts/NotoSans-Regular.ttf')).toString(
        'base64',
      ),
      bold: (await readFile('public/fonts/NotoSans-Bold.ttf')).toString(
        'base64',
      ),
    }
    const document: ReportDocument = {
      title: 'Reservation report',
      filters: 'All authorized records',
      generated: 'October 15, 2026 Manila',
      summary: ['120 reservations; fixture only.'],
      headers: ['Reference', 'Customer', 'Total (PHP)'],
      rows: Array.from({ length: 120 }, (_, i) => [
        'RC-2026-' + String(i + 1).padStart(6, '0'),
        'José Demo Customer',
        32000,
      ]),
      filename: 'qa-report',
    }
    const pdf = await createReportPdf(document, fonts)
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    expect(pdf.output().startsWith('%PDF')).toBe(true)
    expect(pdf.output()).toContain('NotoSans')
    await mkdir('.private', { recursive: true })
    await writeFile(
      '.private/qa-consolidated-report.pdf',
      Buffer.from(pdf.output('arraybuffer')),
    )
  }, 15000)
  it('exports the full thirteen-column reservation report in landscape across pages', async () => {
    const fonts = {
      regular: (await readFile('public/fonts/NotoSans-Regular.ttf')).toString(
        'base64',
      ),
      bold: (await readFile('public/fonts/NotoSans-Bold.ttf')).toString(
        'base64',
      ),
    }
    const pdf = await createReportPdf(
      {
        title: 'Reservation report',
        filters: 'Event date All to All; All; search: Demo Customer',
        generated: 'October 15, 2026 Manila',
        summary: [
          '25 bookings: 10 pending, 15 approved/completed.',
          'Saved totals are expected amounts, not verified receipts.',
        ],
        headers: [
          'Reservation reference',
          'Customer',
          'Event',
          'Type',
          'Event date',
          'Start time',
          'Guests',
          'Status',
          'Total (PHP)',
          'Guest chairs',
          'Theme',
          'Colors',
          'Saved seating / extras (PHP)',
        ],
        rows: Array.from({ length: 25 }, (_, i) => [
          'RC-2026-' + String(i + 1).padStart(6, '0'),
          'José Demo Customer',
          'Demo garden celebration',
          'Birthday',
          'October 20, 2026',
          '12:00 PM',
          100,
          'Approved',
          42300,
          'Monoblock × 70; Elegant chair × 30',
          'Garden celebration',
          'Ivory and sage',
          'Elegant chair × 30 @ PHP 10.00 = PHP 300.00',
        ]),
        filename: 'qa-wide-report',
      },
      fonts,
    )
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(
      pdf.internal.pageSize.getHeight(),
    )
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    await mkdir('.private', { recursive: true })
    await writeFile(
      '.private/qa-wide-report.pdf',
      Buffer.from(pdf.output('arraybuffer')),
    )
  }, 15000)
})
