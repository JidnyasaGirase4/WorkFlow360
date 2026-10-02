import { Link } from 'react-router-dom'
import { Clock, Home, LogIn, ShieldCheck } from 'lucide-react'
import Button from '../../components/common/Button'
import ErrorScene from '../../components/public/ErrorScene'
import '../../components/public/public.css'

export default function SessionExpired() {
  return (
    <ErrorScene icon={Clock} tone="warning">
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">Your session has expired</h1>
      <p className="mx-auto mt-3 max-w-md text-ink-500">
        You were signed out after a period of inactivity. Log in again to pick up right where you left off.
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Button as={Link} to="/login" size="lg" leftIcon={<LogIn size={16} />} className="gradient-brand justify-center hover:-translate-y-0.5 hover:shadow-glow">
          Log in again
        </Button>
        <Button as={Link} to="/" variant="secondary" size="lg" leftIcon={<Home size={16} />} className="justify-center hover:-translate-y-0.5">
          Back to home
        </Button>
      </div>
      <p className="mx-auto mt-6 flex max-w-sm items-center justify-center gap-1.5 rounded-full bg-white/70 px-3.5 py-1.5 text-xs text-ink-500 shadow-card backdrop-blur-sm dark:bg-ink-900/60">
        <ShieldCheck size={13} className="shrink-0 text-success-500" />
        Sessions end automatically to keep your account secure.
      </p>
    </ErrorScene>
  )
}
