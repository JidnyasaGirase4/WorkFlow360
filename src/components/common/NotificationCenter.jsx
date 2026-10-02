import { useMemo, useState } from 'react'
import { Bell, BellOff, Briefcase, CalendarClock, CheckCheck, LifeBuoy, ListChecks, Receipt, Settings2, Trash2, Users } from 'lucide-react'
import PageHeader from '../business/PageHeader'
import Card from './Card'
import Tabs from './Tabs'
import Button from './Button'
import Badge from './Badge'
import Select from './Select'
import SearchBar from './SearchBar'
import FilterBar from './FilterBar'
import EmptyState from './EmptyState'
import AsyncState from './AsyncState'
import { Skeleton } from './Skeleton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { getNotificationsForUser } from '../../utils/portalNotifications'
import { createStore, useStore } from '../../utils/createStore'
import { formatDateTime, timeAgo } from '../../utils/format'
import { cn } from '../../utils/cn'

const CATEGORY_META = {
  tasks: { label: 'Tasks', icon: ListChecks, tone: 'brand' },
  projects: { label: 'Projects', icon: Briefcase, tone: 'accent' },
  billing: { label: 'Billing', icon: Receipt, tone: 'success' },
  crm: { label: 'CRM', icon: Users, tone: 'info' },
  support: { label: 'Support', icon: LifeBuoy, tone: 'warning' },
  meetings: { label: 'Meetings', icon: CalendarClock, tone: 'brand' },
  system: { label: 'Updates', icon: Settings2, tone: 'neutral' },
}

const ICON_CHIP = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  neutral: 'bg-ink-100 text-ink-500 dark:bg-ink-800',
}

// Per-account read / dismissed state so it survives navigation.
const stateStore = createStore({})
const EMPTY_ACCOUNT = { read: [], dismissed: [] }

function NotificationsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading notifications" className="space-y-3">
      <Skeleton className="h-10 w-72" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-ink-200 p-4 dark:border-ink-800">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Role-scoped notification centre used by the employee and client portals.
export default function NotificationCenter({ homeHref, breadcrumbLabel = 'Notifications', description }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad({ delay: 500 })
  const account = useStore(stateStore)[user?.email] || EMPTY_ACCOUNT

  const [tab, setTab] = useState('all')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const items = useMemo(
    () =>
      getNotificationsForUser(user)
        .filter((n) => !account.dismissed.includes(n.id))
        .map((n) => ({ ...n, read: n.read || account.read.includes(n.id) })),
    [user, account]
  )

  const unread = items.filter((n) => !n.read).length
  const categories = [...new Set(items.map((n) => n.category))]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(
      (n) =>
        (tab === 'all' || !n.read) &&
        (!category || n.category === category) &&
        (!q || n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))
    )
  }, [items, tab, category, search])

  function patch(fn) {
    stateStore.set((all) => ({ ...all, [user.email]: fn(all[user.email] || EMPTY_ACCOUNT) }))
  }

  function markRead(id) {
    patch((s) => ({ ...s, read: [...new Set([...s.read, id])] }))
  }

  function markAllRead() {
    patch((s) => ({ ...s, read: [...new Set([...s.read, ...items.map((n) => n.id)])] }))
    toast.success('All notifications marked as read')
  }

  function dismiss(id) {
    patch((s) => ({ ...s, dismissed: [...s.dismissed, id] }))
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={description || 'Updates about your work, in one place.'}
        breadcrumbItems={[{ label: breadcrumbLabel }]}
        homeHref={homeHref}
        action={
          <Button variant="secondary" leftIcon={<CheckCheck size={15} />} onClick={markAllRead} disabled={unread === 0}>
            Mark all as read
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<NotificationsSkeleton />}>
        {items.length === 0 ? (
          <EmptyState icon={BellOff} title="You're all caught up" description="New notifications will appear here as things happen." />
        ) : (
          <>
            <Tabs
              tabs={[
                { value: 'all', label: 'All', count: items.length },
                { value: 'unread', label: 'Unread', count: unread },
              ]}
              active={tab}
              onChange={setTab}
              ariaLabel="Notification filter"
              className="mb-4"
            />
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search notifications..." />}
              chips={category ? [{ key: 'category', label: `Type: ${CATEGORY_META[category]?.label || category}`, onRemove: () => setCategory('') }] : []}
              onClearAll={() => setCategory('')}
            >
              <Select
                aria-label="Filter by type"
                placeholder="All types"
                options={categories.map((c) => ({ value: c, label: CATEGORY_META[c]?.label || c }))}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="sm:w-44"
              />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState icon={Bell} title="Nothing to show" description="No notifications match this view." />
            ) : (
              <ul className="space-y-2">
                {filtered.map((n) => {
                  const meta = CATEGORY_META[n.category] || CATEGORY_META.system
                  const Icon = meta.icon
                  return (
                    <li key={n.id}>
                      <Card hover className={cn('flex items-start gap-3 p-4', !n.read && 'border-brand-200 bg-brand-50/40 dark:border-brand-500/30 dark:bg-brand-500/5')}>
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', ICON_CHIP[meta.tone] || ICON_CHIP.neutral)}>
                          <Icon size={17} />
                        </span>
                        <button type="button" onClick={() => markRead(n.id)} className="focus-ring min-w-0 flex-1 rounded text-left" aria-label={`${n.title}. ${n.read ? 'Read' : 'Unread, click to mark as read'}`}>
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{n.title}</span>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />}
                          </span>
                          <span className="mt-0.5 block text-sm text-ink-500">{n.description}</span>
                          <time dateTime={n.time} title={formatDateTime(n.time)} className="mt-1 block text-xs text-ink-400">
                            {timeAgo(n.time)}
                          </time>
                        </button>
                        <Button variant="ghost" size="icon" onClick={() => dismiss(n.id)} aria-label={`Dismiss ${n.title}`}>
                          <Trash2 size={15} />
                        </Button>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </AsyncState>
    </div>
  )
}
