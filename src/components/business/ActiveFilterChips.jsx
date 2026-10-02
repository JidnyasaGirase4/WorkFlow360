import { X, Filter } from 'lucide-react'

// Removable chips for every active filter plus a "Clear All" action.
// filters: [{ key, label, onRemove }]
export default function ActiveFilterChips({ filters, onClearAll, className = '' }) {
  if (filters.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="group" aria-label="Active filters">
      <span className="flex items-center gap-1 text-xs font-semibold text-ink-500">
        <Filter size={12} aria-hidden="true" /> Filters:
      </span>
      {filters.map((f) => (
        <span
          key={f.key}
          className="animate-scale-in inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-700 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
        >
          <span className="truncate">{f.label}</span>
          <button
            type="button"
            onClick={f.onRemove}
            className="focus-ring flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-brand-200/70 dark:hover:bg-brand-500/25"
            aria-label={`Remove filter: ${f.label}`}
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="focus-ring min-h-[2rem] rounded-lg px-2 text-xs font-semibold text-accent-600 transition-colors hover:bg-accent-50 dark:text-accent-300 dark:hover:bg-accent-500/10"
      >
        Clear All
      </button>
    </div>
  )
}
