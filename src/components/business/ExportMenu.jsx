import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownLabel } from '../common/Dropdown'
import Button from '../common/Button'

export default function ExportMenu({ onCsv, onPdf, disabled = false }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="secondary" className="w-full sm:w-auto" leftIcon={<Download size={15} />} rightIcon={<ChevronDown size={14} />} disabled={disabled} aria-haspopup="menu">
          Export
        </Button>
      </DropdownTrigger>
      <DropdownMenu className="w-52">
        <DropdownLabel>Export shown data</DropdownLabel>
        <DropdownItem icon={<FileSpreadsheet size={15} className="text-success-600" />} onClick={onCsv}>
          Download CSV
        </DropdownItem>
        <DropdownItem icon={<FileText size={15} className="text-accent-600" />} onClick={onPdf}>
          Export as PDF
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
