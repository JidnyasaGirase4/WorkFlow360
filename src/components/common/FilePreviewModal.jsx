import { Download } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import Badge from './Badge'
import FileTypeIcon from './FileTypeIcon'
import { formatDate } from '../../utils/format'

// Simulated preview: shows the file card and metadata, since the demo has no
// real file storage. `onDownload` runs the mock download.
export default function FilePreviewModal({ doc, isOpen, onClose, onDownload }) {
  if (!doc) return null
  const rows = [
    ['Category', doc.category],
    ['Project', doc.project],
    ['Uploaded by', doc.uploadedBy],
    ['Uploaded on', doc.uploadedDate ? formatDate(doc.uploadedDate) : null],
    ['Size', doc.size],
  ].filter(([, value]) => value)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="File preview"
      description={doc.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button leftIcon={<Download size={15} />} onClick={() => onDownload?.(doc)}>
            Download
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-6 py-10 text-center dark:border-ink-700 dark:bg-ink-800/30">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <FileTypeIcon type={doc.type} size={30} />
        </span>
        <p className="break-all text-sm font-semibold text-ink-800 dark:text-ink-100">{doc.name}</p>
        <Badge tone="info">Demo preview</Badge>
        <p className="max-w-xs text-xs text-ink-500">
          File contents are simulated in this demo. Download saves a placeholder file with the document details.
        </p>
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium text-ink-400">{label}</dt>
            <dd className="mt-0.5 font-medium text-ink-700 dark:text-ink-200">{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  )
}
