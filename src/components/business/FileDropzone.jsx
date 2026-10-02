import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { cn } from '../../utils/cn'

// Drag-and-drop area with a keyboard-accessible browse fallback.
// Validation is left to the parent (see utils/validators.validateFile).
export default function FileDropzone({ onFiles, multiple = false, accept, title, hint, disabled = false, compact = false, className }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const active = (dragging || hovered) && !disabled

  function emit(fileList) {
    const files = Array.from(fileList || [])
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1))
  }

  function open() {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={title || 'Upload files: drag and drop or press Enter to browse'}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) emit(e.dataTransfer.files)
      }}
      className={cn(
        'focus-ring group relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl text-center transition-all duration-200',
        compact ? 'px-4 py-5' : 'px-4 py-8 sm:px-6 sm:py-10',
        dragging
          ? 'scale-[1.01] bg-brand-50 dark:bg-brand-500/10'
          : 'gradient-soft hover:bg-brand-50/50 dark:hover:bg-brand-500/5',
        disabled && 'cursor-not-allowed opacity-60',
        className
      )}
    >
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        <rect
          x="1"
          y="1"
          rx="16"
          ry="16"
          style={{ width: 'calc(100% - 2px)', height: 'calc(100% - 2px)' }}
          fill="none"
          strokeWidth="2"
          strokeDasharray="8 6"
          strokeLinecap="round"
          className={active ? 'stroke-brand-500' : 'stroke-brand-300 dark:stroke-ink-600'}
        >
          {active && <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.1s" repeatCount="indefinite" />}
        </rect>
      </svg>
      <span
        className={cn(
          'relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 text-brand-600 shadow-sm transition-transform duration-200 dark:from-brand-500/20 dark:to-accent-500/15 dark:text-brand-300',
          active && '-translate-y-1 scale-110'
        )}
      >
        <UploadCloud size={22} />
      </span>
      <p className="relative text-sm font-semibold text-ink-700 dark:text-ink-200">
        {dragging ? 'Drop to add' : title || 'Drag & drop files here, or '}
        {!dragging && !title && <span className="text-brand-600 underline dark:text-brand-400">browse</span>}
      </p>
      {hint && <p className="relative text-xs text-ink-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={accept}
        tabIndex={-1}
        onChange={(e) => {
          emit(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
