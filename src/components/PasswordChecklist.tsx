import { Check, Circle } from 'lucide-react'
import { passwordRequirements } from '../lib/account'

export function PasswordChecklist({ value, id }: { value: string; id: string }) {
  const met = passwordRequirements.filter((rule) => rule.test(value)).length
  return (
    <div className="password-checklist" id={id}>
      <span className="password-checklist-heading">Use a strong password</span>
      <ul>
        {passwordRequirements.map((rule) => {
          const passed = rule.test(value)
          const Icon = passed ? Check : Circle
          return (
            <li className={passed ? 'met' : ''} key={rule.id}>
              <Icon size={15} aria-hidden="true" />
              <span className="sr-only">{passed ? 'Met: ' : 'Needed: '}</span>
              {rule.label}
            </li>
          )
        })}
      </ul>
      <span className="sr-only" role="status" aria-live="polite">
        {met} of {passwordRequirements.length} password requirements met.
      </span>
    </div>
  )
}
