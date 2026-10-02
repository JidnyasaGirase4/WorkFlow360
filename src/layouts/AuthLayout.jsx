import { Outlet, Link } from 'react-router-dom'
import { CheckCircle2, Quote, Star, Users, Receipt, ListChecks, ArrowLeft } from 'lucide-react'
import Logo from '../components/common/Logo'
import ThemeToggle from '../components/common/ThemeToggle'
import '../components/public/public.css'

const POINTS = [
  'One workspace for CRM, projects, billing and support',
  'Role-based dashboards for admins, staff and clients',
  'Built for IT companies, agencies and consultancies',
]

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
        {/* Decorative background: dots, blurred blobs and floating shapes */}
        <div className="wf-dots-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="wf-drift pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-300/50 blur-3xl" aria-hidden="true" />
        <div className="wf-drift-slow pointer-events-none absolute -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full bg-accent-400/70 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="wf-float absolute right-[12%] top-[16%] flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/15 backdrop-blur-sm">
            <Users size={20} />
          </span>
          <span className="wf-float-delay absolute right-[30%] top-[7%] h-6 w-6 rotate-12 rounded-lg bg-warning-300/80" />
          <span className="wf-float absolute bottom-[26%] right-[8%] flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/15 backdrop-blur-sm">
            <Receipt size={18} />
          </span>
          <span className="wf-float-delay absolute bottom-[10%] right-[24%] flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-white/15 backdrop-blur-sm">
            <ListChecks size={17} />
          </span>
          <span className="wf-float absolute left-[46%] top-[12%] h-3 w-3 rounded-full bg-white/70" />
        </div>

        <Logo dark className="[&_span_span]:text-accent-200!" />
        <div className="relative z-10 max-w-md">
          <h2 className="text-balance text-3xl font-bold leading-tight xl:text-4xl">Run your entire business from one workspace</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
                  <CheckCircle2 size={14} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <figure className="mt-10 rounded-2xl border border-white/25 bg-white/15 p-5 shadow-panel backdrop-blur-md">
            <div className="flex items-center justify-between">
              <Quote size={20} className="text-white/80" aria-hidden="true" />
              <div className="flex gap-0.5 text-warning-300" role="img" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
            </div>
            <blockquote className="mt-3 text-sm leading-relaxed text-white/95">
              WorkFlow360 replaced four different tools we were juggling. Our delivery team finally has one place to see everything.
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3 text-xs text-white/85">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-700">KM</span>
              <span>
                <span className="block text-sm font-semibold text-white">Karan Mehta</span>
                COO, CloudMatrix Technologies
              </span>
            </figcaption>
          </figure>
        </div>
        <p className="relative z-10 text-xs text-white/80">© {new Date().getFullYear()} WorkFlow360. All rights reserved.</p>
      </aside>

      <div className="gradient-soft relative flex min-w-0 flex-col overflow-hidden">
        <div className="wf-drift pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/10" aria-hidden="true" />
        <div className="wf-drift-slow pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent-300/30 blur-3xl dark:bg-accent-500/10" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:justify-end">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              to="/"
              className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink-200 bg-white/80 px-3 py-1.5 min-[440px]:px-3.5 text-sm font-medium text-ink-600 shadow-card backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900/70 dark:text-ink-300"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span className="sr-only min-[440px]:not-sr-only min-[440px]:whitespace-nowrap">Back to website</span>
            </Link>
          </div>
        </div>
        <main className="relative flex flex-1 items-center justify-center px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="w-full max-w-lg rounded-3xl border border-ink-100 bg-white/95 p-4 shadow-panel backdrop-blur-sm dark:border-ink-800 dark:bg-ink-900/90 min-[400px]:p-5 sm:p-6 animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
