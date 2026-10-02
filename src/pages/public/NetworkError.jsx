import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Home, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Button from '../../components/common/Button'
import ErrorScene from '../../components/public/ErrorScene'
import '../../components/public/public.css'
import { cn } from '../../utils/cn'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getSnapshot = () => navigator.onLine
const getServerSnapshot = () => true

export default function NetworkError() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return (
    <ErrorScene icon={isOnline ? Wifi : WifiOff} tone={isOnline ? 'brand' : 'info'}>
      <>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">You appear to be offline</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-500">
          We couldn't reach WorkFlow360. Check your internet connection or Wi-Fi, then try again.
        </p>

        <div
          role="status"
          aria-live="polite"
          className={cn(
            'mx-auto mt-6 inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-card transition-colors',
            isOnline
              ? 'border-success-100 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500'
              : 'border-danger-100 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-500'
          )}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                isOnline ? 'bg-success-500' : 'bg-danger-500'
              )}
            />
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', isOnline ? 'bg-success-500' : 'bg-danger-500')} />
          </span>
          {isOnline ? (
            <>
              <Wifi size={14} /> Connection restored. You're back online.
            </>
          ) : (
            <>
              <WifiOff size={14} /> No internet connection detected
            </>
          )}
        </div>

        <div className="mt-8 flex w-full max-w-sm flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          <Button onClick={() => window.location.reload()} size="lg" leftIcon={<RefreshCw size={16} />} className="gradient-brand justify-center hover:-translate-y-0.5 hover:shadow-glow">
            Try again
          </Button>
          <Button as={Link} to="/" variant="secondary" size="lg" leftIcon={<Home size={16} />} className="justify-center hover:-translate-y-0.5">
            Back to home
          </Button>
        </div>
      </>
    </ErrorScene>
  )
}
