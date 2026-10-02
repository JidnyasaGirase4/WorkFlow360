import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES, getPasswordStrength } from '../../utils/password'
import { cn } from '../../utils/cn'

const BAR = ['bg-ink-200 dark:bg-ink-700', 'bg-danger-500', 'bg-warning-500', 'bg-brand-500', 'bg-success-500']
const TEXT = [
  'text-ink-400',
  'text-danger-600 dark:text-danger-400',
  'text-warning-700 dark:text-warning-400',
  'text-brand-700 dark:text-brand-300',
  'text-success-700 dark:text-success-400',
]

// Strength meter plus a live checklist of password requirements.
export default function PasswordStrength({ password }) {
  const { score, label } = getPasswordStrength(password)
  if (!password) return null
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full transition-all duration-300', i <= score ? BAR[score] : 'bg-ink-200 dark:bg-ink-700')} />
        ))}
      </div>
      <p className={cn('mt-1.5 text-xs font-medium', TEXT[score])}>Password strength: {label}</p>
      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password)
          return (
            <li key={rule.id} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-success-700 dark:text-success-400' : 'text-ink-500')}>
              {ok ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
              <span>
                {rule.label}
                <span className="sr-only">{ok ? ' - met' : ' - not met'}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
