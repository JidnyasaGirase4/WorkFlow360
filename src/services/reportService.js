import {
  revenueTrend,
  projectStatusBreakdown,
  taskOverview,
  clientGrowth,
  employeeWorkload,
} from '../mockData/activities'
import { monthlyHistory, yearlyRevenue, employeeStats } from '../mockData/reportsData'
import { clients } from '../mockData/clients'
import { employees } from '../mockData/employees'
import { invoices } from '../mockData/invoices'
import { leads, LEAD_STATUSES } from '../mockData/leads'
import { milestones } from '../mockData/milestones'
import { projects } from '../mockData/projects'
import { tasks } from '../mockData/tasks'
import { tickets } from '../mockData/tickets'
import { MOCK_TODAY, inRange, monthKeysInRange, monthLabel, resolveRange, shortMonth } from '../utils/reportRange'

function wait(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const sum = (list, pick) => list.reduce((s, x) => s + pick(x), 0)
const round1 = (n) => Math.round(n * 10) / 10
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const C = {
  brand: '#1aa996',
  accent: '#ec4a7d',
  success: '#22a559',
  warning: '#f59e0b',
  danger: '#e04a3c',
  info: '#8654ec',
  neutral: '#a0a9a2',
}
const PALETTE = [C.brand, C.success, C.warning, C.info, C.accent, C.danger]

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
}

// Months of history that fall in the range, and a trailing window of them for trend charts.
function historyFor(range) {
  const keys = new Set(monthKeysInRange(range))
  const inside = monthlyHistory.filter((m) => keys.has(m.key))
  let context = []
  if (inside.length > 0) {
    const endIdx = monthlyHistory.findIndex((m) => m.key === inside[inside.length - 1].key)
    const startIdx = monthlyHistory.findIndex((m) => m.key === inside[0].key)
    context = monthlyHistory.slice(Math.max(0, Math.min(startIdx, endIdx - 5)), endIdx + 1)
  }
  // Previous period of equal length, used for growth figures.
  let previous = []
  if (inside.length > 0) {
    const startIdx = monthlyHistory.findIndex((m) => m.key === inside[0].key)
    previous = monthlyHistory.slice(Math.max(0, startIdx - inside.length), startIdx)
    if (previous.length !== inside.length) previous = []
  }
  return { inside, context, previous }
}

const trendLabel = (m) => (m.key.endsWith('-01') || m.key === monthlyHistory[0].key ? `${shortMonth(m.key)} ${m.key.slice(2, 4)}` : shortMonth(m.key))

function buildRevenue(range, filter) {
  const { inside, context, previous } = historyFor(range)
  if (inside.length === 0) return null
  const total = sum(inside, (m) => m.revenue)
  const prevTotal = sum(previous, (m) => m.revenue)
  const growth = prevTotal ? round1(((total - prevTotal) / prevTotal) * 100) : null
  const lifetime = sum(clients, (c) => c.revenue)
  const clientRows = clients
    .map((c) => ({
      id: c.id,
      client: c.company,
      industry: c.industry,
      revenue: Math.round((total * c.revenue) / lifetime),
      share: round1((c.revenue / lifetime) * 100),
      outstanding: c.outstanding,
      projects: c.activeProjects,
    }))
    .filter((r) => !filter || r.client === filter)
    .sort((a, b) => b.revenue - a.revenue)

  return {
    kpis: [
      { label: 'Total Revenue', value: total, kind: 'currency', tone: 'brand' },
      { label: 'Avg Monthly Revenue', value: Math.round(total / inside.length), kind: 'currency', tone: 'success' },
      { label: 'Growth vs Previous Period', value: growth ?? 0, kind: 'percent', tone: growth !== null && growth < 0 ? 'danger' : 'info', note: growth === null ? 'No earlier period to compare' : undefined, signed: true },
      { label: 'Clients Billed', value: clients.filter((c) => c.revenue > 0).length, kind: 'number', tone: 'accent' },
    ],
    charts: [
      { id: 'monthly', title: 'Monthly Revenue', subtitle: `Trend for ${context.length} months to ${monthLabel(context[context.length - 1].key)}`, type: 'area', data: context.map((m) => ({ name: trendLabel(m), revenue: m.revenue })), series: [{ key: 'revenue', name: 'Revenue', color: C.brand }], format: 'currency', span: 2 },
      { id: 'yearly', title: 'Yearly Revenue', subtitle: 'Financial-year totals (April - March)', type: 'bar', data: yearlyRevenue, series: [{ key: 'revenue', name: 'Revenue', color: C.accent }], format: 'currency' },
      { id: 'clients', title: 'Revenue by Client', subtitle: 'Share of revenue in the selected period', type: 'hbar', data: clientRows.map((r) => ({ name: r.client, revenue: r.revenue })), series: [{ key: 'revenue', name: 'Revenue', color: C.brand }], format: 'currency', span: 3 },
    ],
    table: {
      title: 'Client revenue',
      filename: 'revenue-by-client',
      columns: [
        { key: 'client', header: 'Client', kind: 'strong' },
        { key: 'industry', header: 'Industry' },
        { key: 'revenue', header: 'Revenue (period)', kind: 'currency', align: 'right' },
        { key: 'share', header: 'Share', kind: 'percent', align: 'right' },
        { key: 'outstanding', header: 'Outstanding', kind: 'currency', align: 'right' },
        { key: 'projects', header: 'Active projects', align: 'right' },
      ],
      rows: clientRows,
    },
  }
}

