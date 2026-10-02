import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '../../utils/cn'
import IconChip from './IconChip'

// Portal card surface: rounded-2xl, soft border, card shadow, optional hover lift.
export function Panel({ as: Component = 'div', hover = false, className, children, ...props }) {
  return (
    <Component
      className={cn(
        'rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

export function PanelHeader({ icon, tone = 'brand', title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-center gap-3 border-b border-ink-100 px-4 py-3.5 dark:border-ink-800 sm:px-5', className)}>
      {icon && <IconChip icon={icon} tone={tone} size="sm" />}
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-snug text-ink-800 dark:text-ink-100">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function PanelBody({ className, children, ...props }) {
  return (
    <div className={cn('p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  )
}

// Small "View all" style link with a nudging arrow.
export function PanelLink({ to, children, className }) {
  return (
    <Link
      to={to}
      className={cn(
        'focus-ring group inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 sm:text-sm',
        className
      )}
    >
      {children}
      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
