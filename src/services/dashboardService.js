import { revenueTrend, clientGrowth, recentActivities } from '../mockData/activities'
import { kpiHistory, ticketTrend } from '../mockData/dashboard'
import { invoices } from '../mockData/invoices'
import { projects } from '../mockData/projects'
import { tasks } from '../mockData/tasks'
import { tickets } from '../mockData/tickets'
import { meetings } from '../mockData/meetings'

function wait(ms = 700) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withLatest(series, latest) {
  return [...series.slice(0, -1), latest]
}

function percentChange(series) {
  const prev = series[series.length - 2]
  const last = series[series.length - 1]
  if (!prev) return 0
  return Math.round(((last - prev) / prev) * 1000) / 10
}

const PROJECT_STATUS_COLORS = { planning: '#8654ec', active: '#22a559', on_hold: '#f59e0b', completed: '#1aa996' }
const TASK_STAGES = [
  { key: 'todo', name: 'Todo', color: '#a0a9a2' },
  { key: 'in_progress', name: 'In Progress', color: '#1aa996' },
  { key: 'review', name: 'Review', color: '#8654ec' },
  { key: 'done', name: 'Completed', color: '#22a559' },
]

export const dashboardService = {
  async getOverview() {
    await wait()

    const outstanding = invoices
      .filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + i.balance, 0)
    const activeProjects = projects.filter((p) => p.status === 'active').length
    const pendingTasks = tasks.filter((t) => t.status !== 'done').length
    const openTickets = tickets.filter((t) => ['open', 'in_progress', 'waiting_for_client'].includes(t.status)).length
    const activeClients = clientGrowth[clientGrowth.length - 1].clients

    const series = {
      revenue: withLatest(kpiHistory.revenue, revenueTrend[revenueTrend.length - 1].revenue),
      outstanding: withLatest(kpiHistory.outstanding, outstanding),
      clients: withLatest(kpiHistory.clients, activeClients),
      projects: withLatest(kpiHistory.projects, activeProjects),
      tasks: withLatest(kpiHistory.tasks, pendingTasks),
      tickets: withLatest(kpiHistory.tickets, openTickets),
    }
    const kpis = [
      { key: 'revenue', label: 'Total Revenue', value: series.revenue.at(-1), kind: 'currency', tone: 'brand', icon: 'revenue', higherIsBetter: true },
      { key: 'outstanding', label: 'Outstanding Invoices', value: series.outstanding.at(-1), kind: 'currency', tone: 'warning', icon: 'invoice', higherIsBetter: false },
      { key: 'clients', label: 'Active Clients', value: series.clients.at(-1), kind: 'number', tone: 'success', icon: 'clients', higherIsBetter: true },
      { key: 'projects', label: 'Active Projects', value: series.projects.at(-1), kind: 'number', tone: 'info', icon: 'projects', higherIsBetter: true },
      { key: 'tasks', label: 'Pending Tasks', value: series.tasks.at(-1), kind: 'number', tone: 'accent', icon: 'tasks', higherIsBetter: false },
      { key: 'tickets', label: 'Open Tickets', value: series.tickets.at(-1), kind: 'number', tone: 'danger', icon: 'tickets', higherIsBetter: false },
    ].map((k) => ({
      ...k,
      change: percentChange(series[k.key]),
      compareLabel: 'vs Aug 2026',
      trend: series[k.key].map((value, i) => ({ i, value })),
    }))

    const statusLabels = { planning: 'Planning', active: 'Active', on_hold: 'On Hold', completed: 'Completed' }
    const projectStatus = Object.keys(statusLabels).map((key) => ({
      name: statusLabels[key],
      value: projects.filter((p) => p.status === key).length,
      color: PROJECT_STATUS_COLORS[key],
    }))

    const taskOverview = TASK_STAGES.map((s) => ({
      name: s.name,
      value: tasks.filter((t) => t.status === s.key).length,
      color: s.color,
    }))

    const workloadMap = {}
    tasks
      .filter((t) => t.status !== 'done')
      .forEach((t) => {
        workloadMap[t.assignee] = (workloadMap[t.assignee] || 0) + 1
      })
    const employeeWorkload = Object.entries(workloadMap)
      .map(([name, count]) => ({ name, tasks: count }))
      .sort((a, b) => b.tasks - a.tasks)

    const upcomingMeetings = meetings
      .filter((m) => m.status === 'upcoming')
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .slice(0, 4)

    return {
      kpis,
      revenue: revenueTrend,
      projectStatus,
      taskOverview,
      clientGrowth,
      ticketTrend,
      employeeWorkload,
      activities: recentActivities,
      meetings: upcomingMeetings,
    }
  },
}
