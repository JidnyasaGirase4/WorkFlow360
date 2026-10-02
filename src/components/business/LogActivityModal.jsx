import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Button from '../common/Button'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { ACTIVITY_TYPE_CONFIG, todayKey } from '../../utils/workspace'

const TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function initialValues(defaultOwner) {
  return { type: 'call', subject: '', owner: defaultOwner || '', date: todayKey(), time: nowTime(), notes: '' }
}

// Log a call / email / meeting / note / follow-up against a lead or client.
export default function LogActivityModal({ isOpen, onClose, onSubmit, isSaving, owners, defaultOwner, relatedTo }) {
  const [values, setValues] = useState(() => initialValues(defaultOwner))
  const [errors, setErrors] = useState({})

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(initialValues(defaultOwner))
      setErrors({})
    }
  })

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.subject.trim()) next.subject = 'Subject is required'
    else if (values.subject.trim().length < 5) next.subject = 'Subject should be at least 5 characters'
    if (!values.owner) next.owner = 'Select an owner'
    if (!values.date) next.date = 'Pick a date'
    if (!values.time) next.time = 'Pick a time'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({ ...values, subject: values.subject.trim(), notes: values.notes.trim() })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Activity"
      description={relatedTo ? `Record an interaction with ${relatedTo}` : 'Record an interaction'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Add Activity</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Select label="Type" required options={TYPE_OPTIONS} value={values.type} onChange={(e) => setField('type', e.target.value)} />
        <Select
          label="Owner"
          required
          placeholder="Select an owner"
          options={owners.map((o) => ({ value: o, label: o }))}
          value={values.owner}
          error={errors.owner}
          onChange={(e) => setField('owner', e.target.value)}
        />
        <Input
          label="Subject"
          required
          wrapperClassName="sm:col-span-2"
          placeholder="e.g. Pricing discussion after demo"
          value={values.subject}
          error={errors.subject}
          onChange={(e) => setField('subject', e.target.value)}
        />
        <Input label="Date" type="date" required value={values.date} error={errors.date} onChange={(e) => setField('date', e.target.value)} />
        <Input label="Time" type="time" required value={values.time} error={errors.time} onChange={(e) => setField('time', e.target.value)} />
        <Textarea
          label="Notes"
          wrapperClassName="sm:col-span-2"
          rows={3}
          placeholder="Key points discussed, decisions and next steps"
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </form>
    </Modal>
  )
}
