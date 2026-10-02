import { employees } from '../mockData/employees'
import { users, ROLES } from '../mockData/users'
import { PERMISSIONS, extraMembers, initialInvitations } from '../mockData/team'

function wait(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function lastActiveFor(idx) {
  const d = new Date('2026-09-26T09:30:00')
  d.setDate(d.getDate() - idx)
  return d.toISOString()
}

function buildMembers() {
  const fromEmployees = employees.map((e, idx) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    department: e.department,
    designation: e.designation,
    status: e.status === 'active' ? 'active' : 'on_leave',
    role: users.find((u) => u.email.toLowerCase() === e.email.toLowerCase())?.role || ROLES.EMPLOYEE,
    lastActive: lastActiveFor(idx),
  }))
  return [...extraMembers.map((m) => ({ ...m, lastActive: lastActiveFor(0) })), ...fromEmployees]
}

function defaultMatrix() {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.id, { ...p.defaults }]))
}

let members = buildMembers()
let invitations = [...initialInvitations]
let matrix = defaultMatrix()

const clone = (v) => structuredClone(v)

export const teamService = {
  async load() {
    await wait()
    return { members: clone(members), invitations: clone(invitations), matrix: clone(matrix) }
  },

  async changeRole(id, role) {
    await wait(250)
    members = members.map((m) => (m.id === id ? { ...m, role } : m))
    return members.find((m) => m.id === id)
  },

  async setMemberStatus(id, status) {
    await wait(300)
    members = members.map((m) => (m.id === id ? { ...m, status } : m))
    return members.find((m) => m.id === id)
  },

  async invite({ email, role, message, invitedBy }) {
    await wait(500)
    const invitation = {
      id: `inv-${Date.now()}`,
      email: email.trim().toLowerCase(),
      role,
      message: message.trim(),
      sentDate: '2026-09-26',
      invitedBy,
      status: 'pending',
    }
    invitations = [invitation, ...invitations]
    return clone(invitation)
  },

  async resend(id) {
    await wait(350)
    invitations = invitations.map((i) => (i.id === id ? { ...i, sentDate: '2026-09-26', status: 'pending' } : i))
    return clone(invitations.find((i) => i.id === id))
  },

  async revoke(id) {
    await wait(300)
    invitations = invitations.filter((i) => i.id !== id)
    return { success: true }
  },

  async savePermissions(next) {
    await wait(500)
    matrix = clone(next)
    return clone(matrix)
  },

  defaultMatrix,
}
