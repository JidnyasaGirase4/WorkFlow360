import { forwardRef, useId } from 'react'
import { cn } from '../../utils/cn'

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    required,
    leftIcon,
    rightIcon,
    rightElement,
    className,
    wrapperClassName,
    id,
    ...props
  },
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
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 transition-colors group-focus-within/field:text-brand-600">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            'field-control h-11',
            leftIcon && 'pl-10',
            (rightIcon || rightElement) && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {rightIcon}
          </span>
        )}
        {rightElement && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</span>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-medium text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-ink-500 dark:text-ink-400">
          {hint}
        </p>
      )}
    </div>
  )
})

export default Input
