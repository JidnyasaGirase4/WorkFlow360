import { useState } from 'react'
import Modal from '../common/Modal'
import Select from '../common/Select'
import Button from '../common/Button'
import FileDropInput from './FileDropInput'
import { useResetOnChange } from '../../hooks/useResetOnChange'

const CATEGORIES = ['Project Documents', 'Contracts', 'Invoices', 'Other']

// Upload dialog with file type / size validation. Files are kept in mock data only.
export default function FileUploadModal({ isOpen, onClose, onSubmit, isSaving, targetName }) {
  const [file, setFile] = useState(null)
  const [category, setCategory] = useState(CATEGORIES[0])
  const [error, setError] = useState('')

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setFile(null)
      setCategory(CATEGORIES[0])
      setError('')
    }
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Choose a file to upload')
      return
    }
    onSubmit({ file, category })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload File"
      description={targetName ? `Add a file to ${targetName}` : undefined}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>Upload</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FileDropInput
          file={file}
          required
          onChange={(f) => {
            setFile(f)
            setError('')
          }}
          externalError={error}
        />
        <Select label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={(e) => setCategory(e.target.value)} />
      </form>
    </Modal>
  )
}
