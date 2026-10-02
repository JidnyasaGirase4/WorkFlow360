import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import { cn } from '../../utils/cn'

const SIDES = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
}

// Shows on hover AND keyboard focus; Escape dismisses it. The trigger is
// linked to the tooltip with aria-describedby while it is visible.
export default function Tooltip({ content, side = 'top', children, className }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!content) return children

  const trigger = isValidElement(children) ? cloneElement(children, { 'aria-describedby': open ? id : undefined }) : children

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-white shadow-panel animate-fade-in dark:bg-ink-700',
            SIDES[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
