import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Pencil, Paperclip, MessageSquare, Trash2, FileText, Upload, Send, CalendarClock, FolderKanban, CheckSquare, History, Plus, Loader2,
} from 'lucide-react'
import Drawer from '../common/Drawer'
import Badge from '../common/Badge'
import Avatar from '../common/Avatar'
import Button from '../common/Button'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import LeadTimeline from './LeadTimeline'
import ClientAvatar from './ClientAvatar'
import { PRIORITY_ACCENT, TONES } from './ProjectTones'
import TaskFormModal from './TaskFormModal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatDateTime } from '../../utils/format'
import {
  ACCEPT_ATTR, MAX_FILE_MB, PRIORITY_OPTIONS, TASK_COLUMNS, TASK_STATUS_LABEL, cap, formatFileSize, isPastDate, newId, priorityTone, validateFile,
} from '../../utils/workspace'
import { cn } from '../../utils/cn'

const MAX_COMMENT = 1000

function statusTone(status) {
  return { todo: 'neutral', in_progress: 'info', review: 'accent', done: 'success' }[status] || 'neutral'
}

// Slide-over with everything about a task: details, checklist, attachments,
// comments and activity history. Reused on the Tasks page and inside a project.
// `onChange(taskId, patch)` persists a partial update and returns a promise.
export default function TaskDetailsDrawer({ task, onClose, onChange, employees = [], projects }) {
  if (!task) return null
  return (
    <Drawer isOpen onClose={onClose} title="Task details" width="max-w-2xl">
      <DrawerBody key={task.id} task={task} onClose={onClose} onChange={onChange} employees={employees} projects={projects} />
    </Drawer>
  )
}

