import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ArrowUp, Mail, ListTree, Scale, CalendarDays } from 'lucide-react'
import Reveal from '../common/Reveal'
import Badge from '../common/Badge'
import { cn } from '../../utils/cn'
import '../public/public.css'

// Structured legal document with a table of contents (sticky on desktop, collapsible on mobile)
// and scroll-spy highlighting.
// sections: [{ id, title, paragraphs?: string[], list?: string[], subsections?: [{ title, paragraphs?, list? }] }]
function Block({ paragraphs = [], list = [] }) {
  return (
    <>
      {paragraphs.map((text) => (
        <p key={text} className="mt-3 text-sm leading-7 text-ink-600 dark:text-ink-300">
          {text}
        </p>
      ))}
      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((item) => (
            <li key={item} className="flex gap-3 text-sm leading-7 text-ink-600 dark:text-ink-300">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function TocLinks({ sections, activeId, onNavigate }) {
  return (
    <ol className="space-y-0.5">
      {sections.map((section, idx) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            onClick={onNavigate}
            aria-current={activeId === section.id ? 'true' : undefined}
            className={cn(
              'focus-ring flex gap-2 rounded-full px-3 py-1.5 text-sm transition-all duration-200',
              activeId === section.id
                ? 'bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20'
                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:hover:bg-ink-800 dark:hover:text-ink-100'
            )}
          >
            <span className="w-5 shrink-0 text-ink-400">{idx + 1}.</span>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  )
}

export default function LegalPage({ title, updatedAt, effectiveAt, intro, sections, related }) {
  const [activeId, setActiveId] = useState(sections[0]?.id)
  const [tocOpen, setTocOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-90px 0px -65% 0px' }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  return (
    <>
      <section className="gradient-soft relative overflow-hidden">
        <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="wf-drift pointer-events-none absolute -left-24 -top-10 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/15" aria-hidden="true" />
        <div className="wf-drift-slow pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-accent-300/30 blur-3xl dark:bg-accent-500/15" aria-hidden="true" />
        <Reveal className="relative mx-auto max-w-6xl px-4 pb-5 pt-8 sm:px-6 sm:pb-6 sm:pt-10 lg:px-8">
          <Badge tone="brand" className="mb-4">
            <Scale size={12} /> Legal
          </Badge>
          <h1 className="text-balance text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white min-[400px]:text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-4 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border border-ink-100 bg-white/80 px-3.5 py-1.5 text-xs text-ink-500 shadow-card backdrop-blur-sm dark:border-ink-800 dark:bg-ink-900/60 sm:text-sm">
            <CalendarDays size={14} className="text-brand-500" aria-hidden="true" />
            <span>
              Last updated: {updatedAt}
              {effectiveAt && <> · Effective from: {effectiveAt}</>}
            </span>
          </p>
          {intro && <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink-500 dark:text-ink-400">{intro}</p>}
        </Reveal>
      </section>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-8 pt-5 sm:px-6 sm:pb-10 lg:grid-cols-[16rem_1fr] lg:gap-10 lg:px-8">
        {/* Table of contents */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav aria-label="Table of contents" className="rounded-2xl border border-ink-100 bg-white p-2 shadow-card dark:border-ink-800 dark:bg-ink-900 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none dark:lg:bg-transparent">
            <button
              type="button"
              className="focus-ring flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 dark:text-ink-100 lg:hidden"
              aria-expanded={tocOpen}
              aria-controls="legal-toc"
              onClick={() => setTocOpen((o) => !o)}
            >
              <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><ListTree size={15} /></span> Table of contents</span>
              <ChevronDown size={16} className={cn('transition-transform duration-300', tocOpen && 'rotate-180')} />
            </button>
            <p className="hidden px-3 pb-2 text-xs font-bold uppercase tracking-wider text-ink-400 lg:block">On this page</p>
            <div id="legal-toc" className={cn('lg:block!', tocOpen ? 'block' : 'hidden')}>
              <TocLinks sections={sections} activeId={activeId} onNavigate={() => setTocOpen(false)} />
            </div>
          </nav>
        </aside>

        {/* Content */}
        <article className="min-w-0">
          <div className="space-y-12">
            {sections.map((section, idx) => (
              <section key={section.id} id={section.id} className="scroll-mt-24" aria-labelledby={`${section.id}-heading`}>
                <h2 id={`${section.id}-heading`} className="flex items-baseline gap-3 text-xl font-bold text-ink-900 dark:text-white">
                  <span className="wf-text-gradient">{String(idx + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <Block paragraphs={section.paragraphs} list={section.list} />
                {section.subsections?.map((sub) => (
                  <div key={sub.title} className="mt-5">
                    <h3 className="text-base font-semibold text-ink-800 dark:text-ink-100">{sub.title}</h3>
                    <Block paragraphs={sub.paragraphs} list={sub.list} />
                  </div>
                ))}
              </section>
            ))}
          </div>

          <div className="gradient-soft mt-8 rounded-2xl border border-brand-100 p-5 shadow-card dark:border-ink-800 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 dark:text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15"><Mail size={16} /></span> Questions about this document?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              Write to us at <a className="font-medium text-brand-600 hover:underline dark:text-brand-400" href="mailto:legal@workflow360.app">legal@workflow360.app</a> or
              use the <Link to="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-400">contact form</Link>.
              WorkFlow360 Technologies Pvt Ltd, Baner Road, Pune, Maharashtra 411045, India.
            </p>
            {related && (
              <p className="mt-3 text-sm text-ink-500">
                Also read our <Link to={related.to} className="font-medium text-brand-600 hover:underline dark:text-brand-400">{related.label}</Link>.
              </p>
            )}
          </div>

          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }) }} className="focus-ring mt-8 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-600 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300">
            <ArrowUp size={14} /> Back to top
          </a>
        </article>
      </div>
    </>
  )
}
