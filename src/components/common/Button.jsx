import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'

const VARIANTS = {
  primary:
    'gradient-brand bg-brand-600 text-white shadow-sm hover:shadow-glow hover:brightness-105 active:brightness-95 disabled:bg-none disabled:bg-brand-300 disabled:shadow-none disabled:hover:shadow-none disabled:hover:brightness-100 dark:disabled:bg-brand-800 dark:disabled:text-brand-200/60',
  secondary:
    'bg-white text-ink-700 border border-ink-200 shadow-sm hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 active:bg-brand-50 disabled:opacity-60 dark:bg-ink-900 dark:text-ink-100 dark:border-ink-700 dark:hover:border-brand-500/60 dark:hover:bg-ink-800 dark:hover:text-brand-200',
  outline:
    'bg-transparent text-brand-700 border border-brand-300 hover:bg-brand-50 hover:border-brand-400 active:bg-brand-100 disabled:opacity-60 dark:text-brand-300 dark:border-brand-700 dark:hover:bg-brand-500/10',
  ghost:
    'bg-transparent text-ink-600 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100 disabled:opacity-60 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-brand-200',
  danger:
    'bg-danger-500 text-white shadow-sm hover:bg-danger-600 hover:shadow-[0_8px_24px_-6px_rgb(224_74_60/0.5)] active:bg-danger-700 disabled:bg-danger-300 disabled:shadow-none',
  success:
    'bg-success-500 text-white shadow-sm hover:bg-success-600 hover:shadow-[0_8px_24px_-6px_rgb(34_165_89/0.45)] active:bg-success-700 disabled:opacity-60',
  accent:
    'gradient-accent bg-accent-500 text-white shadow-sm hover:shadow-[0_8px_24px_-6px_rgb(236_74_125/0.5)] hover:brightness-105 active:brightness-95 disabled:bg-none disabled:bg-accent-300 disabled:shadow-none',
}

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-10 w-10 justify-center',
}

const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <Component
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 size={16} className="animate-spin" />}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </Component>
  )
})

export default Button
