import { z } from 'zod'

export const fullName = (value: { first_name: string; middle_name?: string; last_name: string }) =>
  [value.first_name, value.middle_name, value.last_name].map((part) => part?.trim()).filter(Boolean).join(' ')

const name = z.string().trim().min(1, 'This name is required').max(60, 'Use at most 60 characters')
export const profileSchema = z.object({
  first_name: name,
  middle_name: z.string().trim().max(60, 'Use at most 60 characters'),
  last_name: name,
  phone: z.string().transform((value) => value.replace(/[\s()-]/g, ''))
    .refine((value) => /^(09\d{9}|\+639\d{9})$/.test(value), 'Enter a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX')
    .transform((value) => value.startsWith('0') ? '+63' + value.slice(1) : value),
}).superRefine((value, context) => {
  if (fullName(value).length > 150)
    context.addIssue({ code: 'custom', path: ['last_name'], message: 'Your complete name must be at most 150 characters' })
})

export const passwordRequirements = [
  { id: 'length', label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { id: 'uppercase', label: 'An uppercase letter (A–Z)', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'lowercase', label: 'A lowercase letter (a–z)', test: (value: string) => /[a-z]/.test(value) },
  { id: 'number', label: 'A number (0–9)', test: (value: string) => /[0-9]/.test(value) },
  { id: 'special', label: 'A special character (e.g. ! @ #)', test: (value: string) => /[^A-Za-z0-9\s]/.test(value) },
]

export const strongPassword = z.string().superRefine((value, context) => {
  for (const rule of passwordRequirements)
    if (!rule.test(value)) context.addIssue({ code: 'custom', message: rule.label })
})

export const passwordSchema = z.object({
  password: strongPassword,
  confirm_password: z.string(),
}).refine((value) => value.password === value.confirm_password, {
  path: ['confirm_password'], message: 'Passwords do not match',
})

export const registrationSchema = profileSchema.safeExtend({
  email: z.string().trim().email('Enter a valid email address'),
  password: strongPassword,
  confirm_password: z.string(),
}).refine((value) => value.password === value.confirm_password, {
  path: ['confirm_password'], message: 'Passwords do not match',
})

export function fieldErrors(schema: z.ZodType, values: Record<string, string>) {
  const result = schema.safeParse(values)
  const errors: Record<string, string> = {}
  if (!result.success)
    for (const issue of result.error.issues) errors[String(issue.path[0])] ??= issue.message
  return errors
}

// Capture callback status before the Supabase SDK consumes the URL fragment.
export function callbackStatus(hash: string, search: string) {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const query = new URLSearchParams(search)
  const error = fragment.get('error') || fragment.get('error_code') || query.get('error') || query.get('error_code')
  return { recovery: fragment.get('type') === 'recovery' && !error, failed: Boolean(error) }
}
