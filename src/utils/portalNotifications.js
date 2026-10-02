import { ROLES } from '../mockData/users'
import { notifications as staffNotifications } from '../mockData/notifications'
import { tasks } from '../mockData/tasks'
import { meetings } from '../mockData/meetings'
import { portalMeetings } from '../mockData/clientPortal'
import { projects } from '../mockData/projects'
import { milestones } from '../mockData/milestones'
import { invoices } from '../mockData/invoices'
import { payments } from '../mockData/payments'
import { tickets } from '../mockData/tickets'
import { leaveRequests } from '../mockData/attendance'
import { formatCurrency, formatDate } from './format'

const allMeetings = [...meetings, ...portalMeetings]

function byNewest(a, b) {
  return b.time.localeCompare(a.time)
}

function employeeNotifications(user) {
  const name = user?.name
  const items = []
  tasks
    .filter((t) => t.assignee === name && t.status !== 'done')
    .forEach((t) => {
      items.push({
        id: `emp-task-${t.id}`,
        category: 'tasks',
        title: 'Task assigned to you',
        description: `${t.title} - due ${formatDate(t.dueDate)}.`,
        time: `${t.dueDate < '2026-09-20' ? t.dueDate : '2026-09-20'}T08:15:00`,
        read: t.dueDate > '2026-09-26',
      })
    })
  allMeetings
    .filter((m) => m.participants.includes(name) && m.status === 'upcoming')
    .forEach((m) => {
      items.push({
        id: `emp-mtg-${m.id}`,
        category: 'meetings',
        title: 'Meeting reminder',
        description: `${m.title} on ${formatDate(m.date)} at ${m.time}.`,
        time: '2026-09-25T09:00:00',
        read: false,
      })
    })
  leaveRequests
    .filter((l) => l.employee === name && l.decidedOn)
    .forEach((l) => {
      items.push({
        id: `emp-leave-${l.id}`,
        category: 'system',
        title: `Leave request ${l.status}`,
        description: `${l.type} from ${formatDate(l.from)} to ${formatDate(l.to)} was ${l.status}.`,
        time: `${l.decidedOn}T11:00:00`,
        read: true,
      })
    })
  projects
    .filter((p) => p.team.includes(name))
    .forEach((p) => {
      milestones
        .filter((m) => m.projectId === p.id && m.status === 'done')
        .slice(-1)
        .forEach((m) => {
          items.push({
            id: `emp-ms-${m.id}`,
            category: 'projects',
            title: 'Project milestone completed',
            description: `${m.title} - ${p.name}.`,
            time: `${m.dueDate}T10:00:00`,
            read: true,
          })
        })
    })
  return items.sort(byNewest)
}

function clientNotifications(user) {
  const company = user?.company
  const items = []
  invoices
    .filter((i) => i.client === company && !['draft', 'cancelled'].includes(i.status))
    .forEach((i) => {
      items.push({
        id: `cl-inv-${i.id}`,
        category: 'billing',
        title: i.status === 'paid' ? `Invoice ${i.number} paid` : `Invoice ${i.number} is due`,
        description:
          i.status === 'paid'
            ? `Thank you - we received ${formatCurrency(i.amount)}.`
            : `${formatCurrency(i.balance)} due by ${formatDate(i.dueDate)}.`,
        time: `${i.issueDate}T09:30:00`,
        read: i.status === 'paid',
      })
    })
  payments
    .filter((p) => p.client === company)
    .forEach((p) => {
      items.push({
        id: `cl-pay-${p.id}`,
        category: 'billing',
        title: p.status === 'pending' ? 'Payment pending verification' : 'Payment received',
        description: `${formatCurrency(p.amount)} against ${p.invoice} via ${p.method}.`,
        time: `${p.date}T17:10:00`,
        read: p.status !== 'pending',
      })
    })
  tickets
    .filter((t) => t.client === company)
    .forEach((t) => {
      const last = t.messages[t.messages.length - 1]
      items.push({
        id: `cl-tkt-${t.id}`,
        category: 'support',
        title: `Update on ${t.ticketId}`,
        description: `${t.subject} - ${last?.role === 'employee' ? `${last.from} replied` : 'awaiting response'}.`,
        time: last?.time || `${t.createdDate}T10:00:00`,
        read: t.status === 'resolved' || t.status === 'closed',
      })
    })
  const ownProjects = projects.filter((p) => p.client === company)
  ownProjects.forEach((p) => {
    milestones
      .filter((m) => m.projectId === p.id && m.status === 'done')
      .slice(-1)
      .forEach((m) => {
        items.push({
          id: `cl-ms-${m.id}`,
          category: 'projects',
          title: 'Milestone completed',
          description: `${m.title} - ${p.name}.`,
          time: `${m.dueDate}T10:00:00`,
          read: true,
        })
      })
  })
  allMeetings
    .filter((m) => m.client === company && m.status === 'upcoming')
    .forEach((m) => {
      items.push({
        id: `cl-mtg-${m.id}`,
        category: 'meetings',
        title: 'Upcoming meeting',
        description: `${m.title} on ${formatDate(m.date)} at ${m.time}.`,
        time: '2026-09-24T09:00:00',
        read: false,
      })
    })
  return items.sort(byNewest)
}

// Role-scoped notification feed: staff see the workspace feed, employees see
// items about their own work and clients only see items about their own company.
export function getNotificationsForUser(user) {
  if (user?.role === ROLES.CLIENT) return clientNotifications(user)
  if (user?.role === ROLES.EMPLOYEE) return employeeNotifications(user)
  return staffNotifications.map((n) => ({ ...n }))
}
