import { Phone, Mail, Video, StickyNote, BellRing } from 'lucide-react'

// Shared constants and helpers for the CRM, Projects and Tasks modules.

export const LEAD_STAGES = [
  { value: 'new', label: 'New', dot: 'bg-info-500' },
  { value: 'contacted', label: 'Contacted', dot: 'bg-brand-500' },
  { value: 'qualified', label: 'Qualified', dot: 'bg-accent-500' },
  { value: 'proposal', label: 'Proposal', dot: 'bg-warning-500' },
  { value: 'negotiation', label: 'Negotiation', dot: 'bg-warning-600' },
  { value: 'won', label: 'Won', dot: 'bg-success-500' },
  { value: 'lost', label: 'Lost', dot: 'bg-danger-500' },
]
export const LEAD_STAGE_LABEL = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, s.label]))
export const LEAD_STAGE_DOT = Object.fromEntries(LEAD_STAGES.map((s) => [s.value, s.dot]))

export const LEAD_SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Event']

export const TASK_COLUMNS = [
  { value: 'todo', label: 'Todo', dot: 'bg-ink-400' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-info-500' },
  { value: 'review', label: 'Review', dot: 'bg-accent-500' },
  { value: 'done', label: 'Completed', dot: 'bg-success-500' },
]
export const TASK_STATUS_LABEL = Object.fromEntries(TASK_COLUMNS.map((s) => [s.value, s.label]))
export const TASK_COLUMN_DOT = Object.fromEntries(TASK_COLUMNS.map((s) => [s.value, s.dot]))

export const PRIORITIES = ['low', 'medium', 'high', 'urgent']
export const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: cap(p) }))

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
export const PROJECT_STATUS_OPTIONS = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function cap(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function priorityTone(priority) {
  if (priority === 'urgent') return 'danger'
  if (priority === 'high') return 'warning'
  if (priority === 'medium') return 'brand'
  return 'neutral'
}

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function todayKey() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isPastDate(dateKey) {
  return Boolean(dateKey) && dateKey < todayKey()
}

const EMAIL_RE = /^\S+@\S+\.\S+$/
export function isValidEmail(value) {
  return EMAIL_RE.test(value)
}
export function isValidPhone(value) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13 && /^[+\d][\d\s-]*$/.test(value.trim())
}

// ---- CSV export -----------------------------------------------------------
export function downloadCsv(filename, rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => escape(c.header)).join(',')
  const body = rows.map((row) => columns.map((c) => escape(c.value(row))).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ---- File upload validation ------------------------------------------------
export const MAX_FILE_MB = 10
export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'svg', 'fig', 'zip', 'txt', 'csv']
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

export function fileExtension(name = '') {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Returns an error message, or '' when the file is acceptable.
export function validateFile(file) {
  if (!file) return 'Choose a file to upload'
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()}`
  }
  if (file.size === 0) return 'This file is empty'
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_FILE_MB} MB`
  return ''
}

export function fileKind(name) {
  const ext = fileExtension(name)
  if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) return 'image'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  if (['doc', 'docx', 'txt'].includes(ext)) return 'doc'
  if (['fig'].includes(ext)) return 'design'
  return ext === 'pdf' ? 'pdf' : 'file'
}

// ---- CRM activities --------------------------------------------------------
export const ACTIVITY_TYPE_CONFIG = {
  call: { label: 'Call', icon: Phone, tone: 'info', verb: 'logged a call with' },
  email: { label: 'Email', icon: Mail, tone: 'brand', verb: 'emailed' },
  meeting: { label: 'Meeting', icon: Video, tone: 'success', verb: 'met with' },
  note: { label: 'Note', icon: StickyNote, tone: 'neutral', verb: 'added a note on' },
  follow_up: { label: 'Follow-up', icon: BellRing, tone: 'warning', verb: 'scheduled a follow-up with' },
}
export const ACTIVITY_DEFAULT_OUTCOME = {
  call: 'Connected',
  email: 'Sent',
  meeting: 'Completed',
  note: 'Logged',
  follow_up: 'Pending',
}
