import { useState } from 'react'
import { Lock, Monitor, Smartphone, LogOut, ShieldCheck, QrCode, KeyRound, Fingerprint, Laptop } from 'lucide-react'
import Card, { CardBody, CardHeader, CardTitle } from '../common/Card'
import Input from '../common/Input'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Switch from '../common/Switch'
import ConfirmDialog from '../common/ConfirmDialog'
import { cn } from '../../utils/cn'
import PasswordStrength from './PasswordStrength'
import { settingsService } from '../../services/settingsService'
import { useToast } from '../../context/ToastContext'
import { PASSWORD_RULES } from '../../utils/password'
import { timeAgo } from '../../utils/format'

const EMPTY = { current: '', next: '', confirm: '' }

const CHIP_TINT = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
}

function IconChip({ icon: Icon, tint }) {
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', CHIP_TINT[tint])}>
      <Icon size={16} />
    </span>
  )
}

// Password change (with strength meter), 2FA placeholder and active sessions.
export default function SecuritySettings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PasswordCard />
      <TwoFactorCard />
      <SessionsCard />
    </div>
  )
}

function PasswordCard() {
  const { toast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.current) e.current = 'Enter your current password'
    if (!form.next) e.next = 'Enter a new password'
    else if (form.next.length < 8) e.next = 'Password must be at least 8 characters'
    else if (PASSWORD_RULES.filter((r) => r.test(form.next)).length < 3) e.next = 'Use upper and lower case letters plus a number or symbol'
    else if (form.next === form.current) e.next = 'New password must be different from the current one'
    if (!form.confirm) e.confirm = 'Confirm your new password'
    else if (form.confirm !== form.next) e.confirm = 'Passwords do not match'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    await settingsService.changePassword()
    setSaving(false)
    setForm(EMPTY)
    toast.success('Password updated. Other devices will be asked to sign in again.')
  }

  return (
    <Card className="animate-slide-up rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={KeyRound} tint="brand" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
          <Input label="Current password" type="password" autoComplete="current-password" required leftIcon={<Lock size={14} />} value={form.current} error={errors.current} disabled={saving} onChange={(e) => update('current', e.target.value)} />
          <div>
            <Input label="New password" type="password" autoComplete="new-password" required leftIcon={<Lock size={14} />} value={form.next} error={errors.next} disabled={saving} onChange={(e) => update('next', e.target.value)} />
            <PasswordStrength password={form.next} />
          </div>
          <Input label="Confirm new password" type="password" autoComplete="new-password" required leftIcon={<Lock size={14} />} value={form.confirm} error={errors.confirm} disabled={saving} onChange={(e) => update('confirm', e.target.value)} />
          <Button type="submit" isLoading={saving} className="w-full sm:w-auto">
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

function TwoFactorCard() {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(() => settingsService.getTwoFactor())
  const [pending, setPending] = useState(false)

  async function handleChange(e) {
    const next = e.target.checked
    setPending(true)
    await settingsService.setTwoFactor(next)
    setEnabled(next)
    setPending(false)
    toast.info(next ? 'Two-factor authentication turned on (preview only)' : 'Two-factor authentication turned off')
  }

  return (
    <Card className="animate-slide-up rounded-2xl" style={{ animationDelay: '60ms' }}>
      <CardHeader className="flex-wrap">
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={Fingerprint} tint="accent" />
          Two-factor authentication
        </CardTitle>
        <Badge tone={enabled ? 'success' : 'neutral'} dot>
          {enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <Switch
          checked={enabled}
          disabled={pending}
          onChange={handleChange}
          label="Require a verification code at sign-in"
          description="Add an extra layer of security with an authenticator app. This is a preview and does not change your real sign-in."
        />
        {enabled && (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 dark:bg-ink-900 dark:text-brand-300">
              <QrCode size={20} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Authenticator app setup</p>
              <p className="mt-0.5 text-xs text-ink-500">QR code enrolment and backup codes will appear here once the security service is connected.</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function SessionsCard() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState(() => settingsService.getSessions())
  const [target, setTarget] = useState(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [busy, setBusy] = useState(false)
  const others = sessions.filter((s) => !s.current)

  async function signOut() {
    setBusy(true)
    setSessions(await settingsService.signOutSession(target.id))
    setBusy(false)
    toast.success(`Signed out of ${target.device}`)
    setTarget(null)
  }

  async function signOutOthers() {
    setBusy(true)
    setSessions(await settingsService.signOutOthers())
    setBusy(false)
    setConfirmOthers(false)
    toast.success('Signed out of all other sessions')
  }

  return (
    <Card className="animate-slide-up rounded-2xl" style={{ animationDelay: '120ms' }}>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2.5">
            <IconChip icon={Laptop} tint="info" />
            Active sessions
          </CardTitle>
          <p className="mt-1 text-xs text-ink-500">Devices currently signed in to your account.</p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<LogOut size={14} />} disabled={others.length === 0} onClick={() => setConfirmOthers(true)}>
          <span className="hidden sm:inline">Sign out all others</span>
          <span className="sm:hidden">Sign out others</span>
        </Button>
      </CardHeader>
      <CardBody>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {sessions.map((s) => {
            const Icon = s.type === 'mobile' ? Smartphone : Monitor
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.current ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300')}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800 dark:text-ink-100">
                    {s.device} <span className="font-normal text-ink-400">- {s.browser}</span>
                    {s.current && (
                      <Badge tone="success" dot>
                        This device
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-400">
                    {s.location} - {s.ip} - {s.current ? 'Active now' : `Last active ${timeAgo(s.lastActive)}`}
                  </p>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" onClick={() => setTarget(s)} aria-label={`Sign out ${s.device}`}>
                    Sign out
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
        {others.length === 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-xs text-success-700 dark:bg-success-500/10 dark:text-success-300">
            <ShieldCheck size={14} /> This is the only device signed in to your account.
          </p>
        )}
      </CardBody>

      <ConfirmDialog
        isOpen={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={signOut}
        isLoading={busy}
        title="Sign out this session?"
        description={target ? `${target.device} (${target.location}) will need to sign in again.` : ''}
        confirmLabel="Sign out"
      />
      <ConfirmDialog
        isOpen={confirmOthers}
        onClose={() => setConfirmOthers(false)}
        onConfirm={signOutOthers}
        isLoading={busy}
        title="Sign out of all other sessions?"
        description={`${others.length} other device${others.length === 1 ? '' : 's'} will be signed out. This device stays signed in.`}
        confirmLabel="Sign out all"
      />
    </Card>
  )
}
