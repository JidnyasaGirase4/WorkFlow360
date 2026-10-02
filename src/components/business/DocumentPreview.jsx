import { Image as ImageIcon, Palette, FileArchive, File as FileIcon } from 'lucide-react'
import { fileKind, KIND_META } from '../../utils/fileKind'
import { cn } from '../../utils/cn'

function Lines({ rows = 8, className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-2 rounded-full bg-ink-200 dark:bg-ink-300" style={{ width: `${[92, 100, 84, 96, 70, 100, 88, 60, 94, 78][i % 10]}%` }} />
      ))}
    </div>
  )
}

// Type-appropriate placeholder preview (no real rendering, this is mock data).
export default function DocumentPreview({ doc }) {
  const kind = fileKind(doc.name)
  const meta = KIND_META[kind]

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-50 via-ink-50 to-accent-50 p-4 dark:from-ink-950/60 dark:via-ink-950/60 dark:to-ink-950/60 sm:p-6" role="img" aria-label={`Preview placeholder for ${doc.name} (${meta.label})`}>
      {kind === 'image' && (
        doc.previewUrl ? (
          <img src={doc.previewUrl} alt={doc.name} className="mx-auto max-h-[52vh] rounded-lg object-contain shadow-card" />
        ) : (
          <div className="mx-auto flex aspect-[4/3] max-w-md items-center justify-center rounded-lg bg-gradient-to-br from-info-200 via-brand-200 to-accent-200 shadow-card">
            <ImageIcon size={56} className="text-white/90" />
          </div>
        )
      )}

      {(kind === 'pdf' || kind === 'doc' || kind === 'slides') && (
        <div className={cn('mx-auto rounded-lg bg-white p-6 text-ink-800 shadow-card', kind === 'slides' ? 'aspect-video max-w-lg' : 'aspect-[3/4] max-w-xs')}>
          {kind === 'pdf' && <div className="mb-4 h-1.5 w-12 rounded-full bg-gradient-to-r from-danger-500 to-accent-400" aria-hidden="true" />}
          <div className="mb-4 h-3.5 w-2/3 rounded bg-brand-200" aria-hidden="true" />
          <Lines rows={kind === 'slides' ? 4 : 10} />
          {kind === 'pdf' && <p className="mt-5 text-center text-[10px] font-medium uppercase tracking-wider text-ink-400">Page 1 of {Math.max(1, Math.round((doc.sizeBytes || 100000) / 300000))}</p>}
        </div>
      )}

      {kind === 'sheet' && (
        <div className="mx-auto max-w-lg overflow-hidden rounded-lg bg-white shadow-card" aria-hidden="true">
          <div className="grid grid-cols-5 bg-success-500 text-center text-[10px] font-semibold text-white">
            {['A', 'B', 'C', 'D', 'E'].map((c) => (
              <span key={c} className="border-r border-white/30 py-1 last:border-0">{c}</span>
            ))}
          </div>
          {Array.from({ length: 9 }).map((_, r) => (
            <div key={r} className="grid grid-cols-5 border-t border-ink-100">
              {Array.from({ length: 5 }).map((__, c) => (
                <span key={c} className="border-r border-ink-100 px-2 py-2 last:border-0">
                  <span className="block h-1.5 rounded-full bg-ink-200" style={{ width: `${40 + ((r * 7 + c * 13) % 55)}%` }} />
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {kind === 'design' && (
        <div className="mx-auto flex aspect-[4/3] max-w-md items-center justify-center rounded-lg bg-gradient-to-br from-accent-100 to-brand-100 shadow-card">
          <Palette size={56} className="text-accent-500" />
        </div>
      )}

      {(kind === 'archive' || kind === 'file') && (
        <div className="mx-auto flex aspect-[4/3] max-w-xs flex-col items-center justify-center gap-2 rounded-lg bg-white shadow-card">
          {kind === 'archive' ? <FileArchive size={48} className="text-ink-400" /> : <FileIcon size={48} className="text-ink-400" />}
          <p className="text-xs text-ink-500">No preview available for this file type</p>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-ink-500">{meta.label} · {doc.size}</p>
    </div>
  )
}
