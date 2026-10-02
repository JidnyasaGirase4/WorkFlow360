import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn'

const Switch = forwardRef(function Switch({ label, description, className, id, ...props }, ref) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <label htmlFor={inputId} className={cn('inline-flex cursor-pointer items-start gap-3', className)}>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-ink-200 transition-colors duration-200 has-checked:bg-brand-600 has-checked:shadow-[0_2px_10px_-2px_rgb(26_169_150/0.6)] has-disabled:cursor-not-allowed has-disabled:opacity-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2 dark:bg-ink-700">
        <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...props} />
        <span className="pointer-events-none ml-0.5 h-5 w-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out peer-checked:translate-x-5" />
      </span>
      {(label || description) && (
        <span className="flex min-w-0 flex-col">
          {label && <span className="text-sm font-medium text-ink-700 dark:text-ink-200">{label}</span>}
          {description && <span className="text-xs text-ink-500 dark:text-ink-400">{description}</span>}
        </span>
      )}
    </label>
  )
})

export default Switch
