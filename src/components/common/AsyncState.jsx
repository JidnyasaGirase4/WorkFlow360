import Card from './Card'
import ErrorState from './ErrorState'
import { SkeletonPage } from './Skeleton'

// Standard loading / error / content switch for pages.
//   <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<SkeletonPage />}>
//     ...content...
//   </AsyncState>
export default function AsyncState({
  isLoading,
  isError,
  onRetry,
  skeleton,
  errorTitle = "We couldn't load this page",
  errorDescription = 'Something went wrong while fetching your data. Please try again.',
  children,
}) {
  if (isLoading) return skeleton || <SkeletonPage />
  if (isError) {
    return (
      <Card>
        <ErrorState title={errorTitle} description={errorDescription} onRetry={onRetry} />
      </Card>
    )
  }
  return children
}
