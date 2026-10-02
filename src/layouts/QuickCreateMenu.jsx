import { useNavigate } from 'react-router-dom'
import { Plus, Users, Building2, FolderKanban, ListChecks, Receipt, CalendarClock, LifeBuoy, UserSquare2 } from 'lucide-react'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownLabel } from '../components/common/Dropdown'

// Every item navigates to its list page with `state.openCreate`, which each
// target page reads to open its create modal (Leads, Clients, Projects, Tasks,
// Invoices, Meetings, Tickets and Employees all handle it).
const ITEMS = [
  { label: 'New Lead', icon: Users, href: '/admin/crm/leads', tone: 'text-brand-500' },
  { label: 'New Client', icon: Building2, href: '/admin/crm/clients', tone: 'text-accent-500' },
  { label: 'New Project', icon: FolderKanban, href: '/admin/projects', tone: 'text-info-500' },
  { label: 'New Task', icon: ListChecks, href: '/admin/tasks', tone: 'text-success-500' },
  { label: 'New Invoice', icon: Receipt, href: '/admin/billing/invoices', tone: 'text-warning-500' },
  { label: 'New Meeting', icon: CalendarClock, href: '/admin/meetings', tone: 'text-brand-600' },
  { label: 'New Ticket', icon: LifeBuoy, href: '/admin/support', tone: 'text-accent-400' },
  { label: 'New Employee', icon: UserSquare2, href: '/admin/employees', tone: 'text-info-400' },
]

export default function QuickCreateMenu() {
  const navigate = useNavigate()
  return (
    <Dropdown>
      <DropdownTrigger
        className="focus-ring gradient-brand group inline-flex h-10 w-10 select-none items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-glow hover:brightness-105 active:scale-95 sm:w-auto sm:px-4"
        aria-label="Quick create"
      >
        <Plus size={18} className="transition-transform duration-300 group-hover:rotate-90" />
        <span className="hidden sm:inline">Create</span>
      </DropdownTrigger>
      <DropdownMenu className="w-60" label="Quick create">
        <DropdownLabel>Quick Create</DropdownLabel>
        {ITEMS.map((item) => (
          <DropdownItem
            key={item.label}
            icon={<item.icon size={16} className={item.tone} />}
            onClick={() => navigate(item.href, { state: { openCreate: true } })}
          >
            {item.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