function buildProjects(range, filter) {
  const rows = projects
    .filter((p) => p.startDate <= range.to && (!filter || p.status === filter))
    .map((p) => {
      const lateMilestone = milestones.find((m) => m.projectId === p.id && m.status === 'delayed')
      const overdueDeadline = p.status !== 'completed' && p.deadline < MOCK_TODAY
      const delayed = Boolean(lateMilestone) || overdueDeadline
      return {
        id: p.id,
        project: p.name,
        client: p.client,
        manager: p.manager,
        status: p.status,
        progress: p.progress,
        deadline: p.deadline,
        budget: p.budget,
        spent: p.spent,
        health: delayed ? 'delayed' : p.status === 'completed' ? 'completed' : 'on_track',
        lateMilestone,
      }
    })
  const statusData = ['planning', 'active', 'on_hold', 'completed'].map((s) => ({
    name: cap(s.replace('_', ' ')),
    value: rows.filter((r) => r.status === s).length,
    color: projectStatusBreakdown.find((p) => p.name.toLowerCase().replace(' ', '_') === s)?.color || C.neutral,
  }))
  const delayedRows = rows.filter((r) => r.health === 'delayed')
  const open = rows.filter((r) => r.status !== 'completed')
  const avg = open.length ? Math.round(sum(open, (r) => r.progress) / open.length) : 0

  return {
    kpis: [
      { label: 'Total Projects', value: rows.length, kind: 'number', tone: 'brand' },
      { label: 'Active', value: rows.filter((r) => r.status === 'active').length, kind: 'number', tone: 'success' },
      { label: 'Avg Completion (open)', value: avg, kind: 'percent', tone: 'info' },
      { label: 'Delayed', value: delayedRows.length, kind: 'number', tone: 'danger' },
    ],
    charts: [
      { id: 'status', title: 'Project Status', subtitle: 'Planning, active, on hold and completed', type: 'donut', data: statusData, centerLabel: 'Projects' },
      { id: 'completion', title: 'Completion by Project', subtitle: 'Progress against plan', type: 'progress', data: rows.map((r) => ({ name: r.project, value: r.progress, hint: cap(r.status.replace('_', ' ')) })), span: 2 },
      {
        id: 'delayed',
        title: 'Delayed Milestones',
        subtitle: 'Days past the due date',
        type: 'hbar',
        data: delayedRows.filter((r) => r.lateMilestone).map((r) => ({ name: r.project, days: Math.max(0, daysBetween(r.lateMilestone.dueDate, MOCK_TODAY)) })),
        series: [{ key: 'days', name: 'Days late', color: C.danger }],
        format: 'number',
        span: 3,
        emptyText: 'No delayed milestones for the selected projects.',
      },
    ],
    table: {
      title: 'Project health',
      filename: 'project-report',
      columns: [
        { key: 'project', header: 'Project', kind: 'strong' },
        { key: 'client', header: 'Client' },
        { key: 'manager', header: 'Manager' },
        { key: 'status', header: 'Status', kind: 'status' },
        { key: 'progress', header: 'Progress', kind: 'progress' },
        { key: 'deadline', header: 'Deadline', kind: 'date' },
        { key: 'budget', header: 'Budget', kind: 'currency', align: 'right' },
        { key: 'spent', header: 'Spent', kind: 'currency', align: 'right' },
        { key: 'health', header: 'Health', kind: 'health' },
      ],
      rows,
    },
  }
}

