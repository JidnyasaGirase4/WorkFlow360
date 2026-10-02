import { cn } from '../../utils/cn'

// Segmented view switcher (table / cards / kanban ...).
// options: [{ value, label (aria), text (visible), icon }]
export default function ProjectViewToggle({ value, onChange, options, ariaLabel, className }) {
  return (
    <div
      className={cn('flex items-center gap-1 self-start rounded-xl border border-ink-200 bg-white p-1 shadow-sm dark:border-ink-700 dark:bg-ink-900', className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(({ value: v, label, text, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          aria-label={label}
          className={cn(
            'focus-ring flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all duration-200 sm:h-8',
            value === v
              ? 'gradient-brand bg-brand-600 text-white shadow-sm'
              : 'text-ink-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800 dark:hover:text-brand-300'
          )}
        >
          <Icon size={15} aria-hidden="true" />
          <span className={text ? 'hidden sm:inline' : 'sr-only'}>{text}</span>
        </button>
      ))}
    </div>
  )
}
