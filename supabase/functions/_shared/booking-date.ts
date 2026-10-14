export function manilaDate(now: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
}
export function addDays(day: string, count: number): string {
  const value = new Date(day + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}
export function earliestBookingDate(now: string | Date = new Date()): string {
  return addDays(manilaDate(now), 3)
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
