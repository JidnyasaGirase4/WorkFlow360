import { cn } from '../../utils/cn'

// Inline icon buttons for table rows. Used instead of a popup menu because
// tables scroll horizontally and would clip an absolutely positioned menu.
export default function RowActions({ actions, className }) {
  return (
    <div className={cn('flex items-center justify-end gap-1', className)} onClick={(e) => e.stopPropagation()}>
      {actions
        .filter((a) => !a.hidden)
        .map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            disabled={a.disabled}
            onClick={a.onClick}
            className={cn(
              'focus-ring flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100',
              a.tone === 'danger' && 'bg-danger-50/70 text-danger-500 hover:bg-danger-100 hover:text-danger-600 dark:bg-danger-500/10 dark:hover:bg-danger-500/20',
              a.tone === 'success' && 'bg-success-50 text-success-600 hover:bg-success-100 dark:bg-success-500/10 dark:hover:bg-success-500/20',
              !a.tone && 'text-ink-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800 dark:hover:text-brand-300'
            )}
          >
            {a.icon}
          </button>
        ))}
    </div>
  )
}
