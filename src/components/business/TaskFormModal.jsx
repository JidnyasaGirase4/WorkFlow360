import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Button from '../common/Button'
import { projects as mockProjects } from '../../mockData/projects'
import { employees as mockEmployees } from '../../mockData/employees'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { PRIORITY_OPTIONS, TASK_COLUMNS } from '../../utils/workspace'

const EMPTY = { title: '', projectId: '', assignee: '', priority: 'medium', status: 'todo', dueDate: '', description: '' }
const FIELDS = Object.keys(EMPTY)

function pick(source) {
  return Object.fromEntries(FIELDS.map((f) => [f, source?.[f] ?? EMPTY[f]]))
}

// `lockedProjectId` pre-selects and locks the project (used from Project Details).
export default function TaskFormModal({ isOpen, onClose, onSubmit, initialValues, isSaving, projects, employees, lockedProjectId }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const isEdit = Boolean(initialValues)
  const projectList = projects || mockProjects
  const people = employees || mockEmployees

  useResetOnChange([isOpen, initialValues], () => {
    if (isOpen) {
      setValues(initialValues ? pick(initialValues) : { ...EMPTY, projectId: lockedProjectId || '' })
      setErrors({})
    }
  })

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.title.trim()) next.title = 'Task title is required'
    else if (values.title.trim().length < 3) next.title = 'Task title should be at least 3 characters'
    if (!values.projectId) next.projectId = 'Select a project'
    if (!values.assignee) next.assignee = 'Select an assignee'
    if (!values.dueDate) next.dueDate = 'Due date is required'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    const project = projectList.find((p) => p.id === values.projectId)
    onSubmit({ ...values, title: values.title.trim(), description: values.description.trim(), project: project?.name })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'Create New Task'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Create Task'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Input label="Task Title" required wrapperClassName="sm:col-span-2" value={values.title} error={errors.title} onChange={(e) => setField('title', e.target.value)} />
        <Select
          label="Project"
          required
          placeholder="Select project"
          disabled={Boolean(lockedProjectId)}
          options={projectList.map((p) => ({ value: p.id, label: p.name }))}
          value={values.projectId}
          error={errors.projectId}
          onChange={(e) => setField('projectId', e.target.value)}
        />
        <Select
          label="Assignee"
          required
          placeholder="Select assignee"
          options={people.map((e) => ({ value: e.name, label: e.name }))}
          value={values.assignee}
          error={errors.assignee}
          onChange={(e) => setField('assignee', e.target.value)}
        />
        <Select label="Priority" options={PRIORITY_OPTIONS} value={values.priority} onChange={(e) => setField('priority', e.target.value)} />
        <Select label="Status" options={TASK_COLUMNS} value={values.status} onChange={(e) => setField('status', e.target.value)} />
        <Input label="Due Date" type="date" required value={values.dueDate} error={errors.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
        <Textarea label="Description" wrapperClassName="sm:col-span-2" rows={3} value={values.description} onChange={(e) => setField('description', e.target.value)} />
      </form>
    </Modal>
  )
}
