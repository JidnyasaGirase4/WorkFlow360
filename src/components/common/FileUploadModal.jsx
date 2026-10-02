import { useId, useRef, useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'
import Select from './Select'
import Textarea from './Textarea'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { formatFileSize } from '../../utils/format'
import { cn } from '../../utils/cn'

const DEFAULT_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'txt', 'zip', 'fig']

function extensionOf(name) {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

// Upload dialog with drag & drop, type + size validation and category / project
// pickers. Nothing is sent anywhere: `onSubmit({ file, category, project, note })`
// receives the validated File and the caller stores the metadata.
export default function FileUploadModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Upload document',
  description = 'Add a file to share.',
  categories = [],
  projects = [],
  allowedTypes = DEFAULT_TYPES,
  maxSizeMB = 10,
  submitLabel = 'Upload',
  showNote = true,
}) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [category, setCategory] = useState('')
  const [project, setProject] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [dragging, setDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useResetOnChange([isOpen], () => {
    if (!isOpen) {
      setFile(null)
      setCategory('')
      setProject('')
      setNote('')
      setErrors({})
      setDragging(false)
      setIsSaving(false)
    }
  })

  function validateFile(candidate) {
    if (!candidate) return 'Please choose a file to upload.'
    const ext = extensionOf(candidate.name)
    if (!allowedTypes.includes(ext)) return `.${ext || 'unknown'} files are not supported. Allowed: ${allowedTypes.join(', ')}.`
    if (candidate.size > maxSizeMB * 1024 * 1024) return `File is ${formatFileSize(candidate.size)}. The maximum size is ${maxSizeMB} MB.`
    if (candidate.size === 0) return 'This file is empty.'
    return ''
  }

  function pick(candidate) {
    const message = validateFile(candidate)
    setErrors((prev) => ({ ...prev, file: message }))
    setFile(message ? null : candidate)
  }

  function handleSubmit() {
    const next = {}
    const fileError = validateFile(file)
    if (fileError) next.file = fileError
    if (categories.length > 0 && !category) next.category = 'Please select a category.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setIsSaving(true)
    setTimeout(() => {
      onSubmit({ file, category, project: project || null, note: note.trim() })
      setIsSaving(false)
    }, 600)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSaving} leftIcon={<Upload size={15} />}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
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
              pick(e.dataTransfer.files?.[0])
            }}
            className={cn(
              'gradient-soft flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
              dragging ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-ink-200 hover:border-brand-400 dark:border-ink-700',
              errors.file && 'border-danger-400'
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <Upload size={22} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Drag a file here or click to browse</span>
            <span className="text-xs text-ink-400">
              {allowedTypes.slice(0, 6).join(', ').toUpperCase()} and more, up to {maxSizeMB} MB
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              className="sr-only"
              accept={allowedTypes.map((t) => `.${t}`).join(',')}
              onChange={(e) => pick(e.target.files?.[0])}
              aria-describedby={errors.file ? `${inputId}-error` : undefined}
            />
          </label>
          {errors.file && (
            <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">
              {errors.file}
            </p>
          )}
          {file && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-ink-200 px-3 py-2.5 dark:border-ink-700">
              <FileText size={18} className="shrink-0 text-brand-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{file.name}</p>
                <p className="text-xs text-ink-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                aria-label="Remove selected file"
                className="focus-ring rounded-lg p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <Select
            label="Category"
            required
            placeholder="Select category"
            options={categories.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            error={errors.category}
          />
        )}
        {projects.length > 0 && (
          <Select
            label="Project"
            hint="Optional - link the file to a project."
            options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p, label: p }))]}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
        )}
        {showNote && (
          <Textarea label="Note" rows={3} placeholder="Add context for whoever opens this file (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        )}
      </div>
    </Modal>
  )
}
