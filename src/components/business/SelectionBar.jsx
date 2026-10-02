import { CheckCheck, X } from 'lucide-react'

// Bar shown above a table while rows are selected. Children are the bulk actions.
export default function SelectionBar({ count, noun = 'item', onClear, children }) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="animate-slide-up mb-3 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-accent-50/60 px-4 py-3 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between dark:border-brand-500/30 dark:from-brand-500/10 dark:via-ink-900 dark:to-accent-500/10"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 font-semibold text-brand-700 dark:text-brand-300" aria-live="polite">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            <CheckCheck size={15} aria-hidden="true" />
          </span>
          {count} {noun}
          {count === 1 ? '' : 's'} selected
        </span>
        <button
          type="button"
          onClick={onClear}
          className="focus-ring inline-flex min-h-[2rem] items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100/70 dark:text-brand-300 dark:hover:bg-brand-500/15"
        >
          <X size={12} aria-hidden="true" /> Clear selection
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
