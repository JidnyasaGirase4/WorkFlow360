import { cn } from '../../utils/cn'

const TONES = {
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200/70 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700/60',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20',
  accent: 'bg-accent-50 text-accent-700 ring-accent-200/70 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/20',
  success: 'bg-success-50 text-success-700 ring-success-200/70 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/20',
  warning: 'bg-warning-50 text-warning-700 ring-warning-200/70 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/20',
  danger: 'bg-danger-50 text-danger-700 ring-danger-200/70 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/20',
  info: 'bg-info-50 text-info-600 ring-info-200/70 dark:bg-info-500/15 dark:text-info-300 dark:ring-info-500/20',
}

const DOT_TONES = {
  neutral: 'bg-ink-400',
  brand: 'bg-brand-500',
  accent: 'bg-accent-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

export default function Badge({ tone = 'neutral', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[tone] || DOT_TONES.neutral)} />}
      {children}
    </span>
  )
}
