import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Checkbox from '../common/Checkbox'
import Button from '../common/Button'
import { clients as mockClients } from '../../mockData/clients'
import { employees as mockEmployees } from '../../mockData/employees'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { PROJECT_STATUS_OPTIONS, todayKey } from '../../utils/workspace'

const EMPTY = {
  name: '',
  clientId: '',
  manager: '',
  status: 'planning',
  budget: '',
  startDate: '',
  deadline: '',
  team: [],
  description: '',
}
const FIELDS = Object.keys(EMPTY)

function pick(source) {
  return Object.fromEntries(FIELDS.map((f) => [f, source?.[f] ?? EMPTY[f]]))
}

export default function ProjectFormModal({ isOpen, onClose, onSubmit, initialValues, isSaving, clients, employees }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const isEdit = Boolean(initialValues)
  const clientList = clients || mockClients
  const people = employees || mockEmployees

  useResetOnChange([isOpen, initialValues], () => {
    if (isOpen) {
      setValues(initialValues ? { ...pick(initialValues), team: [...(initialValues.team || [])] } : { ...EMPTY, startDate: todayKey(), team: [] })
      setErrors({})
    }
  })

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function toggleMember(name) {
    setValues((v) => ({ ...v, team: v.team.includes(name) ? v.team.filter((n) => n !== name) : [...v.team, name] }))
  }

  function validate() {
    const next = {}
    if (!values.name.trim()) next.name = 'Project name is required'
    else if (values.name.trim().length < 3) next.name = 'Project name should be at least 3 characters'
    if (!values.clientId) next.clientId = 'Select a client'
    if (!values.manager) next.manager = 'Select a project manager'
    if (!values.budget || Number(values.budget) <= 0) next.budget = 'Enter a budget greater than 0'
    if (!values.deadline) next.deadline = 'Deadline is required'
    else if (values.startDate && values.deadline < values.startDate) next.deadline = 'Deadline must be on or after the start date'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    const client = clientList.find((c) => c.id === values.clientId)
    onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      budget: Number(values.budget),
      client: client?.company,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Project' : 'Create New Project'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Create Project'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Project Name" required wrapperClassName="sm:col-span-2" value={values.name} error={errors.name} onChange={(e) => setField('name', e.target.value)} />
        <Select
          label="Client"
          required
          placeholder="Select client"
          options={clientList.map((c) => ({ value: c.id, label: c.company }))}
          value={values.clientId}
          error={errors.clientId}
          onChange={(e) => setField('clientId', e.target.value)}
        />
        <Select
          label="Project Manager"
          required
          placeholder="Select manager"
          options={people.map((e) => ({ value: e.name, label: e.name }))}
          value={values.manager}
          error={errors.manager}
          onChange={(e) => setField('manager', e.target.value)}
        />
        <Select label="Status" options={PROJECT_STATUS_OPTIONS} value={values.status} onChange={(e) => setField('status', e.target.value)} />
        <Input label="Budget (₹)" type="number" min="0" required value={values.budget} error={errors.budget} onChange={(e) => setField('budget', e.target.value)} />
        <Input label="Start Date" type="date" value={values.startDate} onChange={(e) => setField('startDate', e.target.value)} />
        <Input label="Deadline" type="date" required value={values.deadline} error={errors.deadline} onChange={(e) => setField('deadline', e.target.value)} />
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
            Team Members <span className="font-normal text-ink-400">({values.team.length} selected)</span>
          </legend>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-2xl border border-ink-200 bg-ink-50/50 p-3 sm:grid-cols-2 dark:border-ink-700 dark:bg-ink-900/40">
            {people.map((p) => (
              <Checkbox key={p.id} label={p.name} checked={values.team.includes(p.name)} onChange={() => toggleMember(p.name)} />
            ))}
          </div>
        </fieldset>
        <Textarea label="Description" wrapperClassName="sm:col-span-2" rows={3} value={values.description} onChange={(e) => setField('description', e.target.value)} />
      </form>
    </Modal>
  )
}
