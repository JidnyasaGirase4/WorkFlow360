import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldCheck, User, Bell, Palette, ArrowRight } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import SecuritySettings from '../../components/business/SecuritySettings'
import AppearanceSettings from '../../components/business/AppearanceSettings'
import Tabs from '../../components/common/Tabs'
import Card, { CardBody, CardHeader, CardTitle } from '../../components/common/Card'
import Avatar from '../../components/common/Avatar'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import Switch from '../../components/common/Switch'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  NOTIFICATION_CATEGORIES,
  getNotificationPreferences,
  saveNotificationPreferences,
} from '../../services/notificationService'

const TABS = [
  { value: 'profile', label: 'Profile', icon: <User size={15} /> },
  { value: 'security', label: 'Security', icon: <ShieldCheck size={15} /> },
  { value: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { value: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
]

const ROLE_LABEL = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  manager: 'Manager',
  employee: 'Employee',
  client: 'Client',
}

export default function AccountSettings({ profileHref }) {
  const [tab, setTab] = useState('profile')
  const { pathname } = useLocation()
  const homeHref = `/${pathname.split('/')[1] || 'admin'}/dashboard`

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, security, notifications and appearance." breadcrumbItems={[{ label: 'Settings' }]} homeHref={homeHref} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />
      <div className="max-w-3xl">
        {tab === 'profile' && <ProfileTab profileHref={profileHref} />}
        {tab === 'security' && <SecuritySettings />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'appearance' && <AppearanceSettings />}
      </div>
    </div>
  )
}

function ProfileTab({ profileHref }) {
  const { user } = useAuth()
  const name = user?.name || 'Guest user'

  return (
    <Card className="animate-slide-up overflow-hidden rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300">
            <User size={16} />
          </span>
          Account summary
        </CardTitle>
      </CardHeader>
      <CardBody className="gradient-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={name} src={user?.avatar || undefined} size="xl" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-ink-800 dark:text-ink-100">{name}</p>
              <p className="truncate text-sm text-ink-500">{user?.email || 'No email on file'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{ROLE_LABEL[user?.role] || 'Member'}</Badge>
                {user?.company && <span className="text-xs text-ink-400">{user.company}</span>}
              </div>
            </div>
          </div>
          {profileHref && (
            <Button as={Link} to={profileHref} variant="outline" rightIcon={<ArrowRight size={15} />} className="w-full shrink-0 sm:w-auto sm:self-auto">
              Edit profile
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function NotificationsTab() {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState(getNotificationPreferences)
  const [saving, setSaving] = useState(false)

  function toggle(cat, channel) {
    setPrefs((p) => ({ ...p, [cat]: { ...p[cat], [channel]: !p[cat][channel] } }))
  }

  function handleSave() {
    setSaving(true)
    setTimeout(() => {
      saveNotificationPreferences(prefs)
      setSaving(false)
      toast.success('Notification preferences saved')
    }, 500)
  }

  return (
    <Card className="animate-slide-up rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
            <Bell size={16} />
          </span>
          Notification preferences
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 sm:grid-cols-[1fr_6rem_6rem]">
          <span>Category</span>
          <span className="text-center">In-app</span>
          <span className="text-center">Email</span>
        </div>
        {NOTIFICATION_CATEGORIES.map((c) => (
          <div
            key={c.value}
            className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t border-ink-100 py-3 dark:border-ink-800 sm:grid-cols-[1fr_6rem_6rem]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{c.label}</p>
              <p className="text-xs text-ink-400">{c.description}</p>
            </div>
            <span className="flex justify-center">
              <Switch checked={prefs[c.value].inApp} onChange={() => toggle(c.value, 'inApp')} aria-label={`${c.label} in-app notifications`} />
            </span>
            <span className="flex justify-center">
              <Switch checked={prefs[c.value].email} onChange={() => toggle(c.value, 'email')} aria-label={`${c.label} email notifications`} />
            </span>
          </div>
        ))}
        <div className="border-t border-ink-100 pt-4 dark:border-ink-800">
          <Button onClick={handleSave} isLoading={saving} className="w-full sm:w-auto">
            Save preferences
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
