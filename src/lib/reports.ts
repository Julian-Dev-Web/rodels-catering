import type { RecordRow, Reservation } from '../types'
import type { FinancialSnapshot } from './financial'
import { dateTime, dayManila, human, todayManila } from './format'
import {paymentMethod} from './payments'
export type ReportRow = RecordRow & {
  reservation: string
  customer: string
  event: string
  event_date: string
}
export interface ReportDocument {
  title: string
  filters: string
  generated: string
  summary: string[]
  headers: string[]
  rows: (string | number)[][]
  filename: string
}
export function savedFinancialLabel(snapshot?: FinancialSnapshot | null) {
  if (!snapshot) return 'Historical tax/discount breakdown not recorded'
  return `VAT ${human(snapshot.tax_mode)}: PHP ${(snapshot.vat_amount / 100).toFixed(2)}; discount ${snapshot.discount_name || 'none'}${snapshot.discount_percent!=null?' ('+snapshot.discount_percent+'%)':''}: PHP ${(snapshot.discount_amount / 100).toFixed(2)}${snapshot.discount_usage_type?'; '+(snapshot.discount_usage_type==='one_time'?'one-time offer':'ongoing offer'):''}${snapshot.discount_expires_on?'; deadline '+snapshot.discount_expires_on+' Manila':''}${snapshot.discount_reason ? '; reason: ' + snapshot.discount_reason : ''}; ${snapshot.business_confirmed ? 'configured' : 'tax confirmation pending'}`
}
export function paymentReportRows(
  reservations: Reservation[],
  transactions: RecordRow[],
  payments: RecordRow[],
  balances: RecordRow[],
): ReportRow[] {
  const bookings = new Map(reservations.map((r) => [r.id, r])),
    attempts = new Map(payments.map((p) => [p.id, p])),
    due = new Map(balances.map((b) => [b.reservation_id, Number(b.amount)]))
  return transactions.map((t) => {
    const r = bookings.get(String(t.reservation_id)),
      p = attempts.get(String(t.payment_id))
    return {
      id: t.id,
      booking_key: String(t.reservation_id),
      reference: String(p?.payment_reference || t.record_reference || 'Record '+String(t.kind)),
      reservation:
        r?.reservation_reference || 'Historical reference unavailable',
      customer: r?.customer_name || 'Not provided',
      event: r?.event_name || 'Unavailable booking',
      event_date: r?.event_date || '',
      created_at: t.created_at,
      paid_at: dateTime(String(t.received_at || p?.received_at || t.created_at)) + ' Manila',
      kind: String(t.kind),
      payment_type:
        t.kind === 'refund'
          ? 'Completed refund'
          : t.kind==='reversal'?'Mistaken entry reversed':p?.source==='manual'?'In-person installment':p?.intent === 'partial'
            ? '50% down payment'
            : p?.intent === 'balance'
              ? 'Balance payment'
              : p?.intent === 'full'
                ? 'Full payment'
                : 'Verified payment',
      method: paymentMethod(String(t.method||p?.method||(p?.source==='manual'?'not_recorded':'paymongo'))),
      status: t.kind === 'refund' ? 'Completed' : t.kind==='reversal'?'Reversed':p?.voided_at?'Voided':p?.source==='manual'?'Staff recorded':'Provider confirmed',
      received: t.kind === 'payment' ? Number(t.amount) / 100 : 0,
      refunded: t.kind === 'refund' ? Number(t.amount) / 100 : 0,
      reversed: t.kind==='reversal'?Number(t.amount)/100:0,
      refund_due: r&&['pending','for_approval','approved','completed'].includes(r.status)?Math.max(r.paid-(r.refunded||0)-(r.payment_reversed||0)-r.total,0)/100:0,
      balance: (r ? (due.get(r.id) ?? Math.max(r.total-r.paid+(r.refunded||0)+(r.payment_reversed||0),0)) : 0) / 100,
      tax_discount: savedFinancialLabel(r?.financial_snapshot),
    }
  })
}
export function paymentSummary(rows: ReportRow[]) {
  const received = rows.reduce((sum, r) => sum + Number(r.received), 0),
    refunded = rows.reduce((sum, r) => sum + Number(r.refunded), 0),
    reversed = rows.reduce((sum,r)=>sum+Number(r.reversed||0),0)
  const unique = new Map(
      rows.map((r) => [
        String(r.booking_key || r.reservation),
        Number(r.balance),
      ]),
    ),
    outstanding = [...unique.values()].reduce((s, n) => s + n, 0)
  return {
    received,
    refunded,
    reversed,
    net: received - refunded - reversed,
    outstanding,
    bookings: unique.size,
  }
}
export function reservationReportRows(rows: Reservation[]): ReportRow[] {
  return rows.map((r) => ({
    id: r.id,
    reservation: r.reservation_reference || 'Historical reference unavailable',
    customer: r.customer_name || 'Not provided',
    event: r.event_name,
    event_date: r.event_date,
    event_type: human(r.event_preferences?.occasion_type || 'Not provided'),
    event_time: r.event_time.slice(0, 5) + ' Manila',
    guests: r.guests,
    status: human(r.status),
    total: r.total / 100,
    tax_discount: savedFinancialLabel(r.financial_snapshot),
    paid: (r.paid-(r.refunded||0)-(r.payment_reversed||0)) / 100,
    remaining: ['cancelled','rejected','pending_refund','refund_approved','refunded'].includes(r.status)?0:Math.max(r.total-r.paid+(r.refunded||0)+(r.payment_reversed||0),0) / 100,
    refund_due: ['pending','for_approval','approved','completed'].includes(r.status)?Math.max(r.paid-(r.refunded||0)-(r.payment_reversed||0)-r.total,0)/100:0,
    revision: r.approved_revision||0,
    theme: r.event_preferences?.theme || 'Not provided',
    colors: r.event_preferences?.colors || 'Not provided',
    extras:
      r.selection_snapshot
        ?.map(
          (x) =>
            x.name +
            ' x ' +
            x.quantity +
            '; PHP ' +
            ((x.subtotal ?? 0) / 100).toFixed(2),
        )
        .join('; ') || (r.selection_snapshot?'No selected item charges':'Historical item charges not recorded'),
    chair_quantity: 'See booking seating details',
  }))
}
export function reservationSummary(rows: ReportRow[]) {
  return {
    pending: rows.filter((r) =>
      ['Pending', 'For approval'].includes(String(r.status)),
    ).length,
    confirmed: rows.filter((r) =>
      ['Approved', 'Completed'].includes(String(r.status)),
    ).length,
    upcoming: rows.filter(
      (r) => r.status === 'Approved' && r.event_date >= todayManila(),
    ).length,
    total: rows.reduce((s, r) => s + Number(r.total), 0),
  }
}
export function filterReportRows(
  rows: ReportRow[],
  start: string,
  end: string,
  search: string,
  kind = 'all',
  dateField = 'event_date',
) {
  return rows.filter((r) => {
    const value =
      dateField === 'created_at'
        ? dayManila(String(r.created_at))
        : r.event_date
    return (
      (!start || value >= start) &&
      (!end || value <= end) &&
      (kind === 'all' || r.kind === kind || r.status === kind) &&
      Object.values(r).some(
        (v) =>
          (typeof v === 'string' || typeof v === 'number') &&
          String(v).toLowerCase().includes(search.toLowerCase()),
      )
    )
  })
}
export function reportCsv(doc: ReportDocument) {
  const cell = (value: string | number) => {
    if (typeof value === 'number') return String(value)
    const safe =
      /^[=+\-@]/.test(value.trimStart()) || /^[\t\r]/.test(value)
        ? "'" + value
        : value
    return '"' + safe.replaceAll('"', '""') + '"'
  }
  return (
    '\uFEFF' +
    [doc.headers, ...doc.rows]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  )
}
export function downloadReportCsv(doc: ReportDocument) {
  const url = URL.createObjectURL(
      new Blob([reportCsv(doc)], { type: 'text/csv;charset=utf-8' }),
    ),
    a = document.createElement('a')
  a.href = url
  a.download = doc.filename + '.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
type ReportFonts = { regular: string; bold: string }
let fontFiles: Promise<ReportFonts> | undefined
async function loadReportFonts() {
  fontFiles ??= Promise.all(
    ['Regular', 'Bold'].map(async (weight) => {
      const response = await fetch('/fonts/NotoSans-' + weight + '.ttf')
      if (!response.ok)
        throw Error('Report font could not load. Retry the download.')
      const bytes = new Uint8Array(await response.arrayBuffer()),
        chunks: string[] = []
      for (let i = 0; i < bytes.length; i += 8192)
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
      return btoa(chunks.join(''))
    }),
  )
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error) => {
      fontFiles = undefined
      throw error
    })
  return fontFiles
}
export async function createReportPdf(
  report: ReportDocument,
  providedFonts?: ReportFonts,
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({
    orientation: report.headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const fonts = providedFonts || (await loadReportFonts())
  pdf.addFileToVFS('NotoSans-Regular.ttf', fonts.regular)
  pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
  pdf.addFileToVFS('NotoSans-Bold.ttf', fonts.bold)
  pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')
  pdf.setFont('NotoSans', 'normal')
  autoTable(pdf, {
    head: [report.headers],
    body: report.rows.map((r) => r.map(String)),
    startY: 69,
    margin: { top: 69, bottom: 18, left: 12, right: 12 },
    styles: {
      font: 'NotoSans',
      fontSize: 8,
      textColor: 0,
      lineColor: 160,
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: 240, textColor: 0, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: 255 },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didDrawPage: () => {
      const width = pdf.internal.pageSize.getWidth()
      pdf.setTextColor(0)
      pdf.setFont('NotoSans', 'bold')
      pdf.setFontSize(14)
      pdf.text("RodelConnect | Rodel's Catering Services", 12, 13)
      pdf.setFontSize(12)
      pdf.text(report.title, 12, 21)
      pdf.setFont('NotoSans', 'normal')
      pdf.setFontSize(8)
      pdf.text(
        pdf.splitTextToSize('Filters: ' + report.filters, width - 24),
        12,
        28,
      )
      pdf.text('Generated: ' + report.generated, 12, 37)
      pdf.text(
        pdf.splitTextToSize(report.summary.join('  '), width - 24),
        12,
        44,
      )
      pdf.text(
        'Complete filtered records; PHP amounts. Pending checkout attempts are excluded from verified receipts.',
        12,
        61,
      )
    },
  })
  const pages = pdf.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.text(
      'Page ' + i + ' of ' + pages,
      12,
      pdf.internal.pageSize.getHeight() - 8,
    )
    pdf.text(
      'Authorized business report; not a tax invoice.',
      pdf.internal.pageSize.getWidth() - 12,
      pdf.internal.pageSize.getHeight() - 8,
      { align: 'right' },
    )
  }
  return pdf
}
export async function downloadReportPdf(doc: ReportDocument) {
  const pdf = await createReportPdf(doc)
  pdf.save(doc.filename + '.pdf')
}
export async function printReport(doc: ReportDocument) {
  const target = window.open('', '_blank')
  if (!target)
    throw Error('Allow the report window to open, then choose Print again.')
  target.opener = null
  try {
    const pdf = await createReportPdf(doc)
    pdf.autoPrint()
    const url = URL.createObjectURL(pdf.output('blob'))
    target.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    target.close()
    throw error
  }
}
