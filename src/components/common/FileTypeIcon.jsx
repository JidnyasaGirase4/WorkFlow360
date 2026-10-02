import { FileText, FileSpreadsheet, Image as ImageIcon, FileArchive, File as FileIcon } from 'lucide-react'

// Icon for a document `type` ('pdf' | 'doc' | 'sheet' | 'design' | 'image' | 'archive').
export default function FileTypeIcon({ type, size = 16, className }) {
  const props = { size, className, 'aria-hidden': true }
  switch (type) {
    case 'pdf':
    case 'doc':
      return <FileText {...props} />
    case 'sheet':
      return <FileSpreadsheet {...props} />
    case 'design':
    case 'image':
      return <ImageIcon {...props} />
    case 'archive':
      return <FileArchive {...props} />
    default:
      return <FileIcon {...props} />
  }
}
