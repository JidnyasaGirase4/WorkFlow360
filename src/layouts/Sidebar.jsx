import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronDown, Check, Plus, X, ShieldCheck, Briefcase, Building2 } from 'lucide-react'
import Logo from '../components/common/Logo'
import Avatar from '../components/common/Avatar'
import Tooltip from '../components/common/Tooltip'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '../components/common/Dropdown'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useOverlay } from '../hooks/useOverlay'
import { cn } from '../utils/cn'

// Each nav group gets its own icon colour so the menu reads colourful but tidy.
const GROUP_ICON_TONES = [
  'text-brand-500 dark:text-brand-400',
  'text-accent-500 dark:text-accent-400',
  'text-info-500 dark:text-info-400',
  'text-warning-500 dark:text-warning-400',
  'text-success-500 dark:text-success-400',
  'text-accent-400 dark:text-accent-300',
  'text-brand-600 dark:text-brand-300',
]

// Which dashboard the sidebar belongs to, shown as a chip under the logo.
const PANEL_META = {
  admin: { label: 'Admin Dashboard', icon: ShieldCheck },
  employee: { label: 'Employee Dashboard', icon: Briefcase },
  client: { label: 'Client Dashboard', icon: Building2 },
}

export default function Sidebar({ nav, mobileOpen, onCloseMobile, homeHref, showWorkspaceSwitcher, panel }) {
  const [collapsed, setCollapsed] = useState(false)
  const asideRef = useRef(null)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const drawerActive = mobileOpen && !isDesktop
  // The sidebar is a modal drawer below lg: Escape closes it, focus is trapped
  // inside while open and returns to the menu button afterwards.
  useOverlay({ isOpen: drawerActive, onClose: onCloseMobile, ref: asideRef })

  // On desktop the collapsed rail is a real rail; inside the mobile drawer it is always expanded.
  const rail = collapsed && isDesktop

  return (
    <>
      {drawerActive && (
        <div className="animate-fade-in fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-md lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}
      <aside
        ref={asideRef}
        aria-label="Sidebar"
        role={drawerActive ? 'dialog' : undefined}
        aria-modal={drawerActive ? 'true' : undefined}
        // Off-screen drawer must not be reachable by keyboard / screen readers.
        inert={!isDesktop && !mobileOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-ink-100 bg-white outline-none transition-[transform,width] duration-300 ease-out dark:border-ink-800 dark:bg-ink-900 lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:shrink-0 lg:translate-x-0',
          drawerActive && 'shadow-panel',
          rail ? 'w-[76px]' : 'w-[min(18rem,86vw)] lg:w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center justify-between gap-2 px-4', rail && 'justify-center px-2')}>
          {!rail && <Logo to={homeHref} className="text-base" />}
          {rail && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 via-brand-500 to-accent-500 text-white shadow-glow" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 12L10 18L20 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
          {drawerActive && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-all hover:bg-accent-50 hover:text-accent-600 active:scale-90 dark:hover:bg-ink-800"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {PANEL_META[panel] && !rail && <PanelBadge meta={PANEL_META[panel]} />}

        {showWorkspaceSwitcher && !rail && <WorkspaceSwitcher />}

        <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-3">
          {nav.map((group, gIdx) => (
            <div key={gIdx}>
              {group.section && !rail && (
                <p className="mb-1.5 flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                  {group.section}
                  <span className="h-px flex-1 bg-gradient-to-r from-ink-200 to-transparent dark:from-ink-700" aria-hidden="true" />
                </p>
              )}
              {group.section && rail && gIdx > 0 && <div className="mx-3 mb-2 h-px bg-ink-100 dark:bg-ink-800" aria-hidden="true" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      collapsed={rail}
                      onCloseMobile={onCloseMobile}
                      iconTone={GROUP_ICON_TONES[gIdx % GROUP_ICON_TONES.length]}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <SidebarUser rail={rail} />

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="focus-ring group hidden shrink-0 items-center gap-2 border-t border-ink-100 px-4 py-3 text-xs font-semibold text-ink-400 transition-colors hover:bg-ink-50 hover:text-brand-700 dark:border-ink-800 dark:hover:bg-ink-800/60 dark:hover:text-brand-300 lg:flex"
        >
          <ChevronsLeft size={15} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
          {!collapsed && 'Collapse'}
        </button>
      </aside>
    </>
  )
}

function SidebarUser({ rail }) {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className={cn('shrink-0 border-t border-ink-100 p-3 dark:border-ink-800', rail && 'flex justify-center px-2')}>
      <div className={cn('gradient-soft flex items-center gap-2.5 rounded-2xl border border-ink-100 p-2 dark:border-ink-800', rail && 'border-0 bg-transparent p-0')}>
        <Avatar name={user.name} src={user.avatar || undefined} size="md" status="online" />
        {!rail && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{user.name}</p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">{user.designation || user.email}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SidebarLink({ item, collapsed, onCloseMobile, iconTone }) {
  // NavLink sets aria-current="page" on the active link automatically.
  const link = (
    <NavLink
      to={item.href}
      onClick={onCloseMobile}
      end={item.href.split('/').length <= 3}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-gradient-to-r from-brand-100/80 via-brand-50 to-brand-50/20 font-semibold text-brand-800 dark:from-brand-500/20 dark:via-brand-500/10 dark:to-transparent dark:text-brand-200'
            : 'text-ink-600 hover:translate-x-0.5 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="animate-scale-in absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600"
              aria-hidden="true"
            />
          )}
          <item.icon
            size={18}
            className={cn(
              'shrink-0 transition-transform duration-200 group-hover:scale-110',
              isActive ? 'text-brand-600 dark:text-brand-300' : iconTone
            )}
            aria-hidden="true"
          />
          {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
          {!collapsed && item.badge !== undefined && (
            <span className="ml-auto rounded-full bg-accent-100 px-1.5 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-accent-300">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right">
        {link}
      </Tooltip>
    )
  }
  return link
}

const WORKSPACES = ['TechNova Solutions', 'BrightPixel Labs', 'CloudMatrix Technologies']

function WorkspaceSwitcher() {
  const { toast } = useToast()
  const [current, setCurrent] = useState(WORKSPACES[0])

  function select(name) {
    setCurrent(name)
    toast.info(`Switched to ${name}`)
  }

  return (
    <div className="px-3 pb-2 pt-1">
      <Dropdown className="block w-full">
        <DropdownTrigger asChild>
          <button
            type="button"
            className="focus-ring gradient-soft group flex w-full items-center gap-2.5 rounded-2xl border border-ink-100 px-2.5 py-2.5 text-left transition-all duration-200 hover:border-brand-200 hover:shadow-card dark:border-ink-800 dark:hover:border-brand-500/40"
          >
            <span className="gradient-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm">
              {current.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{current}</span>
              <span className="block text-xs text-ink-500 dark:text-ink-400">Workspace</span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-ink-400 transition-transform group-aria-expanded:rotate-180" />
          </button>
        </DropdownTrigger>
        <DropdownMenu className="w-56" align="left" label="Switch workspace">
          <DropdownLabel>Switch workspace</DropdownLabel>
          {WORKSPACES.map((name) => (
            <DropdownItem key={name} icon={name === current ? <Check size={15} className="text-brand-600" /> : <span className="w-[15px]" />} onClick={() => select(name)}>
              {name}
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem icon={<Plus size={15} />} onClick={() => toast.info('Workspace creation will be available with the backend.')}>
            Add workspace
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}

function PanelBadge({ meta }) {
  const Icon = meta.icon
  return (
    <div className="shrink-0 px-4 pb-2">
      <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-brand-50 py-1.5 pl-2.5 pr-3.5 text-xs font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/25">
        <Icon size={14} aria-hidden="true" className="shrink-0" />
        <span className="truncate">{meta.label}</span>
      </span>
    </div>
  )
}
