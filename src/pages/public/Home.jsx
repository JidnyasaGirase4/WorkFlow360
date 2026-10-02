import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Users,
  Briefcase,
  Receipt,
  LifeBuoy,
  UserSquare2,
  ShieldCheck,
  Sparkles,
  Star,
  Lock,
  KeyRound,
  ScrollText,
  Eye,
  Building,
  CheckCircle2,
  Quote,
  Rocket,
} from 'lucide-react'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Reveal from '../../components/common/Reveal'
import DashboardPreview from '../../components/business/DashboardPreview'
import Accordion from '../../components/public/Accordion'
import CountUp from '../../components/public/CountUp'
import SectionHeading from '../../components/public/SectionHeading'
import TrustedMarquee from '../../components/public/TrustedMarquee'
import ModuleSection from '../../components/public/ModuleSection'
import WorkflowVisualization from '../../components/public/WorkflowVisualization'
import IntegrationsSection from '../../components/public/IntegrationsSection'
import { BillingToggle, PlanGrid } from '../../components/public/PlanCards'
import CtaBand from '../../components/public/CtaBand'
import { FAQS, TESTIMONIALS } from '../../components/public/siteData'
import { tint } from '../../components/public/tints'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

const STATS = [
  { label: 'Businesses onboarded', target: 1200, suffix: '+', icon: Building },
  { label: 'Projects delivered', target: 8400, suffix: '+', icon: Briefcase },
  { label: 'Invoices processed monthly', target: 42000, suffix: '+', icon: Receipt },
  { label: 'Average uptime', target: 99.9, suffix: '%', decimals: 1, icon: ShieldCheck },
]

const STAT_GRADIENTS = ['from-brand-400 to-brand-600', 'from-accent-400 to-accent-600', 'from-warning-300 to-warning-500', 'from-info-400 to-info-600']

const CORE_FEATURES = [
  { icon: Users, title: 'CRM & Leads', desc: 'Track leads from first touch to closed deal with a visual pipeline and follow-up reminders.', href: '#crm' },
  { icon: Briefcase, title: 'Project Management', desc: 'Plan milestones, assign tasks and track budget and progress in real time.', href: '#projects' },
  { icon: UserSquare2, title: 'Employee Management', desc: 'Manage attendance, leave, departments and workloads in one place.', href: '#employees' },
  { icon: Receipt, title: 'Billing & Invoicing', desc: 'Create quotations, send GST-ready invoices and reconcile payments effortlessly.', href: '#billing' },
  { icon: ShieldCheck, title: 'Client Portal', desc: 'Give clients a branded space to track projects, files and invoices themselves.', href: '#portal' },
  { icon: LifeBuoy, title: 'Support Desk', desc: 'Resolve client issues with a structured, trackable ticketing system.', href: '#support' },
]

const MODULES = [
  {
    id: 'crm',
    icon: Users,
    eyebrow: 'CRM',
    kind: 'crm',
    title: 'Turn enquiries into long-term clients',
    description: 'Capture every lead in one pipeline, see exactly where each deal stands and never miss a follow-up again.',
    points: ['Kanban-style pipeline from New to Won', 'Lead source, owner and deal value tracking', 'Convert a won lead into a client in one click', 'Full activity and conversation history per contact'],
  },
  {
    id: 'projects',
    icon: Briefcase,
    eyebrow: 'Project management',
    kind: 'project',
    title: 'Deliver projects on time and on budget',
    description: 'Milestones, boards and budgets live together, so managers always know what is on track and what needs attention.',
    points: ['Milestones and Kanban task boards', 'Budget versus spend tracking per project', 'Shared files, comments and activity logs', 'Deadline and workload alerts for managers'],
  },
  {
    id: 'employees',
    icon: UserSquare2,
    eyebrow: 'Employee management',
    kind: 'employee',
    title: 'Know who is available and who is overloaded',
    description: 'A single people directory with attendance, leave and workload, so assignments are fair and realistic.',
    points: ['Departments, designations and reporting lines', 'Attendance and leave approval workflows', 'Live workload view across active projects', 'Role-based access for every team member'],
  },
  {
    id: 'billing',
    icon: Receipt,
    eyebrow: 'Billing',
    kind: 'billing',
    title: 'Get paid faster with GST-ready invoicing',
    description: 'Move from quotation to invoice to payment without leaving the project, with the taxes worked out for you.',
    points: ['Quotations that convert to invoices in a click', 'Automatic GST, discount and total calculation', 'Payment status, partial payments and reminders', 'Expense tracking against every project'],
  },
  {
    id: 'portal',
    icon: ShieldCheck,
    eyebrow: 'Client portal',
    kind: 'portal',
    title: 'Give clients the transparency they ask for',
    description: 'Clients log in to their own portal to follow progress, download documents and settle invoices, so status calls drop sharply.',
    points: ['Real-time project progress and milestones', 'Secure document sharing and downloads', 'Invoice history and payment status', 'Direct access to raise support tickets'],
  },
  {
    id: 'support',
    icon: LifeBuoy,
    eyebrow: 'Support desk',
    kind: 'support',
    title: 'Resolve issues without losing context',
    description: 'Every client request becomes a ticket with an owner, a priority and a full conversation history.',
    points: ['Priority levels and response targets', 'Threaded conversations with attachments', 'Assignment and escalation to the right person', 'Ticket activity timeline for audits'],
  },
]

