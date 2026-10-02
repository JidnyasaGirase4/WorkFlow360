import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Users, CalendarClock, FolderKanban, MessageSquare, SearchX } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import AnimatedBar from '../../components/portal/AnimatedBar'
import { toneOf, stagger, ROTATION } from '../../components/portal/tones'
import StatusBadge from '../../components/common/StatusBadge'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import SearchBar from '../../components/common/SearchBar'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
]

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

export default function ClientProjects() {
  const navigate = useNavigate()
  const { isLoading, isError, retry } = usePortalLoad()
  const { company, projects } = useClientData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => (!q || p.name.toLowerCase().includes(q) || p.manager.toLowerCase().includes(q)) && (!status || p.status === status))
  }, [projects, search, status])

  return (
    <div>
      <PageHeader
        title="Projects"
        description={`Projects WorkFlow360 is delivering for ${company || 'your company'}.`}
        breadcrumbItems={[{ label: 'Projects' }]}
        homeHref="/client/dashboard"
        action={
          <Button as={Link} to="/client/messages" variant="secondary" leftIcon={<MessageSquare size={15} />}>
            Message your team
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<ProjectsSkeleton />}>
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" description="Projects delivered for your company will appear here." />
        ) : (
          <>
            <FilterBar
              className="mb-5"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search projects..." />}
              chips={status ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`, onRemove: () => setStatus('') }] : []}
              onClearAll={() => setStatus('')}
            >
              <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="No projects match" description="Try a different search or clear the filter." actionLabel="Clear filters" onAction={() => { setSearch(''); setStatus('') }} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6 xl:grid-cols-3">
                {filtered.map((project, idx) => {
                  const tone = ROTATION[idx % ROTATION.length]
                  return (
                    <Panel key={project.id} hover style={stagger(idx)} className="animate-slide-up overflow-hidden">
                      <span className={cn('block h-1.5 w-full bg-gradient-to-r', toneOf(tone).bar)} aria-hidden="true" />
                      <div
                        role="link"
                        tabIndex={0}
                        aria-label={`Open ${project.name}`}
                        onClick={() => navigate(`/client/projects/${project.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(`/client/projects/${project.id}`)
                        }}
                        className="focus-ring group cursor-pointer rounded-b-2xl p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <IconChip icon={FolderKanban} tone={tone} className="group-hover:scale-110" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-semibold text-ink-800 dark:text-ink-100">{project.name}</p>
                            <p className="truncate text-sm text-ink-500">Manager: {project.manager}</p>
                          </div>
                          <StatusBadge status={project.status} />
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm text-ink-500">{project.description}</p>
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
                      </div>
                    </Panel>
                  )
                })}
              </div>
            )}
          </>
        )}
      </AsyncState>
    </div>
  )
}
