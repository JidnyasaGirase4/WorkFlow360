import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Search, HelpCircle, SearchX } from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import Button from '../../components/common/Button'
import Accordion from '../../components/public/Accordion'
import PageHero from '../../components/public/PageHero'
import { FAQS } from '../../components/public/siteData'
import '../../components/public/public.css'

export default function FAQ() {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const results = term ? FAQS.filter((f) => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term)) : FAQS

  return (
    <>
      <PageHero
        eyebrow="FAQ"
        icon={HelpCircle}
        title={<>Frequently asked <span className="wf-text-gradient">questions</span></>}
        description="Everything you need to know about WorkFlow360. Can't find an answer? Our team is one message away."
      >
        <div className="relative mx-auto mt-5 max-w-md">
          <label htmlFor="faq-search" className="sr-only">Search questions</label>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, e.g. invoices"
            className="focus-ring h-12 w-full rounded-2xl border border-ink-200 bg-white pl-11 pr-3 text-sm text-ink-800 shadow-card transition-all placeholder:text-ink-400 hover:border-brand-300 focus:border-brand-400 focus:shadow-glow dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
          />
        </div>
      </PageHero>

      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {results.length > 0 ? (
          // Re-mount on search so the open item resets cleanly.
          <Accordion key={term} items={results} defaultOpen={term ? null : 0} />
        ) : (
          <div className="rounded-3xl border border-dashed border-ink-200 bg-white p-8 text-center dark:border-ink-800 dark:bg-ink-900 sm:p-10" role="status">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50 text-accent-500 dark:bg-accent-500/15">
              <SearchX size={26} />
            </span>
            <p className="mt-4 font-semibold text-ink-800 dark:text-ink-100">No questions match &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-sm text-ink-500">Try a different keyword, or ask us directly.</p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10">
        <Reveal className="gradient-soft relative overflow-hidden rounded-3xl border border-brand-100 p-6 text-center shadow-card dark:border-ink-800 sm:p-8">
          <div className="wf-drift-slow pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent-200/50 blur-2xl dark:bg-accent-500/10" aria-hidden="true" />
          <span className="gradient-brand relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-glow">
            <MessageCircle size={22} />
          </span>
          <h2 className="relative mt-4 text-xl font-bold text-ink-900 dark:text-white">Still have questions?</h2>
          <p className="relative mx-auto mt-1.5 max-w-md text-sm text-ink-500">Our team usually replies within one business day. We are happy to walk you through a live demo, too.</p>
          <div className="relative mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Button as={Link} to="/contact" className="gradient-brand justify-center hover:shadow-glow">Contact Us</Button>
            <Button as={Link} to="/register" variant="secondary" className="justify-center">Start Free</Button>
          </div>
        </Reveal>
      </section>
    </>
  )
}
