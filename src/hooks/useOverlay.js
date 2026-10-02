import { useEffect, useRef } from 'react'

// Shared behaviour for modal-like layers (Modal, Drawer, mobile sidebar):
//  - Escape closes only the top-most open layer
//  - Tab / Shift+Tab is trapped inside the layer
//  - focus moves into the layer on open and is restored to the opener on close
//  - body scroll is locked (ref-counted so stacked layers cooperate)
const layerStack = []
let scrollLocks = 0

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
}

function pickInitialFocus(container) {
  return (
    container.querySelector('[data-autofocus]') ||
    container.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
    getFocusable(container)[0] ||
    container
  )
}

export function useOverlay({ isOpen, onClose, ref, trapFocus = true, lockScroll = true, restoreFocus = true }) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return undefined
    const token = {}
    layerStack.push(token)
    const opener = document.activeElement
    const container = ref.current

    if (lockScroll) {
      scrollLocks += 1
      document.body.style.overflow = 'hidden'
    }

    if (trapFocus && container) {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
      pickInitialFocus(container).focus({ preventScroll: true })
    }

    function onKeyDown(e) {
      if (layerStack[layerStack.length - 1] !== token) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current?.()
        return
      }
      if (e.key === 'Tab' && trapFocus && ref.current) {
        const items = getFocusable(ref.current)
        if (items.length === 0) {
          e.preventDefault()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        } else if (!ref.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const idx = layerStack.indexOf(token)
      if (idx !== -1) layerStack.splice(idx, 1)
      if (lockScroll) {
        scrollLocks = Math.max(0, scrollLocks - 1)
        if (scrollLocks === 0) document.body.style.overflow = ''
      }
      if (restoreFocus && opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [isOpen, ref, trapFocus, lockScroll, restoreFocus])
}
