// Six-month history behind the admin dashboard KPI sparklines (Apr - Sep 2026).
// The latest point of each series is replaced with the live value computed
// from the other mock collections, so cards always agree with their modules.
export const kpiHistory = {
  revenue: [620000, 710000, 845000, 792000, 980000, 1125000],
  outstanding: [410000, 455000, 380000, 520000, 610000, 599000],
  clients: [9, 10, 11, 12, 14, 16],
  projects: [2, 2, 3, 3, 3, 3],
  tasks: [6, 8, 7, 11, 10, 9],
  tickets: [2, 4, 3, 5, 4, 3],
}

export const ticketTrend = [
  { month: 'Apr', opened: 9, resolved: 8 },
  { month: 'May', opened: 12, resolved: 10 },
  { month: 'Jun', opened: 10, resolved: 11 },
  { month: 'Jul', opened: 14, resolved: 12 },
  { month: 'Aug', opened: 11, resolved: 13 },
  { month: 'Sep', opened: 8, resolved: 9 },
]
