import { ROLES } from './users'

export const TEAM_ROLES = [
  {
    value: ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    tone: 'danger',
    description: 'Owns the workspace. Full access to data, billing plan and security. Cannot be restricted.',
    locked: true,
  },
  {
    value: ROLES.COMPANY_ADMIN,
    label: 'Company Admin',
    tone: 'brand',
    description: 'Runs the company account: people, clients, finances, reports and settings.',
  },
  {
    value: ROLES.MANAGER,
    label: 'Manager',
    tone: 'accent',
    description: 'Leads projects and teams, manages client relationships and approves day-to-day work.',
  },
  {
    value: ROLES.EMPLOYEE,
    label: 'Employee',
    tone: 'info',
    description: 'Works on assigned projects and tasks, logs attendance and updates client-facing status.',
  },
]

export const ROLE_LABEL = Object.fromEntries(TEAM_ROLES.map((r) => [r.value, r.label]))
export const ROLE_TONE = Object.fromEntries(TEAM_ROLES.map((r) => [r.value, r.tone]))
export const INVITABLE_ROLES = TEAM_ROLES.filter((r) => r.value !== ROLES.SUPER_ADMIN)

const y = 'yes'
const n = 'no'
const l = 'limited'

// Access per role, in the order: Super Admin, Company Admin, Manager, Employee.
function perm(id, group, name, description, access, binary = false) {
  const [sa, ca, mg, em] = access
  return { id, group, name, description, binary, defaults: { [ROLES.SUPER_ADMIN]: sa, [ROLES.COMPANY_ADMIN]: ca, [ROLES.MANAGER]: mg, [ROLES.EMPLOYEE]: em } }
}

export const PERMISSIONS = [
  perm('project-create', 'Projects', 'Create Project', 'Start new projects and assign a team.', [y, y, y, n]),
  perm('project-edit', 'Projects', 'Edit Project', 'Change scope, milestones and deadlines.', [y, y, y, l]),
  perm('records-delete', 'Projects', 'Delete Records', 'Permanently delete projects, tasks and documents.', [y, y, n, n]),
  perm('clients-manage', 'CRM', 'Manage Clients', 'Add, edit and archive client accounts.', [y, y, y, l]),
  perm('leads-manage', 'CRM', 'Manage Leads', 'Work the pipeline and convert leads to clients.', [y, y, y, n]),
  perm('employees-manage', 'People', 'Manage Employees', 'Add, edit and deactivate employee profiles.', [y, y, n, n]),
  perm('leave-approve', 'People', 'Approve Leave', 'Approve or reject leave requests.', [y, y, y, n], true),
  perm('invoice-create', 'Finance', 'Create Invoice', 'Draft and send invoices and quotations.', [y, y, l, n]),
  perm('billing-manage', 'Finance', 'Manage Billing', 'Record payments, expenses and payment methods.', [y, y, n, n]),
  perm('reports-view', 'Reports', 'View Reports', 'Open business, team and finance reports.', [y, y, y, l]),
  perm('data-export', 'Reports', 'Export Data', 'Download CSV and PDF exports.', [y, y, l, n]),
  perm('settings-manage', 'Administration', 'Manage Settings', 'Change company profile, security and integrations.', [y, y, n, n], true),
  perm('roles-manage', 'Administration', 'Manage Roles & Invites', 'Invite people and change roles and permissions.', [y, l, n, n]),
]

export const extraMembers = [
  {
    id: 'emp-owner',
    name: 'Rohit Malhotra',
    email: 'rohit.malhotra@technova.in',
    department: 'Leadership',
    designation: 'Co-founder & Chairman',
    status: 'active',
    role: ROLES.SUPER_ADMIN,
  },
]

export const initialInvitations = [
  { id: 'inv-1', email: 'neha.kapoor@technova.in', role: ROLES.MANAGER, message: 'Welcome aboard! You will be leading the new Delivery pod.', sentDate: '2026-09-16', invitedBy: 'Jidnyasa Girase', status: 'pending' },
  { id: 'inv-2', email: 'arjun.mehta@technova.in', role: ROLES.EMPLOYEE, message: '', sentDate: '2026-09-18', invitedBy: 'Jay Girase', status: 'pending' },
  { id: 'inv-3', email: 'divya.shah@technova.in', role: ROLES.EMPLOYEE, message: 'Excited to have you on the design team.', sentDate: '2026-09-20', invitedBy: 'Jidnyasa Girase', status: 'pending' },
  { id: 'inv-4', email: 'imran.qureshi@technova.in', role: ROLES.EMPLOYEE, message: '', sentDate: '2026-09-04', invitedBy: 'Jay Girase', status: 'expired' },
]
