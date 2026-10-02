import { AlertOctagon, RefreshCcw, WifiOff, ShieldAlert } from 'lucide-react'
import Button from './Button'
import { cn } from '../../utils/cn'

export default function ErrorState({
  icon: Icon = AlertOctagon,
  title = 'Something went wrong',
  description = "We couldn't load this data. Please try again.",
  onRetry,
  retryLabel = 'Retry',
  action,
  className,
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center sm:py-14', className)}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-danger-50 to-accent-100 text-danger-500 ring-8 ring-danger-50/60 dark:from-danger-500/20 dark:to-accent-500/10 dark:ring-danger-500/10">
        <Icon size={28} aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">{title}</h3>
        <p className="max-w-sm text-sm text-ink-500">{description}</p>
      </div>
      {(onRetry || action) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} leftIcon={<RefreshCcw size={14} />}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}

// Connectivity failure (offline, timeout, server unreachable).
export function NetworkErrorState({
  title = "You're offline or the server is unreachable",
  description = 'Check your internet connection and try again. Your changes are safe.',
  onRetry,
  ...props
}) {
  return <ErrorState icon={WifiOff} title={title} description={description} onRetry={onRetry} {...props} />
}

// Authenticated but not allowed to view a resource.
export function PermissionDeniedState({
  title = "You don't have access to this",
  description = 'Your role does not include permission to view this content. Contact your workspace admin if you think this is a mistake.',
  action,
  ...props
}) {
  return <ErrorState icon={ShieldAlert} title={title} description={description} action={action} {...props} />
}
