import { Check, Circle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { PASSWORD_RULES, STRENGTH_LABELS, passwordStrength } from './validators'

const BAR_COLORS = ['bg-ink-200', 'bg-danger-500', 'bg-warning-500', 'bg-brand-500', 'bg-success-500']
const TEXT_COLORS = [
  'text-ink-400',
  'text-danger-600 dark:text-danger-400',
  'text-warning-600 dark:text-warning-400',
  'text-brand-600 dark:text-brand-400',
  'text-success-600 dark:text-success-400',
]

export default function PasswordStrength({ password, showRules = true }) {
  if (!password) return null
  const strength = passwordStrength(password)
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="img" aria-label={`Password strength: ${STRENGTH_LABELS[strength]}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                i < strength ? BAR_COLORS[strength] : 'bg-ink-100 dark:bg-ink-800'
              )}
            />
          ))}
        </div>
        <span className={cn('w-16 text-right text-xs font-semibold', TEXT_COLORS[strength])}>{STRENGTH_LABELS[strength]}</span>
      </div>
      {showRules && (
        <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(password)
            return (
              <li key={rule.id} className={cn('flex items-center gap-1.5 text-xs', ok ? 'text-success-600 dark:text-success-400' : 'text-ink-400')}>
                {ok ? <Check size={12} strokeWidth={3} /> : <Circle size={10} />}
                {rule.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
