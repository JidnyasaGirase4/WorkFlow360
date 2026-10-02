import { CalendarClock, MessageSquare, Paperclip } from 'lucide-react'
import Badge from '../common/Badge'
import Avatar from '../common/Avatar'
import MoveToMenu from './MoveToMenu'
import { formatDate } from '../../utils/format'
import { TASK_COLUMNS, cap, isPastDate, priorityTone } from '../../utils/workspace'
import { cn } from '../../utils/cn'

// Card body rendered inside a board column for tasks. The coloured left edge
// (priority accent) is applied by the board through `cardAccent`.
export default function TaskCard({ task, onOpen, onMove }) {
  const overdue = task.status !== 'done' && isPastDate(task.dueDate)

  return (
    <div onClick={() => onOpen(task)} className="cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          draggable={false}
          className="focus-ring min-w-0 rounded text-left text-sm font-semibold leading-snug text-ink-800 hover:text-brand-600 dark:text-ink-100"
        >
          {task.title}
        </button>
        <Badge tone={priorityTone(task.priority)} className="shrink-0">{cap(task.priority)}</Badge>
      </div>
      <p className="mt-1 truncate text-xs text-ink-400">{task.project}</p>
      <p
        className={cn(
          'mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
          overdue
            ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
            : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
        )}
      >
        <CalendarClock size={12} aria-hidden="true" />
        Due {formatDate(task.dueDate, { year: undefined })}
        {overdue && ' · Overdue'}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 dark:border-ink-800">
        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="flex items-center gap-1" title={`${task.comments} comments`}>
            <MessageSquare size={13} aria-hidden="true" />
            <span aria-label={`${task.comments} comments`}>{task.comments}</span>
          </span>
          <span className="flex items-center gap-1" title={`${task.attachments} attachments`}>
            <Paperclip size={13} aria-hidden="true" />
            <span aria-label={`${task.attachments} attachments`}>{task.attachments}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Avatar name={task.assignee} size="xs" />
          <MoveToMenu itemLabel={task.title} current={task.status} options={TASK_COLUMNS} onSelect={(status) => onMove(task.id, status)} />
        </div>
      </div>
    </div>
  )
}
