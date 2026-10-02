// Date-range helpers for the Reports module. All dates are 'YYYY-MM-DD' strings
// (or 'YYYY-MM' month keys) so there is no timezone drift.
export const MOCK_TODAY = '2026-09-26'

export const RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Year (FY)' },
  { value: 'custom', label: 'Custom Range' },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function monthEnd(year, monthIndex) {
  return `${year}-${pad(monthIndex + 1)}-${pad(new Date(year, monthIndex + 1, 0).getDate())}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(y, m - 1, 1))
}

export { monthLabel, shortMonth }

export function validateCustomRange(from, to) {
  if (!from || !to) return 'Select both a start and an end date.'
  if (from > to) return 'The start date must be on or before the end date.'
  return ''
}

// Returns { from, to, label } for a preset or custom range.
export function resolveRange(range, custom = {}) {
  const [ty, tm] = MOCK_TODAY.split('-').map(Number)
  const m0 = tm - 1
  switch (range) {
    case 'last_month': {
      const d = new Date(ty, m0 - 1, 1)
      return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: monthEnd(d.getFullYear(), d.getMonth()), label: monthLabel(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`) }
    }
    case 'this_quarter': {
      const qStart = m0 - (m0 % 3)
      return {
        from: `${ty}-${pad(qStart + 1)}-01`,
        to: monthEnd(ty, qStart + 2),
        label: `${monthLabel(`${ty}-${pad(qStart + 1)}`)} - ${monthLabel(`${ty}-${pad(qStart + 3)}`)}`,
      }
    }
    case 'this_year': {
      const fyStartYear = m0 >= 3 ? ty : ty - 1
      return { from: `${fyStartYear}-04-01`, to: MOCK_TODAY, label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)} to date` }
    }
    case 'custom':
      return { from: custom.from, to: custom.to, label: `${custom.from} to ${custom.to}` }
    case 'this_month':
    default:
      return { from: `${ty}-${pad(tm)}-01`, to: monthEnd(ty, m0), label: monthLabel(`${ty}-${pad(tm)}`) }
  }
}

export function inRange(dateStr, { from, to }) {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= from && d <= to
}

// Month keys ('YYYY-MM') that overlap the range.
export function monthKeysInRange({ from, to }) {
  const keys = []
  let [y, m] = from.split('-').map(Number)
  const [ey, em] = to.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${pad(m)}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return keys
}
