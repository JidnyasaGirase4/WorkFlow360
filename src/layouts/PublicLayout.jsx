import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sparkles, ChevronRight, X } from 'lucide-react'
import PublicHeader from './PublicHeader'
import PublicFooter from './PublicFooter'
import '../components/public/public.css'

function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="wf-gradient-animate relative bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 px-10 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <p className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
        <Sparkles size={14} className="shrink-0" aria-hidden="true" />
        <span>Introducing automated invoice reminders, now live on every plan.</span>
        <Link to="/features" className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2 hover:no-underline">
          Learn more <ChevronRight size={12} />
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="focus-ring absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
        aria-label="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// Scroll to the top on navigation, or to the #anchor when the URL has one.
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    // Pages are lazy-loaded, so the anchor may appear a moment after navigation.
    let attempts = 0
    let timer
    function tryScroll() {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ block: 'start' })
      } else if (attempts++ < 15) {
        timer = setTimeout(tryScroll, 100)
      }
    }
    tryScroll()
    return () => clearTimeout(timer)
  }, [pathname, hash])
}

export default function PublicLayout() {
  const { pathname } = useLocation()
  useScrollOnNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-ink-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      {pathname === '/' && <AnnouncementBar />}
      <PublicHeader />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
