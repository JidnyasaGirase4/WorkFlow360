import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { cn } from '../utils/cn'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES = {
  success: 'border-l-success-500 dark:border-l-success-400',
  error: 'border-l-danger-500 dark:border-l-danger-400',
  warning: 'border-l-warning-500 dark:border-l-warning-400',
  info: 'border-l-brand-500 dark:border-l-brand-400',
}

const CHIPS = {
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  error: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  info: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message, { type = 'info', duration = 4000, title } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { id, message, type, title }])
      if (duration) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  const toast = useMemo(
    () =>
      Object.assign((message, opts) => show(message, opts), {
        success: (message, opts) => show(message, { ...opts, type: 'success' }),
        error: (message, opts) => show(message, { ...opts, type: 'error' }),
        warning: (message, opts) => show(message, { ...opts, type: 'warning' }),
        info: (message, opts) => show(message, { ...opts, type: 'info' }),
      }),
    [show]
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6 sm:w-full"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={cn(
                'animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-l-4 border-ink-100 bg-white px-3.5 py-3 text-ink-800 shadow-panel dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100',
                STYLES[t.type] || STYLES.info
              )}
            >
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', CHIPS[t.type] || CHIPS.info)}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 py-1 text-sm">
                {t.title && <p className="font-semibold">{t.title}</p>}
                <p className={cn('break-words', t.title ? 'text-ink-600 dark:text-ink-300' : 'font-medium')}>{t.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
