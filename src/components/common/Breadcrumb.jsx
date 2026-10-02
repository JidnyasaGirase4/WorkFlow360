import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

export default function Breadcrumb({ items = [], homeHref = '/admin/dashboard' }) {
  return (
    <nav aria-label="Breadcrumb" className="no-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-sm text-ink-400">
      <Link
        to={homeHref}
        aria-label="Home"
        className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800 dark:hover:text-brand-300"
      >
        <Home size={14} />
      </Link>
      {items.map((item, idx) => (
        <span key={idx} className="flex shrink-0 items-center gap-1.5">
          <ChevronRight size={14} className="text-ink-300 dark:text-ink-600" />
          {item.href && idx !== items.length - 1 ? (
            <Link
              to={item.href}
              className="focus-ring rounded px-0.5 transition-colors hover:text-brand-600 dark:hover:text-brand-300"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink-700 dark:text-ink-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
