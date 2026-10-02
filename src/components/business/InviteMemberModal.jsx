import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import { INVITABLE_ROLES } from '../../mockData/team'

const FORM_ID = 'invite-member-form'
const EMPTY = { email: '', role: 'employee', message: '' }
const MAX_MESSAGE = 300

export default function InviteMemberModal({ isOpen, onClose, onSubmit, isSaving = false, existingEmails = [] }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="Invite Member"
      description="Send an email invitation to join your workspace."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSaving} leftIcon={<Send size={15} />}>
            Send Invite
          </Button>
        </>
      }
    >
      <InviteForm onSubmit={onSubmit} disabled={isSaving} existingEmails={existingEmails} />
    </Modal>
  )
}

function InviteForm({ onSubmit, disabled, existingEmails }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const roleInfo = INVITABLE_ROLES.find((r) => r.value === values.role)

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const next = {}
    const email = values.email.trim().toLowerCase()
    if (!email) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) next.email = 'Enter a valid email address'
    else if (existingEmails.includes(email)) next.email = 'This person is already on the team or has a pending invite'
    if (!values.role) next.role = 'Choose a role'
    if (values.message.length > MAX_MESSAGE) next.message = `Message must be ${MAX_MESSAGE} characters or fewer`
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Email address"
        type="email"
        required
        autoComplete="off"
        placeholder="name@technova.in"
        leftIcon={<Mail size={16} />}
        value={values.email}
        error={errors.email}
        disabled={disabled}
        onChange={(e) => update('email', e.target.value)}
      />
      <Select
        label="Role"
        required
        options={INVITABLE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
        value={values.role}
        error={errors.role}
        hint={roleInfo?.description}
        disabled={disabled}
        onChange={(e) => update('role', e.target.value)}
      />
      <Textarea
        label="Personal message (optional)"
        rows={3}
        placeholder="Add a short welcome note for the invitee"
        value={values.message}
        error={errors.message}
        hint={`${values.message.length}/${MAX_MESSAGE} characters`}
        disabled={disabled}
        onChange={(e) => update('message', e.target.value)}
      />
    </form>
  )
}
