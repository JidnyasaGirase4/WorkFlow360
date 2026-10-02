import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'

export default function Logo({ className, to = '/', dark = false }) {
  return (
    <Link to={to} className={cn('focus-ring group inline-flex items-center gap-2 rounded-lg font-extrabold tracking-tight', className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 text-white shadow-glow transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 12L10 18L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn('text-lg', dark ? 'text-white' : 'text-ink-900 dark:text-white')}>
        WorkFlow<span className="text-brand-500">360</span>
      </span>
    </Link>
  )
}
