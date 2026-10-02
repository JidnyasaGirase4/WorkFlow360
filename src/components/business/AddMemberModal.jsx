import { useState } from 'react'
import Modal from '../common/Modal'
import Select from '../common/Select'
import ClientAvatar from './ClientAvatar'
import Button from '../common/Button'
import { useResetOnChange } from '../../hooks/useResetOnChange'

export default function AddMemberModal({ isOpen, onClose, onSubmit, isSaving, candidates, projectName }) {
  const [memberName, setMemberName] = useState('')
  const [error, setError] = useState('')

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setMemberName('')
      setError('')
    }
  })

  const selected = candidates.find((c) => c.name === memberName)

  function handleSubmit(e) {
    e.preventDefault()
    if (!memberName) {
      setError('Select a team member to add')
      return
    }
    onSubmit(memberName)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Team Member"
      description={projectName ? `Add someone to ${projectName}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving} disabled={candidates.length === 0}>Add Member</Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-sm text-ink-500">Everyone in your organisation is already on this project.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Select
            label="Team member"
            required
            placeholder="Select a person"
            options={candidates.map((c) => ({ value: c.name, label: `${c.name} — ${c.designation}` }))}
            value={memberName}
            error={error}
            onChange={(e) => {
              setMemberName(e.target.value)
              setError('')
            }}
          />
          {selected && (
            <div className="animate-scale-in flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-500/30 dark:bg-brand-500/5">
              <ClientAvatar name={selected.name} size="lg" />
              <div>
                <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{selected.name}</p>
                <p className="text-xs text-ink-400">{selected.designation} · {selected.department}</p>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}
