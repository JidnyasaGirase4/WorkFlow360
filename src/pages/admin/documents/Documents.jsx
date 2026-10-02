import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, Download, Eye, Pencil, Trash2, MoreHorizontal, Folder, User, LayoutGrid, List, ArrowUp, ArrowDown, Globe, Users, Lock, X, AlertCircle, CheckCircle2,
  Files, Briefcase, FolderKanban, IdCard, FileSignature, Receipt, Shapes, Calendar,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import RowActions from '../../../components/business/RowActions'
import DocumentPreview from '../../../components/business/DocumentPreview'
import FileDropzone from '../../../components/business/FileDropzone'
import { StatusChips, ActiveFilters } from '../../../components/business/ChipFilters'
import { PageError } from '../../../components/business/PageStates'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import Input from '../../../components/common/Input'
import Badge from '../../../components/common/Badge'
import Card from '../../../components/common/Card'
import Modal from '../../../components/common/Modal'
import Drawer from '../../../components/common/Drawer'
import DataTable from '../../../components/common/DataTable'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import { Skeleton, SkeletonCard } from '../../../components/common/Skeleton'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '../../../components/common/Dropdown'
import { documentService } from '../../../services/documentService'
import { projectService } from '../../../services/projectService'
import { DOCUMENT_CATEGORIES } from '../../../mockData/documents'
import { clients } from '../../../mockData/clients'
import { TODAY } from '../../../mockData/reference'
import { formatDate } from '../../../utils/format'
import { fileKind, KIND_META } from '../../../utils/fileKind'
import { ALLOWED_DOCUMENT_TYPES, MAX_FILE_BYTES, formatBytes, validateFile } from '../../../utils/validators'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'Documents' }]

const CATEGORY_ICONS = {
  'Client Documents': Briefcase,
  'Project Documents': FolderKanban,
  'Employee Documents': IdCard,
  Contracts: FileSignature,
  Invoices: Receipt,
  Other: Shapes,
}

// Solid gradient tiles for the file-type icons (light + dark friendly).
const KIND_TILE = {
  pdf: 'from-danger-400 to-danger-600 shadow-danger-500/25',
  doc: 'from-brand-400 to-brand-600 shadow-brand-500/25',
  sheet: 'from-success-400 to-success-600 shadow-success-500/25',
  slides: 'from-warning-300 to-warning-500 shadow-warning-500/25',
  image: 'from-info-400 to-info-600 shadow-info-500/25',
  design: 'from-accent-400 to-accent-600 shadow-accent-500/25',
  archive: 'from-ink-400 to-ink-600 shadow-ink-500/20',
  file: 'from-ink-400 to-ink-600 shadow-ink-500/20',
}

function FileTile({ name, size = 'md', className }) {
  const kind = fileKind(name)
  const Icon = KIND_META[kind].icon
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-lg',
        KIND_TILE[kind],
        size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl',
        className
      )}
    >
      <Icon size={size === 'lg' ? 26 : size === 'sm' ? 16 : 22} aria-hidden="true" />
    </span>
  )
}

const VISIBILITY = {
  everyone: { label: 'Everyone in workspace', short: 'Everyone', icon: Globe },
  team: { label: 'Project team only', short: 'Team', icon: Users },
  admins: { label: 'Admins only', short: 'Admins', icon: Lock },
}
const VISIBILITY_OPTIONS = Object.entries(VISIBILITY).map(([value, v]) => ({ value, label: v.label }))

const STATUS = {
  active: { label: 'Active', tone: 'success' },
  in_review: { label: 'In review', tone: 'warning' },
  signed: { label: 'Signed', tone: 'info' },
  archived: { label: 'Archived', tone: 'neutral' },
}
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))

