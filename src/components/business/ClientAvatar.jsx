import { cn } from '../../utils/cn'
import { initials } from '../../utils/format'

const GRADIENTS = [
  'from-brand-400 to-brand-600',
  'from-accent-400 to-accent-600',
  'from-info-400 to-info-600',
  'from-warning-400 to-accent-500',
  'from-success-400 to-brand-600',
  'from-accent-400 to-info-500',
]

const SIZES = {
  sm: 'h-8 w-8 rounded-xl text-xs',
  md: 'h-10 w-10 rounded-xl text-sm',
  lg: 'h-12 w-12 rounded-2xl text-base',
  xl: 'h-16 w-16 rounded-2xl text-xl sm:h-20 sm:w-20 sm:text-2xl',
}

function pick(name = '') {
  const code = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return GRADIENTS[code % GRADIENTS.length]
}

// Gradient monogram tile for companies / leads / contacts.
export default function ClientAvatar({ name = '', size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white shadow-sm ring-2 ring-white dark:ring-ink-900',
        SIZES[size],
        pick(name),
        className
      )}
    >
      {initials(name) || '?'}
    </span>
  )
}
