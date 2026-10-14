export const PH_MOBILE_PATTERN = /^(?:09\d{9}|(?:\+?63)9\d{9})$/
export const validMobile = (value: string) => PH_MOBILE_PATTERN.test(value)
export function normalizeMobile(value: string) {
  if (!validMobile(value)) return value
  return value.startsWith('09')
    ? '+63' + value.slice(1)
    : '+' + value.replace(/^\+/, '')
}
export const mobileMaxLength = (value: string) =>
  value.startsWith('0') ? 11 : value.startsWith('6') ? 12 : 13
// Reject an invalid edit/paste as a whole; do not turn pasted letters into a
// seemingly valid phone number. Empty/partial numeric values remain editable.
export function mobileInput(value: string, previous: string) {
  if (!/^\+?\d*$/.test(value)) return previous
  return value.length > mobileMaxLength(value) ? previous : value
}
export function validMobileEdit(value: string) {
  return /^\+?\d*$/.test(value) && value.length <= mobileMaxLength(value)
}
