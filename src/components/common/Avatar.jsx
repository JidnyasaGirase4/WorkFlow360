import { cn } from '../../utils/cn'
import { initials } from '../../utils/format'

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

// Gradient fallbacks drawn from the brand palette.
const PALETTE = [
  'from-brand-400 to-brand-600',
  'from-accent-400 to-accent-600',
  'from-info-400 to-info-600',
  'from-warning-400 to-warning-600',
  'from-success-400 to-success-600',
  'from-brand-500 to-accent-500',
]

function colorFor(name = '') {
  const code = name.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return PALETTE[code % PALETTE.length]
}

export default function Avatar({ name = '', src, size = 'md', status, className }) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn('rounded-full object-cover ring-2 ring-white dark:ring-ink-900', SIZES[size])}
        />
      ) : (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ring-2 ring-white dark:ring-ink-900',
            SIZES[size],
            colorFor(name)
          )}
        >
          {initials(name) || '?'}
        </span>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white dark:ring-ink-900',
            size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5',
            status === 'online' && 'bg-success-500',
            status === 'busy' && 'bg-danger-500',
            status === 'away' && 'bg-warning-500',
            status === 'offline' && 'bg-ink-300'
          )}
        />
      )}
    </span>
  )
}
