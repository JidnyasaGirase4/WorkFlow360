import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, CalendarClock, FolderKanban, ListChecks, SearchX } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import StatusBadge from '../../components/common/StatusBadge'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Drawer from '../../components/common/Drawer'
import EmptyState from '../../components/common/EmptyState'
import { Panel } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import AnimatedBar from '../../components/portal/AnimatedBar'
import MilestoneStepper from '../../components/portal/MilestoneStepper'
import { toneOf, stagger, ROTATION } from '../../components/portal/tones'
import SearchBar from '../../components/common/SearchBar'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
]

const MILESTONE_LABEL = { done: 'Done', in_progress: 'In progress', upcoming: 'Upcoming', delayed: 'Delayed' }

function ProjectsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading projects">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </div>
  )
}

export default function EmployeeProjects() {
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, projects, tasks, milestones } = useEmployeeData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter(
      (p) => (!q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)) && (!status || p.status === status)
    )
  }, [projects, search, status])

  const chips = status ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`, onRemove: () => setStatus('') }] : []
  const selected = projects.find((p) => p.id === selectedId) || null

  return (
    <div>
      <PageHeader
        title="My Projects"
        description="Projects you're assigned to."
        breadcrumbItems={[{ label: 'Work' }, { label: 'My Projects' }]}
        homeHref="/employee/dashboard"
        action={
          <Button as={Link} to="/employee/tasks" leftIcon={<ListChecks size={15} />}>
            View My Tasks
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<ProjectsSkeleton />}>
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects assigned yet" description="You are not part of any project. Your manager will add you when work begins." />
        ) : (
          <>
            <FilterBar
              className="mb-5"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search projects or clients..." />}
              chips={chips}
              onClearAll={() => setStatus('')}
            >
              <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="No projects match" description="Try a different search or clear the status filter." actionLabel="Clear filters" onAction={() => { setSearch(''); setStatus('') }} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 lg:gap-6">
                {filtered.map((project, idx) => {
                  const mine = tasks.filter((t) => t.projectId === project.id)
                  const open = mine.filter((t) => t.status !== 'done').length
                  const tone = ROTATION[idx % ROTATION.length]
                  return (
                    <Panel key={project.id} hover style={stagger(idx)} className="animate-slide-up flex flex-col overflow-hidden">
                      <span className={cn('h-1.5 w-full bg-gradient-to-r', toneOf(tone).bar)} aria-hidden="true" />
                      <div className="flex flex-1 flex-col p-4 sm:p-5">
                        <button
                          type="button"
                          onClick={() => setSelectedId(project.id)}
                          aria-label={`Open ${project.name}`}
                          className="focus-ring group -m-1 rounded-lg p-1 text-left"
                        >
                          <div className="flex items-start gap-3">
                            <IconChip icon={FolderKanban} tone={tone} className="group-hover:scale-110" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-semibold text-ink-800 dark:text-ink-100">{project.name}</p>
                              <p className="truncate text-sm text-ink-500">{project.client}</p>
                            </div>
                            <StatusBadge status={project.status} />
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm text-ink-500">{project.description}</p>
                        </button>

                        <AnimatedBar value={project.progress} tone={tone} showValue label="Progress" className="mt-4" />

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex -space-x-2">
                            {project.team.slice(0, 4).map((member) => (
                              <Avatar key={member} name={member} size="xs" className="ring-2 ring-white dark:ring-ink-900" />
                            ))}
                            {project.team.length > 4 && (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-500 ring-2 ring-white dark:bg-ink-800 dark:ring-ink-900">
                                +{project.team.length - 4}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-ink-500">
                            <span className="flex items-center gap-1">
                              <Users size={12} /> {project.team.length}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarClock size={12} /> {formatDate(project.deadline)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-auto flex items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
                          <ListChecks size={13} className={toneOf(tone).text} aria-hidden="true" />
                          <span>
                            <span className="font-semibold text-ink-700 dark:text-ink-200">{open}</span> open task{open === 1 ? '' : 's'} assigned to you
                          </span>
                        </p>
                      </div>
                    </Panel>
                  )
                })}
              </div>
            )}
          </>
        )}
      </AsyncState>

      {selected && (
        <Drawer isOpen onClose={() => setSelectedId(null)} title={selected.name} description={selected.client} width="max-w-lg">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} />
              <span className="text-xs text-ink-500">
                {formatDate(selected.startDate)} - {formatDate(selected.deadline)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{selected.description}</p>
            <AnimatedBar value={selected.progress} showValue label="Overall progress" size="lg" />

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-100">Team</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-3">
                  <Avatar name={selected.manager} size="sm" />
                  <span className="text-sm text-ink-700 dark:text-ink-200">{selected.manager}</span>
                  <Badge tone="brand">Project Manager</Badge>
                </li>
                {selected.team.map((member) => (
                  <li key={member} className="flex items-center gap-3">
                    <Avatar name={member} size="sm" />
                    <span className="text-sm text-ink-700 dark:text-ink-200">{member}</span>
                    {member === name && <Badge tone="success">You</Badge>}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-100">Milestones</h3>
              <MilestoneStepper
                items={milestones
                  .filter((m) => m.projectId === selected.id)
                  .map((m) => ({ id: m.id, title: m.title, due: formatDate(m.dueDate), status: m.status, label: MILESTONE_LABEL[m.status] }))}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-800 dark:text-ink-100">Your tasks in this project</h3>
              {tasks.filter((t) => t.projectId === selected.id).length === 0 && <p className="text-sm text-ink-400">No tasks assigned to you here.</p>}
              <ul className="space-y-2">
                {tasks
                  .filter((t) => t.projectId === selected.id)
                  .map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{t.title}</p>
                        <p className="text-xs text-ink-400">Due {formatDate(t.dueDate)}</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </Drawer>
      )}
    </div>
  )
}