const SORT_OPTIONS = [
  { value: 'date', label: 'Date uploaded' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
]

function loadDocuments() {
  return Promise.all([documentService.list(), projectService.list()]).then(([documents, projects]) => ({ documents, projects }))
}

function DocumentsSkeleton() {
  return (
    <div aria-busy="true">
      <PageHeader title="Documents" description="Store and organize contracts, project files and other documents." breadcrumbItems={BREADCRUMB} />
      <span className="sr-only">Loading documents</span>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 w-full sm:w-72" />
        <Skeleton className="h-10 w-full sm:w-44" />
      </div>
      <div className="mb-5 flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

export default function Documents() {
  const { status, data, retry } = useMockLoad(loadDocuments)
  if (status === 'loading') return <DocumentsSkeleton />
  if (status === 'error') return <PageError title="Documents" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <DocumentsView initial={data.documents} projects={data.projects} />
}

function DocumentsView({ initial, projects }) {
  const { toast } = useToast()
  const [documents, setDocuments] = useState(initial)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [view, setView] = useState('grid')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewId, setPreviewId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const detail = documents.find((d) => d.id === detailId) || null
  const previewDoc = documents.find((d) => d.id === previewId) || null

  const counts = useMemo(() => {
    const acc = { '': documents.length }
    DOCUMENT_CATEGORIES.forEach((c) => {
      acc[c] = documents.filter((d) => d.category === c).length
    })
    return acc
  }, [documents])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = documents.filter(
      (d) =>
        (!category || d.category === category) &&
        (!q || d.name.toLowerCase().includes(q) || (d.project || '').toLowerCase().includes(q) || (d.client || '').toLowerCase().includes(q) || d.uploadedBy.toLowerCase().includes(q))
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'size') return ((a.sizeBytes || 0) - (b.sizeBytes || 0)) * dir
      return a.uploadedDate.localeCompare(b.uploadedDate) * dir
    })
  }, [documents, search, category, sortKey, sortDir])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    category && { key: 'category', label: `Category: ${category}`, onRemove: () => setCategory('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setCategory('')
  }

  function download(doc) {
    toast.success(`Downloading ${doc.name}...`)
  }

  async function updateDoc(id, patch, message) {
    try {
      const updated = await documentService.update(id, patch)
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)))
      if (message) toast.success(message)
      return true
    } catch {
      toast.error('Could not update the document. Please try again.')
      return false
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await documentService.remove(deleteTarget.id)
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
      toast.success(`${deleteTarget.name} deleted`)
      if (detailId === deleteTarget.id) setDetailId(null)
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete the document. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  function menu(doc) {
    return (
      <Dropdown>
        <DropdownTrigger asChild>
          <button type="button" className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800" aria-label={`Actions for ${doc.name}`}>
            <MoreHorizontal size={16} />
          </button>
        </DropdownTrigger>
        <DropdownMenu>
          <DropdownItem icon={<Eye size={14} />} onClick={() => setPreviewId(doc.id)}>Preview</DropdownItem>
          <DropdownItem icon={<Download size={14} />} onClick={() => download(doc)}>Download</DropdownItem>
          <DropdownItem icon={<Pencil size={14} />} onClick={() => setRenameTarget(doc)}>Rename</DropdownItem>
          <DropdownItem icon={<Trash2 size={14} />} danger onClick={() => setDeleteTarget(doc)}>Delete</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    )
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <FileTile name={row.name} size="sm" />
          <span className="max-w-[16rem] truncate font-semibold text-ink-800 dark:text-ink-100" title={row.name}>{row.name}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <CategoryPill name={row.category} /> },
    { key: 'project', header: 'Project', render: (row) => row.project || <span className="text-ink-400">—</span> },
    { key: 'uploadedBy', header: 'Uploaded by', render: (row) => <span className="whitespace-nowrap">{row.uploadedBy}</span> },
    { key: 'uploadedDate', header: 'Date', render: (row) => <span className="whitespace-nowrap">{formatDate(row.uploadedDate)}</span> },
    { key: 'size', header: 'Size', align: 'right', render: (row) => <span className="whitespace-nowrap">{row.size}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={STATUS[row.status]?.tone || 'neutral'} dot>{STATUS[row.status]?.label || 'Active'}</Badge> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `Preview ${row.name}`, icon: <Eye size={15} />, onClick: () => setPreviewId(row.id) },
            { label: `Download ${row.name}`, icon: <Download size={15} />, onClick: () => download(row) },
            { label: `Rename ${row.name}`, icon: <Pencil size={15} />, onClick: () => setRenameTarget(row) },
            { label: `Delete ${row.name}`, icon: <Trash2 size={15} />, tone: 'danger', onClick: () => setDeleteTarget(row) },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Store and organize contracts, project files and other documents."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Upload size={16} />} onClick={() => setUploadOpen(true)} className="w-full sm:w-auto">
            Upload
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, project, client, uploader..." className="lg:w-96" />
        <div className="flex items-center gap-2">
          <Select aria-label="Sort by" options={SORT_OPTIONS} value={sortKey} onChange={(e) => setSortKey(e.target.value)} wrapperClassName="flex-1 sm:w-44 sm:flex-none" />
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="focus-ring flex h-10 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
            aria-label={`Sort direction: ${sortDir === 'asc' ? 'ascending' : 'descending'}. Click to reverse`}
          >
            {sortDir === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            <span className="hidden sm:inline">{sortDir === 'asc' ? 'Ascending' : 'Descending'}</span>
          </button>
          <div role="group" aria-label="Layout" className="flex rounded-xl border border-ink-200 bg-white p-0.5 dark:border-ink-700 dark:bg-ink-900">
            {[
              ['grid', LayoutGrid, 'Grid view'],
              ['list', List, 'List view'],
            ].map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                aria-label={label}
                title={label}
                onClick={() => setView(value)}
                className={cn('focus-ring flex h-9 w-9 items-center justify-center rounded-[10px] transition-all', view === value ? 'gradient-brand bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800')}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <StatusChips
        label="Filter by category"
        className="mb-3"
        options={[{ value: '', label: 'All', icon: Files }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c, icon: CATEGORY_ICONS[c] }))]}
        value={category}
        onChange={setCategory}
        counts={counts}
      />
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />
      <p className="sr-only" aria-live="polite">{visible.length} documents shown</p>

      {visible.length === 0 ? (
        <Card className="rounded-2xl">
          <EmptyState
            icon={Folder}
            title="No documents found"
            description={activeFilters.length ? 'Nothing matches your search or category. Try clearing the filters.' : 'Upload your first document to get started.'}
            actionLabel={activeFilters.length ? 'Clear filters' : 'Upload Document'}
            onAction={activeFilters.length ? clearFilters : () => setUploadOpen(true)}
          />
        </Card>
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {visible.map((doc, i) => {
            const Vis = VISIBILITY[doc.visibility || 'team'].icon
            return (
              <li key={doc.id} className="min-w-0 animate-slide-up" style={{ animationDelay: `${Math.min(i, 9) * 50}ms` }}>
                <Card hover className="group flex h-full flex-col gap-3 rounded-2xl border-ink-100 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <FileTile name={doc.name} className="transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3" />
                    {menu(doc)}
                  </div>
                  <button type="button" onClick={() => setDetailId(doc.id)} className="focus-ring -m-1 min-w-0 rounded-lg p-1 text-left">
                    <span className="line-clamp-2 break-words text-sm font-semibold text-ink-800 dark:text-ink-100" title={doc.name}>{doc.name}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <CategoryPill name={doc.category} />
                      <Badge tone={STATUS[doc.status]?.tone || 'neutral'} dot>{STATUS[doc.status]?.label || 'Active'}</Badge>
                    </span>
                  </button>
                  <div className="space-y-1 text-xs text-ink-500">
                    {doc.project && <p className="flex items-center gap-1.5 truncate"><FolderKanban size={12} className="shrink-0 text-brand-500" /> <span className="truncate">{doc.project}</span></p>}
                    {doc.client && <p className="flex items-center gap-1.5 truncate"><Briefcase size={12} className="shrink-0 text-accent-500" /> <span className="truncate">{doc.client}</span></p>}
                    <p className="flex items-center gap-1.5"><User size={12} className="shrink-0 text-info-500" /> {doc.uploadedBy}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(doc.uploadedDate)}</span>
                    <span className="flex items-center gap-1 font-medium" title={VISIBILITY[doc.visibility || 'team'].label}><Vis size={12} /> {doc.size}</span>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="animate-fade-in rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4">
          <DataTable columns={columns} data={visible} pageSize={10} onRowClick={(row) => setDetailId(row.id)} />
        </div>
      )}

      <Drawer isOpen={Boolean(detail)} onClose={() => setDetailId(null)} title="Document details" width="max-w-md">
        {detail && <DetailPanel doc={detail} onPreview={() => setPreviewId(detail.id)} onDownload={() => download(detail)} onRename={() => setRenameTarget(detail)} onDelete={() => setDeleteTarget(detail)} onUpdate={updateDoc} />}
      </Drawer>

      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewId(null)}
        title={previewDoc?.name || ''}
        description={previewDoc ? `${previewDoc.category} · uploaded ${formatDate(previewDoc.uploadedDate)} by ${previewDoc.uploadedBy}` : ''}
        size="lg"
        footer={
          previewDoc && (
            <>
              <Button variant="secondary" onClick={() => setPreviewId(null)}>Close</Button>
              <Button leftIcon={<Download size={15} />} onClick={() => download(previewDoc)}>Download</Button>
            </>
          )
        }
      >
        {previewDoc && <DocumentPreview doc={previewDoc} />}
      </Modal>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projects={projects}
        onUploaded={(docs) => {
          setDocuments((prev) => [...docs, ...prev])
          setUploadOpen(false)
          toast.success(docs.length === 1 ? `${docs[0].name} uploaded successfully` : `${docs.length} documents uploaded successfully`)
        }}
      />

      <RenameModal
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        existing={documents}
        onSave={async (name) => {
          const ok = await updateDoc(renameTarget.id, { name }, 'Document renamed')
          if (ok) setRenameTarget(null)
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete this document?"
        description={deleteTarget ? `${deleteTarget.name} will be permanently removed from your library. This cannot be undone.` : ''}
        confirmLabel="Delete Document"
      />
    </div>
  )
}

function DetailPanel({ doc, onPreview, onDownload, onRename, onDelete, onUpdate }) {
  const meta = KIND_META[fileKind(doc.name)]
  const visibility = doc.visibility || 'team'

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FileTile name={doc.name} size="lg" />
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-ink-800 dark:text-ink-100">{doc.name}</p>
          <p className="text-xs text-ink-500">{meta.label} · {doc.size}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-ink-100 bg-gradient-to-br from-brand-50/50 to-accent-50/30 p-4 text-sm dark:border-ink-800 dark:from-brand-500/5 dark:to-accent-500/5">
        <Fact label="Category" value={doc.category} />
        <Fact label="Project" value={doc.project || 'Not linked'} />
        <Fact label="Client" value={doc.client || 'Not linked'} />
        <Fact label="Uploaded by" value={doc.uploadedBy} />
        <Fact label="Uploaded on" value={formatDate(doc.uploadedDate)} />
        <Fact label="File size" value={doc.size} />
      </dl>

      <div className="space-y-4">
        <Select
          label="Access control"
          hint={VISIBILITY[visibility].label === 'Admins only' ? 'Only workspace admins can open this file.' : visibility === 'team' ? 'Visible to members of the linked project.' : 'Anyone in the workspace can open this file.'}
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(e) => onUpdate(doc.id, { visibility: e.target.value }, `Access changed to "${VISIBILITY[e.target.value].label}"`)}
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={doc.status || 'active'}
          onChange={(e) => onUpdate(doc.id, { status: e.target.value }, `Status set to ${STATUS[e.target.value].label}`)}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-ink-100 pt-4 dark:border-ink-800 min-[400px]:grid-cols-2">
        <Button variant="secondary" leftIcon={<Eye size={15} />} onClick={onPreview}>Preview</Button>
        <Button variant="secondary" leftIcon={<Download size={15} />} onClick={onDownload}>Download</Button>
        <Button variant="secondary" leftIcon={<Pencil size={15} />} onClick={onRename}>Rename</Button>
        <Button variant="danger" leftIcon={<Trash2 size={15} />} onClick={onDelete}>Delete</Button>
      </div>
    </div>
  )
}

