import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { CalendarClock, Users, Eye, Download, MessageSquare, Flag, FolderSearch, Activity, Target, ListChecks } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import Button from '../../components/common/Button'
import Tabs from '../../components/common/Tabs'
import StatusBadge from '../../components/common/StatusBadge'
import Avatar from '../../components/common/Avatar'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import ActivityTimeline from '../../components/common/ActivityTimeline'
import FilePreviewModal from '../../components/common/FilePreviewModal'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonText } from '../../components/common/Skeleton'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import AnimatedBar from '../../components/portal/AnimatedBar'
import IconChip from '../../components/portal/IconChip'
import FileTypeTile from '../../components/portal/FileTypeTile'
import MilestoneStepper from '../../components/portal/MilestoneStepper'
import { stagger } from '../../components/portal/tones'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { clientProjectUpdates } from '../../mockData/clientPortal'
import { TODAY } from '../../mockData/reference'
import { downloadMockDocument } from '../../utils/download'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'milestones', label: 'Milestones' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'files', label: 'Files' },
  { value: 'team', label: 'Team' },
  { value: 'activity', label: 'Activity' },
]

const MILESTONE_LABEL = { done: 'Completed', in_progress: 'In progress', upcoming: 'Upcoming', delayed: 'Delayed' }

function DetailsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading project" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <Skeleton className="mb-4 h-5 w-40" />
        <SkeletonText lines={5} />
      </div>
    </div>
  )
}

