import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../utils/createStore'
import { ticketStore, invoiceStore, paymentStore, clientDocStore, toClientTicket, taskStore } from '../utils/portalStores'
import { clients } from '../mockData/clients'
import { projects } from '../mockData/projects'
import { meetings } from '../mockData/meetings'
import { milestones } from '../mockData/milestones'
import { documents } from '../mockData/documents'
import { portalMeetings } from '../mockData/clientPortal'

// Only fields that are safe to show a client. Budgets, spend and margins never
// leave this function, so no client page can render them by accident.
export function toClientProject(p) {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    clientId: p.clientId,
    manager: p.manager,
    status: p.status,
    progress: p.progress,
    deadline: p.deadline,
    startDate: p.startDate,
    team: p.team,
    description: p.description,
  }
}

// Everything the client portal shows, scoped strictly to user.company. If the
// company has no matching client record every list is simply empty.
export function useClientData() {
  const { user } = useAuth()
  const allTickets = useStore(ticketStore)
  const allInvoices = useStore(invoiceStore)
  const allPayments = useStore(paymentStore)
  const uploadedFiles = useStore(clientDocStore)
  const allTasks = useStore(taskStore)
  const company = user?.company || null

  return useMemo(() => {
    const client = clients.find((c) => c.company === company) || null
    const myProjects = projects.filter((p) => p.client === company).map(toClientProject)
    const projectIds = new Set(myProjects.map((p) => p.id))
    const projectNames = new Set(myProjects.map((p) => p.name))

    const myTasks = allTasks
      .filter((t) => projectIds.has(t.projectId))
      // Client view: no internal comment / attachment payloads.
      .map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project,
        projectId: t.projectId,
        assignee: t.assignee,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
      }))

    const seededDocIds = new Set(uploadedFiles.map((d) => d.id))
    const seededDocs = documents.filter(
      (d) => d.client === company && d.category !== 'Employee Documents' && !seededDocIds.has(d.id)
    )

    return {
      user,
      company,
      client,
      contactName: client?.contactPerson || user?.name || '',
      projects: myProjects,
      tasks: myTasks,
      milestones: milestones.filter((m) => projectIds.has(m.projectId)),
      invoices: allInvoices.filter((i) => i.client === company && !['draft', 'cancelled'].includes(i.status)),
      payments: allPayments.filter((p) => p.client === company),
      tickets: allTickets.filter((t) => t.client === company).map(toClientTicket),
      meetings: [...meetings, ...portalMeetings].filter((m) => m.client === company),
      documents: [...uploadedFiles.filter((d) => d.client === company), ...seededDocs],
      projectNames,
    }
  }, [user, company, allTickets, allInvoices, allPayments, uploadedFiles, allTasks])
}
