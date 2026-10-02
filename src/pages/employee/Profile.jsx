import { useState } from 'react'
import { Mail, Phone as PhoneIcon, User, MapPin, Save, Plus, X, BadgeCheck, Briefcase, Sparkles } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import { TONES, ROTATION } from '../../components/portal/tones'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Textarea from '../../components/common/Textarea'
import Button from '../../components/common/Button'
import AvatarUpload from '../../components/common/AvatarUpload'
import PasswordChangeCard from '../../components/common/PasswordChangeCard'
import AsyncState from '../../components/common/AsyncState'
import { SkeletonProfile } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useStore } from '../../utils/createStore'
import { profileStore, saveProfile } from '../../utils/portalStores'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const PHONE_RE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOCATIONS = ['Pune HQ', 'Hybrid', 'Remote']
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const MAX_SKILLS = 12

function ReadOnlyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="shrink-0 text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-800 dark:text-ink-100">{value || '—'}</span>
    </div>
  )
}

function ProfileForm({ user, record }) {
  const { toast } = useToast()
  const overrides = useStore(profileStore)[user.email] || {}
  const base = {
    name: overrides.name ?? user.name ?? '',
    email: overrides.email ?? user.email ?? '',
    phone: overrides.phone ?? user.phone ?? record?.phone ?? '',
    dob: overrides.dob ?? record?.dob ?? '',
    gender: overrides.gender ?? record?.gender ?? '',
    address: overrides.address ?? record?.address ?? '',
    emergencyName: overrides.emergencyName ?? record?.emergencyContact?.name ?? '',
    emergencyPhone: overrides.emergencyPhone ?? record?.emergencyContact?.phone ?? '',
    location: overrides.location ?? record?.location ?? 'Hybrid',
    bio: overrides.bio ?? '',
  }
  const [personal, setPersonal] = useState(base)
  const [errors, setErrors] = useState({})
  const [skills, setSkills] = useState(overrides.skills ?? record?.skills ?? [])
  const [skillInput, setSkillInput] = useState('')
  const [skillError, setSkillError] = useState('')
  const [avatar, setAvatar] = useState(overrides.avatar ?? null)
  const [isSaving, setIsSaving] = useState(false)

  function update(field, value) {
    setPersonal((p) => ({ ...p, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!personal.name.trim()) next.name = 'Full name is required.'
    else if (personal.name.trim().length < 3) next.name = 'Enter your full name.'
    if (!personal.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(personal.email.trim())) next.email = 'Enter a valid email address.'
    if (!personal.phone.trim()) next.phone = 'Phone number is required.'
    else if (!PHONE_RE.test(personal.phone.trim())) next.phone = 'Enter a valid 10-digit Indian mobile number (e.g. +91 98765 43210).'
    if (personal.emergencyPhone.trim() && !PHONE_RE.test(personal.emergencyPhone.trim())) next.emergencyPhone = 'Enter a valid mobile number.'
    if (personal.dob && personal.dob > '2008-12-31') next.dob = 'Date of birth looks incorrect.'
    if (personal.bio.length > 240) next.bio = 'Keep your bio under 240 characters.'
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
      saveProfile(user.email, { ...personal, skills, avatar })
      setIsSaving(false)
      toast.success('Profile updated successfully')
    }, 500)
  }

  function addSkill() {
    const value = skillInput.trim()
    if (!value) return
    if (skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setSkillError('You already listed that skill.')
      return
    }
    if (skills.length >= MAX_SKILLS) {
      setSkillError(`You can list up to ${MAX_SKILLS} skills.`)
      return
    }
    setSkills((prev) => [...prev, value])
    setSkillInput('')
    setSkillError('')
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Panel className="overflow-hidden">
        <div className="gradient-hero relative overflow-hidden px-4 py-5 text-white sm:px-6 sm:py-6">
          <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
          <span className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-accent-400/40 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{personal.name || 'Employee'}</h2>
              <p className="mt-0.5 text-sm text-white/90">
                {record?.designation || user.designation || 'Employee'} · {record?.department || user.department || '—'}
              </p>
            </div>
            {record?.employeeCode && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold ring-1 ring-white/30">
                <BadgeCheck size={13} /> {record.employeeCode}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <AvatarUpload name={personal.name} src={avatar} onChange={setAvatar} />
          {skills.length > 0 && (
            <div className="min-w-0 lg:max-w-md lg:text-right">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500 lg:justify-end">
                <Sparkles size={13} aria-hidden="true" /> Skills
              </p>
              <div className="flex flex-wrap gap-1.5 lg:justify-end">
                {skills.slice(0, 8).map((skill, i) => (
                  <span key={skill} className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', TONES[ROTATION[i % ROTATION.length]].chip)}>
                    {skill}
                  </span>
                ))}
                {skills.length > 8 && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">+{skills.length - 8}</span>}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <form onSubmit={handleSave} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
          <Panel>
            <PanelHeader icon={User} tone="brand" title="Personal information" />
            <PanelBody className="space-y-4">
              <Input label="Full name" required value={personal.name} onChange={(e) => update('name', e.target.value)} error={errors.name} leftIcon={<User size={15} />} autoComplete="name" />
              <Input label="Email" type="email" required value={personal.email} onChange={(e) => update('email', e.target.value)} error={errors.email} leftIcon={<Mail size={15} />} autoComplete="email" />
              <Input label="Phone" required value={personal.phone} onChange={(e) => update('phone', e.target.value)} error={errors.phone} leftIcon={<PhoneIcon size={15} />} autoComplete="tel" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Date of birth" type="date" value={personal.dob} onChange={(e) => update('dob', e.target.value)} error={errors.dob} />
                <Select label="Gender" placeholder="Select" options={GENDERS.map((g) => ({ value: g, label: g }))} value={personal.gender} onChange={(e) => update('gender', e.target.value)} />
              </div>
              <Input label="Address" value={personal.address} onChange={(e) => update('address', e.target.value)} leftIcon={<MapPin size={15} />} autoComplete="street-address" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Emergency contact" value={personal.emergencyName} onChange={(e) => update('emergencyName', e.target.value)} />
                <Input label="Emergency phone" value={personal.emergencyPhone} onChange={(e) => update('emergencyPhone', e.target.value)} error={errors.emergencyPhone} />
              </div>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader icon={Briefcase} tone="accent" title="Professional information" />
            <PanelBody className="space-y-4">
              <div className="space-y-3 rounded-xl bg-gradient-to-br from-brand-50/70 to-accent-50/50 p-4 dark:from-brand-500/10 dark:to-accent-500/5">
                <ReadOnlyRow label="Designation" value={record?.designation || user.designation} />
                <ReadOnlyRow label="Department" value={record?.department || user.department} />
                <ReadOnlyRow label="Reporting manager" value={record?.manager} />
                <ReadOnlyRow label="Employment type" value={record?.employmentType} />
                <ReadOnlyRow label="Joining date" value={record?.joiningDate ? formatDate(record.joiningDate) : null} />
                <p className="text-xs text-ink-500">These fields are managed by HR. Contact HR to request changes.</p>
              </div>
              <Select label="Work location preference" options={LOCATIONS.map((l) => ({ value: l, label: l }))} value={personal.location} onChange={(e) => update('location', e.target.value)} />
              <Textarea label="About me" rows={3} placeholder="A short bio your teammates will see" value={personal.bio} onChange={(e) => update('bio', e.target.value)} error={errors.bio} hint={`${personal.bio.length}/240`} />

              <div>
                <label htmlFor="skill-input" className="text-sm font-medium text-ink-700 dark:text-ink-200">
                  Skills
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2" aria-live="polite">
                  {skills.length === 0 && <span className="text-sm text-ink-400">No skills listed yet.</span>}
                  {skills.map((skill, i) => (
                    <span key={skill} className={cn('inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1.5 text-xs font-semibold', TONES[ROTATION[i % ROTATION.length]].chip)}>
                      {skill}
                      <button type="button" onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))} aria-label={`Remove skill ${skill}`} className="focus-ring rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-start gap-2">
                  <Input
                    id="skill-input"
                    wrapperClassName="flex-1"
                    placeholder="Add a skill, e.g. TypeScript"
                    value={skillInput}
                    onChange={(e) => {
                      setSkillInput(e.target.value)
                      if (skillError) setSkillError('')
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSkill()
                      }
                    }}
                    error={skillError}
                  />
                  <Button type="button" variant="secondary" leftIcon={<Plus size={15} />} onClick={addSkill}>
                    Add
                  </Button>
                </div>
              </div>
            </PanelBody>
          </Panel>
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving} leftIcon={<Save size={15} />}>
            Save changes
          </Button>
        </div>
      </form>

      <PasswordChangeCard email={user.email} />
    </div>
  )
}

export default function EmployeeProfile() {
  const { user } = useAuth()
  const { isLoading, isError, retry } = usePortalLoad({ delay: 500 })
  const { record } = useEmployeeData()

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="View and update your personal and professional information."
        breadcrumbItems={[{ label: 'Profile' }]}
        homeHref="/employee/dashboard"
      />
      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<SkeletonProfile />}>
        {user && <ProfileForm user={user} record={record} />}
      </AsyncState>
    </div>
  )
}
