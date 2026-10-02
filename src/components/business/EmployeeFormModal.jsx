import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { departments } from '../../mockData/employees'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { isValidEmail, isValidIndianPhone, normalizeIndianPhone } from '../../utils/validators'

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
]

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Probation'].map((t) => ({ value: t, label: t }))

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  department: departments[0],
  designation: '',
  status: 'active',
  employmentType: 'Full-time',
  joiningDate: '',
  skills: '',
}

export default function EmployeeFormModal({ isOpen, onClose, onSubmit, initialValues, isSaving, existingEmails = [] }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const isEdit = Boolean(initialValues)

  useResetOnChange([isOpen, initialValues], () => {
    if (isOpen) {
      setValues(
        initialValues
          ? { ...EMPTY, ...initialValues, skills: (initialValues.skills || []).join(', ') }
          : EMPTY
      )
      setErrors({})
    }
  })

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validate() {
    const next = {}
    if (!values.name.trim()) next.name = 'Employee name is required'
    else if (values.name.trim().length < 3) next.name = 'Enter the full name'
    const email = values.email.trim().toLowerCase()
    if (!email) next.email = 'Email is required'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address'
    else if (existingEmails.some((e) => e.toLowerCase() === email && e.toLowerCase() !== (initialValues?.email || '').toLowerCase()))
      next.email = 'An employee with this email already exists'
    if (!values.phone.trim()) next.phone = 'Phone number is required'
    else if (!isValidIndianPhone(values.phone)) next.phone = 'Enter a valid Indian mobile number, e.g. +91 98765 43210'
    if (!values.designation.trim()) next.designation = 'Designation is required'
    if (!values.joiningDate) next.joiningDate = 'Joining date is required'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (isSaving) return
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    onSubmit({
      ...values,
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: normalizeIndianPhone(values.phone),
      designation: values.designation.trim(),
      skills: values.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title={isEdit ? 'Edit Employee' : 'Add New Employee'}
      description={isEdit ? 'Update employee details' : 'Add a new employee to your organization'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Add Employee'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Full Name" required autoComplete="off" placeholder="e.g. Rohit Girase" value={values.name} error={errors.name} onChange={set('name')} />
        <Input label="Work Email" type="email" required placeholder="name@technova.in" value={values.email} error={errors.email} onChange={set('email')} />
        <Input label="Phone" type="tel" required placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={set('phone')} />
        <Input label="Designation" required placeholder="e.g. Senior Frontend Developer" value={values.designation} error={errors.designation} onChange={set('designation')} />
        <Select label="Department" options={departments.map((d) => ({ value: d, label: d }))} value={values.department} onChange={set('department')} />
        <Select label="Employment Type" options={EMPLOYMENT_TYPES} value={values.employmentType} onChange={set('employmentType')} />
        <Select label="Status" options={STATUSES} value={values.status} onChange={set('status')} />
        <Input label="Joining Date" type="date" required value={values.joiningDate} error={errors.joiningDate} onChange={set('joiningDate')} />
        <Input
          label="Skills"
          wrapperClassName="sm:col-span-2"
          hint="Separate skills with commas"
          placeholder="React, Node.js, Figma"
          value={values.skills}
          onChange={set('skills')}
        />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