// Category pill with the category's icon in a rotating brand tint.
const CATEGORY_TINT = {
  'Client Documents': 'bg-brand-50 text-brand-700 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20',
  'Project Documents': 'bg-info-50 text-info-600 ring-info-200/70 dark:bg-info-500/15 dark:text-info-300 dark:ring-info-500/20',
  'Employee Documents': 'bg-accent-50 text-accent-700 ring-accent-200/70 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/20',
  Contracts: 'bg-warning-50 text-warning-700 ring-warning-200/70 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/20',
  Invoices: 'bg-success-50 text-success-700 ring-success-200/70 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/20',
  Other: 'bg-ink-100 text-ink-600 ring-ink-200/70 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700/60',
}

function CategoryPill({ name }) {
  const Icon = CATEGORY_ICONS[name] || Folder
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', CATEGORY_TINT[name] || CATEGORY_TINT.Other)}>
      <Icon size={12} aria-hidden="true" />
      {name}
    </span>
  )
}

function Fact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  )
}

const INVALID_NAME = /[\\/:*?"<>|]/

function RenameModal({ target, onClose, onSave, existing }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useResetOnChange([target?.id], () => {
    setValue(target?.name || '')
    setError('')
    setSaving(false)
  })

  async function submit(e) {
    e?.preventDefault()
    const name = value.trim()
    if (!name) return setError('File name cannot be empty')
    if (INVALID_NAME.test(name)) return setError('A file name cannot contain \\ / : * ? " < > |')
    if (name.length > 120) return setError('Keep the name under 120 characters')
    if (existing.some((d) => d.id !== target.id && d.name.toLowerCase() === name.toLowerCase())) return setError('A document with this name already exists')
    setSaving(true)
    await onSave(name)
    setSaving(false)
  }

  const extChanged = target && value.includes('.') && value.split('.').pop().toLowerCase() !== target.name.split('.').pop().toLowerCase()

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={saving ? undefined : onClose}
      title="Rename document"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving}>Save</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Input label="File name" required autoFocus value={value} error={error} hint={extChanged ? 'Heads up: you are changing the file extension.' : undefined} onChange={(e) => { setValue(e.target.value); setError('') }} />
      </form>
    </Modal>
  )
}

