import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useOverlay } from '../../hooks/useOverlay'

// placement: 'right' (default) | 'left' | 'bottom' (mobile bottom-sheet).
// `side` is kept as a backward-compatible alias for placement.
export default function Drawer({
  isOpen,
  onClose,
  title,
  description,
  side,
  placement,
  width = 'max-w-md',
  footer,
  children,
}) {
  const where = placement || side || 'right'
  const panelRef = useRef(null)
  const titleId = useId()

  useOverlay({ isOpen, onClose, ref: panelRef })

  if (!isOpen) return null

  const isBottom = where === 'bottom'

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', isBottom && 'items-end', where === 'left' && 'justify-start')}>
      <div className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? 'Panel' : undefined}
        className={cn(
          'relative flex flex-col bg-white shadow-panel outline-none dark:bg-ink-900',
          isBottom
            ? 'sheet-enter max-h-[88vh] w-full rounded-t-3xl pb-[env(safe-area-inset-bottom)]'
            : cn('h-full w-full', width, where === 'left' ? 'drawer-enter-left mr-auto' : 'drawer-enter-right ml-auto')
        )}
      >
        {isBottom && <span className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink-200 dark:bg-ink-700" aria-hidden="true" />}
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-4 py-4 dark:border-ink-800 sm:px-5">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-bold tracking-tight text-ink-800 dark:text-ink-100">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-all hover:bg-accent-50 hover:text-accent-600 active:scale-90 dark:hover:bg-ink-800 sm:h-9 sm:w-9"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center gap-2 border-t border-ink-100 bg-ink-50/60 px-4 py-3.5 dark:border-ink-800 dark:bg-ink-950/30 sm:px-5">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  )
}