function buildEmployees(range, filter) {
  const { inside, context } = historyFor(range)
  if (inside.length === 0) return null
  const completedTotal = sum(inside, (m) => m.tasksCompleted)
  const avgAttendance = round1(sum(inside, (m) => m.attendance) / inside.length)
  const pool = employees.filter((e) => !filter || e.department === filter)
  const shareBase = sum(employees, (e) => employeeStats[e.name]?.completed || 0) || 1
  const rows = pool
    .map((e) => {
      const st = employeeStats[e.name] || { completed: 0, attendance: 90 }
      return {
        id: e.id,
        name: e.name,
        department: e.department,
        designation: e.designation,
        open: tasks.filter((t) => t.assignee === e.name && t.status !== 'done').length,
        completed: Math.round((completedTotal * st.completed) / shareBase),
        attendance: st.attendance,
      }
    })
    .sort((a, b) => b.open - a.open || b.completed - a.completed)
  const workloadNames = new Set(pool.map((e) => e.name))
  const workload = employeeWorkload.filter((w) => workloadNames.has(w.name))
  const openTasks = sum(rows, (r) => r.open)

  return {
    kpis: [
      { label: 'Employees', value: rows.length, kind: 'number', tone: 'brand' },
      { label: 'Tasks Completed', value: completedTotal, kind: 'number', tone: 'success' },
      { label: 'Avg Attendance', value: avgAttendance, kind: 'percent', tone: 'info' },
      { label: 'Open Tasks', value: openTasks, kind: 'number', tone: 'accent' },
    ],
    charts: [
      { id: 'workload', title: 'Employee Workload', subtitle: 'Open tasks per employee', type: 'hbar', data: rows.map((r) => ({ name: r.name, open: r.open })), series: [{ key: 'open', name: 'Open tasks', color: C.accent }], format: 'number', emptyText: `No workload data for ${workload.length ? 'this selection' : 'the selected department'}.` },
      { id: 'completed', title: 'Tasks Completed', subtitle: 'Completed vs created per month', type: 'line', data: context.map((m) => ({ name: trendLabel(m), completed: m.tasksCompleted, created: m.tasksCreated })), series: [{ key: 'completed', name: 'Completed', color: C.success }, { key: 'created', name: 'Created', color: C.brand }], format: 'number', span: 2 },
      { id: 'attendance', title: 'Attendance Rate', subtitle: 'Average monthly attendance', type: 'area', data: context.map((m) => ({ name: trendLabel(m), attendance: m.attendance })), series: [{ key: 'attendance', name: 'Attendance', color: C.info }], format: 'percent', domain: [85, 100], span: 3 },
    ],
    table: {
      title: 'Employee performance',
      filename: 'employee-report',
      columns: [
        { key: 'name', header: 'Employee', kind: 'strong' },
        { key: 'department', header: 'Department' },
        { key: 'designation', header: 'Designation' },
        { key: 'open', header: 'Open tasks', align: 'right' },
        { key: 'completed', header: 'Completed (period)', align: 'right' },
        { key: 'attendance', header: 'Attendance', kind: 'percent', align: 'right' },
      ],
      rows,
    },
  }
}

