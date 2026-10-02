import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Button from '../common/Button'
import { employees } from '../../mockData/employees'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { LEAD_SOURCES, LEAD_STAGES, PRIORITY_OPTIONS, isValidEmail, isValidPhone } from '../../utils/workspace'

const EMPTY = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: 'Website',
  status: 'new',
  value: '',
  owner: '',
  priority: 'medium',
  nextFollowUp: '',
  notes: '',
}
const FIELDS = Object.keys(EMPTY)

function pick(source) {
  return Object.fromEntries(FIELDS.map((f) => [f, source?.[f] ?? EMPTY[f]]))
}

export default function LeadFormModal({ isOpen, onClose, onSubmit, initialValues, isSaving, owners }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const isEdit = Boolean(initialValues)
  const ownerNames = owners || employees.map((e) => e.name)

  useResetOnChange([isOpen, initialValues], () => {
    if (isOpen) {
      setValues(initialValues ? pick(initialValues) : EMPTY)
      setErrors({})
    }
  })

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.name.trim()) next.name = 'Contact name is required'
    if (!values.company.trim()) next.company = 'Company name is required'
    if (!values.email.trim()) next.email = 'Email is required'
    else if (!isValidEmail(values.email.trim())) next.email = 'Enter a valid email address'
    if (values.phone.trim() && !isValidPhone(values.phone)) next.phone = 'Enter a valid phone number, e.g. +91 98765 43210'
    if (!values.value || Number(values.value) <= 0) next.value = 'Enter a valid deal value greater than 0'
    if (!values.owner) next.owner = 'Assign an owner'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    onSubmit({
      ...values,
      name: values.name.trim(),
      company: values.company.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      value: Number(values.value),
      nextFollowUp: values.nextFollowUp || null,
      notes: values.notes.trim(),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Lead' : 'Add New Lead'}
      description={isEdit ? 'Update lead details' : 'Capture a new lead in your pipeline'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Add Lead'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Contact Name" required value={values.name} error={errors.name} onChange={(e) => setField('name', e.target.value)} />
        <Input label="Company" required value={values.company} error={errors.company} onChange={(e) => setField('company', e.target.value)} />
        <Input label="Email" type="email" required value={values.email} error={errors.email} onChange={(e) => setField('email', e.target.value)} />
        <Input label="Phone" type="tel" placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={(e) => setField('phone', e.target.value)} />
        <Select label="Lead Source" options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))} value={values.source} onChange={(e) => setField('source', e.target.value)} />
        <Select label="Status" options={LEAD_STAGES} value={values.status} onChange={(e) => setField('status', e.target.value)} />
        <Input label="Estimated Value (₹)" type="number" min="0" required value={values.value} error={errors.value} onChange={(e) => setField('value', e.target.value)} />
        <Select label="Priority" options={PRIORITY_OPTIONS} value={values.priority} onChange={(e) => setField('priority', e.target.value)} />
        <Select
          label="Owner"
          required
          placeholder="Assign an owner"
          options={ownerNames.map((n) => ({ value: n, label: n }))}
          value={values.owner}
          error={errors.owner}
          onChange={(e) => setField('owner', e.target.value)}
        />
        <Input label="Next Follow-up" type="date" value={values.nextFollowUp || ''} onChange={(e) => setField('nextFollowUp', e.target.value)} />
        <Textarea label="Notes" wrapperClassName="sm:col-span-2" rows={3} value={values.notes} onChange={(e) => setField('notes', e.target.value)} />
      </form>
    </Modal>
  )
}
