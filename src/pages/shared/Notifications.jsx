import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Bell,
  BellOff,
  Briefcase,
  CalendarClock,
  CheckCheck,
  LifeBuoy,
  ListChecks,
  Mail,
  MailOpen,
  Receipt,
  Settings2,
  Trash2,
  Users,
} from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import Tabs from '../../components/common/Tabs'
import Card, { CardBody, CardHeader, CardTitle } from '../../components/common/Card'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Switch from '../../components/common/Switch'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import Drawer from '../../components/common/Drawer'
import { Skeleton } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import {
  NOTIFICATION_CATEGORIES,
  getNotificationPreferences,
  notificationService,
  saveNotificationPreferences,
} from '../../services/notificationService'
import { formatDateTime, timeAgo } from '../../utils/format'
import { cn } from '../../utils/cn'

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
  tasks: 'brand',
  projects: 'accent',
  billing: 'success',
  crm: 'info',
  support: 'warning',
  meetings: 'brand',
  system: 'neutral',
}

const CATEGORY_CHIP = {
  tasks: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  projects: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  billing: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
  crm: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  support: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  meetings: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400',
  system: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
}

const CATEGORY_LABEL = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.value, c.label]))

const READ_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
]

export default function NotificationsPage() {
  const { toast } = useToast()
  const { pathname } = useLocation()
  const homeHref = `/${pathname.split('/')[1] || 'admin'}/dashboard`
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [category, setCategory] = useState('all')
  const [readFilter, setReadFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  const [prefs, setPrefs] = useState(getNotificationPreferences)
  const [savedPrefs, setSavedPrefs] = useState(getNotificationPreferences)
  const [savingPrefs, setSavingPrefs] = useState(false)

  useEffect(() => {
    let active = true
    notificationService
      .list()
      .then((data) => {
        if (!active) return
        setItems(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt])

  function retryLoad() {
    setLoadError(false)
    setLoading(true)
    setAttempt((a) => a + 1)
  }

  const unreadCount = items.filter((n) => !n.read).length

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All', count: items.length },
      ...NOTIFICATION_CATEGORIES.map((c) => ({
        value: c.value,
        label: c.label,
        count: items.filter((n) => n.category === c.value).length,
      })),
    ],
    [items]
  )

  const filtered = useMemo(
    () =>
      items
        .filter((n) => category === 'all' || n.category === category)
        .filter((n) => readFilter === 'all' || (readFilter === 'unread' ? !n.read : n.read))
        .sort((a, b) => new Date(b.time) - new Date(a.time)),
    [items, category, readFilter]
  )

  const selected = items.find((n) => n.id === selectedId) || null
  const prefsDirty = JSON.stringify(prefs) !== JSON.stringify(savedPrefs)

  function setRead(id, read) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)))
    notificationService.update(id, { read })
  }

  function markAllRead() {
    const targets = items.filter((n) => !n.read)
    if (targets.length === 0) return
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    targets.forEach((n) => notificationService.update(n.id, { read: true }))
    toast.success('All notifications marked as read')
  }

  function dismiss(id) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
    notificationService.remove(id)
    toast.info('Notification dismissed')
  }

  function openItem(n) {
    if (!n.read) setRead(n.id, true)
    setSelectedId(n.id)
  }

  function togglePref(cat, channel) {
    setPrefs((p) => ({ ...p, [cat]: { ...p[cat], [channel]: !p[cat][channel] } }))
  }

  function handleSavePrefs() {
    setSavingPrefs(true)
    setTimeout(() => {
      const saved = saveNotificationPreferences(prefs)
      setSavedPrefs(saved)
      setSavingPrefs(false)
      toast.success('Notification preferences saved')
    }, 500)
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        breadcrumbItems={[{ label: 'Notifications' }]}
        homeHref={homeHref}
        description={loading ? 'Loading your notifications…' : unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}.` : "You're all caught up."}
        action={
          <Button variant="secondary" leftIcon={<CheckCheck size={16} />} onClick={markAllRead} disabled={loading || unreadCount === 0} className="w-full sm:w-auto">
            Mark all as read
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3 xl:gap-6">
        <div className="min-w-0 xl:col-span-2">
          <Tabs tabs={tabs} active={category} onChange={setCategory} className="mb-4" />

          <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by read status">
            {READ_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={readFilter === f.value}
                onClick={() => setReadFilter(f.value)}
                className={cn(
                  'focus-ring min-h-9 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95',
                  readFilter === f.value
                    ? 'gradient-brand border-transparent bg-brand-600 text-white shadow-glow'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800'
                )}
              >
                {f.label}
                {f.value === 'unread' && !loading && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden rounded-2xl">
            {loading ? (
              <div className="divide-y divide-ink-100 dark:divide-ink-800" aria-busy="true" aria-label="Loading notifications">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 px-4 py-4">
                    <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <ErrorState title="Couldn't load notifications" description="There was a problem fetching your notifications. Please try again." onRetry={retryLoad} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title={items.length === 0 ? 'No notifications' : 'Nothing to show'}
                description={
                  items.length === 0
                    ? "You're all caught up. New activity will appear here."
                    : 'No notifications match the selected filters. Try a different category or status.'
                }
                actionLabel={items.length > 0 ? 'Clear filters' : undefined}
                onAction={() => {
                  setCategory('all')
                  setReadFilter('all')
                }}
              />
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {filtered.map((n, i) => {
                  const Icon = CATEGORY_ICON[n.category] || Bell
                  return (
                    <li
                      key={n.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                      className={cn(
                        'group relative flex animate-slide-up items-start gap-1 transition-colors hover:bg-brand-50/40 dark:hover:bg-ink-800/40',
                        !n.read && 'bg-brand-50/40 dark:bg-brand-500/5'
                      )}
                    >
                      {!n.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-brand-500" />}
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className="focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-lg px-4 py-3.5 text-left"
                        aria-label={`${n.read ? '' : 'Unread. '}${n.title}. Open details`}
                      >
                        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105', CATEGORY_CHIP[n.category] || CATEGORY_CHIP.system)}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn('truncate text-sm text-ink-800 dark:text-ink-100', n.read ? 'font-medium' : 'font-semibold')}>
                              {n.title}
                            </span>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-ink-500">{n.description}</span>
                          <span className="mt-1.5 flex items-center gap-2 text-xs text-ink-400">
                            <Badge tone={CATEGORY_TONE[n.category] || 'neutral'}>{CATEGORY_LABEL[n.category] || n.category}</Badge>
                            <span>{timeAgo(n.time)}</span>
                          </span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => setRead(n.id, !n.read)}
                          className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                          aria-label={n.read ? `Mark "${n.title}" as unread` : `Mark "${n.title}" as read`}
                          title={n.read ? 'Mark as unread' : 'Mark as read'}
                        >
                          {n.read ? <Mail size={16} /> : <MailOpen size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismiss(n.id)}
                          className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
                          aria-label={`Dismiss "${n.title}"`}
                          title="Dismiss"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card className="min-w-0 self-start rounded-2xl">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
                  <Bell size={16} />
                </span>
                Notification preferences
              </CardTitle>
              <p className="mt-1 text-xs text-ink-500">Choose how you hear about each type of activity.</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-1">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <span>Category</span>
              <span className="text-center">In-app</span>
              <span className="text-center">Email</span>
            </div>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <div
                key={c.value}
                className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t border-ink-100 py-2.5 dark:border-ink-800"
              >
                <span className="min-w-0 text-sm font-medium text-ink-700 dark:text-ink-200">{c.label}</span>
                <span className="flex justify-center">
                  <Switch
                    checked={prefs[c.value].inApp}
                    onChange={() => togglePref(c.value, 'inApp')}
                    aria-label={`${c.label} in-app notifications`}
                  />
                </span>
                <span className="flex justify-center">
                  <Switch
                    checked={prefs[c.value].email}
                    onChange={() => togglePref(c.value, 'email')}
                    aria-label={`${c.label} email notifications`}
                  />
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-4 dark:border-ink-800">
              <p className="text-xs text-ink-400">{prefsDirty ? 'You have unsaved changes.' : 'Preferences are up to date.'}</p>
              <Button size="sm" onClick={handleSavePrefs} isLoading={savingPrefs} disabled={!prefsDirty}>
                Save preferences
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Drawer isOpen={Boolean(selected)} onClose={() => setSelectedId(null)} title="Notification details">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', CATEGORY_CHIP[selected.category] || CATEGORY_CHIP.system)}>
                {(() => {
                  const Icon = CATEGORY_ICON[selected.category] || Bell
                  return <Icon size={20} />
                })()}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">{selected.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={CATEGORY_TONE[selected.category] || 'neutral'}>{CATEGORY_LABEL[selected.category] || selected.category}</Badge>
                  <Badge tone={selected.read ? 'neutral' : 'brand'} dot>
                    {selected.read ? 'Read' : 'Unread'}
                  </Badge>
                </div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{selected.description}</p>

            <dl className="space-y-3 rounded-2xl border border-ink-100 bg-ink-50/60 p-4 text-sm dark:border-ink-800 dark:bg-ink-800/30">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-400">Received</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100">{formatDateTime(selected.time)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-400">Time since</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100">{timeAgo(selected.time)}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selected.read ? 'secondary' : 'primary'}
                leftIcon={selected.read ? <Mail size={16} /> : <MailOpen size={16} />}
                onClick={() => setRead(selected.id, !selected.read)}
              >
                {selected.read ? 'Mark as unread' : 'Mark as read'}
              </Button>
              <Button variant="ghost" leftIcon={<Trash2 size={16} />} onClick={() => dismiss(selected.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
