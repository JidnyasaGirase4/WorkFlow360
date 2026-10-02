import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import InvoicePreview from '../components/business/InvoicePreview'

const PRINT_CSS = `
@page { size: A4; margin: 10mm; }
@media print {
  body > *:not(.invoice-print-portal) { display: none !important; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  .invoice-print-portal { display: block !important; }
}
@media screen { .invoice-print-portal { display: none; } }
`

// "Download PDF": mounts a print-only copy of the invoice and opens the
// browser print dialog (choose "Save as PDF"). Render `portal` once in the page.
export function usePrintInvoice({ onPrint } = {}) {
  const [payload, setPayload] = useState(null)

  const print = useCallback(
    (data) => {
      setPayload(data)
      onPrint?.()
      setTimeout(() => window.print(), 150)
    },
    [onPrint]
  )

  useEffect(() => {
    const clear = () => setPayload(null)
    window.addEventListener('afterprint', clear)
    return () => window.removeEventListener('afterprint', clear)
  }, [])

  const portal = payload
    ? createPortal(
        <div className="invoice-print-portal">
          <style>{PRINT_CSS}</style>
          <InvoicePreview invoice={payload.invoice} client={payload.client} flat />
        </div>,
        document.body
      )
    : null

  return { print, portal }
}
