import { forwardRef, useId } from 'react'
import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'

const Checkbox = forwardRef(function Checkbox({ label, className, id, ...props }, ref) {
  const generatedId = useId()
  const inputId = id || generatedId
  return (
    <label htmlFor={inputId} className={cn('group/check inline-flex cursor-pointer items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition-all duration-150',
          'border-ink-300 bg-white group-hover/check:border-brand-400 has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:shadow-[0_2px_8px_-2px_rgb(26_169_150/0.55)]',
          'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-offset-2',
          'has-disabled:cursor-not-allowed has-disabled:opacity-50',
          'dark:border-ink-600 dark:bg-ink-900'
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <Check
          size={13}
          strokeWidth={3.5}
          className="pointer-events-none scale-50 text-white opacity-0 transition-all duration-150 peer-checked:scale-100 peer-checked:opacity-100"
        />
      </span>
      {label && <span className="text-sm text-ink-700 dark:text-ink-200">{label}</span>}
    </label>
  )
})

export default Checkbox
