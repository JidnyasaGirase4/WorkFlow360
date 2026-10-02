import { useId, useRef } from 'react'
import { cn } from '../../utils/cn'

// WAI-ARIA tabs: role=tablist / role=tab, roving tabindex, Arrow/Home/End keys.
// Tab ids are `${idPrefix}-tab-${value}` and panels can use
// `${idPrefix}-panel-${value}` (pass the same `idPrefix`) for aria-controls.
export default function Tabs({ tabs, active, onChange, className, idPrefix, ariaLabel = 'Sections' }) {
  const autoId = useId()
  const prefix = idPrefix || autoId
  const listRef = useRef(null)
  const hasActive = tabs.some((t) => t.value === active)

  function onKeyDown(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const enabled = tabs.filter((t) => !t.disabled)
    const idx = enabled.findIndex((t) => t.value === active)
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length
    if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = enabled.length - 1
    const target = enabled[next]
    if (!target) return
    onChange(target.value)
    listRef.current?.querySelector(`[data-tab="${CSS.escape(String(target.value))}"]`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-ink-200 dark:border-ink-800', className)}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.value === active
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${prefix}-tab-${tab.value}`}
            data-tab={tab.value}
            aria-selected={isActive}
            aria-controls={idPrefix ? `${idPrefix}-panel-${tab.value}` : undefined}
            tabIndex={isActive || (!hasActive && index === 0) ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              'focus-ring group relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4',
              isActive
                ? 'bg-gradient-to-t from-brand-50 to-transparent text-brand-700 dark:from-brand-500/10 dark:text-brand-300'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:hover:bg-ink-800/60 dark:hover:text-ink-100'
            )}
          >
            {tab.icon && (
              <span className={cn('inline-flex transition-transform duration-200', isActive ? 'scale-110' : 'group-hover:scale-110')}>
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors',
                  isActive ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300'
                )}
              >
                {tab.count}
              </span>
            )}
            {isActive && <span className="tab-indicator absolute inset-x-2 -bottom-px h-0.5 rounded-full gradient-brand" />}
          </button>
        )
      })}
    </div>
  )
}
