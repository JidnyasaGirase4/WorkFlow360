import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

// Animated, accessible accordion (aria-expanded / aria-controls, keyboard operable).
// items: [{ q, a }]. By default only one item is open at a time.
export default function Accordion({ items, defaultOpen = 0, allowMultiple = false, className }) {
  const baseId = useId()
  const [open, setOpen] = useState(() => (defaultOpen === null ? [] : [defaultOpen]))

  function toggle(index) {
    setOpen((current) => {
      if (current.includes(index)) return current.filter((i) => i !== index)
      return allowMultiple ? [...current, index] : [index]
    })
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item, index) => {
        const isOpen = open.includes(index)
        const buttonId = `${baseId}-btn-${index}`
        const panelId = `${baseId}-panel-${index}`
        return (
          <div
            key={item.q}
            className={cn(
              'rounded-xl border bg-white transition-colors duration-200 dark:bg-ink-900',
              'relative overflow-hidden',
              isOpen ? 'border-brand-200 bg-gradient-to-br from-brand-50/60 to-white shadow-card dark:border-brand-700/50 dark:from-brand-500/5 dark:to-ink-900' : 'border-ink-200 hover:border-brand-200 dark:border-ink-800 dark:hover:border-ink-700'
            )}
          >
            <span className={cn('absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-400 to-accent-400 transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
            <h3>
              <button
                id={buttonId}
                type="button"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="focus-ring flex w-full items-center justify-between gap-4 rounded-xl px-4 py-4 text-left sm:px-5"
              >
                <span className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100 sm:text-base">{item.q}</span>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                    isOpen ? 'gradient-brand rotate-180 text-white shadow-glow' : 'bg-ink-100 text-ink-500 dark:bg-ink-800'
                  )}
                >
                  <ChevronDown size={16} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-5 text-sm leading-relaxed sm:px-5 text-ink-500 dark:text-ink-400">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
