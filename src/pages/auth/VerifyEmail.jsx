import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailCheck, CheckCircle2, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react'
import Button from '../../components/common/Button'
import { useAuth } from '../../context/AuthContext'
import { homeForRole } from '../../components/public/validators'
import '../../components/public/public.css'

const RESEND_SECONDS = 30

// States: 'pending' (waiting for the link), 'verifying', 'verified'.
// Opening the page with ?token=... (as the emailed link would) lands directly on 'verified'.
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { isAuthenticated, user } = useAuth()
  const email = params.get('email') || user?.email || 'your email address'
  const [status, setStatus] = useState(() => (params.get('token') ? 'verified' : 'pending'))
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS)
  const [isResending, setIsResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])

  async function resend() {
    setIsResending(true)
    await new Promise((r) => setTimeout(r, 800))
    setIsResending(false)
    setResent(true)
    setSecondsLeft(RESEND_SECONDS)
  }

  async function simulateVerify() {
    setStatus('verifying')
    await new Promise((r) => setTimeout(r, 1100))
    setStatus('verified')
  }

  if (status === 'verified') {
    return (
      <div className="text-center" role="status">
        <span className="wf-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
          <CheckCircle2 size={32} />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-ink-900 dark:text-white">Email verified</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-500">Thank you! Your email address has been confirmed and your account is fully active.</p>
        <Button as={Link} to={isAuthenticated ? homeForRole(user?.role) : '/login'} size="lg" className="gradient-brand mt-6 w-full justify-center hover:shadow-glow">
          {isAuthenticated ? 'Go to my dashboard' : 'Continue to login'}
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <span className="gradient-brand mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-glow">
        <MailCheck size={28} />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink-900 dark:text-white">Verify your email</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-ink-500">
        We&apos;ve sent a verification link to <span className="font-medium text-ink-700 dark:text-ink-200">{email}</span>. Click the link in that email to activate your account.
      </p>

      <div aria-live="polite" className="min-h-5">
        {resent && secondsLeft > 0 && <p className="mt-3 text-xs font-medium text-success-600 dark:text-success-400">A new verification email is on its way.</p>}
      </div>

      <Button
        variant="secondary"
        className="mt-4 w-full justify-center"
        onClick={resend}
        isLoading={isResending}
        disabled={secondsLeft > 0}
        leftIcon={<RefreshCw size={15} />}
      >
        {secondsLeft > 0 ? `Resend email in ${secondsLeft}s` : 'Resend Verification Email'}
      </Button>

      <div className="mt-5 rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-3 py-3 text-xs text-ink-500 dark:border-ink-700 dark:bg-ink-900">
        <p>Demo mode: no real email is sent.</p>
        <button
          type="button"
          onClick={simulateVerify}
          disabled={status === 'verifying'}
          className="focus-ring mt-1.5 inline-flex items-center gap-1.5 rounded font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400"
        >
          {status === 'verifying' && <Loader2 size={13} className="animate-spin" />}
          {status === 'verifying' ? 'Verifying...' : 'Simulate clicking the email link'}
        </button>
      </div>

      <Link to="/login" className="focus-ring mt-5 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  )
}
