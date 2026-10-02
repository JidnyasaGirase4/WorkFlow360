import { useRef, useState } from 'react'
import { cn } from '../../../utils/cn'
import { Link } from 'react-router-dom'
import {
  Building2, User, Mail, Phone, Upload, Shield, Globe, Palette, Bell, Lock, KeyRound, ArrowRight, ImageIcon, Trash2, MapPin, FileText,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import SecuritySettings from '../../../components/business/SecuritySettings'
import AppearanceSettings from '../../../components/business/AppearanceSettings'
import Card, { CardBody, CardHeader, CardTitle } from '../../../components/common/Card'
import Input from '../../../components/common/Input'
import Textarea from '../../../components/common/Textarea'
import Select from '../../../components/common/Select'
import Switch from '../../../components/common/Switch'
import Button from '../../../components/common/Button'
import Avatar from '../../../components/common/Avatar'
import Badge from '../../../components/common/Badge'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { settingsService } from '../../../services/settingsService'
import { NOTIFICATION_CATEGORIES, getNotificationPreferences, saveNotificationPreferences } from '../../../services/notificationService'
import { TEAM_ROLES, PERMISSIONS } from '../../../mockData/team'
import { CURRENCIES, INDUSTRIES, TIMEZONES } from '../../../mockData/settings'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: <Building2 size={15} /> },
  { value: 'profile', label: 'Profile', icon: <User size={15} /> },
  { value: 'security', label: 'Security', icon: <Lock size={15} /> },
  { value: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { value: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { value: 'roles', label: 'Roles', icon: <KeyRound size={15} /> },
]

// Tint used for each tab icon chip and section header.
const TAB_TINT = {
  general: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  profile: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  security: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400',
  notifications: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  appearance: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  roles: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
}

const SECTION_TINT = {
  brand: TAB_TINT.general,
  accent: TAB_TINT.profile,
  warning: TAB_TINT.notifications,
  info: TAB_TINT.appearance,
  success: TAB_TINT.roles,
}

function SectionTitle({ icon: Icon, tint = 'brand', children }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', SECTION_TINT[tint])}>
        <Icon size={16} />
      </span>
      {children}
    </CardTitle>
  )
}

// Vertical list on desktop, horizontally scrollable pills on phones. Keeps tablist semantics + arrow keys.
function SettingsNav({ tabs, active, onChange }) {
  const listRef = useRef(null)

  function onKeyDown(e) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const idx = tabs.findIndex((t) => t.value === active)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % tabs.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    onChange(tabs[next].value)
    listRef.current?.querySelector(`[data-tab="${tabs[next].value}"]`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Settings sections"
      onKeyDown={onKeyDown}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-2xl lg:border lg:border-ink-100 lg:bg-white lg:p-2 lg:shadow-card dark:lg:border-ink-800 dark:lg:bg-ink-900"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            data-tab={tab.value}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              'focus-ring group flex min-h-10 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold transition-all duration-200 lg:rounded-xl lg:border-transparent lg:px-3',
              isActive
                ? 'border-transparent bg-brand-600 text-white shadow-glow lg:bg-brand-50 lg:text-brand-700 lg:shadow-none dark:lg:bg-brand-500/15 dark:lg:text-brand-200'
                : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700 lg:bg-transparent lg:hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:lg:bg-transparent dark:lg:hover:bg-ink-800'
            )}
          >
            <span className={cn('hidden h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105 lg:flex', TAB_TINT[tab.value])}>{tab.icon}</span>
            <span className="lg:hidden">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  company_admin: 'Company Admin',
  manager: 'Manager',
  employee: 'Employee',
  client: 'Client',
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_LOGO_MB = 2
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

function isValidPhone(value) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 13 && /^[+\d][\d\s-]*$/.test(value.trim())
}

function isValidUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function Settings() {
  const [tab, setTab] = useState('general')
  const { data, loading, error, reload, setData } = useAsyncData(settingsService.load, 'settings')

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your company profile, security and preferences."
        breadcrumbItems={[{ label: 'Settings' }]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-24 lg:w-60 lg:shrink-0">
        <SettingsNav tabs={SETTINGS_TABS} active={tab} onChange={setTab} />
      </div>

      <div className="min-w-0 flex-1">
      {loading && (
        <div className="max-w-3xl space-y-4" aria-busy="true" aria-label="Loading settings">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      )}
      {error && (
        <Card className="rounded-2xl">
          <ErrorState title="Couldn't load settings" description="There was a problem fetching your settings. Please try again." onRetry={reload} />
        </Card>
      )}
      {data && (
        <div key={tab} className={cn('animate-fade-in', tab === 'roles' ? '' : 'max-w-3xl')}>
          {tab === 'general' && <GeneralTab company={data.company} onSaved={(company) => setData((d) => ({ ...d, company }))} />}
          {tab === 'profile' && <ProfileTab data={data} onSaved={(saved) => setData((d) => ({ ...d, profileOverrides: saved.overrides, profileExtras: saved.extras }))} />}
          {tab === 'security' && <SecuritySettings />}
          {tab === 'notifications' && <NotificationsTab digest={data.digest} onDigestSaved={(digest) => setData((d) => ({ ...d, digest }))} />}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'roles' && <RolesTab team={data.team} />}
        </div>
      )}
      </div>
      </div>
    </div>
  )
}

