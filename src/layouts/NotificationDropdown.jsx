import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ListChecks, Briefcase, Receipt, LifeBuoy, Users, CalendarClock, Settings2 } from 'lucide-react'
import { Dropdown, DropdownTrigger, DropdownMenu } from '../components/common/Dropdown'
import { useAuth } from '../context/AuthContext'
import { getNotificationsForUser } from '../utils/portalNotifications'
import { timeAgo } from '../utils/format'
import { cn } from '../utils/cn'

const CATEGORY_ICON = {
  tasks: ListChecks,
  projects: Briefcase,
  billing: Receipt,
  crm: Users,
  support: LifeBuoy,
  meetings: CalendarClock,
  system: Settings2,
}

const CATEGORY_TONE = {
  tasks: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  projects: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  billing: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  crm: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  support: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  meetings: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  system: 'bg-ink-100 text-ink-500 dark:bg-ink-800',
}

export default function NotificationDropdown({ viewAllHref }) {
  const { user } = useAuth()
  // Role-scoped feed: clients and employees only see their own items.
  const [items, setItems] = useState(() => getNotificationsForUser(user))
  const unreadCount = items.filter((n) => !n.read).length

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <Dropdown>
      <DropdownTrigger
        asChild
      >
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="focus-ring group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-500 transition-all duration-200 hover:bg-accent-50 hover:text-accent-600 active:scale-90 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-accent-300"
        >
          <Bell size={18} className="origin-top transition-transform duration-300 group-hover:rotate-12" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-white dark:ring-ink-900" aria-hidden="true" />
          )}
        </button>
      </DropdownTrigger>
      <DropdownMenu className="w-[min(20rem,calc(100vw-2rem))] p-0" align="right" role="dialog" label="Notifications">
        <div className="gradient-soft flex items-center justify-between gap-3 rounded-t-2xl border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <p className="text-sm font-bold text-ink-800 dark:text-ink-100">Notifications</p>
          <button
            type="button"
            onClick={markAllRead}
            className="focus-ring rounded px-1 py-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Mark all as read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-400">You're all caught up.</p>}
          {items.map((n) => {
            const Icon = CATEGORY_ICON[n.category] || Bell
            return (
              <div
                key={n.id}
                className={cn('flex gap-3 border-b border-ink-50 px-4 py-3 transition-colors last:border-0 hover:bg-ink-50 dark:border-ink-800/60 dark:hover:bg-ink-800/40', !n.read && 'bg-brand-50/40 dark:bg-brand-500/5')}
              >
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', CATEGORY_TONE[n.category] || CATEGORY_TONE.system)}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{n.title}</p>
                  <p className="truncate text-xs text-ink-500">{n.description}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{timeAgo(n.time)}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-500" aria-label="Unread" />}
              </div>
            )
          })}
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="focus-ring block rounded-b-2xl border-t border-ink-100 px-4 py-3 text-center text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:border-ink-800 dark:text-brand-400 dark:hover:bg-ink-800/40"
          >
            View all notifications
          </Link>
        )}
      </DropdownMenu>
    </Dropdown>
  )
}
