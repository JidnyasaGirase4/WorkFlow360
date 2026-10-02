import { useMemo, useState } from 'react'
import { Eye, Download, Upload, FileText } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import DataTable from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Select from '../../components/common/Select'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import EmptyState from '../../components/common/EmptyState'
import FileUploadModal from '../../components/common/FileUploadModal'
import FilePreviewModal from '../../components/common/FilePreviewModal'
import FileTypeTile from '../../components/portal/FileTypeTile'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { addClientDoc } from '../../utils/portalStores'
import { downloadMockDocument } from '../../utils/download'
import { formatDate, formatFileSize } from '../../utils/format'

const CLIENT_UPLOAD_CATEGORIES = ['Project Documents', 'Client Documents', 'Contracts', 'Other']
const TYPE_BY_EXT = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'sheet', xlsx: 'sheet', csv: 'sheet', png: 'image', jpg: 'image', jpeg: 'image', zip: 'archive', fig: 'design' }

function DocsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading documents">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={5} cols={6} />
      </div>
    </div>
  )
}

export default function ClientDocuments() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { company, user, projects, documents } = useClientData()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [project, setProject] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const categories = useMemo(() => [...new Set(documents.map((d) => d.category))], [documents])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter(
      (d) =>
        (!q || d.name.toLowerCase().includes(q) || (d.project || '').toLowerCase().includes(q)) &&
        (!category || d.category === category) &&
        (!project || d.project === project)
    )
  }, [documents, search, category, project])

  const chips = [
    category && { key: 'category', label: `Category: ${category}`, onRemove: () => setCategory('') },
    project && { key: 'project', label: `Project: ${project}`, onRemove: () => setProject('') },
  ].filter(Boolean)

  function handleUpload({ file, category: cat, project: proj }) {
    const ext = file.name.split('.').pop().toLowerCase()
    addClientDoc({
      name: file.name,
      category: cat,
      project: proj,
      client: company,
      uploadedBy: user?.name || 'You',
      size: formatFileSize(file.size),
      sizeBytes: file.size,
      type: TYPE_BY_EXT[ext] || 'doc',
    })
    toast.success(`${file.name} uploaded and shared with the WorkFlow360 team`)
    setUploadOpen(false)
  }

  function handleDownload(doc) {
    downloadMockDocument(doc)
    toast.success(`Downloading ${doc.name}`)
  }

  const columns = [
    {
      key: 'name',
      header: 'File name',
      sortable: true,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <FileTypeTile type={row.type} size="sm" />
          <span className="min-w-0 break-words font-semibold text-ink-800 dark:text-ink-100">{row.name}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="brand">{row.category}</Badge> },
    { key: 'project', header: 'Project', render: (row) => row.project || '—' },
    { key: 'uploadedDate', header: 'Uploaded', sortable: true, render: (row) => formatDate(row.uploadedDate) },
    { key: 'uploadedBy', header: 'Uploaded by' },
    { key: 'size', header: 'Size', sortable: true, sortAccessor: (row) => row.sizeBytes || 0 },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" leftIcon={<Eye size={13} />} onClick={() => setPreview(row)} aria-label={`Preview ${row.name}`}>
            Preview
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<Download size={13} />} onClick={() => handleDownload(row)} aria-label={`Download ${row.name}`}>
            Download
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Contracts, project files and invoices shared with your company."
        breadcrumbItems={[{ label: 'Documents' }]}
        homeHref="/client/dashboard"
        action={
          <Button leftIcon={<Upload size={15} />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DocsSkeleton />}>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Files shared with your company will appear here. You can also upload files for the team." actionLabel="Upload Document" onAction={() => setUploadOpen(true)} />
        ) : (
          <>
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search files..." />}
              chips={chips}
              onClearAll={() => {
                setCategory('')
                setProject('')
              }}
            >
              <Select aria-label="Filter by category" placeholder="All categories" options={categories.map((c) => ({ value: c, label: c }))} value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48" />
              <Select aria-label="Filter by project" placeholder="All projects" options={projects.map((p) => ({ value: p.name, label: p.name }))} value={project} onChange={(e) => setProject(e.target.value)} className="sm:w-56" />
            </FilterBar>
            <DataTable columns={columns} data={filtered} ariaLabel="Shared documents" emptyTitle="No documents match" emptyDescription="Try a different search or clear the filters." />
          </>
        )}
      </AsyncState>

      <FileUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        title="Upload a document"
        description="Share a file with the WorkFlow360 team working on your account."
        categories={CLIENT_UPLOAD_CATEGORIES}
        projects={projects.map((p) => p.name)}
      />
      <FilePreviewModal doc={preview} isOpen={Boolean(preview)} onClose={() => setPreview(null)} onDownload={handleDownload} />
    </div>
  )
}
