import { SlidersHorizontal } from 'lucide-react'
import { useDisclosure } from '../../hooks/useDisclosure'
import Button from './Button'
import Drawer from './Drawer'
import { cn } from '../../utils/cn'

// "Filters" button (mobile only by default) that opens a bottom-sheet holding
// the filter controls, with Reset / Apply actions. The controls stay
// controlled by the parent, so Apply simply confirms and closes.
export default function MobileFilterSheet({
  children,
  activeCount = 0,
  title = 'Filters',
  buttonLabel = 'Filters',
  onApply,
  onReset,
  className,
  triggerClassName = 'sm:hidden',
}) {
  const sheet = useDisclosure(false)

  function apply() {
    onApply?.()
    sheet.close()
  }

  return (
    <div className={className}>
      <Button
        variant="secondary"
        onClick={sheet.open}
        leftIcon={<SlidersHorizontal size={15} />}
        className={cn(triggerClassName)}
        aria-haspopup="dialog"
      >
        {buttonLabel}
        {activeCount > 0 && (
          <span className="ml-0.5 rounded-full bg-accent-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{activeCount}</span>
        )}
      </Button>
      <Drawer
        isOpen={sheet.isOpen}
        onClose={sheet.close}
        placement="bottom"
        title={title}
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => onReset?.()}>
              Reset
            </Button>
            <Button className="flex-1" onClick={apply}>
              Apply
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 [&>*]:w-full">{children}</div>
      </Drawer>
    </div>
  )
}
