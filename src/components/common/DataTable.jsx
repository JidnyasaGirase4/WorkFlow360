import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import Checkbox from './Checkbox'
import Pagination from './Pagination'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import SearchBar from './SearchBar'
import Select from './Select'
import { SkeletonTable, SkeletonCard } from './Skeleton'

function compare(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
  return a > b ? 1 : -1
}

function isActivate(e) {
  return e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')
}

// Column options:
//   key, header, render(row), sortable, sortAccessor(row), align: 'left'|'center'|'right'
//   searchValue(row)   text used by the built-in search (defaults to row[key])
//   mobileHidden       hide this column in the stacked-card mobile layout
//   mobileLabel        label shown in the card (defaults to header)
//   A column with an empty header is treated as a row-actions column (shown in
//   the card footer on mobile).
//
// Props added on top of the original API (all optional):
//   mobileCards (default true)  <640px: rows become stacked cards; false = horizontal scroll
//   searchable / searchPlaceholder / searchKeys   built-in search box
//   rowActions(row)             extra actions cell (also the card footer on mobile)
//   toolbar                     node rendered next to the search box
//   error / onRetry             render an ErrorState with retry instead of the table
//   ariaLabel                   accessible table name
export default function DataTable({
  columns,
  data,
  keyField = 'id',
  selectable = false,
  selected = [],
  onSelectedChange,
  onRowClick,
  isLoading = false,
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription = 'Try adjusting your filters or search terms.',
  emptyActionLabel,
  onEmptyAction,
  emptyIcon,
  bulkActions,
  className,
  mobileCards = true,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  rowActions,
  toolbar,
  error,
  onRetry,
  ariaLabel,
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const isMobile = useIsMobile()
  const showCards = mobileCards && isMobile

  useResetOnChange([query, sort.key, sort.dir], () => setPage(1))

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!searchable || !q) return data
    const keys = searchKeys || columns.map((c) => c.key)
    return data.filter((row) =>
      keys.some((k) => {
        const col = columns.find((c) => c.key === k)
        const value = col?.searchValue ? col.searchValue(row) : row[k]
        return (typeof value === 'string' || typeof value === 'number') && String(value).toLowerCase().includes(q)
      })
    )
  }, [data, query, searchable, searchKeys, columns])

  const sorted = useMemo(() => {
    if (!sort.key) return searched
    const col = columns.find((c) => c.key === sort.key)
    const accessor = col?.sortAccessor || ((row) => row[sort.key])
    return [...searched].sort((a, b) => {
      const result = compare(accessor(a), accessor(b))
      return sort.dir === 'asc' ? result : -result
    })
  }, [searched, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const pageData = sorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  const allOnPageSelected = pageData.length > 0 && pageData.every((row) => selected.includes(row[keyField]))

  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return { key: null, dir: 'asc' }
    })
  }

  function toggleAll() {
    if (allOnPageSelected) {
      onSelectedChange(selected.filter((id) => !pageData.some((row) => row[keyField] === id)))
    } else {
      const ids = new Set(selected)
      pageData.forEach((row) => ids.add(row[keyField]))
      onSelectedChange([...ids])
    }
  }

  function toggleRow(id) {
    if (selected.includes(id)) {
      onSelectedChange(selected.filter((s) => s !== id))
    } else {
      onSelectedChange([...selected, id])
    }
  }

  const dataColumns = columns.filter((c) => c.header)
  const actionColumns = columns.filter((c) => !c.header)
  const sortableColumns = columns.filter((c) => c.sortable)

  if (error) {
    return <ErrorState description={typeof error === 'string' ? error : undefined} onRetry={onRetry} className={className} />
  }

  if (isLoading) {
    return (
      <div className={cn('w-full', className)} role="status" aria-busy="true" aria-label="Loading table">
        {showCards ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} lines={2} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
            <SkeletonTable cols={columns.length} />
          </div>
        )}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    )
  }

  const toolbarNode =
    searchable || toolbar ? (
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {searchable && <SearchBar value={query} onChange={setQuery} placeholder={searchPlaceholder} className="sm:w-72" />}
        {toolbar}
      </div>
    ) : null

  const bulkBar =
    selectable && selected.length > 0 && bulkActions ? (
      <div
        role="status"
        className="animate-scale-in mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm dark:border-brand-500/30 dark:bg-brand-500/10"
      >
        <span className="font-semibold text-brand-700 dark:text-brand-300">{selected.length} selected</span>
        <div className="flex flex-wrap items-center gap-2">{bulkActions}</div>
      </div>
    ) : null

  const pagination = (
    <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} totalItems={sorted.length} pageSize={pageSize} />
  )

  if (sorted.length === 0) {
    return (
      <div className={cn('w-full', className)}>
        {toolbarNode}
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  if (showCards) {
    const visible = dataColumns.filter((c) => !c.mobileHidden)
    const [titleCol, ...restCols] = visible
    return (
      <div className={cn('w-full', className)}>
        {toolbarNode}
        {bulkBar}
        {(sortableColumns.length > 0 || selectable) && (
          <div className="mb-3 flex items-end gap-3">
            {sortableColumns.length > 0 && (
              <Select
                label="Sort by"
                wrapperClassName="flex-1"
                value={sort.key ? `${sort.key}:${sort.dir}` : ''}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(':')
                  setSort(key ? { key, dir } : { key: null, dir: 'asc' })
                }}
                options={[
                  { value: '', label: 'Default order' },
                  ...sortableColumns.flatMap((c) => [
                    { value: `${c.key}:asc`, label: `${c.mobileLabel || c.header} (ascending)` },
                    { value: `${c.key}:desc`, label: `${c.mobileLabel || c.header} (descending)` },
                  ]),
                ]}
              />
            )}
            {selectable && <Checkbox label="Select page" checked={allOnPageSelected} onChange={toggleAll} className="pb-2.5" />}
          </div>
        )}
        <ul className="space-y-3" aria-label={ariaLabel}>
          {pageData.map((row) => {
            const hasActions = actionColumns.length > 0 || rowActions
            return (
              <li
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (onRowClick && isActivate(e)) {
                    e.preventDefault()
                    onRowClick(row)
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'focus-ring rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition-all duration-200 dark:border-ink-800 dark:bg-ink-900',
                  onRowClick && 'cursor-pointer active:scale-[0.99] active:bg-brand-50/60 dark:active:bg-ink-800/40'
                )}
              >
                <div className="flex items-start gap-3">
                  {selectable && (
                    <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                      <Checkbox
                        aria-label="Select row"
                        checked={selected.includes(row[keyField])}
                        onChange={() => toggleRow(row[keyField])}
                      />
                    </span>
                  )}
                  {titleCol && (
                    <div className="min-w-0 flex-1 text-sm font-semibold text-ink-800 dark:text-ink-100">
                      {titleCol.render ? titleCol.render(row) : row[titleCol.key]}
                    </div>
                  )}
                </div>
                {restCols.length > 0 && (
                  <dl className="mt-3 space-y-2">
                    {restCols.map((col) => (
                      <div key={col.key} className="flex items-center justify-between gap-4 text-sm">
                        <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-ink-400">{col.mobileLabel || col.header}</dt>
                        <dd className="min-w-0 text-right text-ink-700 dark:text-ink-200">
                          {col.render ? col.render(row) : row[col.key]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {hasActions && (
                  <div
                    className="mt-3 flex flex-wrap items-center justify-end gap-1.5 border-t border-ink-100 pt-3 dark:border-ink-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionColumns.map((col) => (
                      <div key={col.key}>{col.render ? col.render(row) : row[col.key]}</div>
                    ))}
                    {rowActions?.(row)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {pagination}
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {toolbarNode}
      {bulkBar}
      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <table aria-label={ariaLabel} className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1]">
            <tr className="border-b border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-800/60">
              {selectable && (
                <th scope="col" className="w-10 px-4 py-3">
                  <Checkbox aria-label="Select all rows on this page" checked={allOnPageSelected} onChange={toggleAll} />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    col.sortable ? (sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center'
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={cn(
                        'focus-ring inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors hover:text-brand-700 dark:hover:text-brand-300',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      {col.header}
                      {sort.key === col.key ? (
                        sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ChevronsUpDown size={12} className="opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => (
              <tr
                key={row[keyField]}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(e) => {
                  if (onRowClick && isActivate(e)) {
                    e.preventDefault()
                    onRowClick(row)
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'focus-ring border-b border-ink-100 transition-colors last:border-0 hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {selectable && (
                  <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label="Select row"
                      checked={selected.includes(row[keyField])}
                      onChange={() => toggleRow(row[keyField])}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3.5 text-ink-700 dark:text-ink-200',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center'
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  )
}
