import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Save } from 'lucide-react'
import Card, { CardHeader, CardBody, CardTitle } from './Card'
import Input from './Input'
import Button from './Button'
import ProgressBar from './ProgressBar'
import { useToast } from '../../context/ToastContext'
import { findUserByEmail } from '../../mockData/users'

const EMPTY = { current: '', next: '', confirm: '' }

function strengthOf(pw) {
  let score = 0
  if (pw.length >= 8) score += 1
  if (pw.length >= 12) score += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw)) score += 1
  return score
}

const STRENGTH = [
  { label: 'Too weak', tone: 'danger' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warning' },
  { label: 'Good', tone: 'info' },
  { label: 'Strong', tone: 'success' },
  { label: 'Very strong', tone: 'success' },
]

// Change-password form with validation, a strength meter and (mock) verification
// of the current password against the demo user store.
export default function PasswordChangeCard({ email }) {
  const { toast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [show, setShow] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const strength = strengthOf(form.next)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const next = {}
    const account = email ? findUserByEmail(email) : null
    if (!form.current) next.current = 'Enter your current password.'
    else if (account && account.password !== form.current) next.current = 'Current password is incorrect.'
    if (!form.next) next.next = 'Enter a new password.'
    else if (form.next.length < 8) next.next = 'Use at least 8 characters.'
    else if (!/[A-Z]/.test(form.next) || !/\d/.test(form.next)) next.next = 'Include an uppercase letter and a number.'
    else if (form.next === form.current) next.next = 'New password must be different from the current one.'
    if (!form.confirm) next.confirm = 'Confirm your new password.'
    else if (form.confirm !== form.next) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setForm(EMPTY)
      toast.success('Password changed successfully')
    }, 600)
  }

  const type = show ? 'text' : 'password'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <KeyRound size={16} className="text-ink-400" aria-hidden="true" />
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Current password"
              type={type}
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => update('current', e.target.value)}
              error={errors.current}
            />
            <div>
              <Input label="New password" type={type} autoComplete="new-password" value={form.next} onChange={(e) => update('next', e.target.value)} error={errors.next} />
              {form.next && (
                <div className="mt-2">
                  <ProgressBar value={(strength / 5) * 100} size="sm" tone={STRENGTH[strength].tone} label={`Strength: ${STRENGTH[strength].label}`} />
                </div>
              )}
            </div>
            <Input label="Confirm new password" type={type} autoComplete="new-password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} error={errors.confirm} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" isLoading={isSaving} leftIcon={<Save size={15} />}>
              Update password
            </Button>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-200"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />} {show ? 'Hide' : 'Show'} passwords
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
