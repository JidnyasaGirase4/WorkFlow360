import Badge from './Badge'

// Central status → tone map so every module (leads, projects, tasks,
// invoices, tickets, attendance...) renders status consistently.
const STATUS_TONES = {
  // Leads
  new: 'accent',
  contacted: 'info',
  qualified: 'brand',
  proposal: 'accent',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
  // Projects
  planning: 'info',
  active: 'success',
  on_hold: 'warning',
  cancelled: 'danger',
  // Tasks
  todo: 'neutral',
  in_progress: 'brand',
  review: 'info',
  done: 'success',
  // Invoices
  draft: 'neutral',
  sent: 'brand',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
  // Tickets
  open: 'accent',
  waiting_for_client: 'warning',
  resolved: 'success',
  closed: 'neutral',
  // Priority
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
  // Attendance / leave
  present: 'success',
  absent: 'danger',
  late: 'warning',
  wfh: 'info',
  approved: 'success',
  rejected: 'danger',
  pending: 'warning',
  // Quotations / payments
  accepted: 'success',
  completed: 'success',
}

const LABEL_OVERRIDES = {
  on_hold: 'On Hold',
  in_progress: 'In Progress',
  partially_paid: 'Partially Paid',
  waiting_for_client: 'Waiting for Client',
  wfh: 'Work from Home',
}

function toLabel(status) {
  if (LABEL_OVERRIDES[status]) return LABEL_OVERRIDES[status]
  return status
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
}

export default function StatusBadge({ status, label, className }) {
  if (!status) return null
  const tone = STATUS_TONES[status] || 'neutral'
  return (
    <Badge tone={tone} dot className={className}>
      {label || toLabel(status)}
    </Badge>
  )
}
