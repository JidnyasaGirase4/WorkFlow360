import FileTypeIcon from '../common/FileTypeIcon'
import { cn } from '../../utils/cn'
import { FILE_TONE, toneOf } from './tones'

// Coloured tile for a document `type` (pdf | doc | sheet | image | design | archive).
export default function FileTypeTile({ type, size = 'md', className }) {
  const tone = toneOf(FILE_TONE[type] || 'neutral')
  const box = size === 'lg' ? 'h-12 w-12 rounded-2xl' : size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
  return (
    <span className={cn('flex shrink-0 items-center justify-center', box, tone.chip, className)}>
      <FileTypeIcon type={type} size={size === 'lg' ? 22 : size === 'sm' ? 15 : 18} />
    </span>
  )
}
