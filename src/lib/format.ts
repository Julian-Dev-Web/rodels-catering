export const money = (centavos: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(centavos / 100)
export const date = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value.length === 10 ? value + 'T00:00:00+08:00' : value))
export const dayManila = (value: string | Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
export const todayManila = () => dayManila(new Date())
export const earliestEventDate = () => {
  const value = new Date(todayManila() + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() + 3)
  return value.toISOString().slice(0, 10)
}
export const human = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (s) => s.toUpperCase())
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : 'Something went wrong. Please try again.'
export function exportCsv(name: string, rows: Record<string, unknown>[]) {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const cell = (value: unknown) => {
    let text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
    if (/^[=+\-@]/.test(text.trimStart()) || /^[\t\r]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const csv = [
    keys.map(cell).join(','),
    ...rows.map((row) => keys.map((k) => cell(row[k])).join(',')),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
