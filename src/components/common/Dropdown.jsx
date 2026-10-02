import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useRef } from 'react'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useDisclosure } from '../../hooks/useDisclosure'
import { cn } from '../../utils/cn'

const DropdownContext = createContext(null)

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])'

export function Dropdown({ children, className }) {
  const disclosure = useDisclosure(false)
  const ref = useRef(null)
  const menuId = useId()
  useClickOutside(ref, disclosure.close, disclosure.isOpen)

  return (
    <DropdownContext.Provider value={{ ...disclosure, menuId, containerRef: ref }}>
      <div ref={ref} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

const NATIVE_INTERACTIVE = ['button', 'a', 'input', 'select', 'textarea']

// Toggles the menu. Keyboard: Enter/Space (native buttons) or ArrowDown opens it.
// With `asChild` the child element receives the ARIA attributes and (when it is
// a plain span/div) becomes a focusable role=button.
export function DropdownTrigger({ children, asChild, className, ...rest }) {
  const { toggle, open, isOpen, menuId } = useContext(DropdownContext)

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && !isOpen) {
      e.preventDefault()
      open()
    }
  }

  if (asChild && isValidElement(children)) {
    const isPlain = typeof children.type === 'string' && !NATIVE_INTERACTIVE.includes(children.type)
    const childProps = children.props
    return cloneElement(children, {
      'aria-haspopup': 'menu',
      'aria-expanded': isOpen,
      'aria-controls': isOpen ? menuId : undefined,
      'aria-label': childProps['aria-label'] || (isPlain ? 'Open menu' : undefined),
      ...(isPlain && childProps.tabIndex === undefined ? { role: 'button', tabIndex: 0 } : {}),
      onClick: (e) => {
        childProps.onClick?.(e)
        toggle()
      },
      onKeyDown: (e) => {
        childProps.onKeyDown?.(e)
        if (isPlain && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          toggle()
        } else {
          onKeyDown(e)
        }
      },
    })
  }

  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuId : undefined}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={className}
      {...rest}
    >
      {children}
    </button>
  )
}

// Arrow Up/Down/Home/End move between items, Escape closes and returns focus
// to the trigger, Tab closes. On open, focus moves to the first item (or the menu).
export function DropdownMenu({ align = 'right', className, children, role = 'menu', label }) {
  const { isOpen, close, menuId, containerRef } = useContext(DropdownContext)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const first = menuRef.current?.querySelector(ITEM_SELECTOR)
    ;(first || menuRef.current)?.focus({ preventScroll: true })
  }, [isOpen])

  if (!isOpen) return null

  function focusTrigger() {
    containerRef.current?.querySelector('[aria-haspopup]')?.focus()
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      focusTrigger()
      return
    }
    if (e.key === 'Tab') {
      close()
      return
    }
    const items = Array.from(menuRef.current.querySelectorAll(ITEM_SELECTOR))
    if (items.length === 0) return
    const idx = items.indexOf(document.activeElement)
    let next = null
    if (e.key === 'ArrowDown') next = items[(idx + 1) % items.length]
    if (e.key === 'ArrowUp') next = items[(idx - 1 + items.length) % items.length]
    if (e.key === 'Home') next = items[0]
    if (e.key === 'End') next = items[items.length - 1]
    if (next) {
      e.preventDefault()
      next.focus()
    }
  }

  return (
    <div
      ref={menuRef}
      id={menuId}
      role={role}
      aria-label={label}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        'animate-scale-in absolute z-40 mt-2 min-w-[12rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-ink-100 bg-white p-1.5 shadow-panel outline-none dark:border-ink-800 dark:bg-ink-900',
        align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownItem({ icon, danger = false, className, children, onClick, ...props }) {
  const { close, containerRef } = useContext(DropdownContext)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={(e) => {
        onClick?.(e)
        close()
        containerRef.current?.querySelector('[aria-haspopup]')?.focus()
      }}
      className={cn(
        'focus-ring group/item flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all duration-150 hover:pl-3.5 focus-visible:bg-brand-50 dark:focus-visible:bg-ink-800 [&>svg]:shrink-0 [&>svg]:transition-transform hover:[&>svg]:scale-110',
        danger
          ? 'text-danger-600 hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-500/10'
          : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700 dark:text-ink-200 dark:hover:bg-ink-800 dark:hover:text-brand-200',
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1 h-px bg-ink-100 dark:bg-ink-800" />
}

export function DropdownLabel({ children }) {
  return <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{children}</div>
}
