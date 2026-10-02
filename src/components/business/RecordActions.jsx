import { cn } from '../../utils/cn'

// Inline icon buttons for table rows. Tables scroll horizontally, which would
// clip an absolutely positioned popup menu, so actions are shown inline.
// actions: [{ label, icon, onClick, tone?: 'danger', hidden? }]
export default function RecordActions({ actions }) {
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {actions
        .filter((a) => !a.hidden)
        .map((a) => (
          <button
            key={a.label}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={a.onClick}
            className={cn(
              'focus-ring flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 hover:scale-105 active:scale-95',
              a.tone === 'danger'
                ? 'text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10'
                : 'text-ink-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300'
            )}
          >
            {a.icon}
          </button>
        ))}
    </div>
  )
}
