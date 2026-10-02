import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

function getPageList(current, total) {
  const pages = []
  const window = 1
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - window && i <= current + window)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return pages
}

const NAV_BTN =
  'focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-500 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:bg-white disabled:hover:text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:hover:bg-ink-800 sm:h-9 sm:w-9'

export default function Pagination({ page, totalPages, onChange, totalItems, pageSize }) {
  if (totalPages <= 1) return null
  const pages = getPageList(page, totalPages)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 px-1 py-3 sm:flex-row">
      {totalItems !== undefined && (
        <p className="text-sm text-ink-500">
          Showing <span className="font-semibold text-ink-700 dark:text-ink-200">{start}–{end}</span> of{' '}
          <span className="font-semibold text-ink-700 dark:text-ink-200">{totalItems}</span>
        </p>
      )}
      <div className="flex max-w-full items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          className={NAV_BTN}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-sm text-ink-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'focus-ring flex h-10 min-w-10 items-center justify-center rounded-xl px-1 text-sm font-semibold tabular-nums transition-all duration-150 active:scale-95 sm:h-9 sm:min-w-9',
                p === page
                  ? 'gradient-brand bg-brand-600 text-white shadow-glow'
                  : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700 dark:text-ink-300 dark:hover:bg-ink-800'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          className={NAV_BTN}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}