export default function ClientProjectDetails() {
  const { id } = useParams()
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { projects, tasks, milestones, documents } = useClientData()
  const [tab, setTab] = useState('overview')
  const [preview, setPreview] = useState(null)

  // Only projects that belong to the logged-in client resolve here.
  const project = projects.find((p) => p.id === id) || null

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id])
  const projectMilestones = useMemo(() => milestones.filter((m) => m.projectId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [milestones, id])
  const projectFiles = useMemo(() => documents.filter((d) => project && d.project === project.name), [documents, project])

  const updates = useMemo(() => {
    if (!project) return []
    if (clientProjectUpdates[project.id]) return clientProjectUpdates[project.id]
    return [
      ...projectMilestones.filter((m) => m.status === 'done').map((m) => ({ id: m.id, actor: m.owner, text: `completed milestone "${m.title}"`, time: `${m.dueDate}T10:00:00`, tone: 'success' })),
      { id: 'kickoff', actor: project.manager, text: 'kicked off this project', time: `${project.startDate}T09:30:00`, tone: 'neutral' },
    ].sort((a, b) => b.time.localeCompare(a.time))
  }, [project, projectMilestones])

  function handleDownload(file) {
    downloadMockDocument(file)
    toast.success(`Downloading ${file.name}`)
  }

  const doneMilestones = projectMilestones.filter((m) => m.status === 'done').length
  const nextMilestone = projectMilestones.find((m) => m.status !== 'done')

  return (
    <div>
      <PageHeader
        title={project?.name || 'Project'}
        description={project ? project.description : undefined}
        breadcrumbItems={[{ label: 'Projects', href: '/client/projects' }, { label: project?.name || 'Details' }]}
        homeHref="/client/dashboard"
        action={
          project && (
            <Button as={Link} to="/client/messages" leftIcon={<MessageSquare size={15} />}>
              Message {project.manager.split(' ')[0]}
            </Button>
          )
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DetailsSkeleton />}>
        {!project ? (
          <Panel>
            <ErrorState
              icon={FolderSearch}
              title="Project not found"
              description="This project doesn't exist or isn't part of your account."
              action={
                <Button as={Link} to="/client/projects" size="sm">
                  Back to projects
                </Button>
              }
            />
          </Panel>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
              <Panel style={stagger(0)} className="animate-slide-up flex items-center gap-3 p-4">
                <IconChip icon={Activity} tone="success" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={project.status} />
                  </div>
                </div>
              </Panel>
              <Panel style={stagger(1)} className="animate-slide-up flex items-center gap-3 p-4">
                <IconChip icon={Flag} tone="brand" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">Milestones</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-ink-800 dark:text-ink-100">
                    {doneMilestones} / {projectMilestones.length} completed
                  </p>
                </div>
              </Panel>
              <Panel style={stagger(2)} className="animate-slide-up flex items-center gap-3 p-4">
                <IconChip icon={Target} tone="accent" />
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">Target delivery</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-ink-800 dark:text-ink-100">{formatDate(project.deadline)}</p>
                </div>
              </Panel>
            </div>

            <Panel className="mb-6 p-4 sm:p-5">
              <AnimatedBar value={project.progress} showValue label="Overall progress" size="lg" />
            </Panel>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
              <div className="min-w-0 lg:col-span-2">
                <Tabs tabs={TABS} active={tab} onChange={setTab} idPrefix="cproj" ariaLabel="Project sections" className="mb-5" />

                <div role="tabpanel" id={`cproj-panel-${tab}`} aria-labelledby={`cproj-tab-${tab}`}>
                  {tab === 'overview' && (
                    <Panel>
                      <PanelHeader icon={Target} tone="brand" title="About this project" />
                      <PanelBody className="space-y-4">
                        <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{project.description}</p>
                        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                          {[
                            ['Started', formatDate(project.startDate)],
                            ['Target delivery', formatDate(project.deadline)],
                            ['Project manager', project.manager],
                            ['Next milestone', nextMilestone ? `${nextMilestone.title} (${formatDate(nextMilestone.dueDate)})` : 'All milestones completed'],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-ink-50 px-3.5 py-3 dark:bg-ink-800/40">
                              <dt className="text-xs text-ink-500">{label}</dt>
                              <dd className="mt-0.5 font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </PanelBody>
                    </Panel>
                  )}

                  {tab === 'milestones' && (
                    <Panel>
                      <PanelBody>
                        {projectMilestones.length === 0 ? (
                          <EmptyState icon={Flag} title="No milestones yet" description="Milestones will be added once the delivery plan is agreed." className="py-8" />
                        ) : (
                          <MilestoneStepper
                            items={projectMilestones.map((m) => ({
                              id: m.id,
                              title: m.title,
                              description: m.description,
                              due: formatDate(m.dueDate),
                              status: m.status,
                              label: MILESTONE_LABEL[m.status],
                            }))}
                          />
                        )}
                      </PanelBody>
                    </Panel>
                  )}

                  {tab === 'tasks' && (
                    <Panel>
                      <PanelBody className="space-y-2.5">
                        {projectTasks.length === 0 && <EmptyState icon={ListChecks} title="No tasks yet" description="Tasks for this project will appear here." className="py-8" />}
                        {projectTasks.map((t, i) => (
                          <div
                            key={t.id}
                            style={stagger(i, 40)}
                            className="animate-slide-up flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{t.title}</p>
                              <p className={cn('mt-1 truncate text-xs', t.status !== 'done' && t.dueDate < TODAY ? 'font-semibold text-danger-600 dark:text-danger-400' : 'text-ink-500')}>
                                {t.assignee} · Due {formatDate(t.dueDate)}
                              </p>
                            </div>
                            <StatusBadge status={t.status} />
                          </div>
                        ))}
                      </PanelBody>
                    </Panel>
                  )}

                  {tab === 'files' && (
                    <Panel>
                      <PanelBody className="space-y-2.5">
                        {projectFiles.length === 0 && <EmptyState title="No files" description="Files shared for this project will appear here." className="py-8" />}
                        {projectFiles.map((f, i) => (
                          <div
                            key={f.id}
                            style={stagger(i, 40)}
                            className="animate-slide-up flex flex-col gap-3 rounded-xl border border-ink-100 p-3 text-sm transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <FileTypeTile type={f.type} />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-ink-800 dark:text-ink-100">{f.name}</p>
                                <p className="truncate text-xs text-ink-500">
                                  {f.category} · {f.size} · {formatDate(f.uploadedDate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button size="sm" variant="secondary" leftIcon={<Eye size={13} />} onClick={() => setPreview(f)}>
                                Preview
                              </Button>
                              <Button size="sm" variant="secondary" leftIcon={<Download size={13} />} onClick={() => handleDownload(f)}>
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </PanelBody>
                    </Panel>
                  )}

                  {tab === 'team' && (
                    <Panel>
                      <PanelBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {[project.manager, ...project.team].map((member, idx) => (
                          <div
                            key={member}
                            style={stagger(idx, 40)}
                            className="animate-slide-up flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40"
                          >
                            <Avatar name={member} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{member}</p>
                              <p className="text-xs text-ink-500">{idx === 0 ? 'Project Manager' : 'Project Contributor'}</p>
                            </div>
                          </div>
                        ))}
                      </PanelBody>
                    </Panel>
                  )}

                  {tab === 'activity' && (
                    <Panel>
                      <PanelBody>
                        <ActivityTimeline items={updates} />
                      </PanelBody>
                    </Panel>
                  )}
                </div>
              </div>

              <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                <Panel className="overflow-hidden">
                  <div className="gradient-soft h-14" aria-hidden="true" />
                  <div className="-mt-9 px-4 pb-4 sm:px-5 sm:pb-5">
                    <Avatar name={project.manager} size="xl" className="rounded-full ring-4 ring-white dark:ring-ink-900" />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Your point of contact</p>
                    <p className="mt-0.5 text-base font-semibold text-ink-800 dark:text-ink-100">{project.manager}</p>
                    <p className="text-xs text-ink-500">Project Manager</p>
                  </div>
                </Panel>
                <Panel>
                  <PanelBody className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-ink-600 dark:text-ink-300">
                      <IconChip icon={Users} tone="info" size="sm" /> Team size: {project.team.length + 1}
                    </div>
                    <div className="flex items-center gap-3 text-ink-600 dark:text-ink-300">
                      <IconChip icon={CalendarClock} tone="warning" size="sm" /> Delivery: {formatDate(project.deadline)}
                    </div>
                  </PanelBody>
                </Panel>
              </div>
            </div>
          </>
        )}
      </AsyncState>

      <FilePreviewModal doc={preview} isOpen={Boolean(preview)} onClose={() => setPreview(null)} onDownload={handleDownload} />
    </div>
  )
}
