import { Inbox } from 'lucide-react'
import { cn } from '../../utils/cn'
import Button from './Button'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-14', className)}>
      <span className="animate-scale-in flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-accent-100 text-brand-600 ring-8 ring-brand-50/60 dark:from-brand-500/20 dark:to-accent-500/10 dark:text-brand-300 dark:ring-brand-500/10">
        <Icon size={28} />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
        {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      </div>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
