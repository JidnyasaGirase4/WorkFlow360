import { cn } from '../../utils/cn'
import { initials } from '../../utils/format'
import { tintFor } from './employeeTints'

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
  '2xl': 'h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl',
}

// Avatar with a gradient fallback (same props as the common Avatar).
export default function EmployeeAvatar({ name = '', src, size = 'md', className, ring = false }) {
  const tint = tintFor(name)
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img src={src} alt={name} className={cn('rounded-full object-cover', SIZES[size], ring && 'ring-4 ring-white/70 dark:ring-ink-900/70')} />
      ) : (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-sm',
            SIZES[size],
            tint.gradient,
            ring && 'ring-4 ring-white/70 dark:ring-ink-900/70'
          )}
        >
          {initials(name) || '?'}
        </span>
      )}
    </span>
  )
}
