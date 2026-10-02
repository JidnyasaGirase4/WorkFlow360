import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, Plus } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ContactFormModal from '../../../components/business/ContactFormModal'
import ActiveFilterChips from '../../../components/business/ActiveFilterChips'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import Button from '../../../components/common/Button'
import DataTable from '../../../components/common/DataTable'
import ErrorState from '../../../components/common/ErrorState'
import ClientAvatar from '../../../components/business/ClientAvatar'
import Badge from '../../../components/common/Badge'
import { contactService } from '../../../services/contactService'
import { clientService } from '../../../services/clientService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useToast } from '../../../context/ToastContext'
import { newId } from '../../../utils/workspace'

const loadContactsPage = () => Promise.all([contactService.list(), clientService.list()]).then(([contacts, clients]) => ({ contacts, clients }))

const TYPE_OPTIONS = [
  { value: '', label: 'All contacts' },
  { value: 'client', label: 'Client contacts' },
  { value: 'lead', label: 'Lead contacts' },
]

export default function Contacts() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data, isLoading, isError, retry, setData } = useMockQuery(loadContactsPage)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const contacts = useMemo(() => data?.contacts ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (q && ![c.name, c.company, c.email, c.role, c.phone].some((v) => v?.toLowerCase().includes(q))) return false
      if (typeFilter === 'client' && !c.clientId) return false
      if (typeFilter === 'lead' && c.clientId) return false
      return true
    })
  }, [contacts, search, typeFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    typeFilter && { key: 'type', label: TYPE_OPTIONS.find((o) => o.value === typeFilter).label, onRemove: () => setTypeFilter('') },
  ].filter(Boolean)

  function clearAll() {
    setSearch('')
    setTypeFilter('')
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      const created = await contactService.create({ id: newId('ct'), ...values })
      setData((prev) => ({ ...prev, contacts: [created, ...prev.contacts] }))
      toast.success(`${values.name} added to contacts`)
      setModalOpen(false)
    } catch {
      toast.error('Could not add the contact. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Contact',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ClientAvatar name={row.name} size="md" />
          <div className="min-w-0">
            <p className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{row.name}</p>
            <p className="text-xs text-ink-400">{row.role || 'No designation'}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Company', sortable: true },
    {
      key: 'email',
      header: 'Contact Info',
      render: (row) => (
        <div className="space-y-0.5 text-xs">
          <p className="flex items-center gap-1.5 text-ink-500"><Mail size={12} aria-hidden="true" className="text-brand-500" /> {row.email}</p>
          {row.phone && <p className="flex items-center gap-1.5 text-ink-500"><Phone size={12} aria-hidden="true" className="text-accent-500" /> {row.phone}</p>}
        </div>
      ),
    },
    {
      key: 'clientId',
      header: 'Type',
      render: (row) => (row.clientId ? <Badge tone="success">Client Contact</Badge> : <Badge tone="brand">Lead Contact</Badge>),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Every person associated with your leads and clients."
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Contacts' }]}
        action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)} disabled={isLoading}>Add Contact</Button>}
      />

      {isError ? (
        <ErrorState title="Couldn't load contacts" onRetry={retry} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:flex-row sm:p-4 dark:border-ink-800 dark:bg-ink-900">
            <SearchBar value={search} onChange={setSearch} placeholder="Search contacts by name, company or email..." className="sm:w-96" />
            <Select aria-label="Filter by contact type" wrapperClassName="sm:w-52" options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
          </div>
          <ActiveFilterChips filters={activeFilters} onClearAll={clearAll} className="mb-4" />
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            pageSize={6}
            onRowClick={(row) => row.clientId && navigate(`/admin/crm/clients/${row.clientId}`)}
            emptyTitle={activeFilters.length > 0 ? 'No contacts match your search' : 'No contacts yet'}
            emptyDescription={activeFilters.length > 0 ? 'Try a different search term or clear the filters.' : 'Add your first contact to get started.'}
            emptyActionLabel={activeFilters.length > 0 ? 'Clear All' : 'Add Contact'}
            onEmptyAction={activeFilters.length > 0 ? clearAll : () => setModalOpen(true)}
          />
        </>
      )}

      <ContactFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSave} isSaving={isSaving} clients={clients} />
    </div>
  )
}
