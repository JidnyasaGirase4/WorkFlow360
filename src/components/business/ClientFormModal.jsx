import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { isValidEmail, isValidPhone } from '../../utils/workspace'

const EMPTY = { company: '', industry: '', contactPerson: '', email: '', phone: '', city: '', status: 'active' }
const FIELDS = Object.keys(EMPTY)
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function pick(source) {
  return Object.fromEntries(FIELDS.map((f) => [f, source?.[f] ?? EMPTY[f]]))
}

export default function ClientFormModal({ isOpen, onClose, onSubmit, initialValues, isSaving }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const isEdit = Boolean(initialValues)

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
    if (!values.company.trim()) next.company = 'Company name is required'
    if (!values.contactPerson.trim()) next.contactPerson = 'Contact person is required'
    if (!values.email.trim()) next.email = 'Email is required'
    else if (!isValidEmail(values.email.trim())) next.email = 'Enter a valid email address'
    if (values.phone.trim() && !isValidPhone(values.phone)) next.phone = 'Enter a valid phone number, e.g. +91 98765 43210'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    onSubmit({
      ...values,
      company: values.company.trim(),
      contactPerson: values.contactPerson.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      industry: values.industry.trim(),
      city: values.city.trim(),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Client' : 'Add New Client'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Add Client'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Company Name" required value={values.company} error={errors.company} onChange={(e) => setField('company', e.target.value)} />
        <Input label="Industry" placeholder="e.g. FinTech" value={values.industry} onChange={(e) => setField('industry', e.target.value)} />
        <Input label="Contact Person" required value={values.contactPerson} error={errors.contactPerson} onChange={(e) => setField('contactPerson', e.target.value)} />
        <Input label="Email" type="email" required value={values.email} error={errors.email} onChange={(e) => setField('email', e.target.value)} />
        <Input label="Phone" type="tel" placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={(e) => setField('phone', e.target.value)} />
        <Input label="City" value={values.city} onChange={(e) => setField('city', e.target.value)} />
        <Select label="Status" options={STATUS_OPTIONS} value={values.status} onChange={(e) => setField('status', e.target.value)} />
      </form>
    </Modal>
  )
}
