import { createContext, useContext, useId, useRef } from 'react'
import { cn } from '../../utils/cn'

const RadioContext = createContext(null)

// Accessible radio group with roving tabindex and arrow-key navigation.
//   <RadioGroup label="Payment method" value={v} onChange={setV}>
//     <Radio value="upi" label="UPI" description="Pay using any UPI app" />
//   </RadioGroup>
// Alternatively pass `options={[{ value, label, description, disabled }]}`.
export function RadioGroup({
  value,
  onChange,
  label,
  hint,
  error,
  options,
  orientation = 'vertical',
  className,
  children,
}) {
  const groupId = useId()
  const groupRef = useRef(null)

  function onKeyDown(e) {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const radios = Array.from(groupRef.current.querySelectorAll('[role="radio"]:not([aria-disabled="true"])'))
    if (radios.length === 0) return
    e.preventDefault()
    const current = radios.indexOf(document.activeElement)
    let next = current
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (current + 1) % radios.length
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (current - 1 + radios.length) % radios.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = radios.length - 1
    radios[next].focus()
    radios[next].click()
  }

  const items = options
    ? options.map((o) => <Radio key={o.value} value={o.value} label={o.label} description={o.description} disabled={o.disabled} />)
    : children

  return (
    <RadioContext.Provider value={{ value, onChange, error }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <span id={`${groupId}-label`} className="text-sm font-medium text-ink-700 dark:text-ink-200">
            {label}
          </span>
        )}
        <div
          ref={groupRef}
          role="radiogroup"
          aria-labelledby={label ? `${groupId}-label` : undefined}
          aria-invalid={Boolean(error)}
          onKeyDown={onKeyDown}
          className={cn('flex gap-2', orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col')}
        >
          {items}
        </div>
        {error && <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>}
        {!error && hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </RadioContext.Provider>
  )
}

export function Radio({ value, label, description, disabled = false, className, children }) {
  const ctx = useContext(RadioContext)
  const id = useId()
  if (!ctx) throw new Error('Radio must be used inside <RadioGroup>')
  const checked = ctx.value === value
  // Roving tabindex: once a value is selected only that radio is in the tab order.
  const hasValue = ctx.value !== undefined && ctx.value !== '' && ctx.value !== null

  return (
    <div
      id={id}
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-describedby={description ? `${id}-desc` : undefined}
      tabIndex={disabled || (hasValue && !checked) ? -1 : 0}
      onClick={() => !disabled && ctx.onChange?.(value)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          if (!disabled) ctx.onChange?.(value)
        }
      }}
      className={cn(
        'focus-ring group flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200',
        checked
          ? 'border-brand-500 bg-brand-50/70 shadow-[0_0_0_3px_rgb(26_169_150/0.12)] dark:border-brand-500/60 dark:bg-brand-500/10'
          : 'border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-ink-700 dark:bg-transparent dark:hover:border-ink-600',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-brand-600 bg-brand-600 shadow-[0_2px_8px_-2px_rgb(26_169_150/0.55)]' : 'border-ink-300 bg-white dark:border-ink-600 dark:bg-ink-900'
        )}
      >
        <span className={cn('h-2 w-2 rounded-full bg-white transition-transform', checked ? 'scale-100' : 'scale-0')} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{label || children}</span>
        {description && (
          <span id={`${id}-desc`} className="mt-0.5 block text-xs text-ink-500">
            {description}
          </span>
        )}
      </span>
    </div>
  )
}

export default RadioGroup