function DrawerBody({ task, onClose, onChange, employees, projects }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const actor = user?.name || 'You'

  const rootRef = useRef(null)
  const fileRef = useRef(null)
  const commentRef = useRef(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [checkText, setCheckText] = useState('')
  const [previousFocus] = useState(() => (typeof document !== 'undefined' ? document.activeElement : null))

  // Focus management: move focus into the panel, hand it back when it closes.
  useEffect(() => {
    rootRef.current?.focus()
    return () => {
      previousFocus?.focus?.()
    }
  }, [previousFocus])

  // Escape closes the drawer, unless the edit dialog is on top.
  useEffect(() => {
    if (editOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editOpen, onClose])

  const commentList = useMemo(() => task.commentList ?? [], [task.commentList])
  const attachmentList = useMemo(() => task.attachmentList ?? [], [task.attachmentList])
  const checklist = useMemo(() => task.checklist ?? [], [task.checklist])
  const history = useMemo(() => task.history ?? [], [task.history])

  const overdue = task.status !== 'done' && isPastDate(task.dueDate)
  const doneCount = checklist.filter((c) => c.done).length
  const checklistPct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0

  function logEvent(text, tone = 'brand') {
    return [{ id: newId('h'), actor, text, time: new Date().toISOString(), tone }, ...history]
  }

  async function apply(patch, successMessage) {
    try {
      await onChange(task.id, patch)
      if (successMessage) toast.success(successMessage)
      return true
    } catch {
      toast.error('Could not save your change. Please try again.')
      return false
    }
  }

  function handleStatus(status) {
    if (!status || status === task.status) return
    apply({ status, history: logEvent(`moved this task to ${TASK_STATUS_LABEL[status]}`, status === 'done' ? 'success' : 'brand') }, `Status changed to ${TASK_STATUS_LABEL[status]}`)
  }

  function handleAssign(assignee) {
    if (!assignee || assignee === task.assignee) return
    apply({ assignee, history: logEvent(`assigned this task to ${assignee}`, 'info') }, `Task assigned to ${assignee}`)
  }

  function handlePriority(priority) {
    if (!priority || priority === task.priority) return
    apply({ priority, history: logEvent(`changed the priority to ${cap(priority)}`, 'warning') }, `Priority set to ${cap(priority)}`)
  }

  async function handleEditSave(values) {
    setEditSaving(true)
    const ok = await apply({ ...values, history: logEvent('edited the task details', 'brand') }, 'Task updated successfully')
    setEditSaving(false)
    if (ok) setEditOpen(false)
  }

  function handleAddComment(e) {
    e.preventDefault()
    const text = comment.trim()
    if (!text) {
      setCommentError('Write a comment before posting')
      return
    }
    if (text.length > MAX_COMMENT) {
      setCommentError(`Comments are limited to ${MAX_COMMENT} characters`)
      return
    }
    const next = [...commentList, { id: newId('cm'), author: actor, text, time: new Date().toISOString() }]
    setComment('')
    setCommentError('')
    apply({ commentList: next, comments: next.length, history: logEvent('added a comment', 'neutral') }, 'Comment added')
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const problem = validateFile(file)
    setUploadError(problem)
    if (problem) return
    setUploading(true)
    setTimeout(async () => {
      const next = [...attachmentList, { id: newId('att'), name: file.name, size: file.size, uploadedBy: actor, time: new Date().toISOString() }]
      await apply({ attachmentList: next, attachments: next.length, history: logEvent(`attached ${file.name}`, 'success') }, `${file.name} uploaded`)
      setUploading(false)
    }, 600)
  }

  function removeAttachment(att) {
    const next = attachmentList.filter((a) => a.id !== att.id)
    apply({ attachmentList: next, attachments: next.length, history: logEvent(`removed ${att.name}`, 'neutral') }, `${att.name} removed`)
  }

  function toggleChecklist(itemId) {
    apply({ checklist: checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) })
  }

  function addChecklistItem(e) {
    e.preventDefault()
    const text = checkText.trim()
    if (!text) return
    setCheckText('')
    apply({ checklist: [...checklist, { id: newId('chk'), text, done: false }] })
  }

  const timelineItems = history.map((h) => ({ ...h, time: <>{formatDateTime(h.time)}</> }))

  return (
    <div ref={rootRef} tabIndex={-1} role="dialog" aria-label={`Task details: ${task.title}`} className="space-y-6 outline-none">
      {/* Title + quick facts */}
      <div className={cn('gradient-soft rounded-2xl border border-l-4 border-ink-100 p-4 sm:p-5 dark:border-ink-800', PRIORITY_ACCENT[task.priority])}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(task.status)} dot>{TASK_STATUS_LABEL[task.status]}</Badge>
          <Badge tone={priorityTone(task.priority)}>{cap(task.priority)} priority</Badge>
          {overdue && <Badge tone="danger">Overdue</Badge>}
        </div>
        <h3 className="mt-2 break-words text-lg font-bold leading-snug text-ink-900 sm:text-xl dark:text-white">{task.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-500">
          <span className="flex items-center gap-1.5">
            <FolderKanban size={14} aria-hidden="true" className="text-brand-500" />
            {task.projectId ? (
              <Link to={`/admin/projects/${task.projectId}`} className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-400">{task.project}</Link>
            ) : (
              task.project
            )}
          </span>
          <span className={cn('flex items-center gap-1.5', overdue && 'font-semibold text-danger-600 dark:text-danger-400')}>
            <CalendarClock size={14} aria-hidden="true" className={overdue ? undefined : 'text-accent-500'} /> Due {formatDate(task.dueDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Avatar name={task.assignee} size="xs" /> {task.assignee}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => setEditOpen(true)}>Edit</Button>
        <Button variant="secondary" size="sm" leftIcon={<MessageSquare size={14} />} onClick={() => commentRef.current?.focus()}>Add comment</Button>
        <Button variant="secondary" size="sm" leftIcon={<Upload size={14} />} onClick={() => fileRef.current?.click()} isLoading={uploading}>Upload attachment</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label="Status" options={TASK_COLUMNS} value={task.status} onChange={(e) => handleStatus(e.target.value)} />
        <Select
          label="Assignee"
          options={employees.some((e) => e.name === task.assignee) ? employees.map((e) => ({ value: e.name, label: e.name })) : [{ value: task.assignee, label: task.assignee }, ...employees.map((e) => ({ value: e.name, label: e.name }))]}
          value={task.assignee}
          onChange={(e) => handleAssign(e.target.value)}
        />
        <Select label="Priority" options={PRIORITY_OPTIONS} value={task.priority} onChange={(e) => handlePriority(e.target.value)} />
      </div>

      {/* Description */}
      <section aria-labelledby="task-desc">
        <h4 id="task-desc" className="mb-2 text-sm font-bold text-ink-800 dark:text-ink-100">Description</h4>
        {task.description ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600 dark:text-ink-300">{task.description}</p>
        ) : (
          <p className="text-sm text-ink-400">No description yet. Use Edit to add one.</p>
        )}
      </section>

      {/* Checklist */}
      <section aria-labelledby="task-checklist">
        <div className="mb-2 flex items-center justify-between">
          <h4 id="task-checklist" className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', TONES.success.chip)}><CheckSquare size={15} aria-hidden="true" /></span> Checklist
          </h4>
          {checklist.length > 0 && <span className="text-xs text-ink-400">{doneCount}/{checklist.length} done</span>}
        </div>
        {checklist.length > 0 && (
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={checklistPct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
            <div className="h-full rounded-full bg-gradient-to-r from-success-400 to-brand-500 transition-all duration-500" style={{ width: `${checklistPct}%` }} />
          </div>
        )}
        <ul className="space-y-1.5">
          {checklist.map((item) => (
            <li key={item.id}>
              <label className="flex min-h-[2.5rem] cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-brand-50/60 dark:hover:bg-ink-800/50">
                <input type="checkbox" checked={item.done} onChange={() => toggleChecklist(item.id)} className="mt-0.5 h-4 w-4 accent-brand-600" />
                <span className={cn(item.done ? 'text-ink-400 line-through' : 'text-ink-700 dark:text-ink-200')}>{item.text}</span>
              </label>
            </li>
          ))}
        </ul>
        <form onSubmit={addChecklistItem} className="mt-2 flex gap-2">
          <input
            aria-label="Add checklist item"
            value={checkText}
            onChange={(e) => setCheckText(e.target.value)}
            placeholder="Add a checklist item"
            className="focus-ring h-10 min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
          />
          <Button type="submit" size="sm" variant="secondary" leftIcon={<Plus size={14} />} disabled={!checkText.trim()}>Add</Button>
        </form>
      </section>

      {/* Attachments */}
      <section aria-labelledby="task-attachments">
        <div className="mb-2 flex items-center justify-between">
          <h4 id="task-attachments" className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', TONES.accent.chip)}><Paperclip size={15} aria-hidden="true" /></span> Attachments <span className="font-normal text-ink-400">({attachmentList.length})</span>
          </h4>
          <label className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-500 cursor-pointer rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            {uploading ? (
              <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Uploading...</span>
            ) : (
              'Add file'
            )}
            <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="sr-only" onChange={handleFile} disabled={uploading} />
          </label>
        </div>
        {uploadError && <p role="alert" className="mb-2 text-xs font-medium text-danger-600 dark:text-danger-400">{uploadError}</p>}
        {attachmentList.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-200 px-3 py-5 text-center text-sm text-ink-400 dark:border-ink-700">
            No attachments yet. Files up to {MAX_FILE_MB} MB (PDF, Office, images, Figma, ZIP) are supported.
          </p>
        ) : (
          <ul className="space-y-2">
            {attachmentList.map((att) => (
              <li key={att.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-2.5 transition-colors hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
                  <FileText size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{att.name}</p>
                  <p className="text-xs text-ink-400">{formatFileSize(att.size)} · {att.uploadedBy} · {formatDate(att.time)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(att)}
                  aria-label={`Remove attachment ${att.name}`}
                  className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Comments */}
      <section aria-labelledby="task-comments">
        <h4 id="task-comments" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', TONES.info.chip)}><MessageSquare size={15} aria-hidden="true" /></span> Comments <span className="font-normal text-ink-400">({commentList.length})</span>
        </h4>
        {commentList.length === 0 ? (
          <p className="mb-4 text-sm text-ink-400">No comments yet. Start the conversation below.</p>
        ) : (
          <ul className="mb-4 space-y-4">
            {commentList.map((c) => (
              <li key={c.id} className="flex gap-3">
                <ClientAvatar name={c.author} size="sm" />
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-brand-50/60 px-3.5 py-2.5 dark:bg-ink-800/60">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold text-ink-800 dark:text-ink-100">{c.author}</span>
                    <time dateTime={c.time} className="text-xs text-ink-400">{formatDateTime(c.time)}</time>
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-600 dark:text-ink-300">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAddComment} noValidate className="flex gap-3">
          <Avatar name={actor} size="sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea
              ref={commentRef}
              aria-label="Write a comment"
              rows={2}
              placeholder="Write a comment..."
              value={comment}
              error={commentError}
              onChange={(e) => {
                setComment(e.target.value)
                setCommentError('')
              }}
            />
            <div className="flex items-center justify-between">
              <span className={cn('text-xs', comment.length > MAX_COMMENT ? 'text-danger-600' : 'text-ink-400')}>{comment.length}/{MAX_COMMENT}</span>
              <Button type="submit" size="sm" leftIcon={<Send size={14} />} disabled={!comment.trim()}>Post comment</Button>
            </div>
          </div>
        </form>
      </section>

      {/* History */}
      <section aria-labelledby="task-history">
        <h4 id="task-history" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', TONES.warning.chip)}><History size={15} aria-hidden="true" /></span> Activity history
        </h4>
        {timelineItems.length === 0 ? <p className="text-sm text-ink-400">No activity recorded yet.</p> : <LeadTimeline items={timelineItems} />}
      </section>

      <TaskFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSave}
        initialValues={task}
        isSaving={editSaving}
        projects={projects}
        employees={employees.length ? employees : undefined}
      />
    </div>
  )
}
