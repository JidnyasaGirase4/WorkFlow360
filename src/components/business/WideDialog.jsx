import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Wide dialog (up to 72rem) for split layouts such as form + live preview.
export default function WideDialog({ isOpen, onClose, title, description, footer, children }) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-scale-in relative flex h-full max-h-screen w-full max-w-6xl flex-col bg-white shadow-panel dark:bg-ink-900 sm:h-auto sm:max-h-[94vh] sm:rounded-3xl sm:border sm:border-ink-100 dark:sm:border-ink-800"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 bg-gradient-to-r from-brand-50/80 via-white to-accent-50/50 px-4 py-4 dark:border-ink-800 dark:from-brand-500/10 dark:via-transparent dark:to-accent-500/5 sm:rounded-t-3xl sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink-800 dark:text-ink-100 sm:text-xl">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-all hover:rotate-90 hover:bg-white hover:text-ink-700 dark:hover:bg-ink-800"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 [&>button]:flex-1 sm:[&>button]:flex-none border-t border-ink-100 px-4 py-3 dark:border-ink-800 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
