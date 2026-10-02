import PageHeader from './PageHeader'
import Card from '../common/Card'
import ErrorState from '../common/ErrorState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../common/Skeleton'

// Loading skeleton that keeps the page title and breadcrumb visible while
// the (mock) service resolves.
export function PageSkeleton({ title, description, breadcrumbItems, stats = 4, filters = true, cols = 6 }) {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-fade-in">
      <PageHeader title={title} description={description} breadcrumbItems={breadcrumbItems} />
      <span className="sr-only">Loading {title}</span>
      {stats > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
      {filters && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-full sm:w-64" />
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </div>
      )}
      <Card className="overflow-hidden rounded-2xl">
        <SkeletonTable rows={6} cols={cols} />
      </Card>
    </div>
  )
}

export function PageError({ title, breadcrumbItems, message, onRetry }) {
  return (
    <div>
      <PageHeader title={title} breadcrumbItems={breadcrumbItems} />
      <Card className="rounded-2xl">
        <ErrorState
          title={`Couldn't load ${title.toLowerCase()}`}
          description={message || 'Something went wrong while fetching this data. Check your connection and try again.'}
          onRetry={onRetry}
        />
      </Card>
    </div>
  )
}
