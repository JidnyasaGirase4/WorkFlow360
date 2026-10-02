import { useRef, useState } from 'react'
import { Paperclip, X, FileText } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import { clients } from '../../mockData/clients'
import { employees } from '../../mockData/employees'
import { TICKET_CATEGORIES } from '../../mockData/tickets'
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENT_MB, formatBytes, toAttachment, validateAttachment } from '../../utils/attachments'

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const EMPTY = { subject: '', client: '', priority: 'medium', category: '', assignee: '', description: '' }
const FORM_ID = 'create-ticket-form'

export default function TicketFormModal({ isOpen, onClose, onSubmit, isSaving = false }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="Create Ticket"
      description="Log a new support request on behalf of a client."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSaving}>
            Create Ticket
          </Button>
        </>
      }
    >
      <TicketForm onSubmit={onSubmit} disabled={isSaving} />
    </Modal>
  )
}

// Mounted only while the modal is open, so every open starts from a clean form.
function TicketForm({ onSubmit, disabled }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const fileRef = useRef(null)

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.subject.trim()) next.subject = 'Subject is required'
    else if (values.subject.trim().length < 5) next.subject = 'Subject must be at least 5 characters'
    if (!values.client) next.client = 'Please select a client'
    if (!values.category) next.category = 'Please choose a category'
    if (!values.assignee) next.assignee = 'Please assign an employee'
    if (!values.description.trim()) next.description = 'Please describe the issue'
    else if (values.description.trim().length < 15) next.description = 'Add a little more detail (at least 15 characters)'
    return next
  }

  function handleFile(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    const message = validateAttachment(picked)
    setFileError(message)
    setFile(message ? null : picked)
    e.target.value = ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({ ...values, subject: values.subject.trim(), description: values.description.trim(), attachment: file ? toAttachment(file) : null })
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        label="Subject"
        required
        wrapperClassName="sm:col-span-2"
        placeholder="e.g. Unable to download invoice PDF"
        value={values.subject}
        error={errors.subject}
        disabled={disabled}
        onChange={(e) => update('subject', e.target.value)}
      />
      <Select
        label="Client"
        required
        placeholder="Select a client"
        options={clients.map((c) => ({ value: c.company, label: c.company }))}
        value={values.client}
        error={errors.client}
        disabled={disabled}
        onChange={(e) => update('client', e.target.value)}
      />
      <Select
        label="Category"
        required
        placeholder="Select a category"
        options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))}
        value={values.category}
        error={errors.category}
        disabled={disabled}
        onChange={(e) => update('category', e.target.value)}
      />
      <Select
        label="Priority"
        required
        options={PRIORITY_OPTIONS}
        value={values.priority}
        disabled={disabled}
        onChange={(e) => update('priority', e.target.value)}
      />
      <Select
        label="Assign to"
        required
        placeholder="Select an employee"
        options={employees.map((emp) => ({ value: emp.name, label: `${emp.name} — ${emp.designation}` }))}
        value={values.assignee}
        error={errors.assignee}
        disabled={disabled}
        onChange={(e) => update('assignee', e.target.value)}
      />
      <Textarea
        label="Description"
        required
        wrapperClassName="sm:col-span-2"
        rows={4}
        placeholder="Describe what happened, steps to reproduce and any error messages."
        value={values.description}
        error={errors.description}
        disabled={disabled}
        onChange={(e) => update('description', e.target.value)}
      />

      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
          Attachment <span className="font-normal text-ink-400">(optional)</span>
        </p>
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-ink-200 px-3 py-2.5 dark:border-ink-700">
            <FileText size={18} className="shrink-0 text-brand-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">{file.name}</p>
              <p className="text-xs text-ink-400">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="focus-ring rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 dark:hover:bg-ink-800"
              aria-label="Remove attachment"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={disabled}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-4 py-4 text-sm text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600 dark:border-ink-700"
          >
            <Paperclip size={16} /> Attach a file
            <span className="text-xs text-ink-400">up to {MAX_ATTACHMENT_MB} MB</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept={ATTACHMENT_ACCEPT} className="sr-only" tabIndex={-1} onChange={handleFile} aria-label="Choose attachment" />
        {fileError && <p className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{fileError}</p>}
      </div>
    </form>
  )
}