function buildCrm(range, filter) {
  const { inside } = historyFor(range)
  if (inside.length === 0) return null
  const stage = (k) => sum(inside, (m) => m.leads[k])
  const funnel = [
    { name: 'New', value: stage('new') },
    { name: 'Contacted', value: stage('contacted') },
    { name: 'Qualified', value: stage('qualified') },
    { name: 'Proposal', value: stage('proposal') },
    { name: 'Won', value: stage('won') },
  ]
  const sourceTotals = {}
  inside.forEach((m) => Object.entries(m.sources).forEach(([k, v]) => (sourceTotals[k] = (sourceTotals[k] || 0) + v)))
  const sources = Object.entries(sourceTotals).map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))

  const leadRows = leads
    .filter((l) => inRange(l.lastContact, range) && (!filter || l.source === filter))
    .map((l) => ({ id: l.id, lead: l.name, company: l.company, source: l.source, status: l.status, value: l.value, owner: l.owner, lastContact: l.lastContact }))
  const openStages = LEAD_STATUSES.filter((s) => !['won', 'lost'].includes(s))
  const pipeline = openStages.map((s) => ({ name: cap(s), value: sum(leadRows.filter((l) => l.status === s), (l) => l.value) }))
  const openValue = sum(leadRows.filter((l) => openStages.includes(l.status)), (l) => l.value)
  const conversion = funnel[0].value ? round1((funnel[4].value / funnel[0].value) * 100) : 0

  return {
    kpis: [
      { label: 'New Leads', value: funnel[0].value, kind: 'number', tone: 'brand' },
      { label: 'Deals Won', value: funnel[4].value, kind: 'number', tone: 'success' },
      { label: 'Lead Conversion', value: conversion, kind: 'percent', tone: 'info' },
      { label: 'Open Pipeline Value', value: openValue, kind: 'currency', tone: 'accent' },
    ],
    charts: [
      { id: 'funnel', title: 'Lead Conversion Funnel', subtitle: 'Leads reaching each stage in the period', type: 'hbar', data: funnel, series: [{ key: 'value', name: 'Leads', color: C.brand }], format: 'number', span: 2, colorByIndex: true },
      { id: 'sources', title: 'Lead Source', subtitle: 'Where new leads come from', type: 'donut', data: sources, centerLabel: 'Leads' },
      { id: 'pipeline', title: 'Pipeline Value', subtitle: filter ? `Open deals sourced from ${filter}` : 'Open deals by stage', type: 'bar', data: pipeline, series: [{ key: 'value', name: 'Value', color: C.accent }], format: 'currency', span: 3, emptyText: 'No open deals for this selection.' },
    ],
    table: {
      title: 'Lead pipeline',
      filename: 'crm-pipeline',
      columns: [
        { key: 'lead', header: 'Lead', kind: 'strong' },
        { key: 'company', header: 'Company' },
        { key: 'source', header: 'Source' },
        { key: 'status', header: 'Stage', kind: 'status' },
        { key: 'value', header: 'Deal value', kind: 'currency', align: 'right' },
        { key: 'owner', header: 'Owner' },
        { key: 'lastContact', header: 'Last contact', kind: 'date' },
      ],
      rows: leadRows,
    },
  }
}

