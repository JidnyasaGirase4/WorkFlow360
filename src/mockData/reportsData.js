// Twelve months of aggregated business history (Oct 2025 - Sep 2026) behind the Reports module.
// Apr - Sep 2026 revenue and ticket counts match the admin dashboard series.
export const HISTORY_MONTHS = [
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
]

const revenue = [540000, 575000, 610000, 560000, 590000, 655000, 620000, 710000, 845000, 792000, 980000, 1125000]
const outstanding = [96000, 118000, 132000, 141000, 126000, 149000, 168000, 152000, 210000, 244000, 231000, 268000]
const overdue = [18000, 26000, 31000, 42000, 35000, 38000, 52000, 41000, 64000, 78000, 60000, 84000]
const tasksCompleted = [18, 21, 19, 16, 22, 25, 24, 27, 31, 29, 34, 33]
const tasksCreated = [22, 24, 22, 19, 26, 28, 27, 31, 33, 34, 38, 36]
const attendance = [92.4, 93.1, 91.8, 90.5, 93.6, 94.2, 94.8, 93.9, 95.1, 94.4, 95.6, 93.8]
const newLeads = [14, 15, 13, 12, 16, 18, 17, 19, 22, 21, 24, 26]
const ticketsOpened = [11, 13, 10, 9, 12, 14, 9, 12, 10, 14, 11, 8]
const ticketsResolved = [10, 12, 10, 9, 11, 13, 8, 10, 11, 12, 13, 9]
const resolutionHours = [26, 24, 27, 25, 23, 22, 21, 22, 19, 20, 18, 17]
const slaMet = [88, 90, 87, 89, 91, 92, 93, 92, 94, 93, 95, 96]

const SOURCE_SPLIT = { Website: 0.34, Referral: 0.24, LinkedIn: 0.18, 'Cold Outreach': 0.12, Event: 0.12 }

function splitSources(total) {
  const out = {}
  let used = 0
  Object.entries(SOURCE_SPLIT).forEach(([name, share], i, arr) => {
    out[name] = i === arr.length - 1 ? total - used : Math.round(total * share)
    used += out[name]
  })
  return out
}

function splitPriority(total) {
  const urgent = Math.max(0, Math.round(total * 0.1))
  const high = Math.round(total * 0.25)
  const low = Math.round(total * 0.25)
  return { low, medium: total - urgent - high - low, high, urgent }
}

export const monthlyHistory = HISTORY_MONTHS.map((key, i) => {
  const n = newLeads[i]
  return {
    key,
    revenue: revenue[i],
    outstanding: outstanding[i],
    overdue: overdue[i],
    tasksCompleted: tasksCompleted[i],
    tasksCreated: tasksCreated[i],
    attendance: attendance[i],
    leads: {
      new: n,
      contacted: Math.round(n * 0.78),
      qualified: Math.round(n * 0.5),
      proposal: Math.round(n * 0.32),
      won: Math.round(n * 0.16),
    },
    sources: splitSources(n),
    ticketsOpened: ticketsOpened[i],
    ticketsResolved: ticketsResolved[i],
    resolutionHours: resolutionHours[i],
    slaMet: slaMet[i],
    priorities: splitPriority(ticketsOpened[i]),
  }
})

export const yearlyRevenue = [
  { name: 'FY 22-23', revenue: 3100000 },
  { name: 'FY 23-24', revenue: 4600000 },
  { name: 'FY 24-25', revenue: 6200000 },
  { name: 'FY 25-26', revenue: 7430000 },
  { name: 'FY 26-27 (YTD)', revenue: 5072000 },
]

// Per-employee performance for the Employees report (share of the period's totals).
export const employeeStats = {
  'Jidnyasa Girase': { completed: 4, attendance: 97 },
  'Jay Girase': { completed: 12, attendance: 98 },
  'Rohit Girase': { completed: 38, attendance: 95 },
  'Sneha Joshi': { completed: 34, attendance: 94 },
  'Amit Kulkarni': { completed: 41, attendance: 92 },
  'Tanvi Deshpande': { completed: 29, attendance: 96 },
  'Karthik Reddy': { completed: 22, attendance: 89 },
  'Pooja Nair': { completed: 17, attendance: 97 },
}
