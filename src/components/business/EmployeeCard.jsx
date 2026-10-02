import { Mail, Phone, MoreHorizontal, Pencil, Trash2, Eye, FolderKanban } from 'lucide-react'
import Card from '../common/Card'
import StatusBadge from '../common/StatusBadge'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '../common/Dropdown'
import EmployeeAvatar from './EmployeeAvatar'
import { tintFor } from './employeeTints'
import { cn } from '../../utils/cn'

// Compact employee card used on small screens where the table would scroll.
export default function EmployeeCard({ employee, onView, onEdit, onDelete }) {
  const tint = tintFor(employee.department)
  return (
    <Card hover className="relative overflow-hidden rounded-2xl border-ink-100 p-4 sm:p-5">
      <span aria-hidden="true" className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent', tint.corner)} />
      <div className="relative flex items-start gap-3">
        <button type="button" onClick={onView} className="focus-ring group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left" aria-label={`View profile of ${employee.name}`}>
          <EmployeeAvatar name={employee.name} src={employee.avatar} size="lg" className="transition-transform group-hover:scale-105" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{employee.name}</span>
            <span className="block truncate text-xs text-ink-500">{employee.designation}</span>
          </span>
        </button>
        <Dropdown>
          <DropdownTrigger>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800" aria-label={`Actions for ${employee.name}`}>
              <MoreHorizontal size={16} />
            </span>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem icon={<Eye size={14} />} onClick={onView}>View Profile</DropdownItem>
            <DropdownItem icon={<Pencil size={14} />} onClick={onEdit}>Edit</DropdownItem>
            <DropdownItem icon={<Trash2 size={14} />} danger onClick={onDelete}>Delete</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tint.chip)}>{employee.department}</span>
        <StatusBadge status={employee.status} />
        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
          <FolderKanban size={12} /> {employee.projects} {employee.projects === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <div className="relative mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
        <p className="flex min-w-0 items-center gap-2"><Mail size={13} className="shrink-0 text-brand-500" /> <span className="min-w-0 break-all">{employee.email}</span></p>
        <p className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-accent-500" /> {employee.phone}</p>
      </div>
    </Card>
  )
}
