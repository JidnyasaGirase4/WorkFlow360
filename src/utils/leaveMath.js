import { leaveEntitlements } from '../mockData/attendance'
import { daysBetween } from '../mockData/reference'

export const LEAVE_TYPES = Object.keys(leaveEntitlements)

export function leaveDays(request) {
  return daysBetween(request.from, request.to) + 1
}

// Per-type balance for one employee for the year of `year` (default 2026).
export function computeLeaveBalance(requests, employeeName, year = '2026') {
  return LEAVE_TYPES.map((type) => {
    const mine = requests.filter((l) => l.employee === employeeName && l.type === type && l.from.startsWith(year))
    const used = mine.filter((l) => l.status === 'approved').reduce((s, l) => s + leaveDays(l), 0)
    const pending = mine.filter((l) => l.status === 'pending').reduce((s, l) => s + leaveDays(l), 0)
    const total = leaveEntitlements[type]
    return { type, total, used, pending, remaining: Math.max(0, total - used - pending) }
  })
}
