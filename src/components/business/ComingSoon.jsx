import { Construction } from 'lucide-react'
import PageHeader from './PageHeader'
import EmptyState from '../common/EmptyState'

export default function ComingSoon({ title }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="gradient-soft rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <EmptyState icon={Construction} title="This module is being finalized" description="Check back shortly — this page is part of the current build." />
      </div>
    </div>
  )
}
