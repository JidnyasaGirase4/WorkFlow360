import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRightLeft, Check } from 'lucide-react'
import { cn } from '../../utils/cn'

// Keyboard-friendly alternative to drag and drop: a small menu that moves a
// card to another column. Rendered in a portal so Kanban overflow can't clip it.
export default function MoveToMenu({ options, current, onSelect, itemLabel = 'item' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const close = useCallback((returnFocus = false) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  function toggle(e) {
    e.stopPropagation()
    if (open) {
      close()
      return
    }
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = 176
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8)
    const top = Math.min(rect.bottom + 6, window.innerHeight - options.length * 40 - 24)
    setPos({ top: Math.max(8, top), left })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const items = menuRef.current?.querySelectorAll('button:not([disabled])')
    items?.[0]?.focus()
    function onPointerDown(e) {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onDismiss() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
    }
  }, [open])

  function onKeyDown(e) {
    const items = [...menuRef.current.querySelectorAll('button:not([disabled])')]
    const idx = items.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
    } else if (e.key === 'Tab') {
      close()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        draggable={false}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Move ${itemLabel} to another column`}
        className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 sm:h-7 sm:w-7 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
      >
        <ArrowRightLeft size={14} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={`Move ${itemLabel} to`}
            onKeyDown={onKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{ top: pos.top, left: pos.left }}
            className="animate-scale-in fixed z-[70] w-44 rounded-2xl border border-ink-100 bg-white p-1.5 shadow-panel dark:border-ink-800 dark:bg-ink-900"
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">Move to</p>
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                disabled={opt.value === current}
                onClick={() => {
                  close(true)
                  onSelect(opt.value)
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:bg-brand-50 dark:focus-visible:bg-ink-800',
                  opt.value === current
                    ? 'cursor-default text-ink-400'
                    : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700 dark:text-ink-200 dark:hover:bg-ink-800'
                )}
              >
                <span className="flex items-center gap-2">
                  {opt.dot && <span className={cn('h-2 w-2 rounded-full', opt.dot)} />}
                  {opt.label}
                </span>
                {opt.value === current && <Check size={13} className="text-brand-600" aria-label="Current column" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
