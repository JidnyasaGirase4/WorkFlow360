import { Link, useNavigate } from 'react-router-dom'
import { Users, CalendarClock, MoreHorizontal, Pencil, Trash2, Eye, UserRound } from 'lucide-react'
import Card from '../common/Card'
import StatusBadge from '../common/StatusBadge'
import Avatar from '../common/Avatar'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '../common/Dropdown'
import ProjectProgressRing from './ProjectProgressRing'
import { TONES, PROJECT_STATUS_TONE, progressTone } from './ProjectTones'
import { formatDate } from '../../utils/format'
import { isPastDate } from '../../utils/workspace'
import { cn } from '../../utils/cn'

const BAR_GRADIENT = {
  success: 'from-success-400 to-success-500',
  warning: 'from-warning-400 to-warning-500',
  danger: 'from-danger-400 to-danger-500',
  brand: 'from-brand-400 to-brand-600',
  accent: 'from-accent-400 to-accent-500',
}

export default function ProjectCard({ project, onEdit, onDelete }) {
  const navigate = useNavigate()
  const overdue = project.status !== 'completed' && project.status !== 'cancelled' && isPastDate(project.deadline)
  const team = project.team || []
  const tone = progressTone(project.progress, project.status)
  const statusTone = TONES[PROJECT_STATUS_TONE[project.status] || 'neutral']

  return (
    <Card hover className="group relative cursor-pointer overflow-hidden p-4 sm:p-5" onClick={() => navigate(`/admin/projects/${project.id}`)}>
      <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1', statusTone.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProjectProgressRing value={project.progress} tone={tone} label={`${project.name} progress`} className="transition-transform duration-300 group-hover:scale-105" />
          <div className="min-w-0">
            <Link
              to={`/admin/projects/${project.id}`}
              onClick={(e) => e.stopPropagation()}
              className="focus-ring line-clamp-2 break-words rounded text-base font-bold leading-snug text-ink-800 hover:text-brand-600 dark:text-ink-100"
            >
              {project.name}
            </Link>
            <p className="mt-0.5 truncate text-sm text-ink-500">{project.client}</p>
          </div>
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for ${project.name}`}
                className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800"
              >
                <MoreHorizontal size={18} />
              </button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem icon={<Eye size={14} />} onClick={() => navigate(`/admin/projects/${project.id}`)}>View Project</DropdownItem>
              {onEdit && <DropdownItem icon={<Pencil size={14} />} onClick={() => onEdit(project)}>Edit</DropdownItem>}
              {onDelete && <DropdownItem icon={<Trash2 size={14} />} danger onClick={() => onDelete(project)}>Delete</DropdownItem>}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <StatusBadge status={project.status} className="shrink-0" />
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
          <UserRound size={13} aria-hidden="true" className="shrink-0 text-accent-500" />
          <span className="truncate">
            Manager: <span className="font-semibold text-ink-700 dark:text-ink-200">{project.manager}</span>
          </span>
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>Progress</span>
          <span className="font-bold text-ink-700 dark:text-ink-200">{project.progress}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div
            className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out starting:w-0', BAR_GRADIENT[tone])}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3.5 dark:border-ink-800">
        <div className="flex -space-x-1.5">
          {team.slice(0, 4).map((member) => (
            <Avatar key={member} name={member} size="sm" className="ring-2 ring-white transition-transform group-hover:-translate-y-0.5 dark:ring-ink-900" />
          ))}
          {team.length > 4 && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-500 ring-2 ring-white dark:bg-ink-800 dark:ring-ink-900">
              +{team.length - 4}
            </span>
          )}
          {team.length === 0 && <span className="text-xs text-ink-400">No team yet</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-info-50 px-2.5 py-1 font-medium text-info-600 dark:bg-info-500/15 dark:text-info-300">
            <Users size={12} aria-hidden="true" /> {team.length}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium',
              overdue ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400' : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300'
            )}
          >
            <CalendarClock size={12} aria-hidden="true" /> {formatDate(project.deadline)}
          </span>
        </div>
      </div>
    </Card>
  )
}
