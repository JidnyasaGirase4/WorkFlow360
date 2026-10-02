import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import PasswordInput from '../../components/public/PasswordInput'
import PasswordStrength from '../../components/public/PasswordStrength'
import AuthHeading from '../../components/public/AuthHeading'
import { useForm } from '../../components/public/useForm'
import { newPasswordError } from '../../components/public/validators'
import { authService } from '../../services/authService'
import '../../components/public/public.css'

function validate(values) {
  const errors = {}
  const password = newPasswordError(values.password)
  if (password) errors.password = password
  if (!values.confirmPassword) errors.confirmPassword = 'Please confirm your new password'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

export default function ResetPassword() {
  const [params] = useSearchParams()
  const form = useForm({ password: '', confirmPassword: '' }, validate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!form.submit()) return
    setIsSubmitting(true)
    try {
      await authService.resetPassword({ token: params.get('token'), password: form.values.password, confirmPassword: form.values.confirmPassword })
      setDone(true)
    } catch (err) {
      setFormError(err.message || 'This reset link is invalid or has expired. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <span className="wf-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
          <CheckCircle2 size={30} />
        </span>
        <h1 className="mt-5 text-xl font-bold text-ink-900 dark:text-white">Password updated</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-500">Your password has been reset successfully. You can now log in with your new password.</p>
        <Button as={Link} to="/login" size="lg" className="mt-6 w-full justify-center">
          Continue to login
        </Button>
      </div>
    )
  }

  return (
    <div>
      <AuthHeading icon={KeyRound} title="Set a new password" description="Choose a strong password you haven't used before." />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {formError}
          </div>
        )}
        <div>
          <PasswordInput label="New Password" required autoComplete="new-password" placeholder="Create a strong password" {...form.bind('password')} />
          <PasswordStrength password={form.values.password} />
        </div>
        <PasswordInput label="Confirm New Password" required autoComplete="new-password" placeholder="Re-enter your new password" {...form.bind('confirmPassword')} />
        <Button type="submit" size="lg" className="gradient-brand w-full justify-center hover:shadow-glow" isLoading={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Reset Password'}
        </Button>
      </form>
      <Link to="/login" className="focus-ring mt-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  )
}
