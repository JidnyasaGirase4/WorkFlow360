import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UserPlus, Mail, Send, Trash2, ShieldCheck, Users, KeyRound, MailPlus, RotateCcw, Save, UserX, UserCheck, Crown, Briefcase, User, Clock } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import PermissionMatrix from '../../../components/business/PermissionMatrix'
import InviteMemberModal from '../../../components/business/InviteMemberModal'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Tabs from '../../../components/common/Tabs'
import DataTable from '../../../components/common/DataTable'
import Avatar from '../../../components/common/Avatar'
import Badge from '../../../components/common/Badge'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import FilterBar from '../../../components/common/FilterBar'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton, SkeletonTable } from '../../../components/common/Skeleton'
import { teamService } from '../../../services/teamService'
import { PERMISSIONS, TEAM_ROLES, ROLE_LABEL, ROLE_TONE } from '../../../mockData/team'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../utils/format'
import { cn } from '../../../utils/cn'

const STATUS_META = {
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On Leave', tone: 'warning' },
  deactivated: { label: 'Deactivated', tone: 'neutral' },
}

// Coloured icon chip per role (keyed by the role's badge tone).
const ROLE_ICON = { danger: Crown, brand: ShieldCheck, accent: Briefcase, info: User }
const ROLE_CHIP = {
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
}

