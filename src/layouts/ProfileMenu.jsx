import { useNavigate } from 'react-router-dom'
import { User, Settings, HelpCircle, LogOut, Palette } from 'lucide-react'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSeparator } from '../components/common/Dropdown'
import Avatar from '../components/common/Avatar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function ProfileMenu({ profileHref, settingsHref }) {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    toast.info('You have been logged out')
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button type="button" aria-label={`Account menu for ${user.name}`} className="focus-ring cursor-pointer rounded-full p-0.5 ring-2 ring-brand-200 transition-all duration-200 hover:ring-brand-400 hover:shadow-glow active:scale-95 dark:ring-brand-500/40">
          <Avatar name={user.name} size="sm" status="online" />
        </button>
      </DropdownTrigger>
      <DropdownMenu className="w-64" align="right" label="Account">
        <div className="gradient-soft mb-1 flex items-center gap-3 rounded-xl px-3 py-3">
          <Avatar name={user.name} size="md" status="online" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
        </div>
        <DropdownSeparator />
        <DropdownSeparator />
        <DropdownItem icon={<User size={15} />} onClick={() => navigate(profileHref)}>
          Profile
        </DropdownItem>
        <DropdownItem icon={<Settings size={15} />} onClick={() => navigate(settingsHref)}>
          Settings
        </DropdownItem>
        <DropdownItem icon={<Palette size={15} />} onClick={() => navigate(settingsHref)}>
          Appearance
        </DropdownItem>
        <DropdownItem icon={<HelpCircle size={15} />} onClick={() => navigate('/faq')}>
          Help & Support
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<LogOut size={15} />} danger onClick={handleLogout}>
          Log Out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
