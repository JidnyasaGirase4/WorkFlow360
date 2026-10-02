import { cn } from '../../utils/cn'

export default function Card({ className, hover = false, as: Component = 'div', children, ...props }) {
  return (
    <Component
      className={cn(
        'rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900',
        hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:hover:border-brand-500/30',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink-100 card-head dark:border-ink-800', className)} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }) {
  return (
    <div className={cn('card-pad', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-base font-semibold tracking-tight text-ink-800 dark:text-ink-100', className)} {...props}>
      {children}
    </h3>
  )
}
