import { useId, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import Avatar from './Avatar'
import Button from './Button'
import { useToast } from '../../context/ToastContext'

const MAX_MB = 2
const TYPES = ['image/png', 'image/jpeg', 'image/webp']

// Avatar with change / remove controls. Validates type and size; the chosen
// image is shown through an object URL passed to `onChange(url | null)`.
export default function AvatarUpload({ name, src, onChange, size = 'xl' }) {
  const { toast } = useToast()
  const inputId = useId()
  const [error, setError] = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!TYPES.includes(file.type)) {
      setError('Use a PNG, JPG or WebP image.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_MB} MB.`)
      return
    }
    setError('')
    onChange(URL.createObjectURL(file))
    toast.success('Profile photo updated')
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={src} size={size} />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={inputId}
            className="focus-ring has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 inline-flex h-10 cursor-pointer select-none items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 active:scale-[0.97] dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800"
          >
            <Camera size={14} /> Change photo
            <input id={inputId} type="file" accept={TYPES.join(',')} className="sr-only" onChange={handleFile} />
          </label>
          {src && (
            <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-ink-400">PNG, JPG or WebP up to {MAX_MB} MB.</p>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-danger-600 dark:text-danger-400">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