const SECURITY_POINTS = [
  { icon: KeyRound, label: 'Token-based sessions', desc: 'Sessions expire and can be revoked.' },
  { icon: ShieldCheck, label: 'Role-based access', desc: 'Admin, manager, employee and client views.' },
  { icon: Eye, label: 'Client data isolation', desc: 'Clients only ever see their own records.' },
  { icon: ScrollText, label: 'Activity audit trail', desc: 'Who did what, and when.' },
]

export default function Home() {
  const [yearly, setYearly] = useState(true)

  return (
    <>
      {/* Hero */}
      <section className="gradient-soft relative overflow-hidden">
        <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="wf-drift pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-300/40 blur-3xl dark:bg-brand-500/15" aria-hidden="true" />
        <div className="wf-drift-slow pointer-events-none absolute -right-16 top-32 h-80 w-80 rounded-full bg-accent-300/40 blur-3xl dark:bg-accent-500/15" aria-hidden="true" />
        <div className="wf-float pointer-events-none absolute bottom-10 left-1/3 hidden h-40 w-40 rounded-full bg-warning-200/40 blur-3xl dark:bg-warning-500/10 lg:block" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:px-8 lg:pb-8 lg:pt-8">
          <div className="min-w-0">
            <Reveal>
              <Badge tone="brand" className="mb-5 border border-brand-200/70 bg-white/80 shadow-card backdrop-blur-sm dark:border-brand-500/30 dark:bg-ink-900/60">
                <Sparkles size={12} className="text-accent-500" /> Built for service &amp; IT companies
              </Badge>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 dark:text-white min-[400px]:text-[2.6rem] sm:text-5xl lg:text-6xl">
                One Workspace for Your{' '}
                <span className="wf-text-gradient">Entire Business</span>
              </h1>
            </Reveal>
            <Reveal delay={150}>
              <p className="mt-3 max-w-lg text-base leading-relaxed text-ink-500 dark:text-ink-400 sm:text-lg">
                Manage clients, projects, employees, tasks, billing and support from one powerful workspace.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  as={Link}
                  to="/register"
                  size="lg"
                  rightIcon={<ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}
                  className="gradient-brand group justify-center px-6 shadow-glow hover:-translate-y-0.5 hover:shadow-panel"
                >
                  Start Free
                </Button>
                <Button
                  as={Link}
                  to="/features"
                  variant="secondary"
                  size="lg"
                  className="justify-center border-2 border-brand-200 bg-white/80 px-6 text-brand-700 backdrop-blur-sm hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-500/40 dark:bg-ink-900/60 dark:text-brand-300"
                >
                  Explore Features
                </Button>
              </div>
            </Reveal>
            <Reveal delay={280}>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-500 dark:text-ink-400 sm:text-sm">
                {['No credit card required', '14-day free trial', 'Cancel anytime'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-success-500" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <Reveal delay={200} className="min-w-0 lg:pl-4">
            <DashboardPreview />
          </Reveal>
        </div>

        <TrustedMarquee />
      </section>

      {/* Business statistics */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10" aria-label="WorkFlow360 in numbers">
        <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50 p-6 shadow-card dark:border-ink-800 dark:from-brand-500/10 dark:via-transparent dark:to-accent-500/10 sm:p-8 lg:p-10">
          <div className="wf-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
            {STATS.map((stat, idx) => (
              <Reveal key={stat.label} delay={idx * 80} className="min-w-0 text-center lg:border-r lg:border-brand-100 lg:last:border-r-0 dark:lg:border-ink-800">
                <span className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-glow', STAT_GRADIENTS[idx % STAT_GRADIENTS.length])}>
                  <stat.icon size={22} />
                </span>
                <p className="wf-text-gradient mt-3 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                  <CountUp target={stat.target} suffix={stat.suffix} decimals={stat.decimals} />
                </p>
                <p className="mt-1.5 text-xs text-ink-500 sm:text-sm">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Core features */}
      <section className="bg-ink-50/60 py-6 dark:bg-ink-900/30 sm:py-8 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Everything in one place"
            tone="accent"
            title="Every business function, one workspace"
            description="Stop stitching together five different tools. WorkFlow360 brings your whole operation together."
          />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {CORE_FEATURES.map((f, idx) => {
              const t = tint(idx)
              return (
                <Reveal key={f.title} delay={idx * 60} className="min-w-0">
                  <Link
                    to={`/${f.href}`}
                    className="focus-ring wf-no-motion-hover group relative block h-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-6"
                  >
                    <span className={cn('absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', t.hairline)} aria-hidden="true" />
                    <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow', t.chip, t.chipHover)}>
                      <f.icon size={24} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-ink-800 dark:text-ink-100 sm:text-lg">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{f.desc}</p>
                    <span className={cn('mt-4 inline-flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2', t.text)}>
                      See how it works <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* CRM, Projects, Employees, Billing, Client portal, Support */}
      {MODULES.map((mod, idx) => (
        <ModuleSection key={mod.id} {...mod} reverse={idx % 2 === 1} muted={idx % 2 === 1} toneIndex={idx} to={`/features#${mod.id}`} />
      ))}

      {/* Dashboard preview */}
      <section className="gradient-soft relative overflow-hidden py-6 sm:py-8 lg:py-10">
        <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Dashboard"
            title="Your entire business at a glance"
            description="Revenue, projects, tasks, clients and team activity, all live on one dashboard that adapts to each role."
          />
          <Reveal delay={100} className="mt-6 sm:mt-8">
            <DashboardPreview variant="full" />
          </Reveal>
        </div>
      </section>

      {/* Workflow visualization */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <SectionHeading
          eyebrow="The complete lifecycle"
          title="From first lead to final report"
          description="One connected workflow carries every client through eleven stages, with nothing re-typed and nothing lost in hand-offs."
          className="mb-6 sm:mb-8"
        />
        <WorkflowVisualization />
      </section>

      {/* Integrations */}
      <div className="bg-ink-50/60 dark:bg-ink-900/30">
        <IntegrationsSection />
      </div>

      {/* Security */}
      <section id="security" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50/70 py-6 dark:from-brand-500/5 dark:via-transparent dark:to-accent-500/5 sm:py-8 lg:py-10">
        <div className="wf-drift-slow pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-accent-200/40 blur-3xl dark:bg-accent-500/10" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <Reveal className="min-w-0">
            <Badge tone="brand" className="mb-4">
              <Lock size={12} /> Security first
            </Badge>
            <h2 className="text-balance text-2xl font-bold tracking-tight text-ink-900 dark:text-white min-[400px]:text-3xl sm:text-4xl">Your business data, protected end to end</h2>
            <p className="mt-4 max-w-lg text-ink-500 dark:text-ink-400">
              Role-based access control, expiring sessions and a detailed audit trail keep every workspace secure,
              whether you are a 5-person agency or a 500-person company.
            </p>
            <ul className="mt-6 space-y-3">
              {['Role-based access for every module', 'Session and token expiry controls', 'Full activity audit trail', 'Client-level data isolation'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-ink-700 dark:text-ink-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-600 dark:bg-success-500/15">
                    <ShieldCheck size={14} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:gap-5">
            {SECURITY_POINTS.map((item, idx) => {
              const t = tint(idx)
              return (
                <Reveal key={item.label} delay={120 + idx * 70}>
                  <div className="wf-no-motion-hover group h-full rounded-2xl border border-white/80 bg-white/90 p-5 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900/70">
                    <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110', t.chip)}>
                      <item.icon size={22} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-ink-100">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{item.desc}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" description="Start free for 14 days. Upgrade as your team and client base grow." />
        <Reveal delay={80} className="mt-5 flex justify-center">
          <BillingToggle yearly={yearly} onChange={setYearly} />
        </Reveal>
        <div className="mt-6">
          <PlanGrid yearly={yearly} />
        </div>
        <div className="mt-5 text-center">
          <Link to="/pricing" className="focus-ring group inline-flex items-center gap-1 rounded text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Compare all plan features <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-ink-50/60 py-6 dark:bg-ink-900/30 sm:py-8 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Customer stories" tone="accent" title="Loved by delivery teams across India" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5 md:grid-cols-3 lg:gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <Reveal key={t.name} delay={idx * 80} className="min-w-0">
                <figure className="wf-no-motion-hover relative h-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-6">
                  <Quote size={56} className={cn('pointer-events-none absolute -right-2 -top-2 opacity-10', tint(idx + 1).text)} aria-hidden="true" />
                  <div className="relative flex gap-0.5 text-warning-500" role="img" aria-label="5 out of 5 stars">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
                    ))}
                  </div>
                  <blockquote className="relative mt-4 text-sm leading-relaxed text-ink-600 dark:text-ink-300">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="relative mt-5 flex items-center gap-3 border-t border-ink-100 pt-4 dark:border-ink-800">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-card', tint(idx).gradient)}>
                      {t.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{t.name}</span>
                      <span className="block truncate text-xs text-ink-400">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <Reveal delay={80} className="mt-6">
          <Accordion items={FAQS.slice(0, 5)} />
        </Reveal>
        <div className="mt-5 text-center">
          <Link to="/faq" className="focus-ring group inline-flex items-center gap-1 rounded text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
            View all FAQs <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <CtaBand
        icon={Rocket}
        title="Ready to run your business from one workspace?"
        description="Join hundreds of service companies already managing clients, projects and billing with WorkFlow360."
        primary={{ to: '/register', label: 'Start Free Trial' }}
        secondary={{ to: '/contact', label: 'Talk to Sales' }}
      />
    </>
  )
}
