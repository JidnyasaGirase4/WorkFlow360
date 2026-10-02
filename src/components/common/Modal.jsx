import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useOverlay } from '../../hooks/useOverlay'

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

// Accessible dialog: role=dialog + aria-modal, focus trap, Escape to close,
// focus restore to the opener, ref-counted scroll lock. Full-screen below 640px.
export default function Modal({ isOpen, onClose, title, description, size = 'md', footer, children, hideCloseButton = false, ariaLabel, fullScreenOnMobile = true }) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  useOverlay({ isOpen, onClose, ref: dialogRef })

  if (!isOpen) return null

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex justify-center', fullScreenOnMobile ? 'items-stretch p-0 sm:items-center sm:p-4' : 'items-center p-4')}>
      <div
        className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        className={cn(
          'animate-scale-in relative flex w-full flex-col overflow-hidden bg-white shadow-panel outline-none dark:bg-ink-900 sm:border sm:border-ink-100 sm:dark:border-ink-800',
          fullScreenOnMobile
            ? 'h-full max-h-none rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-2xl'
            : 'h-auto max-h-[90vh] rounded-2xl',
          SIZES[size]
        )}
      >
        {title && (
          <div className="gradient-soft flex shrink-0 items-start justify-between gap-4 border-b border-ink-100 px-4 py-4 dark:border-ink-800 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink-800 dark:text-ink-100">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-sm text-ink-500">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-all hover:bg-accent-50 hover:text-accent-600 active:scale-90 dark:hover:bg-ink-800 sm:h-9 sm:w-9"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-ink-100 bg-ink-50/60 px-4 py-4 dark:border-ink-800 dark:bg-ink-950/30 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
