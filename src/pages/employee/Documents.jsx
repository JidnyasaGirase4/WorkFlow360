import { useMemo, useState } from 'react'
import { Upload, Eye, Download, FileText } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import DataTable from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import Select from '../../components/common/Select'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import Badge from '../../components/common/Badge'
import FileUploadModal from '../../components/common/FileUploadModal'
import FilePreviewModal from '../../components/common/FilePreviewModal'
import FileTypeTile from '../../components/portal/FileTypeTile'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { addUploadedDoc } from '../../utils/portalStores'
import { downloadMockDocument } from '../../utils/download'
import { DOCUMENT_CATEGORIES } from '../../mockData/documents'
import { formatDate, formatFileSize } from '../../utils/format'

const TYPE_BY_EXT = { pdf: 'pdf', doc: 'doc', docx: 'doc', xls: 'sheet', xlsx: 'sheet', csv: 'sheet', png: 'image', jpg: 'image', jpeg: 'image', zip: 'archive', fig: 'design' }

function DocsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading documents">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}

export default function EmployeeDocuments() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, documents, projects } = useEmployeeData()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => (!q || d.name.toLowerCase().includes(q) || (d.project || '').toLowerCase().includes(q)) && (!category || d.category === category))
  }, [documents, search, category])

  function handleUpload({ file, category: cat, project, note }) {
    const ext = file.name.split('.').pop().toLowerCase()
    addUploadedDoc({
      name: file.name,
      category: cat,
      project,
      client: null,
      uploadedBy: name,
      size: formatFileSize(file.size),
      sizeBytes: file.size,
      type: TYPE_BY_EXT[ext] || 'doc',
      note,
    })
    toast.success(`${file.name} uploaded successfully`)
    setUploadOpen(false)
  }

  function handleDownload(doc) {
    downloadMockDocument(doc)
    toast.success(`Downloading ${doc.name}`)
  }

  const columns = [
    {
      key: 'name',
      header: 'Document',
      sortable: true,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <FileTypeTile type={row.type} size="sm" />
          <span className="truncate font-semibold text-ink-800 dark:text-ink-100">{row.name}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <Badge tone="brand">{row.category}</Badge> },
    { key: 'project', header: 'Project', render: (row) => row.project || '—' },
    { key: 'uploadedBy', header: 'Uploaded By' },
    { key: 'uploadedDate', header: 'Date', sortable: true, render: (row) => formatDate(row.uploadedDate) },
    { key: 'size', header: 'Size', sortable: true, sortAccessor: (row) => row.sizeBytes || 0 },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setPreview(row)} aria-label={`Preview ${row.name}`}>
            <Eye size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDownload(row)} aria-label={`Download ${row.name}`}>
            <Download size={15} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Your HR documents, files you've uploaded and shared project files."
        breadcrumbItems={[{ label: 'HR' }, { label: 'Documents' }]}
        homeHref="/employee/dashboard"
        action={
          <Button leftIcon={<Upload size={15} />} onClick={() => setUploadOpen(true)}>
            Upload Document
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DocsSkeleton />}>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Upload a file or wait for HR to share documents with you." actionLabel="Upload Document" onAction={() => setUploadOpen(true)} />
        ) : (
          <>
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search documents..." />}
              chips={category ? [{ key: 'category', label: `Category: ${category}`, onRemove: () => setCategory('') }] : []}
              onClearAll={() => setCategory('')}
            >
              <Select aria-label="Filter by category" placeholder="All categories" options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52" />
            </FilterBar>
            <DataTable columns={columns} data={filtered} ariaLabel="My documents" emptyTitle="No documents match" emptyDescription="Try a different search or category." />
          </>
        )}
      </AsyncState>

      <FileUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleUpload}
        title="Upload document"
        description="Add a file to your workspace documents."
        categories={DOCUMENT_CATEGORIES}
        projects={projects.map((p) => p.name)}
      />
      <FilePreviewModal doc={preview} isOpen={Boolean(preview)} onClose={() => setPreview(null)} onDownload={handleDownload} />
    </div>
  )
}