function SaveBar({ dirty, saving, onDiscard, label = 'Save changes' }) {
  return (
    <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:items-center dark:border-ink-800">
      <span className="text-xs text-ink-500 sm:mr-auto" aria-live="polite">
        {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
      </span>
      <Button type="button" variant="secondary" onClick={onDiscard} disabled={!dirty || saving}>
        Discard
      </Button>
      <Button type="submit" isLoading={saving} disabled={!dirty}>
        {label}
      </Button>
    </div>
  )
}

function GeneralTab({ company, onSaved }) {
  const { toast } = useToast()
  const [values, setValues] = useState(company)
  const [saved, setSaved] = useState(company)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [logoError, setLogoError] = useState('')
  const fileRef = useRef(null)
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!values.companyName.trim()) e.companyName = 'Company name is required'
    if (!values.address.trim()) e.address = 'Business address is required'
    if (!values.phone.trim()) e.phone = 'Phone number is required'
    else if (!isValidPhone(values.phone)) e.phone = 'Enter a valid phone number (10 to 13 digits)'
    if (!values.email.trim()) e.email = 'Business email is required'
    else if (!EMAIL_RE.test(values.email.trim())) e.email = 'Enter a valid email address'
    if (values.website.trim() && !isValidUrl(values.website.trim())) e.website = 'Enter a valid URL starting with https://'
    if (values.gstin.trim() && !GSTIN_RE.test(values.gstin.trim().toUpperCase())) e.gstin = 'Enter a valid 15-character GSTIN (e.g. 36AABCT1234F1Z5)'
    return e
  }

  function handleLogo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return setLogoError('Use a PNG, JPG, SVG or WebP image.')
    if (file.size > MAX_LOGO_MB * 1024 * 1024) return setLogoError(`Logo must be ${MAX_LOGO_MB} MB or smaller.`)
    setLogoError('')
    if (values.logoUrl?.startsWith('blob:') && values.logoUrl !== saved.logoUrl) URL.revokeObjectURL(values.logoUrl)
    setValues((v) => ({ ...v, logoUrl: URL.createObjectURL(file), logoName: file.name }))
  }

  async function handleSave(ev) {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    const next = await settingsService.saveCompany({ ...values, companyName: values.companyName.trim(), gstin: values.gstin.trim().toUpperCase() })
    setSaving(false)
    setValues(next)
    setSaved(next)
    onSaved(next)
    toast.success('Company settings saved')
  }

  function discard() {
    setValues(saved)
    setErrors({})
    setLogoError('')
  }

  return (
    <form onSubmit={handleSave} noValidate className="space-y-4 sm:space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <SectionTitle icon={Building2} tint="brand">Company details</SectionTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Company name" required leftIcon={<Building2 size={16} />} value={values.companyName} error={errors.companyName} disabled={saving} onChange={(e) => update('companyName', e.target.value)} />
            <Select label="Industry" options={INDUSTRIES.map((i) => ({ value: i, label: i }))} value={values.industry} disabled={saving} onChange={(e) => update('industry', e.target.value)} />
            <Input label="Business email" type="email" required leftIcon={<Mail size={16} />} value={values.email} error={errors.email} disabled={saving} onChange={(e) => update('email', e.target.value)} />
            <Input label="Phone" required leftIcon={<Phone size={16} />} value={values.phone} error={errors.phone} disabled={saving} onChange={(e) => update('phone', e.target.value)} />
            <Input label="Website" leftIcon={<Globe size={16} />} placeholder="https://" value={values.website} error={errors.website} disabled={saving} onChange={(e) => update('website', e.target.value)} />
            <Input label="GSTIN" leftIcon={<FileText size={16} />} placeholder="15-character GST number" hint="Shown on invoices and quotations." value={values.gstin} error={errors.gstin} disabled={saving} onChange={(e) => update('gstin', e.target.value.toUpperCase())} maxLength={15} />
          </div>
          <Textarea label="Business address" required rows={3} value={values.address} error={errors.address} disabled={saving} onChange={(e) => update('address', e.target.value)} />
        </CardBody>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <SectionTitle icon={ImageIcon} tint="accent">Company logo</SectionTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="gradient-soft flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-brand-300 dark:border-ink-700">
              {values.logoUrl ? (
                <img src={values.logoUrl} alt="Company logo preview" className="h-full w-full object-contain p-1.5" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-ink-400">
                  <ImageIcon size={22} />
                  <span className="text-xs">No logo</span>
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" leftIcon={<Upload size={14} />} onClick={() => fileRef.current?.click()} disabled={saving}>
                  {values.logoUrl ? 'Replace logo' : 'Upload logo'}
                </Button>
                {values.logoUrl && (
                  <Button type="button" variant="ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => update('logoUrl', null)} disabled={saving}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-ink-400">PNG, JPG, SVG or WebP up to {MAX_LOGO_MB} MB. Square logos look best.</p>
              {values.logoName && values.logoUrl && <p className="text-xs text-ink-500">{values.logoName}</p>}
              {logoError && <p role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">{logoError}</p>}
              <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-label="Upload company logo" onChange={handleLogo} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <SectionTitle icon={Globe} tint="info">Regional settings</SectionTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Timezone" options={TIMEZONES} value={values.timezone} disabled={saving} onChange={(e) => update('timezone', e.target.value)} wrapperClassName="sm:col-span-2" />
            <Select label="Currency" options={CURRENCIES} value={values.currency} hint="Used for invoices, quotations and reports." disabled={saving} onChange={(e) => update('currency', e.target.value)} />
            <Select
              label="Financial year starts"
              options={[{ value: 'april', label: 'April (India standard)' }, { value: 'january', label: 'January' }]}
              value={values.fiscalYearStart}
              disabled={saving}
              onChange={(e) => update('fiscalYearStart', e.target.value)}
            />
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-2xl">
        <CardBody>
          <SaveBar dirty={dirty} saving={saving} onDiscard={discard} />
        </CardBody>
      </Card>
    </form>
  )
}

function ProfileTab({ data, onSaved }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const initial = {
    name: data.profileOverrides?.name ?? user?.name ?? '',
    email: data.profileOverrides?.email ?? user?.email ?? '',
    phone: data.profileOverrides?.phone ?? user?.phone ?? '',
    designation: data.profileOverrides?.designation ?? user?.designation ?? '',
    location: data.profileExtras.location,
    bio: data.profileExtras.bio,
  }
  const [values, setValues] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(values) !== JSON.stringify(saved)

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!values.name.trim()) e.name = 'Full name is required'
    else if (values.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (!values.email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(values.email.trim())) e.email = 'Enter a valid email address'
    if (values.phone.trim() && !isValidPhone(values.phone)) e.phone = 'Enter a valid phone number (10 to 13 digits)'
    if (values.bio.length > 240) e.bio = 'Bio must be 240 characters or fewer'
    return e
  }

  async function handleSave(ev) {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    const result = await settingsService.saveProfile(values)
    setSaving(false)
    setSaved(values)
    onSaved(result)
    toast.success('Profile updated')
  }

  return (
    <form onSubmit={handleSave} noValidate>
      <Card className="rounded-2xl">
        <CardHeader>
          <SectionTitle icon={User} tint="accent">Personal details</SectionTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="gradient-soft flex items-center gap-4 rounded-2xl border border-ink-100 p-4 dark:border-ink-800">
            <Avatar name={values.name} size="xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{values.name || 'Your name'}</p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
                <Badge tone="brand">{ROLE_LABELS[user?.role] || 'Member'}</Badge>
                {user?.company && <span>{user.company}</span>}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Full name" required leftIcon={<User size={16} />} value={values.name} error={errors.name} disabled={saving} onChange={(e) => update('name', e.target.value)} />
            <Input label="Designation" value={values.designation} disabled={saving} onChange={(e) => update('designation', e.target.value)} />
            <Input label="Email" type="email" required leftIcon={<Mail size={16} />} value={values.email} error={errors.email} disabled={saving} onChange={(e) => update('email', e.target.value)} />
            <Input label="Phone" leftIcon={<Phone size={16} />} value={values.phone} error={errors.phone} disabled={saving} onChange={(e) => update('phone', e.target.value)} />
            <Input label="Location" leftIcon={<MapPin size={16} />} value={values.location} disabled={saving} onChange={(e) => update('location', e.target.value)} wrapperClassName="sm:col-span-2" />
          </div>
          <Textarea label="Bio" rows={3} value={values.bio} error={errors.bio} hint={`${values.bio.length}/240 characters`} disabled={saving} onChange={(e) => update('bio', e.target.value)} />
          <SaveBar dirty={dirty} saving={saving} onDiscard={() => { setValues(saved); setErrors({}) }} />
        </CardBody>
      </Card>
    </form>
  )
}

const DIGEST_OPTIONS = [
  { value: 'instant', label: 'Instant - send emails as things happen' },
  { value: 'daily', label: 'Daily digest - one summary each morning' },
  { value: 'weekly', label: 'Weekly digest - every Monday' },
]

function NotificationsTab({ digest, onDigestSaved }) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState(getNotificationPreferences)
  const [saved, setSaved] = useState(getNotificationPreferences)
  const [digestValue, setDigestValue] = useState(digest)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved) || digestValue !== digest

  function toggle(cat, channel) {
    setPrefs((p) => ({ ...p, [cat]: { ...p[cat], [channel]: !p[cat][channel] } }))
  }

  function setAll(channel, value) {
    setPrefs((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, [channel]: value }])))
  }

  async function handleSave(ev) {
    ev.preventDefault()
    setSaving(true)
    const next = saveNotificationPreferences(prefs)
    if (digestValue !== digest) onDigestSaved(await settingsService.saveDigest(digestValue))
    else await new Promise((r) => setTimeout(r, 400))
    setSaved(next)
    setSaving(false)
    toast.success('Notification preferences saved')
  }

  const allOn = (channel) => Object.values(prefs).every((v) => v[channel])

  return (
    <form onSubmit={handleSave}>
      <Card className="rounded-2xl">
        <CardHeader>
          <SectionTitle icon={Bell} tint="warning">Notification preferences</SectionTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div role="group" aria-label="Notification channels by category">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-500 sm:grid-cols-[1fr_6rem_6rem]">
              <span>Category</span>
              <span className="text-center">In-app</span>
              <span className="text-center">Email</span>
            </div>
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t border-ink-100 py-3 dark:border-ink-800 sm:grid-cols-[1fr_6rem_6rem]">
              <span className="text-sm font-semibold text-ink-700 dark:text-ink-200">All categories</span>
              <span className="flex justify-center">
                <Switch checked={allOn('inApp')} onChange={(e) => setAll('inApp', e.target.checked)} aria-label="Turn all in-app notifications on or off" />
              </span>
              <span className="flex justify-center">
                <Switch checked={allOn('email')} onChange={(e) => setAll('email', e.target.checked)} aria-label="Turn all email notifications on or off" />
              </span>
            </div>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <div key={c.value} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 border-t border-ink-100 py-3 dark:border-ink-800 sm:grid-cols-[1fr_6rem_6rem]">
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
          </div>
          <Select label="Email frequency" options={DIGEST_OPTIONS} value={digestValue} disabled={saving} onChange={(e) => setDigestValue(e.target.value)} wrapperClassName="sm:max-w-md" />
          <SaveBar dirty={dirty} saving={saving} onDiscard={() => { setPrefs(saved); setDigestValue(digest) }} label="Save preferences" />
        </CardBody>
      </Card>
    </form>
  )
}

