import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { isValidEmail, isValidPhone } from '../../utils/workspace'

function initialValues(lockedClient) {
  return {
    name: '',
    role: '',
    clientId: lockedClient?.id || '',
    company: lockedClient?.company || '',
    email: '',
    phone: '',
  }
}

export default function ContactFormModal({ isOpen, onClose, onSubmit, isSaving, clients = [], lockedClient }) {
  const [values, setValues] = useState(() => initialValues(lockedClient))
  const [errors, setErrors] = useState({})

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(initialValues(lockedClient))
      setErrors({})
    }
  })

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleClientChange(clientId) {
    const client = clients.find((c) => c.id === clientId)
    setValues((v) => ({ ...v, clientId, company: client ? client.company : v.company }))
    setErrors((e) => ({ ...e, company: undefined }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.name.trim()) next.name = 'Contact name is required'
    if (!values.company.trim()) next.company = 'Company is required'
    if (!values.email.trim()) next.email = 'Email is required'
    else if (!isValidEmail(values.email.trim())) next.email = 'Enter a valid email address'
    if (values.phone.trim() && !isValidPhone(values.phone)) next.phone = 'Enter a valid phone number, e.g. +91 98765 43210'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      name: values.name.trim(),
      role: values.role.trim(),
      company: values.company.trim(),
      clientId: values.clientId || null,
      email: values.email.trim(),
      phone: values.phone.trim(),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Contact"
      description="Add a person associated with a lead or client"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Add Contact</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full name" required value={values.name} error={errors.name} onChange={(e) => setField('name', e.target.value)} />
        <Input label="Designation" placeholder="e.g. Marketing Head" value={values.role} onChange={(e) => setField('role', e.target.value)} />
        {!lockedClient && (
          <Select
            label="Linked client"
            options={[{ value: '', label: 'Not a client yet (lead contact)' }, ...clients.map((c) => ({ value: c.id, label: c.company }))]}
            value={values.clientId}
            onChange={(e) => handleClientChange(e.target.value)}
          />
        )}
        <Input
          label="Company"
          required
          value={values.company}
          error={errors.company}
          disabled={Boolean(values.clientId)}
          onChange={(e) => setField('company', e.target.value)}
        />
        <Input label="Email" type="email" required value={values.email} error={errors.email} onChange={(e) => setField('email', e.target.value)} />
        <Input label="Phone" type="tel" placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={(e) => setField('phone', e.target.value)} />
      </form>
    </Modal>
  )
}
