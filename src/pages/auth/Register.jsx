import { useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, Phone, UserPlus, Building2, UserSquare2, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import Input from '../../components/common/Input'
import Checkbox from '../../components/common/Checkbox'
import Button from '../../components/common/Button'
import PasswordInput from '../../components/public/PasswordInput'
import PasswordStrength from '../../components/public/PasswordStrength'
import AuthHeading from '../../components/public/AuthHeading'
import { useForm } from '../../components/public/useForm'
import { emailError, phoneError, newPasswordError, homeForRole } from '../../components/public/validators'
import { cn } from '../../utils/cn'
import { useAuth } from '../../context/AuthContext'
import { ROLES } from '../../mockData/users'
import '../../components/public/public.css'

const ACCOUNT_TYPES = [
  { value: ROLES.COMPANY_ADMIN, label: 'Company', icon: Building2, desc: 'Manage your team, clients & billing', chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300', active: 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/20 dark:bg-brand-500/10' },
  { value: ROLES.EMPLOYEE, label: 'Employee', icon: UserSquare2, desc: 'Join an existing company workspace', chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300', active: 'border-accent-500 bg-accent-50/70 ring-2 ring-accent-500/20 dark:bg-accent-500/10' },
  { value: ROLES.CLIENT, label: 'Client', icon: ShieldCheck, desc: 'Track your projects & invoices', chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300', active: 'border-info-500 bg-info-50/70 ring-2 ring-info-500/20 dark:bg-info-500/10' },
]

const INITIAL = { fullName: '', email: '', phone: '', company: '', password: '', confirmPassword: '' }

function validate(values, accountType, accepted) {
  const errors = {}
  if (!values.fullName.trim()) errors.fullName = 'Full name is required'
  else if (values.fullName.trim().length < 2) errors.fullName = 'Enter your full name'
  const email = emailError(values.email)
  if (email) errors.email = email
  const phone = phoneError(values.phone)
  if (phone) errors.phone = phone
  if (accountType === ROLES.COMPANY_ADMIN && !values.company.trim()) errors.company = 'Company name is required'
  const password = newPasswordError(values.password)
  if (password) errors.password = password
  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your password'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match'
  if (!accepted) errors.terms = 'You must accept the Terms & Conditions to continue'
  return errors
}

export default function Register() {
  const { register } = useAuth()
  const [accountType, setAccountType] = useState(ROLES.COMPANY_ADMIN)
  const [accepted, setAccepted] = useState(false)
  const form = useForm(INITIAL, (values) => validate(values, accountType, accepted))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [createdUser, setCreatedUser] = useState(null)

  const termsError = form.errors.terms

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.submit()) return
    setIsSubmitting(true)
    try {
      const { fullName, email, phone, company, password, confirmPassword } = form.values
      const user = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        password,
        confirmPassword,
        accountType,
      })
      setCreatedUser(user)
    } catch (err) {
      setFormError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (createdUser) {
    return (
      <div className="text-center" role="status">
        <span className="wf-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
          <CheckCircle2 size={32} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-ink-900 dark:text-white">Account created!</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
          Welcome to WorkFlow360, {createdUser.name.split(' ')[0]}. We have sent a verification link to{' '}
          <span className="font-medium text-ink-700 dark:text-ink-200">{createdUser.email}</span>. Verify your email to keep your account secure.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Button as={Link} to={`/verify-email?email=${encodeURIComponent(createdUser.email)}`} size="lg" className="w-full justify-center">
            Verify my email
          </Button>
          <Button as={Link} to={homeForRole(createdUser.role)} variant="secondary" size="lg" className="w-full justify-center" rightIcon={<ArrowRight size={16} />}>
            Continue to my dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <AuthHeading icon={UserPlus} title="Create your account" description="Start your 14-day free trial. No credit card required." />

      <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {formError}
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
            Account Type<span className="ml-0.5 text-danger-500">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
            {ACCOUNT_TYPES.map((type) => {
              const selected = accountType === type.value
              return (
                <label
                  key={type.value}
                  className={cn(
                    'group relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center transition-all hover:-translate-y-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                    selected ? type.active : 'border-ink-200 bg-white hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900'
                  )}
                >
                  <input
                    type="radio"
                    name="accountType"
                    value={type.value}
                    checked={selected}
                    onChange={() => setAccountType(type.value)}
                    className="sr-only"
                  />
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110', selected ? type.chip : 'bg-ink-100 text-ink-400 dark:bg-ink-800')}>
                    <type.icon size={15} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">{type.label}</span>
                </label>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-400" aria-live="polite">{ACCOUNT_TYPES.find((t) => t.value === accountType)?.desc}</p>
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Full Name" required autoComplete="name" placeholder="e.g. Ananya Iyer" leftIcon={<User size={16} />} {...form.bind('fullName')} />
          <Input label="Email" type="email" required autoComplete="email" placeholder="you@company.in" leftIcon={<Mail size={16} />} {...form.bind('email')} />
          <div className={accountType === ROLES.COMPANY_ADMIN ? undefined : 'sm:col-span-2'}>
            <Input label="Phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" leftIcon={<Phone size={16} />} hint="10-digit Indian mobile number" {...form.bind('phone')} />
          </div>
          {accountType === ROLES.COMPANY_ADMIN && (
            <Input label="Company Name" required autoComplete="organization" placeholder="e.g. TechNova Solutions" leftIcon={<Building2 size={16} />} {...form.bind('company')} />
          )}
          <PasswordInput label="Password" required autoComplete="new-password" placeholder="Create password" {...form.bind('password')} />
          <PasswordInput label="Confirm Password" required autoComplete="new-password" placeholder="Re-enter password" {...form.bind('confirmPassword')} />
        </div>
        <PasswordStrength password={form.values.password} />

        <div>
          <Checkbox
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked)
              if (e.target.checked && termsError) form.setErrors((prev) => ({ ...prev, terms: undefined }))
            }}
            label={
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Terms</Link> and{' '}
                <Link to="/privacy" target="_blank" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Privacy Policy</Link>
              </span>
            }
          />
          {termsError && <p className="mt-1 text-xs font-medium text-danger-600 dark:text-danger-400">{termsError}</p>}
        </div>

        <Button type="submit" size="lg" className="gradient-brand w-full justify-center hover:shadow-glow" isLoading={isSubmitting} leftIcon={<UserPlus size={16} />}>
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-500">
        Already have an account?{' '}
        <Link to="/login" className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-400">
          Log in
        </Link>
      </p>
    </div>
  )
}
