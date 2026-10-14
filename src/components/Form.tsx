import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorState } from './ui'
import { PasswordChecklist } from './PasswordChecklist'
export interface Field {
  name: string
  label: string
  type?: string
  required?: boolean
  min?: number
  max?: number
  options?: { label: string; value: string }[]
  placeholder?: string
  autoComplete?: string
  passwordRules?: boolean
}
export function Form({
  fields,
  initial = {},
  submit,
  label = 'Save changes',
  onSuccess,
  validate,
}: {
  fields: Field[]
  initial?: Record<string, string | number>
  submit: (values: Record<string, string>) => Promise<unknown>
  label?: string
  onSuccess?: () => void
  validate?: (values: Record<string, string>) => Record<string, string>
}) {
  const formId = useId()
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})
  const shape: Record<string, z.ZodType<string, string>> = {}
  for (const f of fields) {
    let s = z.string()
    if (f.required) s = s.min(1, `${f.label} is required`)
    if (f.type === 'email') s = s.email('Enter a valid email')
    if (f.max) s = s.max(f.max)
    shape[f.name] = s
  }
  const schema = z.object(shape).superRefine((values, context) => {
    for (const [field, message] of Object.entries(validate?.(values) ?? {}))
      context.addIssue({ code: 'custom', path: [field], message })
  })
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])),
  })
  const values = useWatch({ control })
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: submit,
    onSuccess: () => {
      void qc.invalidateQueries()
      onSuccess?.()
    },
  })
  return (
    <form className="form" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
      {fields.map((f) => (
        <div className="form-field" key={f.name}>
          <label htmlFor={formId + '-' + f.name}>
            {f.label}
            {f.required && <span aria-hidden="true"> *</span>}
          </label>
          {f.options ? (
            <select id={formId + '-' + f.name} aria-invalid={!!errors[f.name]} {...register(f.name)}>
              <option value="">Select {f.label.toLowerCase()}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              id={formId + '-' + f.name}
              aria-invalid={!!errors[f.name]}
              rows={4}
              maxLength={f.max}
              placeholder={f.placeholder}
              {...register(f.name)}
            />
          ) : (
            <div className={f.type === 'password' ? 'password-input' : 'input-wrap'}>
            <input
              id={formId + '-' + f.name}
              aria-invalid={!!errors[f.name]}
              aria-describedby={[
                f.passwordRules ? formId + '-password-rules' : '',
                errors[f.name] ? formId + '-' + f.name + '-error' : '',
              ].filter(Boolean).join(' ') || undefined}
              type={f.type === 'password' && visiblePasswords[f.name] ? 'text' : f.type || 'text'}
              min={f.min}
              max={f.type === 'number' ? f.max : undefined}
              maxLength={f.type !== 'number' ? f.max : undefined}
              placeholder={f.placeholder}
              autoComplete={
                f.autoComplete ?? (f.type === 'password' ? 'new-password' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : undefined)
              }
              {...register(f.name)}
            />
            {f.type === 'password' && (
              <button
                type="button"
                className="password-toggle"
                aria-label={(visiblePasswords[f.name] ? 'Hide ' : 'Show ') + f.label.toLowerCase()}
                aria-pressed={!!visiblePasswords[f.name]}
                aria-controls={formId + '-' + f.name}
                onClick={() => setVisiblePasswords((current) => ({ ...current, [f.name]: !current[f.name] }))}
              >
                {visiblePasswords[f.name] ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
              </button>
            )}
            </div>
          )}{' '}
          {f.passwordRules && <PasswordChecklist id={formId + '-password-rules'} value={values[f.name] || ''} />}
          {f.name === 'confirm_password' && values[f.name] && (
            <span className={'password-match ' + (values[f.name] === values.password ? 'met' : '')} role="status">
              {values[f.name] === values.password ? 'Passwords match.' : 'Passwords do not match yet.'}
            </span>
          )}
          {errors[f.name] && <span id={formId + '-' + f.name + '-error'} className="field-error">{String(errors[f.name]?.message)}</span>}
        </div>
      ))}
      {mutation.isError && <ErrorState error={mutation.error} />}
      <button className="button" disabled={mutation.isPending}>
        {mutation.isPending ? 'Please wait…' : label}
      </button>
      {mutation.isSuccess && (
        <p className="success" role="status">
          Saved successfully.
        </p>
      )}
    </form>
  )
}
