import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn'

const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, rows = 4, className, wrapperClassName, id, ...props },
  ref
) {
  const generatedId = useId()
  const inputId = id || generatedId

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700 dark:text-ink-200">
          {label}
          {required && <span className="ml-0.5 text-danger-500">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn('field-control resize-y py-2.5', className)}
        {...props}
      />
      {error && <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  )
})

export default Textarea