const ROLE_FILTER_OPTIONS = [{ value: '', label: 'All roles' }, ...TEAM_ROLES.map((r) => ({ value: r.value, label: r.label }))]
const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
]

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function Team() {
  const { toast } = useToast()
  const { user } = useAuth()
  const location = useLocation()
  const { data, loading, error, reload, setData } = useAsyncData(teamService.load, 'team')

  const [tab, setTab] = useState(() => location.state?.tab || 'members')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [revokeTarget, setRevokeTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savingMatrix, setSavingMatrix] = useState(false)

  const members = useMemo(() => data?.members || [], [data])
  const invitations = useMemo(() => data?.invitations || [], [data])
  const savedMatrix = data?.matrix
  const matrix = draft || savedMatrix

  const changedCells = useMemo(() => {
    const set = new Set()
    if (!draft || !savedMatrix) return set
    Object.keys(draft).forEach((permId) =>
      Object.keys(draft[permId]).forEach((roleKey) => {
        if (draft[permId][roleKey] !== savedMatrix[permId]?.[roleKey]) set.add(`${permId}:${roleKey}`)
      })
    )
    return set
  }, [draft, savedMatrix])

  const tabs = [
    { value: 'members', label: 'Team Members', icon: <Users size={15} />, count: members.length },
    { value: 'roles', label: 'Roles', icon: <ShieldCheck size={15} /> },
    { value: 'permissions', label: 'Permissions', icon: <KeyRound size={15} />, count: changedCells.size > 0 ? changedCells.size : undefined },
    { value: 'invitations', label: 'Invitations', icon: <MailPlus size={15} />, count: invitations.length },
  ]

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.department.toLowerCase().includes(q)) &&
        (!roleFilter || m.role === roleFilter) &&
        (!statusFilter || m.status === statusFilter)
    )
  }, [members, search, roleFilter, statusFilter])

  const existingEmails = useMemo(() => [...members.map((m) => m.email.toLowerCase()), ...invitations.map((i) => i.email.toLowerCase())], [members, invitations])

  const activeFilters = [
    roleFilter && { key: 'role', label: `Role: ${ROLE_LABEL[roleFilter]}`, onRemove: () => setRoleFilter('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_META[statusFilter].label}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
  }

  async function handleRoleChange(member, role) {
    if (role === member.role) return
    setBusyId(member.id)
    await teamService.changeRole(member.id, role)
    setData((prev) => ({ ...prev, members: prev.members.map((m) => (m.id === member.id ? { ...m, role } : m)) }))
    setBusyId(null)
    toast.success(`${member.name} is now ${ROLE_LABEL[role]}`)
  }

  async function setStatus(member, status) {
    setBusyId(member.id)
    await teamService.setMemberStatus(member.id, status)
    setData((prev) => ({ ...prev, members: prev.members.map((m) => (m.id === member.id ? { ...m, status } : m)) }))
    setBusyId(null)
    setDeactivateTarget(null)
    toast.success(status === 'deactivated' ? `${member.name} was deactivated and can no longer sign in` : `${member.name} was reactivated`)
  }

  async function handleInvite(values) {
    setInviting(true)
    try {
      const invitation = await teamService.invite({ ...values, invitedBy: user?.name || 'Admin' })
      setData((prev) => ({ ...prev, invitations: [invitation, ...prev.invitations] }))
      setInviteOpen(false)
      setTab('invitations')
      toast.success(`Invitation sent to ${invitation.email}`)
    } catch {
      toast.error('Could not send the invitation. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  async function handleResend(inv) {
    setBusyId(inv.id)
    const updated = await teamService.resend(inv.id)
    setData((prev) => ({ ...prev, invitations: prev.invitations.map((i) => (i.id === inv.id ? updated : i)) }))
    setBusyId(null)
    toast.success(`Invitation resent to ${inv.email}`)
  }

  async function handleRevoke() {
    const inv = revokeTarget
    setBusyId(inv.id)
    await teamService.revoke(inv.id)
    setData((prev) => ({ ...prev, invitations: prev.invitations.filter((i) => i.id !== inv.id) }))
    setBusyId(null)
    setRevokeTarget(null)
    toast.success(`Invitation to ${inv.email} was revoked`)
  }

  function handleMatrixChange(permId, roleKey, value) {
    setDraft((prev) => {
      const base = prev || structuredClone(savedMatrix)
      return { ...base, [permId]: { ...base[permId], [roleKey]: value } }
    })
  }

  async function saveMatrix() {
    setSavingMatrix(true)
    const saved = await teamService.savePermissions(draft)
    setData((prev) => ({ ...prev, matrix: saved }))
    setDraft(null)
    setSavingMatrix(false)
    toast.success(`Permissions updated (${changedCells.size} change${changedCells.size === 1 ? '' : 's'} saved)`)
  }

  function resetToDefaults() {
    setDraft(teamService.defaultMatrix())
    toast.info('Defaults loaded. Review the highlighted cells and save to apply.')
  }

  const memberColumns = [
    {
      key: 'name',
      header: 'Member',
      sortable: true,
      render: (row) => (
        <div className={cn('flex items-center gap-3', row.status === 'deactivated' && 'opacity-60')}>
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="whitespace-nowrap font-medium text-ink-800 dark:text-ink-100">{row.name}</p>
            <p className="whitespace-nowrap text-xs text-ink-400">{row.designation}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', sortable: true },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortAccessor: (r) => ROLE_LABEL[r.role],
      render: (row) => {
        const isSelf = user?.email?.toLowerCase() === row.email.toLowerCase()
        const locked = isSelf || row.role === 'super_admin' || row.status === 'deactivated'
        return (
          <div className="flex items-center gap-2">
            <select
              aria-label={`Role for ${row.name}`}
              title={isSelf ? "You can't change your own role" : row.role === 'super_admin' ? 'Super Admin roles are managed by the workspace owner' : undefined}
              value={row.role}
              disabled={locked || busyId === row.id}
              onChange={(e) => handleRoleChange(row, e.target.value)}
              className="focus-ring h-9 rounded-lg border border-ink-200 bg-white px-2 text-xs font-semibold text-ink-700 transition-colors hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              {TEAM_ROLES.map((r) => (
                <option key={r.value} value={r.value} disabled={r.value === 'super_admin' && row.role !== 'super_admin'}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )
      },
    },
    { key: 'department', header: 'Department', sortable: true },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge tone={STATUS_META[row.status].tone} dot>
          {STATUS_META[row.status].label}
        </Badge>
      ),
    },
    { key: 'lastActive', header: 'Last active', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.lastActive)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => {
        const isSelf = user?.email?.toLowerCase() === row.email.toLowerCase()
        if (row.status === 'deactivated') {
          return (
            <Button variant="secondary" size="sm" leftIcon={<UserCheck size={13} />} isLoading={busyId === row.id} onClick={() => setStatus(row, 'active')}>
              Reactivate
            </Button>
          )
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<UserX size={13} />}
            disabled={isSelf || row.role === 'super_admin'}
            title={isSelf ? "You can't deactivate your own account" : row.role === 'super_admin' ? 'The workspace owner cannot be deactivated' : undefined}
            onClick={() => setDeactivateTarget(row)}
            className="text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10"
          >
            Deactivate
          </Button>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Team & Roles"
        description="Manage members, roles, permissions and pending invitations."
        breadcrumbItems={[{ label: 'Settings', href: '/admin/settings' }, { label: 'Team & Roles' }]}
        action={
          <Button leftIcon={<UserPlus size={15} />} onClick={() => setInviteOpen(true)} disabled={loading || Boolean(error)} className="w-full sm:w-auto">
            Invite Member
          </Button>
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-6" />

      {loading && (
        <Card className="rounded-2xl p-4" aria-busy="true" aria-label="Loading team">
          <Skeleton className="mb-4 h-10 w-72" />
          <SkeletonTable rows={6} cols={6} />
        </Card>
      )}

      {error && (
        <Card>
          <ErrorState title="Couldn't load your team" description="There was a problem fetching team data. Please try again." onRetry={reload} />
        </Card>
      )}

      {data && tab === 'members' && (
        <div>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 lg:flex-row lg:items-center dark:border-ink-800 dark:bg-ink-900">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email or department..." className="lg:w-80" />
            <div className="grid grid-cols-2 gap-3 lg:flex">
              <Select aria-label="Filter by role" options={ROLE_FILTER_OPTIONS} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} wrapperClassName="lg:w-44" />
              <Select aria-label="Filter by status" options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} wrapperClassName="lg:w-44" />
            </div>
          </div>
          {activeFilters.length > 0 && <FilterBar activeFilters={activeFilters} onClearAll={clearFilters} className="mb-4" />}
          <DataTable
            columns={memberColumns}
            data={filteredMembers}
            pageSize={8}
            emptyTitle="No team members match"
            emptyDescription="Try a different search or clear the filters."
            emptyActionLabel="Clear filters"
            onEmptyAction={clearFilters}
          />
        </div>
      )}

      {data && tab === 'roles' && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
          {TEAM_ROLES.map((role, roleIdx) => {
            const RoleIcon = ROLE_ICON[role.tone] || User
            const totalPerms = PERMISSIONS.length || 1
            const roleMembers = members.filter((m) => m.role === role.value)
            const counts = { yes: 0, limited: 0, no: 0 }
            PERMISSIONS.forEach((p) => {
              counts[savedMatrix[p.id]?.[role.value] || 'no'] += 1
            })
            return (
              <Card key={role.value} hover className="flex animate-slide-up flex-col overflow-hidden rounded-2xl" style={{ animationDelay: `${roleIdx * 60}ms` }}>
                <CardBody className="flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ROLE_CHIP[role.tone])}>
                        <RoleIcon size={20} />
                      </span>
                      <div className="min-w-0">
                        <Badge tone={role.tone}>{role.label}</Badge>
                        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{role.description}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block text-2xl font-bold tabular-nums text-ink-800 dark:text-ink-50">{roleMembers.length}</span>
                      <span className="text-xs text-ink-400">member{roleMembers.length === 1 ? '' : 's'}</span>
                    </span>
                  </div>
                  <div className="flex items-center -space-x-2">
                    {roleMembers.slice(0, 5).map((m) => (
                      <Avatar key={m.id} name={m.name} size="sm" className="ring-2 ring-white dark:ring-ink-900" />
                    ))}
                    {roleMembers.length === 0 && <span className="text-xs text-ink-400">No one has this role yet.</span>}
                    {roleMembers.length > 5 && <span className="pl-3 text-xs text-ink-400">+{roleMembers.length - 5}</span>}
                  </div>
                  <div
                    className="flex h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                    role="img"
                    aria-label={`${counts.yes} full, ${counts.limited} limited, ${counts.no} no access permissions`}
                  >
                    <span className="h-full bg-success-500 transition-all duration-700" style={{ width: `${(counts.yes / totalPerms) * 100}%` }} />
                    <span className="h-full bg-warning-400 transition-all duration-700" style={{ width: `${(counts.limited / totalPerms) * 100}%` }} />
                  </div>
                  <p className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone="success">{counts.yes} full</Badge>
                    <Badge tone="warning">{counts.limited} limited</Badge>
                    <Badge tone="neutral">{counts.no} no access</Badge>
                  </p>
                </CardBody>
                <div className="flex flex-wrap gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3 dark:border-ink-800 dark:bg-ink-800/20">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRoleFilter(role.value)
                      setTab('members')
                    }}
                  >
                    View members
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setTab('permissions')}>
                    View permissions
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {data && tab === 'permissions' && (
        <div className="space-y-4">
          <Card className="min-w-0 overflow-hidden rounded-2xl">
            <CardHeader className="flex-wrap">
              <div className="min-w-0">
                <CardTitle>Permission matrix</CardTitle>
                <p className="mt-0.5 text-xs text-ink-500">Select a cell to switch between Yes, Limited and No. Super Admin access is locked.</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Yes</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning-500" /> Limited</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-300" /> No</span>
              </div>
            </CardHeader>
            <CardBody>
              <PermissionMatrix permissions={PERMISSIONS} roles={TEAM_ROLES} matrix={matrix} onChange={handleMatrixChange} changedCells={changedCells} />
            </CardBody>
          </Card>
          <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <Button variant="ghost" leftIcon={<RotateCcw size={15} />} onClick={resetToDefaults} disabled={savingMatrix}>
              Reset to defaults
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-400" aria-live="polite">
                {changedCells.size > 0 ? `${changedCells.size} unsaved change${changedCells.size === 1 ? '' : 's'}` : 'All changes saved'}
              </span>
              <Button variant="secondary" onClick={() => setDraft(null)} disabled={changedCells.size === 0 || savingMatrix}>
                Discard
              </Button>
              <Button leftIcon={<Save size={15} />} onClick={saveMatrix} isLoading={savingMatrix} disabled={changedCells.size === 0}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {data && tab === 'invitations' && (
        <Card className="rounded-2xl">
          <CardHeader>
            <div>
              <CardTitle>Pending invitations</CardTitle>
              <p className="mt-0.5 text-xs text-ink-500">Invitations expire 7 days after they are sent.</p>
            </div>
          </CardHeader>
          <CardBody>
            {invitations.length === 0 ? (
              <EmptyState icon={Mail} title="No pending invitations" description="Invite teammates to collaborate in your workspace." actionLabel="Invite Member" onAction={() => setInviteOpen(true)} />
            ) : (
              <ul className="space-y-3">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/30 lg:flex-row lg:items-center lg:justify-between dark:border-ink-800 dark:hover:bg-ink-800/30">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', inv.status === 'expired' ? 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400' : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400')}>
                        {inv.status === 'expired' ? <Mail size={18} /> : <Clock size={18} />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{inv.email}</p>
                        <p className="text-xs text-ink-400">
                          Invited by {inv.invitedBy} on {formatDate(inv.sentDate)} - {inv.status === 'expired' ? 'expired' : 'expires'} {formatDate(addDays(inv.sentDate, 7))}
                        </p>
                        {inv.message && <p className="mt-1 line-clamp-1 text-xs italic text-ink-500">&ldquo;{inv.message}&rdquo;</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={ROLE_TONE[inv.role]}>{ROLE_LABEL[inv.role]}</Badge>
                      <Badge tone={inv.status === 'expired' ? 'danger' : 'warning'} dot>
                        {inv.status === 'expired' ? 'Expired' : 'Pending'}
                      </Badge>
                      <Button variant="secondary" size="sm" leftIcon={<Send size={13} />} isLoading={busyId === inv.id} onClick={() => handleResend(inv)}>
                        Resend
                      </Button>
                      <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} disabled={busyId === inv.id} onClick={() => setRevokeTarget(inv)} className="text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-500/10">
                        Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <InviteMemberModal isOpen={inviteOpen} onClose={() => setInviteOpen(false)} onSubmit={handleInvite} isSaving={inviting} existingEmails={existingEmails} />

      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => setStatus(deactivateTarget, 'deactivated')}
        isLoading={busyId === deactivateTarget?.id}
        title={`Deactivate ${deactivateTarget?.name}?`}
        description="They will immediately lose access to the workspace. Their tasks and history are kept, and you can reactivate them at any time."
        confirmLabel="Deactivate"
      />
      <ConfirmDialog
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        isLoading={busyId === revokeTarget?.id}
        title="Revoke this invitation?"
        description={`${revokeTarget?.email} will no longer be able to join using the invite link.`}
        confirmLabel="Revoke invitation"
      />
    </div>
  )
}
