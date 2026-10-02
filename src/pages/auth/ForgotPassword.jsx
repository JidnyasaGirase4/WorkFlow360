import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Send, KeyRound } from 'lucide-react'
import Input from '../../components/common/Input'
import Button from '../../components/common/Button'
import { authService } from '../../services/authService'
import { emailError } from '../../components/public/validators'
import AuthHeading from '../../components/public/AuthHeading'
import '../../components/public/public.css'

const RESEND_SECONDS = 30

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])

  async function sendLink() {
    setFormError('')
    setIsSubmitting(true)
    try {
      await authService.forgotPassword(email.trim())
      setSent(true)
      setSecondsLeft(RESEND_SECONDS)
    } catch (err) {
      setFormError(err.message || 'We could not send the reset link. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const message = emailError(email)
    setError(message)
    if (message) return
    sendLink()
  }

  if (sent) {
    return (
      <div className="text-center" role="status">
        <span className="wf-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
          <CheckCircle2 size={30} />
        </span>
        <h1 className="mt-5 text-xl font-bold text-ink-900 dark:text-white">Check your inbox</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-500">
          If an account exists for <span className="font-medium text-ink-700 dark:text-ink-200">{email}</span>, we&apos;ve sent a password reset link. It expires in 30 minutes.
        </p>
        <Button
          variant="secondary"
          className="mt-6 w-full justify-center"
          onClick={sendLink}
          isLoading={isSubmitting}
          disabled={secondsLeft > 0}
        >
          {secondsLeft > 0 ? `Resend email in ${secondsLeft}s` : 'Resend email'}
        </Button>
        {formError && <p role="alert" className="mt-3 text-xs font-medium text-danger-600 dark:text-danger-400">{formError}</p>}
        <p className="mt-5 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-3 py-2.5 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-900">
          Demo mode: no real email is sent.{' '}
          <Link to="/reset-password" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Open the reset page</Link>
        </p>
        <Link to="/login" className="focus-ring mt-5 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    )
  }

  return (
    <div>
      <AuthHeading icon={KeyRound} title="Forgot your password?" description="No problem. Enter your email and we'll send you a reset link." />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-400">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {formError}
          </div>
        )}
        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.in"
          leftIcon={<Mail size={16} />}
          value={email}
          error={error}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError('')
          }}
        />
        <Button type="submit" size="lg" className="gradient-brand w-full justify-center hover:shadow-glow" isLoading={isSubmitting} leftIcon={<Send size={16} />}>
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>
      <Link to="/login" className="focus-ring mt-6 inline-flex items-center gap-1.5 rounded text-sm font-medium text-ink-500 hover:text-ink-800 dark:hover:text-ink-200">
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  )
}
