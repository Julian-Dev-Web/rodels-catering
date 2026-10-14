export function monthOf(day: string) {
  return day.slice(0, 7)
}
export function initialRescheduleMonth(original: string, today: string) {
  return monthOf(original >= today ? original : today)
}
export function moveMonth(month: string, offset: number) {
  const day = new Date(month + '-01T00:00:00Z')
  day.setUTCMonth(day.getUTCMonth() + offset)
  return day.toISOString().slice(0, 7)
}
export function monthDays(month: string) {
  const start = new Date(month + '-01T00:00:00Z')
  const count = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return {
    offset: start.getUTCDay(),
    days: Array.from(
      { length: count },
      (_, i) => month + '-' + String(i + 1).padStart(2, '0'),
    ),
  }
}
export function eligibleRescheduleDay(
  day: string,
  original: string,
  earliest: string,
  remaining: number | undefined,
) {
  return (
    day >= earliest &&
    day !== original &&
    remaining !== undefined &&
    remaining > 0
  )
}
