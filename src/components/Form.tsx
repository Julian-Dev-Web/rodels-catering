import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ErrorState } from './ui'
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
  const shape: Record<string, z.ZodType<string, string>> = {}
  for (const f of fields) {
    let s = z.string()
    if (f.required) s = s.min(1, `${f.label} is required`)
    if (f.type === 'email') s = s.email('Enter a valid email')
    if (f.type === 'password') s = s.min(8, 'Use at least 8 characters')
    if (f.max) s = s.max(f.max)
    shape[f.name] = s
  }
  const schema = z.object(shape).superRefine((values, context) => {
    for (const [field, message] of Object.entries(validate?.(values) ?? {}))
      context.addIssue({ code: 'custom', path: [field], message })
  })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])),
  })
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
        <label key={f.name}>
          {f.label}
          {f.required && <span aria-hidden="true"> *</span>}
          {f.options ? (
            <select {...register(f.name)}>
              <option value="">Select {f.label.toLowerCase()}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              rows={4}
              maxLength={f.max}
              placeholder={f.placeholder}
              {...register(f.name)}
            />
          ) : (
            <input
              type={f.type || 'text'}
              min={f.min}
              max={f.type === 'number' ? f.max : undefined}
              maxLength={f.type !== 'number' ? f.max : undefined}
              placeholder={f.placeholder}
              autoComplete={
                f.autoComplete ?? (f.type === 'password' ? 'new-password' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : undefined)
              }
              {...register(f.name)}
            />
          )}{' '}
          {errors[f.name] && <span className="field-error">{String(errors[f.name]?.message)}</span>}
        </label>
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