function buildBilling(range, filter) {
  const { context } = historyFor(range)
  if (context.length === 0) return null
  const all = invoices.filter((i) => inRange(i.issueDate, range))
  const rows = all
    .filter((i) => !filter || i.status === filter)
    .map((i) => ({ id: i.id, number: i.number, client: i.client, issueDate: i.issueDate, dueDate: i.dueDate, amount: i.amount, paid: i.paid, balance: i.balance, status: i.status }))
  const invoiced = sum(rows, (r) => r.amount)
  const paid = sum(rows, (r) => r.paid)
  const overdue = sum(rows.filter((r) => r.status === 'overdue'), (r) => r.balance)
  const outstanding = sum(rows.filter((r) => r.status !== 'draft'), (r) => r.balance)

  const byStatus = ['paid', 'sent', 'partially_paid', 'overdue', 'draft']
    .map((s, i) => ({ name: cap(s.replace('_', ' ')), value: sum(rows.filter((r) => r.status === s), (r) => r.amount), color: [C.success, C.info, C.warning, C.danger, C.neutral][i] }))
    .filter((s) => s.value > 0)
  const perClient = {}
  rows.forEach((r) => {
    perClient[r.client] = perClient[r.client] || { amount: 0, paid: 0 }
    perClient[r.client].amount += r.amount
    perClient[r.client].paid += r.paid
  })
  const collection = Object.entries(perClient).map(([name, v]) => ({ name, value: v.amount ? Math.round((v.paid / v.amount) * 100) : 0, hint: `${Math.round(v.paid / 1000)}k of ${Math.round(v.amount / 1000)}k` }))

  return {
    kpis: [
      { label: 'Total Invoiced', value: invoiced, kind: 'currency', tone: 'brand' },
      { label: 'Paid', value: paid, kind: 'currency', tone: 'success' },
      { label: 'Outstanding', value: outstanding, kind: 'currency', tone: 'warning' },
      { label: 'Overdue', value: overdue, kind: 'currency', tone: 'danger' },
    ],
    charts: [
      {
        id: 'trend',
        title: 'Collections vs Outstanding',
        subtitle: 'Paid, outstanding and overdue by month',
        type: 'stackedBar',
        data: context.map((m) => ({ name: trendLabel(m), paid: m.revenue, outstanding: m.outstanding - m.overdue, overdue: m.overdue })),
        series: [{ key: 'paid', name: 'Paid', color: C.success }, { key: 'outstanding', name: 'Outstanding', color: C.warning }, { key: 'overdue', name: 'Overdue', color: C.danger }],
        format: 'currency',
        span: 2,
      },
      { id: 'status', title: 'Invoices by Status', subtitle: 'Invoice value in the period', type: 'donut', data: byStatus, format: 'currency', centerLabel: 'Invoiced', centerValue: invoiced, emptyText: 'No invoices in this period.' },
      { id: 'collection', title: 'Collection Progress', subtitle: 'Share of billed amount already received', type: 'progress', data: collection, span: 3, emptyText: 'No invoices in this period.' },
    ],
    table: {
      title: 'Invoices',
      filename: 'billing-report',
      columns: [
        { key: 'number', header: 'Invoice', kind: 'strong' },
        { key: 'client', header: 'Client' },
        { key: 'issueDate', header: 'Issued', kind: 'date' },
        { key: 'dueDate', header: 'Due', kind: 'date' },
        { key: 'amount', header: 'Amount', kind: 'currency', align: 'right' },
        { key: 'paid', header: 'Paid', kind: 'currency', align: 'right' },
        { key: 'balance', header: 'Balance', kind: 'currency', align: 'right' },
        { key: 'status', header: 'Status', kind: 'status' },
      ],
      rows,
    },
  }
}

