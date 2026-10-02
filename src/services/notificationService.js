import { notifications } from '../mockData/notifications'
import { createMockService } from './createMockService'

export const notificationService = createMockService(notifications, 'id')

export const NOTIFICATION_CATEGORIES = [
  { value: 'tasks', label: 'Tasks', description: 'Assignments, due dates and status changes' },
  { value: 'projects', label: 'Projects', description: 'Milestones, updates and deadline changes' },
  { value: 'billing', label: 'Billing', description: 'Invoices, payments and reminders' },
  { value: 'crm', label: 'CRM', description: 'Lead and client activity' },
  { value: 'support', label: 'Support', description: 'Ticket replies and escalations' },
  { value: 'meetings', label: 'Meetings', description: 'Invites, reminders and reschedules' },
  { value: 'system', label: 'System', description: 'Reports, security and product updates' },
]

const DEFAULT_PREFERENCES = Object.fromEntries(
  NOTIFICATION_CATEGORIES.map((c) => [
    c.value,
    { inApp: true, email: c.value === 'billing' || c.value === 'support' || c.value === 'meetings' },
  ])
)

// In-memory preference store shared by the notification center and account settings.
let preferenceStore = structuredClone(DEFAULT_PREFERENCES)

export function getNotificationPreferences() {
  return structuredClone(preferenceStore)
}

export function saveNotificationPreferences(next) {
  preferenceStore = structuredClone(next)
  return getNotificationPreferences()
}
