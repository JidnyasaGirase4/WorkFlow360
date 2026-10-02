import { Video, Phone, MapPin } from 'lucide-react'

export const MEETING_STATUS = {
  upcoming: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export const MEETING_STATUS_OPTIONS = Object.entries(MEETING_STATUS).map(([value, s]) => ({ value, label: s.label }))

export const MEETING_TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
export const MEETING_TYPE_OPTIONS = [
  { value: 'Video Call', label: 'Video Call' },
  { value: 'Phone Call', label: 'Phone Call' },
  { value: 'In Person', label: 'In Person' },
]

// '15:30' -> '3:30 PM'
export function formatTime(value) {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function meetingSortKey(m) {
  return `${m.date} ${m.time}`
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export function canJoin(meeting) {
  return meeting.status === 'upcoming' && meeting.type === 'Video Call' && Boolean(meeting.link)
}
