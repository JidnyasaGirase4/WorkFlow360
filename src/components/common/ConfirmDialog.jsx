import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" fullScreenOnMobile={false} ariaLabel={title}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className={
            danger
              ? 'flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-danger-50 to-accent-100 text-danger-500 ring-8 ring-danger-50/70 dark:from-danger-500/20 dark:to-accent-500/10 dark:ring-danger-500/10'
              : 'flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-8 ring-brand-50/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:ring-brand-500/10'
          }
        >
          <AlertTriangle size={24} />
        </span>
        <h3 className="text-lg font-bold tracking-tight text-ink-800 dark:text-ink-100">{title}</h3>
        {description && <p className="text-sm text-ink-500">{description}</p>}
        <div className="mt-2 flex w-full gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            className="flex-1"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
