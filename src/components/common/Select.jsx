import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'

const Select = forwardRef(function Select(
  { label, error, hint, required, options = [], placeholder, className, wrapperClassName, id, ...props },
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
      <div className="group/field relative">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn('field-control h-11 cursor-pointer appearance-none pr-10', className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors group-focus-within/field:text-brand-600"
        />
      </div>
      {error && <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>}
      {!error && hint && <p className="text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  )
})

export default Select
