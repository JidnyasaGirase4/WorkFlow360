import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, LogIn, AlertCircle, Crown, Briefcase, UserSquare2, Building2 } from 'lucide-react'
import Input from '../../components/common/Input'
import Checkbox from '../../components/common/Checkbox'
import Button from '../../components/common/Button'
import PasswordInput from '../../components/public/PasswordInput'
import AuthHeading from '../../components/public/AuthHeading'
import { useForm } from '../../components/public/useForm'
import { emailError, loginRedirect } from '../../components/public/validators'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { users } from '../../mockData/users'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

const REMEMBER_KEY = 'wf360-remember-email'

// Quick-fill accounts, pulled from the mock user list.
const DEMO_ROLES = [
  { role: 'company_admin', label: 'Admin', icon: Crown, chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300', active: 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-500/20 dark:bg-brand-500/10' },
  { role: 'manager', label: 'Manager', icon: Briefcase, chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300', active: 'border-accent-500 bg-accent-50/70 ring-2 ring-accent-500/20 dark:bg-accent-500/10' },
  { role: 'employee', label: 'Employee', icon: UserSquare2, chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300', active: 'border-warning-500 bg-warning-50/70 ring-2 ring-warning-500/20 dark:bg-warning-500/10' },
  { role: 'client', label: 'Client', icon: Building2, chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300', active: 'border-info-500 bg-info-50/70 ring-2 ring-info-500/20 dark:bg-info-500/10' },
]
const DEMO_ACCOUNTS = DEMO_ROLES.map((r) => ({ ...r, user: users.find((u) => u.role === r.role) })).filter((a) => a.user)

function readRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) || ''
  } catch {
    return ''
  }
}

function validate(values) {
  const errors = {}
  const email = emailError(values.email)
  if (email) errors.email = email
  if (!values.password) errors.password = 'Password is required'
  return errors
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [remembered] = useState(readRememberedEmail)
  const [remember, setRemember] = useState(true)
  const form = useForm({ email: remembered, password: '' }, validate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [activeDemo, setActiveDemo] = useState(null)

  // Already signed in: skip the form and go straight to the right dashboard.
  if (isAuthenticated && !isSubmitting) {
    return <Navigate to={loginRedirect(user?.role, location.state?.from)} replace />
  }

  function fillDemo(account) {
    form.setMany({ email: account.user.email, password: account.user.password })
    setFormError('')
    setActiveDemo(account.role)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.submit()) return
    setIsSubmitting(true)
    try {
      const loggedIn = await login({ email: form.values.email.trim(), password: form.values.password })
      try {
        if (remember) window.localStorage.setItem(REMEMBER_KEY, form.values.email.trim())
        else window.localStorage.removeItem(REMEMBER_KEY)
      } catch {
        /* storage unavailable: ignore */
      }
      toast.success(`Welcome back, ${loggedIn.name.split(' ')[0]}!`)
      navigate(loginRedirect(loggedIn.role, location.state?.from), { replace: true })
    } catch (err) {
      setFormError(err.message || 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <AuthHeading icon={LogIn} title="Welcome back" description="Log in to your WorkFlow360 workspace." />

      <div className="mt-4 rounded-2xl border border-dashed border-brand-200 bg-gradient-to-br from-brand-50/70 to-accent-50/50 p-2.5 dark:border-ink-700 dark:from-brand-500/5 dark:to-accent-500/5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Demo accounts, click to fill</p>
        <div className="grid grid-cols-2 gap-2 min-[440px]:grid-cols-4">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.role}
              type="button"
              onClick={() => fillDemo(acc)}
              aria-pressed={activeDemo === acc.role}
              title={`${acc.user.name} · ${acc.user.email}`}
              className={cn(
                'focus-ring group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-card',
                activeDemo === acc.role
                  ? cn(acc.active, 'text-ink-800 dark:text-ink-100')
                  : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
              )}
            >
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-transform group-hover:scale-110', acc.chip)}>
                <acc.icon size={13} aria-hidden="true" />
              </span>
              {acc.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {formError}
          </div>
        )}
        <Input label="Email" type="email" required autoComplete="username" placeholder="you@company.in" leftIcon={<Mail size={16} />} {...form.bind('email')} />
        <PasswordInput label="Password" required autoComplete="current-password" placeholder="Enter your password" {...form.bind('password')} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <Link to="/forgot-password" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="gradient-brand w-full justify-center hover:shadow-glow" isLoading={isSubmitting} leftIcon={<LogIn size={16} />}>
          {isSubmitting ? 'Signing in...' : 'Log In'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-500">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-400">
          Create one
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-400">Demo password for all accounts: password123</p>
    </div>
  )
}
