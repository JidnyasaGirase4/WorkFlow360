import { CheckCircle2, FileText, Download, Clock, MessageSquare, Paperclip, CalendarCheck2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { tint } from './tints'

// Illustrative product mock-ups (static, decorative) for the marketing sections.

const CARD = 'rounded-xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900'

function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    success: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
    warning: 'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300',
    danger: 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
    info: 'bg-info-100 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', tones[tone])}>{children}</span>
}

function Initials({ name, className }) {
  return (
    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold', tint(name.length).chip, className)}>
      {name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
    </span>
  )
}

function Crm() {
  const columns = [
    { title: 'New', tone: 'info', bg: 'bg-info-50/70 dark:bg-info-500/5', leads: [{ n: 'Nimbus Freight', v: '₹4.5L' }, { n: 'Orbit Analytics', v: '₹8.0L' }] },
    { title: 'Qualified', tone: 'brand', bg: 'bg-brand-50/70 dark:bg-brand-500/5', leads: [{ n: 'Zenith Financial', v: '₹12L' }, { n: 'Kaveri Textiles', v: '₹6.2L' }] },
    { title: 'Proposal', tone: 'warning', bg: 'bg-warning-50/70 dark:bg-warning-500/5', leads: [{ n: 'Meridian Retail', v: '₹9.5L' }] },
  ]
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {columns.map((col) => (
        <div key={col.title} className={cn('rounded-lg p-2', col.bg)}>
          <div className="mb-2 flex items-center justify-between">
            <Pill tone={col.tone}>{col.title}</Pill>
            <span className="text-[10px] font-semibold text-ink-400">{col.leads.length}</span>
          </div>
          <div className="space-y-2">
            {col.leads.map((l) => (
              <div key={l.n} className={CARD}>
                <p className="truncate text-[11px] font-semibold text-ink-800 dark:text-ink-100">{l.n}</p>
                <p className="mt-0.5 text-[10px] text-ink-400">Website Referral</p>
                <p className="mt-1.5 text-xs font-bold text-brand-600 dark:text-brand-400">{l.v}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Project() {
  const cols = [
    { title: 'To Do', bg: 'bg-ink-50 dark:bg-ink-950/50', tasks: ['Wireframe review', 'API contract'] },
    { title: 'In Progress', bg: 'bg-brand-50/70 dark:bg-brand-500/5', tasks: ['Build CMS module', 'Homepage UI'] },
    { title: 'Done', bg: 'bg-success-50/70 dark:bg-success-500/5', tasks: ['Kick-off call'] },
  ]
  return (
    <div className="space-y-3">
      <div className={CARD}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-ink-800 dark:text-ink-100">Corporate Website Redesign</span>
          <span className="font-bold text-brand-600 dark:text-brand-400">68%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
        </div>
        <div className="mt-3 flex items-center justify-between">
          {['Discovery', 'Design', 'Build', 'Launch'].map((m, i) => (
            <div key={m} className="flex flex-col items-center gap-1">
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', i < 2 ? 'bg-success-500 text-white' : i === 2 ? 'bg-brand-500 text-white' : 'bg-ink-200 dark:bg-ink-700')}>
                {i < 2 && <CheckCircle2 size={10} />}
              </span>
              <span className="text-[9px] font-medium text-ink-400">{m}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {cols.map((c) => (
          <div key={c.title} className={cn('rounded-lg p-2', c.bg)}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">{c.title}</p>
            <div className="space-y-1.5">
              {c.tasks.map((t) => (
                <div key={t} className="rounded-md border border-ink-100 bg-white px-2 py-1.5 text-[10px] font-medium text-ink-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200">
                  {t}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Employee() {
  const people = [
    { n: 'Rohit Girase', r: 'Frontend Developer', s: 'Present', tone: 'success', load: 85 },
    { n: 'Sneha Joshi', r: 'UI/UX Designer', s: 'Work from home', tone: 'info', load: 62 },
    { n: 'Amit Kulkarni', r: 'Backend Developer', s: 'Present', tone: 'success', load: 92 },
    { n: 'Tanvi Deshpande', r: 'QA Engineer', s: 'On leave', tone: 'warning', load: 0 },
  ]
  return (
    <div className={cn(CARD, 'space-y-3')}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-800 dark:text-ink-100">Engineering team</p>
        <Pill tone="success">Today · 3 of 4 in</Pill>
      </div>
      {people.map((p) => (
        <div key={p.n} className="flex items-center gap-2.5">
          <Initials name={p.n} className="h-7 w-7" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold text-ink-800 dark:text-ink-100">{p.n}</p>
              <Pill tone={p.tone}>{p.s}</Pill>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div className={cn('h-full rounded-full', p.load > 88 ? 'bg-warning-500' : 'bg-brand-500')} style={{ width: `${p.load}%` }} />
              </div>
              <span className="w-14 text-right text-[10px] text-ink-400">{p.load}% load</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Billing() {
  return (
    <div className={cn(CARD, 'p-4')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-ink-800 dark:text-ink-100">INV-2026-00124</p>
          <p className="text-[10px] text-ink-400">Billed to BrightPixel Labs · Due 05 Oct 2026</p>
        </div>
        <Pill tone="success">Paid</Pill>
      </div>
      <div className="mt-3 divide-y divide-ink-100 text-[11px] dark:divide-ink-800">
        {[
          ['Website design & development', '₹1,80,000'],
          ['CMS integration', '₹45,000'],
          ['Maintenance (3 months)', '₹18,000'],
        ].map(([label, amt]) => (
          <div key={label} className="flex justify-between py-1.5 text-ink-600 dark:text-ink-300">
            <span>{label}</span>
            <span className="font-medium">{amt}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1 border-t border-dashed border-ink-200 pt-2 text-[11px] dark:border-ink-700">
        <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>₹2,43,000</span></div>
        <div className="flex justify-between text-ink-500"><span>GST (18%)</span><span>₹43,740</span></div>
        <div className="flex justify-between text-sm font-bold text-ink-900 dark:text-white"><span>Total</span><span>₹2,86,740</span></div>
      </div>
    </div>
  )
}

function Portal() {
  return (
    <div className={cn(CARD, 'space-y-3 p-4')}>
      <div className="flex items-center gap-2.5">
        <Initials name="Aditi Rao" className="h-8 w-8" />
        <div>
          <p className="text-xs font-bold text-ink-800 dark:text-ink-100">Welcome, Aditi</p>
          <p className="text-[10px] text-ink-400">BrightPixel Labs · Client portal</p>
        </div>
      </div>
      <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-500/10">
        <div className="flex justify-between text-[11px]">
          <span className="font-semibold text-ink-800 dark:text-ink-100">Website Redesign</span>
          <span className="font-bold text-brand-600 dark:text-brand-300">68%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white dark:bg-ink-800">
          <div className="h-full w-[68%] rounded-full bg-brand-500" />
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-500"><CalendarCheck2 size={10} /> Next milestone: Build sign-off, 28 Oct</p>
      </div>
      {['Design_Handoff_v3.pdf', 'Statement_of_Work.pdf'].map((f) => (
        <div key={f} className="flex items-center justify-between rounded-lg border border-ink-100 px-2.5 py-2 text-[11px] dark:border-ink-800">
          <span className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><FileText size={13} className="text-brand-500" /> {f}</span>
          <Download size={13} className="text-ink-400" />
        </div>
      ))}
    </div>
  )
}

function Support() {
  const tickets = [
    { id: 'TCK-2321', t: 'Unable to export monthly report', p: 'High', tone: 'danger', s: 'Open', c: 3 },
    { id: 'TCK-2318', t: 'Add a new user to client portal', p: 'Medium', tone: 'warning', s: 'In progress', c: 5 },
    { id: 'TCK-2309', t: 'Invoice PDF branding update', p: 'Low', tone: 'info', s: 'Resolved', c: 2 },
  ]
  return (
    <div className="space-y-2.5">
      {tickets.map((t) => (
        <div key={t.id} className={CARD}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-ink-400">{t.id}</span>
            <Pill tone={t.tone}>{t.p}</Pill>
          </div>
          <p className="mt-1 truncate text-[11px] font-semibold text-ink-800 dark:text-ink-100">{t.t}</p>
          <div className="mt-2 flex items-center justify-between text-[10px] text-ink-400">
            <span className="flex items-center gap-1"><Clock size={10} /> {t.s}</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1"><MessageSquare size={10} /> {t.c}</span>
              <span className="flex items-center gap-1"><Paperclip size={10} /> 1</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

const VISUALS = { crm: Crm, project: Project, employee: Employee, billing: Billing, portal: Portal, support: Support }

const FRAMES = [
  'from-brand-50/90 via-white to-accent-50/60',
  'from-accent-50/90 via-white to-warning-50/70',
  'from-info-50/90 via-white to-accent-50/60',
  'from-warning-50/90 via-white to-brand-50/60',
  'from-success-50/90 via-white to-brand-50/60',
  'from-accent-50/80 via-white to-info-50/70',
]

export default function ModuleVisual({ kind, className, toneIndex = 0 }) {
  const Visual = VISUALS[kind]
  if (!Visual) return null
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-100 bg-gradient-to-br shadow-panel dark:border-ink-800 dark:from-ink-900 dark:via-ink-900 dark:to-ink-950',
        FRAMES[toneIndex % FRAMES.length],
        className
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-1.5 border-b border-ink-100/80 bg-white/70 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-900/60">
        <span className="h-2 w-2 rounded-full bg-danger-300" />
        <span className="h-2 w-2 rounded-full bg-warning-300" />
        <span className="h-2 w-2 rounded-full bg-success-300" />
      </div>
      <div className="p-4 sm:p-5">
        <Visual />
      </div>
    </div>
  )
}
