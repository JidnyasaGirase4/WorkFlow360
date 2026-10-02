import { X } from 'lucide-react'
import { cn } from '../../utils/cn'

export function FilterChip({ label, onRemove }) {
  return (
    <span className="animate-scale-in inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="focus-ring shrink-0 rounded-full p-1 transition-colors hover:bg-accent-100 hover:text-accent-700 dark:hover:bg-accent-500/20"
        aria-label={`Remove ${label} filter`}
      >
        <X size={12} />
      </button>
    </span>
  )
}

// Removable chips for active filters, e.g. 'Status: Active ×', plus "Clear All".
//   chips = [{ key: 'status', label: 'Status: Active', onRemove: () => ... }]
export default function FilterChips({ chips = [], onClearAll, className, clearLabel = 'Clear All' }) {
  if (chips.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="focus-ring rounded px-1.5 py-1 text-xs font-semibold text-accent-600 underline-offset-2 hover:text-accent-700 hover:underline dark:text-accent-300 dark:hover:text-accent-200"
        >
          {clearLabel}
        </button>
      )}
    </div>
  )
}
