import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, HelpCircle, Menu, MessagesSquare, Search } from 'lucide-react'
import GlobalSearch from './GlobalSearch'
import NotificationDropdown from './NotificationDropdown'
import QuickCreateMenu from './QuickCreateMenu'
import ProfileMenu from './ProfileMenu'
import ThemeToggle from '../components/common/ThemeToggle'
import { getRouteMeta } from './routeMeta'

const ICON_BTN =
  'focus-ring relative h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-500 transition-all duration-200 justify-center hover:bg-brand-50 hover:text-brand-700 active:scale-90 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-brand-200'

// Props: title (workspace name), nav (role nav, used to derive the page label),
// messagesHref (optional; renders a Messages icon button), messagesUnread (dot).
export default function Topbar({
  title,
  nav,
  onOpenMobileSidebar,
  showQuickCreate = false,
  profileHref,
  settingsHref,
  notificationsHref,
  messagesHref,
  messagesUnread = false,
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const meta = getRouteMeta(nav, location.pathname)

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <header className="glass sticky top-0 z-20 flex h-16 shrink-0 items-center gap-1.5 border-b border-ink-100 px-3 dark:border-ink-800 sm:gap-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className={`${ICON_BTN} -ml-1 flex lg:hidden`}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile: current page title. Desktop: breadcrumb-style "Workspace / Section / Page". */}
      {meta && <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight text-ink-800 dark:text-ink-100 md:hidden">{meta.label}</p>}
      <nav aria-label="Current location" className="hidden min-w-0 shrink items-center gap-1.5 text-sm md:flex">
        {title && <span className="truncate font-bold text-ink-800 dark:text-ink-100">{title}</span>}
        {meta?.section && (
          <>
            <ChevronRight size={13} className="shrink-0 text-ink-300" aria-hidden="true" />
            <span className="truncate text-ink-400">{meta.section}</span>
          </>
        )}
        {meta && (
          <>
            <ChevronRight size={13} className="shrink-0 text-ink-300" aria-hidden="true" />
            <span className="truncate rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" aria-current="page">
              {meta.label}
            </span>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
        className="focus-ring group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-ink-200 bg-ink-50/80 text-sm text-ink-400 transition-all duration-200 hover:border-brand-300 hover:bg-white hover:text-brand-700 hover:shadow-card active:scale-95 dark:border-ink-700 dark:bg-ink-900 dark:hover:bg-ink-800 sm:ml-2 sm:w-auto sm:flex-1 sm:justify-start sm:px-4 md:max-w-sm"
      >
        <Search size={16} className="shrink-0 transition-transform group-hover:scale-110" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="ml-auto hidden rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-ink-400 dark:border-ink-700 dark:bg-ink-800 md:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        {showQuickCreate && <QuickCreateMenu />}
        <Link to="/faq" aria-label="Help" className={`${ICON_BTN} hidden sm:flex`}>
          <HelpCircle size={18} />
        </Link>
        {messagesHref && (
          <Link
            to={messagesHref}
            aria-label={messagesUnread ? 'Messages, new messages' : 'Messages'}
            className={`${ICON_BTN} hidden min-[380px]:flex`}
          >
            <MessagesSquare size={18} />
            {messagesUnread && (
              <span className="absolute right-2 top-2 flex h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-white dark:ring-ink-900" aria-hidden="true" />
            )}
          </Link>
        )}
        <NotificationDropdown viewAllHref={notificationsHref} />
        <span className="hidden sm:inline-flex">
          <ThemeToggle />
        </span>
        <div className="mx-1 hidden h-6 w-px bg-ink-200 dark:bg-ink-700 sm:block" />
        <ProfileMenu profileHref={profileHref} settingsHref={settingsHref} />
      </div>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  )
}
