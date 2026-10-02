import { Check, X, Minus, Lock } from 'lucide-react'
import { cn } from '../../utils/cn'

const CYCLE = ['yes', 'limited', 'no']
const STATE = {
  yes: { label: 'Yes', icon: Check, cls: 'bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-500/15 dark:text-success-300 dark:hover:bg-success-500/25' },
  limited: { label: 'Limited', icon: Minus, cls: 'bg-warning-50 text-warning-700 hover:bg-warning-100 dark:bg-warning-500/15 dark:text-warning-300 dark:hover:bg-warning-500/25' },
  no: { label: 'No', icon: X, cls: 'bg-ink-100 text-ink-500 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-400 dark:hover:bg-ink-700' },
}

function nextValue(current, binary) {
  const order = binary ? ['yes', 'no'] : CYCLE
  return order[(order.indexOf(current) + 1) % order.length]
}

// Permission x role matrix. Each cell is an editable Yes / Limited / No control; locked roles are read-only.
export default function PermissionMatrix({ permissions, roles, matrix, onChange, changedCells = new Set() }) {
  const groups = [...new Set(permissions.map((p) => p.group))]

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-ink-100 shadow-card dark:border-ink-800">
      <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Permission matrix showing what each role can do. Select a cell to change access.</caption>
        <thead>
          <tr className="bg-ink-50 dark:bg-ink-800/60">
            <th scope="col" className="sticky left-0 z-20 min-w-[9.5rem] sm:min-w-[11rem] border-b border-r border-ink-100 bg-ink-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-800">
              Permission
            </th>
            {roles.map((role) => (
              <th key={role.value} scope="col" className="whitespace-nowrap border-b border-ink-100 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-ink-500 dark:border-ink-800">
                <span className="inline-flex items-center justify-center gap-1">
                  {role.locked && <Lock size={12} aria-hidden="true" />}
                  {role.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <GroupRows key={group} group={group} permissions={permissions.filter((p) => p.group === group)} roles={roles} matrix={matrix} onChange={onChange} changedCells={changedCells} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GroupRows({ group, permissions, roles, matrix, onChange, changedCells }) {
  return (
    <>
      <tr className="bg-brand-50/60 dark:bg-brand-500/5">
        <th colSpan={roles.length + 1} scope="colgroup" className="border-b border-ink-100 px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-brand-700 dark:border-ink-800 dark:text-brand-300">
          <span className="sticky left-4 inline-block">{group}</span>
        </th>
      </tr>
      {permissions.map((perm) => (
        <tr key={perm.id} className="group transition-colors hover:bg-brand-50/40 dark:hover:bg-ink-800/30">
          <th scope="row" className="sticky left-0 z-10 min-w-[9.5rem] sm:min-w-[11rem] border-b border-r border-ink-100 bg-white px-4 py-3 text-left font-normal group-hover:bg-brand-50 dark:border-ink-800 dark:bg-ink-900 dark:group-hover:bg-ink-800">
            <span className="block font-medium text-ink-800 dark:text-ink-100">{perm.name}</span>
            <span className="block max-w-[15rem] text-xs text-ink-500">{perm.description}</span>
          </th>
          {roles.map((role) => {
            const value = matrix[perm.id]?.[role.value] || 'no'
            const s = STATE[value]
            const Icon = s.icon
            const changed = changedCells.has(`${perm.id}:${role.value}`)
            return (
              <td key={role.value} className="border-b border-ink-100 px-3 py-2.5 text-center dark:border-ink-800">
                <button
                  type="button"
                  disabled={role.locked}
                  onClick={() => onChange(perm.id, role.value, nextValue(value, perm.binary))}
                  className={cn(
                    'focus-ring inline-flex min-h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95',
                    s.cls,
                    changed && 'ring-2 ring-brand-400 ring-offset-1 dark:ring-offset-ink-900',
                    role.locked && 'cursor-not-allowed opacity-80'
                  )}
                  aria-label={`${perm.name} for ${role.label}: ${s.label}.${role.locked ? ' Locked.' : ' Select to change.'}`}
                >
                  <Icon size={13} aria-hidden="true" /> {s.label}
                </button>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
