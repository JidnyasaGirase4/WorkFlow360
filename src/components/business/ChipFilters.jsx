import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

// Single-select chip row (e.g. invoice status). `counts` is optional.
export function StatusChips({ options, value, onChange, counts, label = 'Filter by status', className }) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95',
              active
                ? 'gradient-brand bg-brand-600 text-white shadow-sm shadow-brand-500/30'
                : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800'
            )}
          >
            {opt.icon && <opt.icon size={14} aria-hidden="true" className="shrink-0" />}
            {opt.label}
            {counts && counts[opt.value] !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                  active ? 'bg-white/25 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                )}
              >
                {counts[opt.value]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Removable chips for every active filter, plus a Clear all action.
export function ActiveFilters({ filters, onClearAll, className }) {
  if (filters.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Active filters">
      <span className="text-xs font-medium text-ink-400">Active filters:</span>
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
        >
          {f.label}
          <button
            type="button"
            onClick={f.onRemove}
            className="focus-ring rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20"
            aria-label={`Remove ${f.label} filter`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="focus-ring rounded text-xs font-medium text-ink-500 underline-offset-2 hover:text-ink-700 hover:underline dark:hover:text-ink-200"
      >
        Clear all
      </button>
    </div>
  )
}
