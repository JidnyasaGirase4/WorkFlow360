import { Skeleton } from '../common/Skeleton'

// Loading placeholder for detail pages (header + stat row + two-column body).
export default function DetailSkeleton({ label = 'Loading details', stats = 4 }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <div className="mb-6 space-y-2.5 lg:mb-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card sm:p-5 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
