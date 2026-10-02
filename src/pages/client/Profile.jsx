import { useState } from 'react'
import { Building2, MapPin, Briefcase, CalendarClock, Lock, Mail, Phone as PhoneIcon, User, Save, Receipt, Bell } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import { ROTATION } from '../../components/portal/tones'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import Switch from '../../components/common/Switch'
import EmptyState from '../../components/common/EmptyState'
import AvatarUpload from '../../components/common/AvatarUpload'
import PasswordChangeCard from '../../components/common/PasswordChangeCard'
import AsyncState from '../../components/common/AsyncState'
import { SkeletonProfile } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useStore } from '../../utils/createStore'
import { profileStore, saveProfile } from '../../utils/portalStores'
import { formatDate } from '../../utils/format'

const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

function InfoRow({ icon, label, value, tone = 'brand' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2.5 text-ink-500">
        <IconChip icon={icon} tone={tone} size="xs" /> {label}
      </span>
      <span className="min-w-0 text-right font-semibold text-ink-800 dark:text-ink-100">{value || '—'}</span>
    </div>
  )
}

function ProfileForm({ user, client }) {
  const { toast } = useToast()
  const overrides = useStore(profileStore)[user.email] || {}
  const [form, setForm] = useState({
    name: overrides.name ?? user.name ?? client.contactPerson,
    email: overrides.email ?? user.email ?? client.email,
    phone: overrides.phone ?? user.phone ?? client.phone,
    designation: overrides.designation ?? user.designation ?? '',
    gstin: overrides.gstin ?? '',
    billingEmail: overrides.billingEmail ?? client.email,
  })
  const [prefs, setPrefs] = useState(overrides.prefs ?? { invoices: true, tickets: true, projects: true, meetings: false })
  const [avatar, setAvatar] = useState(overrides.avatar ?? null)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Full name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.phone.trim()) next.phone = 'Phone number is required.'
    else if (!PHONE_RE.test(form.phone.trim())) next.phone = 'Enter a valid 10-digit Indian mobile number.'
    if (form.billingEmail.trim() && !EMAIL_RE.test(form.billingEmail.trim())) next.billingEmail = 'Enter a valid email address.'
    if (form.gstin.trim() && !GSTIN_RE.test(form.gstin.trim().toUpperCase())) next.gstin = 'GSTIN must be 15 characters, e.g. 27AABCT1234F1Z5.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSave(e) {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setIsSaving(true)
    setTimeout(() => {
      saveProfile(user.email, { ...form, gstin: form.gstin.trim().toUpperCase(), prefs, avatar })
      setIsSaving(false)
      toast.success('Profile updated successfully')
    }, 500)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Panel className="overflow-hidden">
        <div className="gradient-hero relative overflow-hidden px-4 py-5 text-white sm:px-6 sm:py-6">
          <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-accent-400/40 blur-3xl" aria-hidden="true" />
          <div className="relative min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{form.name}</h2>
            <p className="mt-0.5 text-sm text-white/90">
              {form.designation || 'Client contact'} · {client.company}
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <AvatarUpload name={form.name} src={avatar} onChange={setAvatar} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <Panel className="self-start lg:col-span-1">
          <PanelHeader icon={Building2} tone="brand" title="Company" action={<Lock size={14} className="text-ink-400" aria-label="Managed by WorkFlow360" />} />
          <PanelBody className="space-y-3.5">
            <InfoRow icon={Building2} tone={ROTATION[0]} label="Company" value={client.company} />
            <InfoRow icon={Briefcase} tone={ROTATION[1]} label="Industry" value={client.industry} />
            <InfoRow icon={MapPin} tone={ROTATION[2]} label="City" value={client.city} />
            <InfoRow icon={CalendarClock} tone={ROTATION[3]} label="Client since" value={formatDate(client.since)} />
            <p className="text-xs text-ink-500">Company details are managed by your account manager.</p>
          </PanelBody>
        </Panel>

        <form onSubmit={handleSave} noValidate className="space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
          <Panel>
            <PanelHeader icon={User} tone="accent" title="Contact details" />
            <PanelBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Full name" required value={form.name} onChange={(e) => update('name', e.target.value)} error={errors.name} leftIcon={<User size={15} />} autoComplete="name" />
                <Input label="Designation" value={form.designation} onChange={(e) => update('designation', e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Email" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} error={errors.email} leftIcon={<Mail size={15} />} autoComplete="email" />
                <Input label="Phone" required value={form.phone} onChange={(e) => update('phone', e.target.value)} error={errors.phone} leftIcon={<PhoneIcon size={15} />} autoComplete="tel" />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader icon={Receipt} tone="warning" title="Billing details" />
            <PanelBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Billing email" type="email" hint="Invoices are sent here." value={form.billingEmail} onChange={(e) => update('billingEmail', e.target.value)} error={errors.billingEmail} />
              <Input label="GSTIN" placeholder="27AABCT1234F1Z5" value={form.gstin} onChange={(e) => update('gstin', e.target.value.toUpperCase())} error={errors.gstin} maxLength={15} />
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader icon={Bell} tone="info" title="Email notifications" />
            <PanelBody className="space-y-4">
              <Switch label="Invoices and payments" description="New invoices, due reminders and payment receipts" checked={prefs.invoices} onChange={(e) => setPrefs((p) => ({ ...p, invoices: e.target.checked }))} />
              <Switch label="Support tickets" description="Replies and status changes on your tickets" checked={prefs.tickets} onChange={(e) => setPrefs((p) => ({ ...p, tickets: e.target.checked }))} />
              <Switch label="Project updates" description="Milestones completed and status reports" checked={prefs.projects} onChange={(e) => setPrefs((p) => ({ ...p, projects: e.target.checked }))} />
              <Switch label="Meeting reminders" description="A reminder the day before each meeting" checked={prefs.meetings} onChange={(e) => setPrefs((p) => ({ ...p, meetings: e.target.checked }))} />
            </PanelBody>
          </Panel>

          <div className="flex justify-end">
            <Button type="submit" isLoading={isSaving} leftIcon={<Save size={15} />}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <PasswordChangeCard email={user.email} />
    </div>
  )
}

export default function ClientProfilePage() {
  const { isLoading, isError, retry } = usePortalLoad({ delay: 500 })
  const { user, client } = useClientData()

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your contact details, billing information and notification preferences."
        breadcrumbItems={[{ label: 'Profile' }]}
        homeHref="/client/dashboard"
      />
      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<SkeletonProfile />}>
        {user && client ? (
          <ProfileForm user={user} client={client} />
        ) : (
          <Panel>
            <EmptyState icon={Building2} title="No company profile linked" description="Your account isn't linked to a client record yet. Contact your account manager." />
          </Panel>
        )}
      </AsyncState>
    </div>
  )
}
