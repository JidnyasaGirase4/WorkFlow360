import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Search, Users, Building2, FolderKanban, UserSquare2, ListChecks, Receipt, LifeBuoy, CornerDownLeft } from 'lucide-react'
import { leads } from '../mockData/leads'
import { clients } from '../mockData/clients'
import { projects } from '../mockData/projects'
import { employees } from '../mockData/employees'
import { tasks } from '../mockData/tasks'
import { invoices } from '../mockData/invoices'
import { tickets } from '../mockData/tickets'
import StatusBadge from '../components/common/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { ROLES } from '../mockData/users'
import { useResetOnChange } from '../hooks/useResetOnChange'
import { useOverlay } from '../hooks/useOverlay'
import { cn } from '../utils/cn'

const CATEGORY_TONE = {
  Leads: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  Clients: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  Projects: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  Employees: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  Tasks: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
  Invoices: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  Tickets: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
}

function buildAdminIndex() {
  return [
    ...leads.map((l) => ({ category: 'Leads', icon: Users, title: l.name, sub: l.company, status: l.status, href: `/admin/crm/leads/${l.id}` })),
    ...clients.map((c) => ({ category: 'Clients', icon: Building2, title: c.company, sub: c.contactPerson, status: c.status, href: `/admin/crm/clients/${c.id}` })),
    ...projects.map((p) => ({ category: 'Projects', icon: FolderKanban, title: p.name, sub: p.client, status: p.status, href: `/admin/projects/${p.id}` })),
    ...employees.map((e) => ({ category: 'Employees', icon: UserSquare2, title: e.name, sub: e.designation, status: e.status, href: `/admin/employees/${e.id}` })),
    ...tasks.map((t) => ({ category: 'Tasks', icon: ListChecks, title: t.title, sub: t.project, status: t.status, href: '/admin/tasks' })),
    ...invoices.map((i) => ({ category: 'Invoices', icon: Receipt, title: i.number, sub: i.client, status: i.status, href: `/admin/billing/invoices/${i.id}` })),
    ...tickets.map((t) => ({ category: 'Tickets', icon: LifeBuoy, title: t.subject, sub: t.client, status: t.status, href: `/admin/support/${t.id}` })),
  ]
}

// Employees only see work assigned to them.
function buildEmployeeIndex(user) {
  const name = user?.name
  return [
    ...projects.filter((p) => p.team?.includes(name) || p.manager === name).map((p) => ({ category: 'Projects', icon: FolderKanban, title: p.name, sub: p.client, status: p.status, href: '/employee/projects' })),
    ...tasks.filter((t) => t.assignee === name).map((t) => ({ category: 'Tasks', icon: ListChecks, title: t.title, sub: t.project, status: t.status, href: '/employee/tasks' })),
  ]
}

// Clients only see records that belong to their own company.
function buildClientIndex(user) {
  const company = user?.company
  const ownProjects = projects.filter((p) => p.client === company)
  const projectIds = new Set(ownProjects.map((p) => p.id))
  return [
    ...ownProjects.map((p) => ({ category: 'Projects', icon: FolderKanban, title: p.name, sub: p.manager, status: p.status, href: `/client/projects/${p.id}` })),
    ...tasks.filter((t) => projectIds.has(t.projectId)).map((t) => ({ category: 'Tasks', icon: ListChecks, title: t.title, sub: t.project, status: t.status, href: '/client/tasks' })),
    ...invoices.filter((i) => i.client === company && !['draft', 'cancelled'].includes(i.status)).map((i) => ({ category: 'Invoices', icon: Receipt, title: i.number, sub: i.client, status: i.status, href: '/client/invoices' })),
    ...tickets.filter((t) => t.client === company).map((t) => ({ category: 'Tickets', icon: LifeBuoy, title: t.subject, sub: t.ticketId, status: t.status, href: `/client/tickets/${t.id}` })),
  ]
}

function buildIndex(user) {
  if (user?.role === ROLES.CLIENT) return buildClientIndex(user)
  if (user?.role === ROLES.EMPLOYEE) return buildEmployeeIndex(user)
  return buildAdminIndex()
}

export default function GlobalSearch({ isOpen, onClose }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const navigate = useNavigate()
  const index = useMemo(() => buildIndex(user), [user])
  const panelRef = useRef(null)
  useOverlay({ isOpen, onClose, ref: panelRef })
  const placeholder =
    user?.role === ROLES.CLIENT
      ? 'Search projects, tasks, invoices, tickets...'
      : user?.role === ROLES.EMPLOYEE
        ? 'Search your projects and tasks...'
        : 'Search leads, clients, projects, tasks, invoices...'

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return index.filter((item) => item.title.toLowerCase().includes(q) || item.sub?.toLowerCase().includes(q)).slice(0, 8)
  }, [query, index])

  useResetOnChange([query], () => setActiveIdx(0))
  useResetOnChange([isOpen], () => {
    if (!isOpen) setQuery('')
  })

  useEffect(() => {
    function onKeyDown(e) {
      if (!isOpen) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[activeIdx]) {
        navigate(results[activeIdx].href)
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, results, activeIdx, navigate, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-16 sm:px-4 sm:pt-24">
      <div className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-md" onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Search" className="animate-scale-in relative w-full max-w-xl overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-panel dark:border-ink-800 dark:bg-ink-900">
        <div className="gradient-soft flex items-center gap-3 border-b border-ink-100 px-4 py-3.5 dark:border-ink-800">
          <Search size={18} className="shrink-0 text-brand-600 dark:text-brand-300" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-800 outline-none placeholder:text-ink-400 dark:text-ink-100"
          />
          <kbd className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-xs font-semibold text-ink-400 dark:border-ink-700 dark:bg-ink-800">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-400">No results for "{query}"</p>
          )}
          {!query.trim() && (
            <p className="px-3 py-8 text-center text-sm text-ink-400">Search across your workspace</p>
          )}
          {results.map((item, idx) => (
            <button
              key={`${item.category}-${item.title}-${idx}`}
              onClick={() => {
                navigate(item.href)
                onClose()
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                idx === activeIdx ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'
              )}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', CATEGORY_TONE[item.category] || CATEGORY_TONE.Leads)}>
                <item.icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500 dark:bg-ink-800">{item.category}</span>
                </span>
                {item.sub && <span className="block truncate text-xs text-ink-400">{item.sub}</span>}
              </span>
              {item.status && <StatusBadge status={item.status} />}
              {idx === activeIdx && <CornerDownLeft size={13} className="shrink-0 text-ink-300" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
