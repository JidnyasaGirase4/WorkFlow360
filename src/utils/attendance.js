// Helpers for attendance rows. Times are either "HH:MM" strings (seeded
// history) or ISO timestamps (live check-in / check-out).
export function toMinutes(value) {
  if (!value) return null
  if (value.includes('T')) {
    const d = new Date(value)
    return d.getHours() * 60 + d.getMinutes()
  }
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

export function workedMinutes(rec) {
  const a = toMinutes(rec.checkIn)
  const b = toMinutes(rec.checkOut)
  if (a === null || b === null || b < a) return 0
  return b - a
}

export function formatMinutes(total) {
  if (!total) return '—'
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
}