function RolesTab({ team }) {
  return (
    <div className="space-y-4">
      <Card className="gradient-soft rounded-2xl">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              <Shield size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Roles &amp; permissions</p>
              <p className="mt-0.5 text-sm text-ink-500">Change who can create projects, manage employees, raise invoices and more from the permission matrix.</p>
            </div>
          </div>
          <Button as={Link} to="/admin/team" state={{ tab: 'permissions' }} rightIcon={<ArrowRight size={15} />} className="w-full shrink-0 sm:w-auto">
            Open permission matrix
          </Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
        {TEAM_ROLES.map((role, roleIdx) => {
          const count = team.members.filter((m) => m.role === role.value).length
          const counts = { yes: 0, limited: 0, no: 0 }
          PERMISSIONS.forEach((p) => {
            counts[team.matrix[p.id]?.[role.value] || 'no'] += 1
          })
          return (
            <Card key={role.value} hover className="animate-slide-up rounded-2xl" style={{ animationDelay: `${roleIdx * 60}ms` }}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Badge tone={role.tone}>{role.label}</Badge>
                  <span className="text-xs text-ink-400">
                    {count} member{count === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-sm text-ink-600 dark:text-ink-300">{role.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge tone="success">{counts.yes} full</Badge>
                  <Badge tone="warning">{counts.limited} limited</Badge>
                  <Badge tone="neutral">{counts.no} no access</Badge>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
