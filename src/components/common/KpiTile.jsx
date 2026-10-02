import { cn } from '../../utils/cn'

// Every tone is spelled out in full so Tailwind can see the class names.
const TONES = {
  brand: {
    wash: 'from-brand-50 via-white to-white dark:from-brand-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-brand-400 to-brand-600',
    chip: 'from-brand-400 to-brand-600 shadow-brand-500/30',
    text: 'text-brand-700 dark:text-brand-300',
    hover: 'hover:border-brand-200 dark:hover:border-brand-500/30',
  },
  accent: {
    wash: 'from-accent-50 via-white to-white dark:from-accent-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-accent-400 to-accent-600',
    chip: 'from-accent-400 to-accent-600 shadow-accent-500/30',
    text: 'text-accent-700 dark:text-accent-300',
    hover: 'hover:border-accent-200 dark:hover:border-accent-500/30',
  },
  info: {
    wash: 'from-info-50 via-white to-white dark:from-info-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-info-400 to-info-600',
    chip: 'from-info-400 to-info-600 shadow-info-500/30',
    text: 'text-info-600 dark:text-info-300',
    hover: 'hover:border-info-200 dark:hover:border-info-500/30',
  },
  success: {
    wash: 'from-success-50 via-white to-white dark:from-success-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-success-400 to-success-600',
    chip: 'from-success-400 to-success-600 shadow-success-500/30',
    text: 'text-success-700 dark:text-success-300',
    hover: 'hover:border-success-200 dark:hover:border-success-500/30',
  },
  warning: {
    wash: 'from-warning-50 via-white to-white dark:from-warning-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-warning-300 to-warning-500',
    chip: 'from-warning-300 to-warning-500 shadow-warning-500/30',
    text: 'text-warning-700 dark:text-warning-300',
    hover: 'hover:border-warning-200 dark:hover:border-warning-500/30',
  },
  danger: {
    wash: 'from-danger-50 via-white to-white dark:from-danger-500/10 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-danger-400 to-danger-600',
    chip: 'from-danger-400 to-danger-600 shadow-danger-500/30',
    text: 'text-danger-700 dark:text-danger-300',
    hover: 'hover:border-danger-200 dark:hover:border-danger-500/30',
  },
  neutral: {
    wash: 'from-ink-100/80 via-white to-white dark:from-ink-800/60 dark:via-ink-900 dark:to-ink-900',
    edge: 'from-ink-300 to-ink-500',
    chip: 'from-ink-400 to-ink-600 shadow-ink-500/25',
    text: 'text-ink-600 dark:text-ink-300',
    hover: 'hover:border-ink-300 dark:hover:border-ink-600',
  },
}

/**
 * Compact KPI tile used by every dashboard: label + number on the left, gradient
 * icon chip on the right, a soft colour wash over the whole card and a coloured
 * edge, so there is no dead space. Optional `badge` sits next to the hint line
 * and `footer` (e.g. a sparkline) spans the full width underneath.
 */
export default function KpiTile({ icon: Icon, label, value, hint, hintTone, badge, footer, tone = 'brand', index = 0, className, ariaLabel }) {
  const t = TONES[tone] || TONES.brand
  return (
    <div
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        'group relative min-w-0 animate-slide-up overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-br p-3.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-ink-800 sm:p-4',
        t.wash,
        t.hover,
        className
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b', t.edge)} />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm sm:hidden', t.chip)} aria-hidden="true">
                <Icon size={14} />
              </span>
            )}
            <p className="min-w-0 text-xs font-semibold leading-tight text-ink-500 dark:text-ink-400 sm:truncate sm:text-sm">{label}</p>
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums leading-tight tracking-tight text-ink-900 dark:text-white sm:mt-1 sm:truncate sm:text-2xl">{value}</p>
          {(hint || badge) && (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {badge}
              {hint && (
                <p className={cn('min-w-0 truncate text-xs font-medium', hintTone === 'danger' ? 'font-semibold text-danger-600 dark:text-danger-400' : t.text)}>{hint}</p>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              'hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-110 sm:flex',
              t.chip
            )}
            aria-hidden="true"
          >
            <Icon size={19} />
          </span>
        )}
      </div>
      {footer && <div className="mt-2 pl-1">{footer}</div>}
    </div>
  )
}
