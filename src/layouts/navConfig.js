import {
  LayoutDashboard, Users, UserSquare2, Receipt, FileText, LifeBuoy, Calendar,
  ShieldCheck, Settings, ListChecks, Building2, Contact2, CalendarClock,
  FileBarChart2, CreditCard, ClipboardList, Wallet, FolderKanban,
  CalendarDays, Activity, Network, Flag, Bell, MessagesSquare,
} from 'lucide-react'
import { ROLES } from '../mockData/users'

export const adminNav = [
  { section: null, items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' }] },
  {
    section: 'CRM',
    items: [
      { label: 'Leads', icon: Users, href: '/admin/crm/leads' },
      { label: 'Clients', icon: Building2, href: '/admin/crm/clients' },
      { label: 'Contacts', icon: Contact2, href: '/admin/crm/contacts' },
      { label: 'Activities', icon: Activity, href: '/admin/crm/activities' },
      { label: 'Meetings', icon: CalendarClock, href: '/admin/meetings' },
    ],
  },
  {
    section: 'Projects',
    items: [
      { label: 'All Projects', icon: FolderKanban, href: '/admin/projects' },
      { label: 'Tasks', icon: ListChecks, href: '/admin/tasks' },
      { label: 'Milestones', icon: Flag, href: '/admin/milestones' },
    ],
  },
  {
    section: 'People',
    items: [
      { label: 'Employees', icon: UserSquare2, href: '/admin/employees' },
      { label: 'Departments', icon: Network, href: '/admin/departments' },
      { label: 'Attendance', icon: ClipboardList, href: '/admin/employees/attendance' },
      { label: 'Leave', icon: Calendar, href: '/admin/employees/leave' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Quotations', icon: FileText, href: '/admin/billing/quotations' },
      { label: 'Invoices', icon: Receipt, href: '/admin/billing/invoices' },
      { label: 'Payments', icon: CreditCard, href: '/admin/billing/payments' },
      { label: 'Expenses', icon: Wallet, href: '/admin/billing/expenses' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Documents', icon: FileText, href: '/admin/documents' },
      { label: 'Support', icon: LifeBuoy, href: '/admin/support' },
      { label: 'Calendar', icon: CalendarDays, href: '/admin/calendar' },
    ],
  },
  {
    section: null,
    items: [
      { label: 'Reports', icon: FileBarChart2, href: '/admin/reports' },
      { label: 'Notifications', icon: Bell, href: '/admin/notifications' },
      { label: 'Team & Roles', icon: ShieldCheck, href: '/admin/team' },
      { label: 'Settings', icon: Settings, href: '/admin/settings' },
    ],
  },
]

export const employeeNav = [
  { section: null, items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/employee/dashboard' }] },
  {
    section: 'Work',
    items: [
      { label: 'My Projects', icon: FolderKanban, href: '/employee/projects' },
      { label: 'My Tasks', icon: ListChecks, href: '/employee/tasks' },
      { label: 'Calendar', icon: Calendar, href: '/employee/calendar' },
      { label: 'Meetings', icon: CalendarClock, href: '/employee/meetings' },
    ],
  },
  {
    section: 'HR',
    items: [
      { label: 'Attendance', icon: ClipboardList, href: '/employee/attendance' },
      { label: 'Leave', icon: Calendar, href: '/employee/leave' },
      { label: 'Documents', icon: FileText, href: '/employee/documents' },
    ],
  },
  {
    section: null,
    items: [
      { label: 'Activity', icon: Activity, href: '/employee/activity' },
      { label: 'Notifications', icon: Bell, href: '/employee/notifications' },
      { label: 'Profile', icon: UserSquare2, href: '/employee/profile' },
      { label: 'Settings', icon: Settings, href: '/employee/settings' },
    ],
  },
]

export const clientNav = [
  { section: null, items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/client/dashboard' }] },
  {
    section: 'Workspace',
    items: [
      { label: 'Projects', icon: FolderKanban, href: '/client/projects' },
      { label: 'Tasks', icon: ListChecks, href: '/client/tasks' },
      { label: 'Documents', icon: FileText, href: '/client/documents' },
      { label: 'Meetings', icon: CalendarClock, href: '/client/meetings' },
      { label: 'Messages', icon: MessagesSquare, href: '/client/messages' },
    ],
  },
  {
    section: 'Billing',
    items: [
      { label: 'Invoices', icon: Receipt, href: '/client/invoices' },
      { label: 'Payments', icon: CreditCard, href: '/client/payments' },
    ],
  },
  {
    section: 'Support',
    items: [{ label: 'Tickets', icon: LifeBuoy, href: '/client/tickets' }],
  },
  {
    section: null,
    items: [
      { label: 'Notifications', icon: Bell, href: '/client/notifications' },
      { label: 'Profile', icon: UserSquare2, href: '/client/profile' },
      { label: 'Settings', icon: Settings, href: '/client/settings' },
    ],
  },
]

export function getNavForRole(role) {
  if (role === ROLES.CLIENT) return clientNav
  if (role === ROLES.EMPLOYEE || role === ROLES.MANAGER) return employeeNav
  return adminNav
}
