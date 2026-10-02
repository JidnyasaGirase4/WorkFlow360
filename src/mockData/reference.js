// Fixed "today" for all mock data so dashboards, overdue checks and
// calendars stay consistent regardless of the viewer's system clock.
export const TODAY = '2026-09-26'
export const ATTENDANCE_REF_DATE = '2026-09-25'

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}
