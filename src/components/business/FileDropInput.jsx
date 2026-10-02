import { useId, useRef, useState } from 'react'
import { UploadCloud, FileText, X } from 'lucide-react'
import { ACCEPT_ATTR, ALLOWED_EXTENSIONS, MAX_FILE_MB, formatFileSize, validateFile } from '../../utils/workspace'
import { cn } from '../../utils/cn'

// File picker with drag-and-drop, type and size validation.
// Calls onChange(file | null) and reports validation problems inline.
export default function FileDropInput({ file, onChange, label = 'File', required = false, externalError }) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  function accept(candidate) {
    if (!candidate) return
    const problem = validateFile(candidate)
    setError(problem)
    onChange(problem ? null : candidate)
    if (problem && inputRef.current) inputRef.current.value = ''
  }

  const shownError = error || externalError

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-700 dark:text-ink-200">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/30 dark:bg-brand-500/5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <FileText size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{file.name}</p>
            <p className="text-xs text-ink-400">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setError('')
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
            aria-label="Remove selected file"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            accept(e.dataTransfer.files?.[0])
          }}
          className={cn(
            'group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
            dragging ? 'scale-[1.01] border-brand-400 bg-brand-50 shadow-glow dark:bg-brand-500/10' : 'gradient-soft border-ink-200 hover:border-brand-300 dark:border-ink-700',
            shownError && 'border-danger-400'
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110 dark:bg-brand-500/15 dark:text-brand-300">
            <UploadCloud size={24} aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
            Drop a file here or <span className="text-brand-600 dark:text-brand-400">browse</span>
          </span>
          <span className="text-xs text-ink-400">
            {ALLOWED_EXTENSIONS.slice(0, 8).join(', ').toUpperCase()} and more, up to {MAX_FILE_MB} MB
          </span>
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        aria-describedby={shownError ? `${inputId}-error` : undefined}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {shownError && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-danger-600 dark:text-danger-400">
          {shownError}
        </p>
      )}
    </div>
  )
}
