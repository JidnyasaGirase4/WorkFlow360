import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Loader, Eye, CheckCircle2, CalendarClock, ChevronRight, SearchX, FolderKanban, Circle } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader } from '../../components/portal/Panel'
import PortalStat from '../../components/portal/PortalStat'
import IconChip from '../../components/portal/IconChip'
import { stagger } from '../../components/portal/tones'
import Tabs from '../../components/common/Tabs'
import Select from '../../components/common/Select'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import StatusBadge from '../../components/common/StatusBadge'
import Badge from '../../components/common/Badge'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { SkeletonCard, SkeletonTable } from '../../components/common/Skeleton'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { TODAY } from '../../mockData/reference'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'done', label: 'Completed' },
]

function TasksSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading tasks">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={6} cols={4} />
      </div>
    </div>
  )
}

export default function ClientTasks() {
  const navigate = useNavigate()
  const { isLoading, isError, retry } = usePortalLoad()
  const { company, projects, tasks } = useClientData()
  const [status, setStatus] = useState('all')
  const [projectFilter, setProjectFilter] = useState('')
  const [search, setSearch] = useState('')

  const stats = useMemo(
    () => ({
      total: tasks.length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      review: tasks.filter((t) => t.status === 'review').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks]
  )

  // Project + search filters apply first so the tab counts match what the list can show.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        (!projectFilter || t.projectId === projectFilter) &&
        (!q || t.title.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q) || t.project.toLowerCase().includes(q))
    )
  }, [tasks, projectFilter, search])

  const tabs = STATUS_TABS.map((tab) => ({
    ...tab,
    count: tab.value === 'all' ? scoped.length : scoped.filter((t) => t.status === tab.value).length,
  }))

  const visible = useMemo(() => scoped.filter((t) => status === 'all' || t.status === status).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [scoped, status])

  const grouped = useMemo(() => {
    const map = new Map()
    visible.forEach((t) => {
      if (!map.has(t.projectId)) map.set(t.projectId, { id: t.projectId, name: t.project, items: [] })
      map.get(t.projectId).items.push(t)
    })
    return [...map.values()]
  }, [visible])

  const statCards = [
    { icon: ListChecks, label: 'Total Tasks', value: stats.total, tone: 'brand' },
    { icon: Loader, label: 'In Progress', value: stats.inProgress, tone: 'info' },
    { icon: Eye, label: 'In Review', value: stats.review, tone: 'accent' },
    { icon: CheckCircle2, label: 'Completed', value: stats.done, tone: 'success' },
  ]

  const projectName = projects.find((p) => p.id === projectFilter)?.name

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`Progress on the work being delivered for ${company || 'your company'}. Select a task to open its project.`}
        breadcrumbItems={[{ label: 'Tasks' }]}
        homeHref="/client/dashboard"
        action={
          <Button as={Link} to="/client/projects" variant="secondary" leftIcon={<FolderKanban size={15} />}>
            View projects
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<TasksSkeleton />}>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          {statCards.map((card, i) => (
            <PortalStat key={card.label} index={i} {...card} />
          ))}
        </div>

        {tasks.length === 0 ? (
          <Panel className="mt-6">
            <EmptyState icon={ListChecks} title="No tasks yet" description="Tasks for your projects will appear here as soon as the team starts planning the work." />
          </Panel>
        ) : (
          <>
            <FilterBar
              className="mt-6"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search tasks or assignees..." />}
              chips={projectFilter ? [{ key: 'project', label: `Project: ${projectName}`, onRemove: () => setProjectFilter('') }] : []}
              onClearAll={() => setProjectFilter('')}
            >
              <Select aria-label="Filter by project" placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="sm:w-64" />
            </FilterBar>

            <Tabs tabs={tabs} active={status} onChange={setStatus} ariaLabel="Task status" className="mt-4" />

            <div className="mt-5 space-y-4 sm:space-y-5">
              {visible.length === 0 ? (
                <Panel>
                  <EmptyState icon={SearchX} title="No tasks match your filters" description="Try a different status, project or search term." />
                </Panel>
              ) : (
                grouped.map((group, gi) => (
                  <Panel key={group.id} style={stagger(gi, 50)} className="animate-slide-up overflow-hidden">
                    <PanelHeader
                      icon={FolderKanban}
                      tone="brand"
                      title={group.name}
                      action={
                        <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                          {group.items.length} {group.items.length === 1 ? 'task' : 'tasks'}
                        </span>
                      }
                    />
                    <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                      {group.items.map((task) => {
                        const overdue = task.status !== 'done' && task.dueDate < TODAY
                        const open = () => navigate(`/client/projects/${task.projectId}`)
                        return (
                          <li key={task.id}>
                            <div
                              role="link"
                              tabIndex={0}
                              aria-label={`${task.title}, open ${task.project}`}
                              onClick={open}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  open()
                                }
                              }}
                              className="focus-ring group flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/50 dark:hover:bg-ink-800/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <IconChip
                                  icon={task.status === 'done' ? CheckCircle2 : task.status === 'in_progress' ? Loader : task.status === 'review' ? Eye : Circle}
                                  tone={task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'brand' : task.status === 'review' ? 'info' : 'neutral'}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className={cn('truncate text-sm font-semibold text-ink-800 dark:text-ink-100', task.status === 'done' && 'text-ink-500 line-through decoration-ink-300 dark:text-ink-400')}>{task.title}</p>
                                  <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
                                    <Avatar name={task.assignee} size="xs" />
                                    <span className="truncate">{task.assignee}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
                                <span className={cn('flex items-center gap-1 text-xs', overdue ? 'font-semibold text-danger-600 dark:text-danger-500' : 'text-ink-500')}>
                                  <CalendarClock size={13} />
                                  Due {formatDate(task.dueDate)}
                                </span>
                                {overdue && <Badge tone="danger">Overdue</Badge>}
                                <StatusBadge status={task.status} />
                                <ChevronRight size={16} className="hidden text-ink-300 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </Panel>
                ))
              )}
            </div>
          </>
        )}
      </AsyncState>
    </div>
  )
}
