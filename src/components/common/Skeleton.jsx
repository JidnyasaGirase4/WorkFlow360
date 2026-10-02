import { cn } from '../../utils/cn'

export function Skeleton({ className, style }) {
  return <div className={cn('skeleton rounded-lg', className)} style={style} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

// Stat / KPI style card skeleton. `lines` adds extra text rows for richer cards.
export function SkeletonCard({ lines = 0, className }) {
  return (
    <div className={cn('rounded-2xl border border-ink-100 bg-white shadow-card p-5 dark:border-ink-800 dark:bg-ink-900', className)} aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
      {lines > 0 && <SkeletonText lines={lines} className="mt-4" />}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="w-full" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-ink-100 px-4 py-3.5 last:border-0 dark:border-ink-800">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 'h-10 w-10' }) {
  return <div className={cn('skeleton rounded-full', size)} aria-hidden="true" />
}

// Avatar + name + a few detail rows (profile headers, user cards).
export function SkeletonProfile({ className }) {
  return (
    <div className={cn('rounded-2xl border border-ink-100 bg-white shadow-card p-6 dark:border-ink-800 dark:bg-ink-900', className)} aria-hidden="true">
      <div className="flex items-center gap-4">
        <SkeletonAvatar size="h-16 w-16" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Chart card placeholder with a title row and bar-shaped body.
export function SkeletonChart({ className, height = 'h-56' }) {
  const bars = [45, 70, 55, 85, 60, 92, 50, 75]
  return (
    <div className={cn('rounded-2xl border border-ink-100 bg-white shadow-card p-5 dark:border-ink-800 dark:bg-ink-900', className)} aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <div className={cn('mt-5 flex items-end gap-3', height)}>
        {bars.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

// Full page skeleton: header + stat cards + two content blocks.
export function SkeletonPage({ stats = 4, header = true, className }) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-busy="true" aria-label="Loading content">
      {header && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-3.5 w-80 max-w-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
        {Array.from({ length: stats }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <SkeletonChart className="lg:col-span-2" />
        <div className="rounded-2xl border border-ink-100 bg-white shadow-card p-5 dark:border-ink-800 dark:bg-ink-900">
          <Skeleton className="mb-4 h-4 w-32" />
          <SkeletonText lines={6} />
        </div>
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={4} cols={5} />
      </div>
    </div>
  )
}
