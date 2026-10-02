import { Link } from 'react-router-dom'
import { Home, LayoutDashboard, Compass } from 'lucide-react'
import Button from '../../components/common/Button'
import Logo from '../../components/common/Logo'
import ThemeToggle from '../../components/common/ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { dashboardForRole } from '../../components/public/validators'
import '../../components/public/public.css'

export default function NotFound() {
  const { isAuthenticated, user } = useAuth()
  // admin -> /admin/dashboard, employee -> /employee/dashboard, client -> /client/dashboard, logged out -> /login
  const dashboardHref = isAuthenticated ? dashboardForRole(user?.role) : '/login'

  return (
    <div className="gradient-soft relative flex min-h-screen flex-col overflow-hidden">
      <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="wf-drift absolute left-[12%] top-[22%] h-40 w-40 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/15" />
        <span className="wf-drift-slow absolute right-[14%] top-[30%] h-48 w-48 rounded-full bg-accent-300/30 blur-3xl dark:bg-accent-500/15" />
        <span className="wf-float absolute bottom-[14%] left-[32%] h-32 w-32 rounded-full bg-warning-200/50 blur-3xl dark:bg-warning-500/10" />
        <span className="wf-float-delay absolute right-[24%] top-[14%] hidden h-5 w-5 rotate-12 rounded-md bg-warning-300/70 sm:block" />
        <span className="wf-float absolute bottom-[26%] right-[14%] hidden h-4 w-4 rounded-full bg-accent-400/60 sm:block" />
        <span className="wf-float-delay absolute bottom-[30%] left-[12%] hidden h-4 w-4 rotate-45 rounded-sm bg-brand-400/60 sm:block" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
        <div className="flex items-center justify-center gap-1 sm:gap-3" role="img" aria-label="Error 404">
          <span className="bg-gradient-to-b from-brand-400 to-brand-600 bg-clip-text text-7xl font-extrabold leading-none text-transparent min-[400px]:text-8xl sm:text-[10rem]" aria-hidden="true">
            4
          </span>
          <span className="wf-float relative flex h-24 w-24 items-center justify-center sm:h-40 sm:w-40" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-400 via-info-400 to-accent-400 shadow-panel" />
            <span className="absolute inset-3 rounded-full bg-white dark:bg-ink-950" />
            <Compass className="wf-wobble relative text-brand-600 dark:text-brand-300" size={52} strokeWidth={1.5} />
          </span>
          <span className="bg-gradient-to-b from-accent-400 to-accent-600 bg-clip-text text-7xl font-extrabold leading-none text-transparent min-[400px]:text-8xl sm:text-[10rem]" aria-hidden="true">
            4
          </span>
        </div>
        <h1 className="animate-slide-up mt-6 text-2xl font-bold text-ink-900 dark:text-white sm:text-3xl">Looks like this page took a wrong turn.</h1>
        <p className="animate-slide-up mx-auto mt-3 max-w-md text-ink-500" style={{ animationDelay: '80ms' }}>
          The page you are looking for does not exist, has been moved, or the link may be mistyped.
        </p>
        <div className="animate-slide-up mt-8 flex w-full max-w-sm flex-col justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row" style={{ animationDelay: '160ms' }}>
          <Button as={Link} to="/" leftIcon={<Home size={16} />} size="lg" className="gradient-brand justify-center hover:-translate-y-0.5 hover:shadow-glow">
            Go Home
          </Button>
          <Button as={Link} to={dashboardHref} variant="secondary" leftIcon={<LayoutDashboard size={16} />} size="lg" className="justify-center hover:-translate-y-0.5 hover:border-brand-300">
            Go Dashboard
          </Button>
        </div>
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-500" aria-label="Helpful links">
          {[
            ['Features', '/features'],
            ['Pricing', '/pricing'],
            ['FAQ', '/faq'],
            ['Contact', '/contact'],
          ].map(([label, to]) => (
            <Link key={to} to={to} className="focus-ring rounded hover:text-brand-600 dark:hover:text-brand-400">
              {label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