const LEGACY_TYPE = { pdf: 'pdf', sheet: 'sheet', image: 'design', design: 'design' }
let uploadCounter = 0

function UploadModal({ isOpen, onClose, onUploaded, projects }) {
  const { toast } = useToast()
  const [queue, setQueue] = useState([])
  const [meta, setMeta] = useState({ category: '', project: '', client: '', visibility: 'team' })
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState(false)
  const timer = useRef(null)
  const queueRef = useRef([])

  useEffect(() => () => clearInterval(timer.current), [])

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      clearInterval(timer.current)
      queueRef.current = []
      setQueue([])
      setMeta({ category: '', project: '', client: '', visibility: 'team' })
      setErrors({})
      setUploading(false)
    }
  })

  const validFiles = queue.filter((q) => !q.error)

  function writeQueue(next) {
    queueRef.current = next
    setQueue(next)
  }

  function addFiles(files) {
    const additions = files.map((file) => {
      uploadCounter += 1
      const duplicate = queueRef.current.some((q) => q.file.name === file.name && q.file.size === file.size)
      return { uid: `up-${uploadCounter}`, file, progress: 0, error: duplicate ? 'This file is already in the queue.' : validateFile(file) }
    })
    writeQueue([...queueRef.current, ...additions])
    const rejected = additions.filter((a) => a.error).length
    if (rejected > 0) toast.warning(`${rejected} file${rejected > 1 ? 's were' : ' was'} rejected. Check the messages in the list.`)
  }

  function removeFile(uid) {
    writeQueue(queueRef.current.filter((q) => q.uid !== uid))
  }

  function startUpload() {
    const next = {}
    if (!meta.category) next.category = 'Choose a category for these files'
    if (validFiles.length === 0) next.files = 'Add at least one valid file to upload'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setUploading(true)
    const project = projects.find((p) => p.id === meta.project)
    const client = clients.find((c) => c.id === meta.client)
    timer.current = setInterval(() => {
      const advanced = queueRef.current.map((q) =>
        q.error || q.progress >= 100 ? q : { ...q, progress: Math.min(100, q.progress + 9 + Math.round(Math.random() * 13)) }
      )
      writeQueue(advanced)
      if (advanced.every((q) => q.error || q.progress >= 100)) {
        clearInterval(timer.current)
        Promise.all(
          advanced
            .filter((q) => !q.error)
            .map((q) =>
              documentService.create({
                id: `doc-${Date.now()}-${q.uid}`,
                name: q.file.name,
                category: meta.category,
                project: project?.name || null,
                client: client?.company || null,
                uploadedBy: 'Jidnyasa Girase',
                uploadedDate: TODAY,
                size: formatBytes(q.file.size),
                sizeBytes: q.file.size,
                type: LEGACY_TYPE[fileKind(q.file.name)] || 'doc',
                visibility: meta.visibility,
                status: 'active',
                previewUrl: fileKind(q.file.name) === 'image' ? URL.createObjectURL(q.file) : undefined,
              })
            )
        )
          .then(onUploaded)
          .catch(() => {
            toast.error('Upload failed. Please try again.')
            setUploading(false)
          })
      }
    }, 180)
  }

  function set(field) {
    return (e) => {
      const value = e.target.value
      setMeta((m) => ({ ...m, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const overall = validFiles.length ? Math.round(validFiles.reduce((s, q) => s + q.progress, 0) / validFiles.length) : 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={uploading ? undefined : onClose}
      title="Upload documents"
      description={`PDF, Word, Excel, images and more. Up to ${formatBytes(MAX_FILE_BYTES)} per file.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button onClick={startUpload} isLoading={uploading} leftIcon={<Upload size={15} />} disabled={validFiles.length === 0}>
            {uploading ? `Uploading ${overall}%` : validFiles.length > 1 ? `Upload ${validFiles.length} files` : 'Upload'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FileDropzone
            multiple
            disabled={uploading}
            onFiles={addFiles}
            accept={ALLOWED_DOCUMENT_TYPES.map((t) => `.${t}`).join(',')}
            hint={`Allowed: ${ALLOWED_DOCUMENT_TYPES.map((t) => t.toUpperCase()).join(', ')} · max ${formatBytes(MAX_FILE_BYTES)}`}
          />
          {errors.files && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{errors.files}</p>}
        </div>

        {queue.length > 0 && (
          <ul className="space-y-2" aria-label="Files to upload">
            {queue.map((q) => {
              return (
                <li key={q.uid} className={cn('rounded-xl border p-3', q.error ? 'border-danger-200 bg-danger-50/60 dark:border-danger-500/30 dark:bg-danger-500/10' : 'border-ink-200 dark:border-ink-800')}>
                  <div className="flex items-center gap-3">
                    <FileTile name={q.file.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{q.file.name}</p>
                      <p className="text-xs text-ink-500">{formatBytes(q.file.size)}</p>
                    </div>
                    {q.progress >= 100 && !q.error && <CheckCircle2 size={16} className="shrink-0 text-success-500" aria-label="Uploaded" />}
                    {!uploading && (
                      <button type="button" onClick={() => removeFile(q.uid)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-ink-800" aria-label={`Remove ${q.file.name}`}>
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  {q.error ? (
                    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger-600 dark:text-danger-400"><AlertCircle size={13} className="mt-px shrink-0" /> {q.error}</p>
                  ) : (
                    (uploading || q.progress > 0) && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={q.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${q.file.name}`}>
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-500 transition-[width] duration-150" style={{ width: `${q.progress}%` }} />
                      </div>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            required
            placeholder="Select a category"
            options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={meta.category}
            error={errors.category}
            onChange={set('category')}
            disabled={uploading}
          />
          <Select label="Access" options={VISIBILITY_OPTIONS} value={meta.visibility} onChange={set('visibility')} disabled={uploading} />
          <Select label="Project" options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} value={meta.project} onChange={set('project')} disabled={uploading} />
          <Select label="Client" options={[{ value: '', label: 'No client' }, ...clients.map((c) => ({ value: c.id, label: c.company }))]} value={meta.client} onChange={set('client')} disabled={uploading} />
        </div>
      </div>
    </Modal>
  )
}
