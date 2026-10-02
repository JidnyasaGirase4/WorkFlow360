import { FileText, FileSpreadsheet, Image as ImageIcon, Palette, FileArchive, File as FileIcon, Presentation } from 'lucide-react'
import { fileExtension } from './validators'

const EXTENSION_KIND = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  txt: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  fig: 'design',
  psd: 'design',
  zip: 'archive',
}

export function fileKind(name) {
  return EXTENSION_KIND[fileExtension(name)] || 'file'
}

export const KIND_META = {
  pdf: { label: 'PDF document', icon: FileText, tone: 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-300' },
  doc: { label: 'Word document', icon: FileText, tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300' },
  sheet: { label: 'Spreadsheet', icon: FileSpreadsheet, tone: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300' },
  slides: { label: 'Presentation', icon: Presentation, tone: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300' },
  image: { label: 'Image', icon: ImageIcon, tone: 'bg-info-50 text-info-600 dark:bg-info-500/10 dark:text-info-300' },
  design: { label: 'Design file', icon: Palette, tone: 'bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-300' },
  archive: { label: 'Archive', icon: FileArchive, tone: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300' },
  file: { label: 'File', icon: FileIcon, tone: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300' },
}
