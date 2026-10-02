import { Link } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import Button from '../../components/common/Button'
import ErrorScene from '../../components/public/ErrorScene'
import '../../components/public/public.css'

export default function AccessDenied() {
  return (
    <ErrorScene icon={ShieldAlert} tone="danger" code="Error 403">
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">403 — Access Denied</h1>
      <p className="mx-auto mt-3 max-w-sm text-ink-500">
        You don't have permission to view this page. If you think this is a mistake, contact your administrator.
      </p>
      <Button as={Link} to="/" variant="secondary" size="lg" leftIcon={<ArrowLeft size={16} />} className="mt-8 justify-center hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700">
        Back to safety
      </Button>
    </ErrorScene>
  )
}
