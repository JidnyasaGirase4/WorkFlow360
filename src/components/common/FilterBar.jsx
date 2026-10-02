import { cn } from '../../utils/cn'
import FilterChips, { FilterChip } from './FilterChips'
import MobileFilterSheet from './MobileFilterSheet'

export { FilterChip }

// Backward compatible: `children` + `activeFilters` + `onClearAll` behave as before.
// New optional props:
//   search        node kept visible on every screen size (e.g. <SearchBar />)
//   chips         [{ key, label, onRemove }] rendered on their own row with "Clear All"
//   mobileSheet   collapse `children` into a "Filters" bottom-sheet below 640px
//                 (defaults to true whenever `chips` is provided)
//   onApply/onReset  sheet buttons (onReset falls back to onClearAll)
//   actions       node pushed to the right (e.g. view toggle)
export default function FilterBar({
  children,
  activeFilters = [],
  chips,
  onClearAll,
  onApply,
  onReset,
  search,
  actions,
  mobileSheet,
  className,
}) {
  const useSheet = mobileSheet ?? chips !== undefined

  if (chips === undefined && !useSheet && !search && !actions) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {children}
        {activeFilters.length > 0 && (
          <>
            <div className="mx-1 h-5 w-px bg-ink-200 dark:bg-ink-700" />
            {activeFilters.map((f) => (
              <FilterChip key={f.key} label={f.label} onRemove={f.onRemove} />
            ))}
            <button
              type="button"
              onClick={onClearAll}
              className="focus-ring rounded px-1 py-1 text-xs font-semibold text-accent-600 underline-offset-2 hover:text-accent-700 hover:underline dark:text-accent-300"
            >
              Clear all
            </button>
          </>
        )}
      </div>
    )
  }

  const chipList = chips ?? activeFilters

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {search && <div className="min-w-0 flex-1 sm:max-w-xs sm:flex-none">{search}</div>}
        {useSheet ? (
          <>
            <div className="hidden flex-wrap items-center gap-2 sm:flex">{children}</div>
            <MobileFilterSheet activeCount={chipList.length} onApply={onApply} onReset={onReset || onClearAll}>
              {children}
            </MobileFilterSheet>
          </>
        ) : (
          children
        )}
        {actions && <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-auto">{actions}</div>}
      </div>
      <FilterChips chips={chipList} onClearAll={onClearAll} />
    </div>
  )
}