function buildSupport(range, filter) {
  const { inside, context } = historyFor(range)
  if (inside.length === 0) return null
  const opened = sum(inside, (m) => m.ticketsOpened)
  const resolved = sum(inside, (m) => m.ticketsResolved)
  const avgHours = resolved ? Math.round(sum(inside, (m) => m.resolutionHours * m.ticketsResolved) / resolved) : 0
  const priorityTotals = { low: 0, medium: 0, high: 0, urgent: 0 }
  inside.forEach((m) => Object.keys(priorityTotals).forEach((k) => (priorityTotals[k] += m.priorities[k])))

  const rows = tickets
    .filter((t) => inRange(t.createdDate, range) && (!filter || t.priority === filter))
    .map((t) => ({ id: t.id, ticketId: t.ticketId, subject: t.subject, client: t.client, assignee: t.assignee, priority: t.priority, status: t.status, createdDate: t.createdDate }))
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
  const liveOpen = tickets.filter((t) => ['open', 'in_progress', 'waiting_for_client'].includes(t.status) && (!filter || t.priority === filter)).length

  return {
    kpis: [
      { label: 'Open Tickets (now)', value: liveOpen, kind: 'number', tone: 'warning' },
      { label: 'Opened in Period', value: opened, kind: 'number', tone: 'brand' },
      { label: 'Resolved in Period', value: resolved, kind: 'number', tone: 'success' },
      { label: 'Avg Resolution Time', value: avgHours, kind: 'hours', tone: 'info' },
    ],
    charts: [
      { id: 'volume', title: 'Open vs Resolved Tickets', subtitle: 'Monthly ticket volume', type: 'line', data: context.map((m) => ({ name: trendLabel(m), opened: m.ticketsOpened, resolved: m.ticketsResolved })), series: [{ key: 'opened', name: 'Opened', color: C.warning }, { key: 'resolved', name: 'Resolved', color: C.success }], format: 'number', span: 2 },
      { id: 'priority', title: 'Tickets by Priority', subtitle: 'Opened in the period', type: 'donut', data: Object.entries(priorityTotals).map(([name, value], i) => ({ name: cap(name), value, color: [C.neutral, C.brand, C.warning, C.danger][i] })), centerLabel: 'Tickets' },
      { id: 'resolution', title: 'Resolution Time', subtitle: 'Average hours to resolve, by month', type: 'area', data: context.map((m) => ({ name: trendLabel(m), hours: m.resolutionHours })), series: [{ key: 'hours', name: 'Avg hours', color: C.info }], format: 'hours', span: 3 },
    ],
    table: {
      title: 'Tickets in period',
      filename: 'support-report',
      columns: [
        { key: 'ticketId', header: 'Ticket', kind: 'strong' },
        { key: 'subject', header: 'Subject' },
        { key: 'client', header: 'Client' },
        { key: 'assignee', header: 'Assigned to' },
        { key: 'priority', header: 'Priority', kind: 'status' },
        { key: 'status', header: 'Status', kind: 'status' },
        { key: 'createdDate', header: 'Created', kind: 'date' },
      ],
      rows,
    },
  }
}

const BUILDERS = {
  revenue: buildRevenue,
  projects: buildProjects,
  employees: buildEmployees,
  crm: buildCrm,
  billing: buildBilling,
  support: buildSupport,
}

export const reportService = {
  // Full report for one tab. Resolves to null-data (empty) when the range has no history.
  async getReport(tab, { range = 'this_month', custom = {}, filter = '' } = {}) {
    await wait()
    const resolved = resolveRange(range, custom)
    const report = BUILDERS[tab](resolved, filter)
    return report ? { ...report, rangeLabel: resolved.label, empty: false } : { rangeLabel: resolved.label, empty: true }
  },

  // Filter options for the tab-specific selector.
  getFilterOptions(tab) {
    const cfg = {
      revenue: { label: 'Client', all: 'All clients', options: clients.map((c) => c.company) },
      projects: { label: 'Status', all: 'All statuses', options: ['planning', 'active', 'on_hold', 'completed'].map((s) => ({ value: s, label: cap(s.replace('_', ' ')) })) },
      employees: { label: 'Department', all: 'All departments', options: [...new Set(employees.map((e) => e.department))] },
      crm: { label: 'Lead source', all: 'All sources', options: [...new Set(leads.map((l) => l.source))] },
      billing: { label: 'Invoice status', all: 'All statuses', options: ['paid', 'sent', 'partially_paid', 'overdue', 'draft'].map((s) => ({ value: s, label: cap(s.replace('_', ' ')) })) },
      support: { label: 'Priority', all: 'All priorities', options: ['low', 'medium', 'high', 'urgent'].map((s) => ({ value: s, label: cap(s) })) },
    }[tab]
    return {
      label: cfg.label,
      options: [{ value: '', label: cfg.all }, ...cfg.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))],
    }
  },

  // Legacy single-purpose loaders (still used by other modules).
  async getRevenueReport() {
    await wait()
    return revenueTrend
  },
  async getProjectReport() {
    await wait()
    return projectStatusBreakdown
  },
  async getTaskReport() {
    await wait()
    return taskOverview
  },
  async getClientGrowthReport() {
    await wait()
    return clientGrowth
  },
  async getEmployeeWorkloadReport() {
    await wait()
    return employeeWorkload
  },
}
