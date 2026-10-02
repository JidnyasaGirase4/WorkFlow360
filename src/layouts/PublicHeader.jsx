import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Menu, X, ChevronRight, ChevronDown, HelpCircle, Mail, ShieldCheck, ScrollText, LayoutDashboard,
  Layers, Puzzle, Tag, Info, ArrowRight,
} from 'lucide-react'
import Logo from '../components/common/Logo'
import Button from '../components/common/Button'
import ThemeToggle from '../components/common/ThemeToggle'
import { useClickOutside } from '../hooks/useClickOutside'
import { useResetOnChange } from '../hooks/useResetOnChange'
import { useAuth } from '../context/AuthContext'
import { cn } from '../utils/cn'
import { dashboardForRole } from '../components/public/validators'
import '../components/public/public.css'

const NAV_LINKS = [
  { label: 'Features', href: '/features', icon: Layers },
  { label: 'Solutions', href: '/solutions', icon: Puzzle },
  { label: 'Pricing', href: '/pricing', icon: Tag },
  { label: 'About', href: '/about', icon: Info },
]

const RESOURCE_LINKS = [
  { label: 'FAQ', desc: 'Answers to common questions', href: '/faq', icon: HelpCircle },
  { label: 'Contact', desc: 'Talk to our team', href: '/contact', icon: Mail },
  { label: 'Privacy Policy', desc: 'How we handle your data', href: '/privacy', icon: ShieldCheck },
  { label: 'Terms & Conditions', desc: 'The rules of using WorkFlow360', href: '/terms', icon: ScrollText },
]

// Rotating tints for the icon chips so the menus feel colourful but coherent.
const CHIP_TINTS = [
  'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
]

const navLinkClass = ({ isActive }) =>
  cn(
    'focus-ring relative rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20'
      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white'
  )

function ResourcesMenu() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(wrapperRef, close, open)
  useResetOnChange([pathname], close)

  function onKeyDown(e) {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  const isResourceRoute = RESOURCE_LINKS.some((l) => l.href === pathname)

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onKeyDown={onKeyDown}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') setOpen(true)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') close()
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="resources-menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'focus-ring flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200',
          isResourceRoute || open
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white'
        )}
      >
        Resources
        <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div id="resources-menu" className="absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-2">
          <div className="animate-scale-in rounded-2xl border border-ink-100 bg-white p-2 shadow-panel dark:border-ink-800 dark:bg-ink-900">
            {RESOURCE_LINKS.map((link, i) => (
              <Link
                key={link.href}
                to={link.href}
                className="focus-ring group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-50/60 dark:hover:bg-ink-800"
              >
                <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110', CHIP_TINTS[i % CHIP_TINTS.length])}>
                  <link.icon size={15} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{link.label}</span>
                  <span className="block text-xs text-ink-400">{link.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PublicHeader() {
  const { pathname } = useLocation()
  const { isAuthenticated, user } = useAuth()
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 12)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const panelRef = useRef(null)

  const closeMobile = useCallback(() => setMobileOpen(false), [])
  useResetOnChange([pathname], closeMobile)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Body scroll lock, Escape to close, focus management and a light focus trap while the menu is open.
  useEffect(() => {
    if (!mobileOpen) return
    const trigger = menuButtonRef.current
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll('a[href], button:not([disabled])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    function onResize() {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      trigger?.focus()
    }
  }, [mobileOpen])

  const dashboardHref = isAuthenticated ? dashboardForRole(user?.role) : '/login'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-ink-200/70 bg-white/80 shadow-card backdrop-blur-xl dark:border-ink-800/70 dark:bg-ink-950/80'
          : 'border-b border-transparent bg-white/40 backdrop-blur-md dark:bg-ink-950/40'
      )}
    >
      <div className={cn('mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 transition-all duration-300 sm:px-6 lg:px-8', scrolled ? 'h-14' : 'h-16')}>
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.href} to={link.href} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <ResourcesMenu />
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button
              as={Link}
              to={dashboardHref}
              variant="primary"
              size="sm"
              leftIcon={<LayoutDashboard size={14} />}
              className="gradient-brand hover:-translate-y-0.5 hover:shadow-glow"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Button as={Link} to="/login" variant="ghost" size="sm">
                Login
              </Button>
              <Button as={Link} to="/register" variant="primary" size="sm" className="gradient-brand px-4 hover:-translate-y-0.5 hover:shadow-glow">
                Get Started
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-ink-300 dark:hover:bg-ink-800"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {mobileOpen &&
        createPortal(
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={closeMobile} aria-hidden="true" />
          <div
            id="mobile-nav"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="wf-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-xs flex-col overflow-y-auto bg-white p-5 shadow-panel dark:bg-ink-950 min-[480px]:max-w-sm"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-500/10" aria-hidden="true" />
            <div className="relative flex items-center justify-between">
              <Logo />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobile}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="relative mt-6 flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.map((link, i) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium transition-colors hover:bg-ink-50 dark:hover:bg-ink-800',
                      isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20' : 'text-ink-700 dark:text-ink-200'
                    )
                  }
                >
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', CHIP_TINTS[i % CHIP_TINTS.length])}>
                    <link.icon size={17} />
                  </span>
                  <span className="flex-1">{link.label}</span>
                  <ChevronRight size={16} className="text-ink-400 transition-transform group-hover:translate-x-0.5" />
                </NavLink>
              ))}
              <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-ink-400">Resources</p>
              {RESOURCE_LINKS.map((link) => (
                <NavLink
                  key={link.href}
                  to={link.href}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-ink-50 dark:hover:bg-ink-800',
                      isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-ink-600 dark:text-ink-300'
                    )
                  }
                >
                  <link.icon size={16} className="text-ink-400" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="relative mt-auto flex flex-col gap-2 border-t border-ink-100 pt-5 dark:border-ink-800">
              {isAuthenticated ? (
                <Button as={Link} to={dashboardHref} variant="primary" size="lg" className="gradient-brand w-full justify-center shadow-glow">
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/login" variant="secondary" size="lg" className="w-full justify-center">
                    Login
                  </Button>
                  <Button as={Link} to="/register" variant="primary" size="lg" className="gradient-brand w-full justify-center shadow-glow" rightIcon={<ArrowRight size={16} />}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
