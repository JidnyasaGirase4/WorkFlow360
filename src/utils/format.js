export function formatCurrency(amount, { compact = false } = {}) {
  const n = Number(amount) || 0
  if (compact) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatDate(value, opts = {}) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(d)
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function timeAgo(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  const ranges = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  if (seconds < 60) return 'just now'
  for (const [unit, secs] of ranges) {
    const val = Math.floor(seconds / secs)
    if (val >= 1) return `${val} ${unit}${val > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-IN').format(Number(n) || 0)
}

// 12-hour clock from a Date/ISO string, e.g. "09:32 am".
export function formatTime(value) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(d)
}

// "HH:MM" (24h, as stored in mock attendance rows) -> "09:32 am".
export function formatClockString(hhmm) {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  return formatTime(new Date(2000, 0, 1, h, m))
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

// Local (not UTC) YYYY-MM-DD key for a Date.
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Inclusive number of calendar days between two YYYY-MM-DD strings.
export function inclusiveDays(from, to) {
  if (!from || !to) return 0
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86400000) + 1)
}
