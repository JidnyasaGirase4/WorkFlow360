import { createStore } from './createStore'
import * as taskData from '../mockData/tasks'
import { leaveRequests } from '../mockData/attendance'
import { tickets } from '../mockData/tickets'
import { invoices } from '../mockData/invoices'
import { payments } from '../mockData/payments'
import { clientSharedFiles } from '../mockData/clientPortal'
import { TODAY } from '../mockData/reference'

// In-memory "server state" shared by the employee and client portals so that
// changes made on one page (a task moved to Review, an invoice paid, a ticket
// reply) are visible on every other page for the rest of the session.
// Each mutator mirrors what a REST call would do; swap for real services later.

let counter = 0
function nextId(prefix) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter}`
}

const STAGE_LABEL = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Completed' }

/* ------------------------------------------------------------------ tasks */

const detailsSeed = taskData.taskDetailsSeed || {}

export const taskStore = createStore(
  (taskData.tasks || []).map((t) => ({
    ...t,
    checklist: t.checklist || [],
    commentList: detailsSeed[t.id]?.commentList || [],
    attachmentList: detailsSeed[t.id]?.attachmentList || [],
    history: detailsSeed[t.id]?.history || [],
  }))
)

function patchTask(id, fn) {
  taskStore.set((list) => list.map((t) => (t.id === id ? fn(t) : t)))
}

export function setTaskStatus(id, status, actor) {
  patchTask(id, (t) => {
    if (t.status === status) return t
    return {
      ...t,
      status,
      history: [
        {
          id: nextId('h'),
          actor,
          text: `moved this task to ${STAGE_LABEL[status] || status}`,
          time: new Date().toISOString(),
          tone: status === 'done' ? 'success' : 'brand',
        },
        ...t.history,
      ],
    }
  })
}

export function addTaskComment(id, author, text) {
  patchTask(id, (t) => ({
    ...t,
    commentList: [...t.commentList, { id: nextId('cm'), author, text, time: new Date().toISOString() }],
    history: [{ id: nextId('h'), actor: author, text: 'commented on this task', time: new Date().toISOString(), tone: 'info' }, ...t.history],
  }))
}

export function addTaskAttachment(id, file, uploadedBy) {
  patchTask(id, (t) => ({
    ...t,
    attachmentList: [
      ...t.attachmentList,
      { id: nextId('att'), name: file.name, size: file.size, uploadedBy, time: new Date().toISOString() },
    ],
    history: [{ id: nextId('h'), actor: uploadedBy, text: `attached ${file.name}`, time: new Date().toISOString(), tone: 'neutral' }, ...t.history],
  }))
}

export function toggleTaskChecklist(id, itemId) {
  patchTask(id, (t) => ({
    ...t,
    checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
  }))
}

/* ------------------------------------------------------------- attendance */

// live[name] = { date, checkIn: ISO | null, checkOut: ISO | null }
export const attendanceStore = createStore({ live: {} })

export function checkInNow(name) {
  attendanceStore.set((s) => ({
    live: { ...s.live, [name]: { date: TODAY, checkIn: new Date().toISOString(), checkOut: null } },
  }))
}

export function checkOutNow(name) {
  attendanceStore.set((s) => {
    const current = s.live[name]
    if (!current?.checkIn) return s
    return { live: { ...s.live, [name]: { ...current, checkOut: new Date().toISOString() } } }
  })
}

/* ------------------------------------------------------------------ leave */

export const leaveStore = createStore([...leaveRequests])

export function addLeaveRequest(request) {
  const record = { id: nextId('lv'), status: 'pending', appliedOn: TODAY, ...request }
  leaveStore.set((list) => [record, ...list])
  return record
}

export function cancelLeaveRequest(id) {
  leaveStore.set((list) => list.filter((l) => l.id !== id))
}

/* -------------------------------------------------------------- documents */

export const uploadedDocsStore = createStore([])

export function addUploadedDoc(doc) {
  const record = { id: nextId('doc'), uploadedDate: TODAY, ...doc }
  uploadedDocsStore.set((list) => [record, ...list])
  return record
}

/* ---------------------------------------------------------------- tickets */

export const ticketStore = createStore(tickets.map((t) => ({ ...t })))

// Internal notes never leave the staff side; the client portal strips them.
export function toClientTicket(ticket) {
  if (!ticket) return ticket
  const safe = { ...ticket }
  delete safe.internalNotes
  return safe
}

export function createClientTicket(payload) {
  const ticketId = `TCK-${2330 + ticketStore.get().length}`
  const record = {
    id: nextId('tkt'),
    ticketId,
    assignee: 'Unassigned',
    status: 'open',
    createdDate: TODAY,
    attachments: [],
    messages: [],
    ...payload,
  }
  ticketStore.set((list) => [record, ...list])
  return record
}

export function addTicketMessage(id, message) {
  ticketStore.set((list) =>
    list.map((t) => (t.id === id ? { ...t, messages: [...t.messages, { ...message, time: new Date().toISOString() }] } : t))
  )
}

/* --------------------------------------------------- invoices & payments */

export const invoiceStore = createStore(invoices.map((i) => ({ ...i })))
export const paymentStore = createStore(payments.map((p) => ({ ...p })))

// Mock gateway: settles the outstanding balance of an invoice.
export function settleInvoice(invoiceId, method, reference) {
  const invoice = invoiceStore.get().find((i) => i.id === invoiceId)
  if (!invoice) return null
  const amount = invoice.balance
  const payment = {
    id: nextId('pay'),
    number: `PAY-${1100 + paymentStore.get().length}`,
    invoice: invoice.number,
    client: invoice.client,
    amount,
    date: TODAY,
    method,
    status: 'completed',
    reference,
  }
  paymentStore.set((list) => [payment, ...list])
  invoiceStore.set((list) =>
    list.map((i) =>
      i.id === invoiceId
        ? {
            ...i,
            paid: i.paid + amount,
            balance: 0,
            status: 'paid',
            activity: [
              ...(i.activity || []),
              { id: nextId('a'), actor: 'System', text: `recorded payment ${payment.number} via ${method}`, time: new Date().toISOString(), tone: 'success' },
            ],
          }
        : i
    )
  )
  return payment
}

/* ------------------------------------------------------- client documents */

export const clientDocStore = createStore(clientSharedFiles.map((d) => ({ ...d })))

export function addClientDoc(doc) {
  const record = { id: nextId('cdoc'), uploadedDate: TODAY, ...doc }
  clientDocStore.set((list) => [record, ...list])
  return record
}

/* ---------------------------------------------------------------- profile */

// Profile edits keyed by account email, layered over the base records.
export const profileStore = createStore({})

export function saveProfile(email, patch) {
  profileStore.set((all) => ({ ...all, [email]: { ...(all[email] || {}), ...patch } }))
}

export function setTicketStatus(id, status) {
  ticketStore.set((list) => list.map((t) => (t.id === id ? { ...t, status } : t)))
}
