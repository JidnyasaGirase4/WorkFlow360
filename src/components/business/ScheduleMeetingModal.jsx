import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Button from '../common/Button'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { todayKey } from '../../utils/workspace'

const MEETING_TYPES = ['Video Call', 'In Person', 'Phone Call'].map((t) => ({ value: t, label: t }))

function initialValues(defaultHost, defaultTitle) {
  return { title: defaultTitle || '', date: '', time: '', type: 'Video Call', link: '', host: defaultHost || '', notes: '' }
}

// Schedule a meeting with a lead or client contact.
export default function ScheduleMeetingModal({ isOpen, onClose, onSubmit, isSaving, hosts, defaultHost, defaultTitle, withWhom }) {
  const [values, setValues] = useState(() => initialValues(defaultHost, defaultTitle))
  const [errors, setErrors] = useState({})

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(initialValues(defaultHost, defaultTitle))
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
    if (!values.title.trim()) next.title = 'Meeting title is required'
    if (!values.date) next.date = 'Pick a date'
    else if (values.date < todayKey()) next.date = 'Meeting date cannot be in the past'
    if (!values.time) next.time = 'Pick a time'
    if (!values.host) next.host = 'Select who will host the meeting'
    if (values.type === 'Video Call' && values.link.trim() && !/^https?:\/\/\S+\.\S+/.test(values.link.trim())) {
      next.link = 'Enter a valid meeting link starting with https://'
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({ ...values, title: values.title.trim(), link: values.link.trim(), notes: values.notes.trim() })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule Meeting"
      description={withWhom ? `Set up a meeting with ${withWhom}` : 'Set up a meeting'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Schedule Meeting</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input
          label="Meeting title"
          required
          wrapperClassName="sm:col-span-2"
          placeholder="e.g. Product demo and pricing walkthrough"
          value={values.title}
          error={errors.title}
          onChange={(e) => setField('title', e.target.value)}
        />
        <Input label="Date" type="date" required min={todayKey()} value={values.date} error={errors.date} onChange={(e) => setField('date', e.target.value)} />
        <Input label="Time" type="time" required value={values.time} error={errors.time} onChange={(e) => setField('time', e.target.value)} />
        <Select label="Meeting type" required options={MEETING_TYPES} value={values.type} onChange={(e) => setField('type', e.target.value)} />
        <Select
          label="Host"
          required
          placeholder="Select host"
          options={hosts.map((h) => ({ value: h, label: h }))}
          value={values.host}
          error={errors.host}
          onChange={(e) => setField('host', e.target.value)}
        />
        {values.type === 'Video Call' && (
          <Input
            label="Meeting link"
            wrapperClassName="sm:col-span-2"
            placeholder="https://meet.workflow360.app/..."
            hint="Optional. Leave blank to generate a link later."
            value={values.link}
            error={errors.link}
            onChange={(e) => setField('link', e.target.value)}
          />
        )}
        <Textarea
          label="Agenda"
          wrapperClassName="sm:col-span-2"
          rows={3}
          placeholder="What should be covered in this meeting?"
          value={values.notes}
          onChange={(e) => setField('notes', e.target.value)}
        />
      </form>
    </Modal>
  )
}
