import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone, ArrowUpRight, Heart, Layers, Building2, ShieldCheck } from 'lucide-react'
import Logo from '../components/common/Logo'
import { LinkedInIcon, XIcon, YouTubeIcon } from '../components/public/SocialIcons'
import { cn } from '../utils/cn'

const COLUMNS = [
  {
    title: 'Product',
    icon: Layers,
    chip: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
    dot: 'bg-brand-400',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Solutions', href: '/solutions' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Security', href: '/features#security' },
    ],
  },
  {
    title: 'Company',
    icon: Building2,
    chip: 'bg-accent-100 text-accent-700 dark:bg-accent-500/20 dark:text-accent-300',
    dot: 'bg-accent-400',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    title: 'Account & Legal',
    icon: ShieldCheck,
    chip: 'bg-info-100 text-info-600 dark:bg-info-500/20 dark:text-info-300',
    dot: 'bg-info-400',
    links: [
      { label: 'Login', href: '/login' },
      { label: 'Create Account', href: '/register' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
    ],
  },
]

const SOCIALS = [
  { label: 'WorkFlow360 on LinkedIn', href: 'https://www.linkedin.com', icon: LinkedInIcon, tone: 'border-brand-500 bg-brand-500 hover:border-brand-600 hover:bg-brand-600' },
  { label: 'WorkFlow360 on X', href: 'https://x.com', icon: XIcon, tone: 'border-accent-500 bg-accent-500 hover:border-accent-600 hover:bg-accent-600' },
  { label: 'WorkFlow360 on YouTube', href: 'https://www.youtube.com', icon: YouTubeIcon, tone: 'border-warning-500 bg-warning-500 hover:border-warning-600 hover:bg-warning-600' },
]

const CONTACTS = [
  { icon: Mail, label: 'Email us', text: 'hello@workflow360.app', href: 'mailto:hello@workflow360.app', chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
  { icon: Phone, label: 'Call us', text: '+91 98765 43210', href: 'tel:+919876543210', chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' },
  { icon: MapPin, label: 'Visit us', text: 'Pune, Maharashtra, India', chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300' },
]

export default function PublicFooter() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-white via-brand-50/40 to-accent-50/40 dark:from-ink-950 dark:via-ink-950 dark:to-ink-950">
      {/* colourful top edge + soft background glows */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-accent-400 to-warning-400" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-accent-200/40 blur-3xl dark:bg-accent-500/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-10 sm:px-6 lg:px-8 lg:pt-12">
        {/* Contact cards */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {CONTACTS.map(({ icon: Icon, label, text, href, chip }) => {
            const body = (
              <>
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110', chip)}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</span>
                  <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{text}</span>
                </span>
              </>
            )
            const cls = 'group flex items-center gap-3 rounded-2xl border border-ink-100 bg-white/90 p-3.5 shadow-card transition-all duration-200 dark:border-ink-800 dark:bg-ink-900/70'
            return (
              <li key={text}>
                {href ? (
                  <a href={href} className={cn(cls, 'focus-ring hover:-translate-y-0.5 hover:shadow-card-hover')}>
                    {body}
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>

        {/* Brand + link columns */}
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-[1.35fr_repeat(3,1fr)] lg:gap-x-8">
          <div className="col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              One workspace to run CRM, projects, people and billing, built for service companies that want to move faster.
            </p>
            <div className="mt-4 flex items-center gap-2">
              {SOCIALS.map(({ label, href, icon: Icon, tone }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'focus-ring flex h-10 w-10 items-center justify-center rounded-xl border text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow',
                    tone
                  )}
                  aria-label={label}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="min-w-0">
              <h2 className="flex items-center gap-2.5 text-sm font-bold text-ink-800 dark:text-ink-100">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', col.chip)}>
                  <col.icon size={16} aria-hidden="true" />
                </span>
                {col.title}
              </h2>
              <ul className="mt-3 space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="focus-ring group -mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-500 transition-all duration-200 hover:bg-white hover:text-brand-700 hover:shadow-card dark:hover:bg-ink-900 dark:hover:text-brand-300"
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full opacity-60 transition-transform duration-200 group-hover:scale-150 group-hover:opacity-100', col.dot)} aria-hidden="true" />
                      <span className="min-w-0 flex-1">{link.label}</span>
                      <ArrowUpRight size={13} className="shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-ink-100 pt-5 text-center text-xs text-ink-500 dark:border-ink-800 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} WorkFlow360. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-ink-100 bg-white/90 px-3 py-1.5 font-medium shadow-card dark:border-ink-800 dark:bg-ink-900/70">
            Made in India for service companies, agencies &amp; growing teams
            <Heart size={12} className="shrink-0 fill-accent-500 text-accent-500" aria-hidden="true" />
          </p>
        </div>
      </div>
    </footer>
  )
}
