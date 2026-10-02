import { useState } from 'react'
import { cn } from '../../utils/cn'

// Drag & drop board. Optional additions (backward compatible):
//   onCardClick(item)   makes cards focusable buttons; Enter/click opens details
//   Keyboard: focus a card and press Alt+ArrowLeft / Alt+ArrowRight to move it
//   between columns (drag & drop does not work on touch screens, so pair the
//   board with a status control in your detail view for mobile users).
export default function KanbanBoard({ columns, itemKey = 'id', onMove, renderCard, columnTone, onCardClick }) {
  const [dragItem, setDragItem] = useState(null)
  const [overColumn, setOverColumn] = useState(null)

  function moveByKeyboard(e, item, colIdx) {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    const target = columns[colIdx + (e.key === 'ArrowRight' ? 1 : -1)]
    if (!target) return
    e.preventDefault()
    onMove(item[itemKey], target.key)
  }

  return (
    <div className="flex snap-x gap-4 overflow-x-auto pb-4">
      {columns.map((col, colIdx) => (
        <section
          key={col.key}
          aria-label={`${col.label}, ${col.items.length} items`}
          onDragOver={(e) => {
            e.preventDefault()
            setOverColumn(col.key)
          }}
          onDragLeave={() => setOverColumn((c) => (c === col.key ? null : c))}
          onDrop={() => {
            if (dragItem) onMove(dragItem, col.key)
            setDragItem(null)
            setOverColumn(null)
          }}
          className={cn(
            'relative flex min-w-[16rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl lg:min-w-[14rem] lg:flex-1 lg:shrink border bg-ink-50/70 transition-all duration-200 dark:bg-ink-900/40',
            overColumn === col.key
              ? 'border-brand-400 bg-brand-50/70 shadow-[0_0_0_3px_rgb(26_169_150/0.15)] dark:bg-brand-500/10'
              : 'border-ink-100 dark:border-ink-800'
          )}
        >
          <span aria-hidden="true" className={cn('h-1 w-full shrink-0', columnTone?.[col.key] || 'bg-ink-300')} />
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-bold text-ink-700 dark:text-ink-200">{col.label}</h3>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-500 shadow-sm dark:bg-ink-800">
              {col.items.length}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-3">
            {col.items.map((item) => (
              <div
                key={item[itemKey]}
                draggable
                tabIndex={onCardClick ? 0 : undefined}
                role={onCardClick ? 'button' : undefined}
                onClick={() => onCardClick?.(item)}
                onKeyDown={(e) => {
                  if (onCardClick && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onCardClick(item)
                  }
                  moveByKeyboard(e, item, colIdx)
                }}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', String(item[itemKey]))
                  setDragItem(item[itemKey])
                }}
                onDragEnd={() => setDragItem(null)}
                className={cn(
                  'focus-ring cursor-grab rounded-xl border border-ink-100 bg-white p-3.5 shadow-card transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-500/30',
                  dragItem === item[itemKey] && 'rotate-1 opacity-50 ring-2 ring-brand-400'
                )}
              >
                {renderCard(item)}
              </div>
            ))}
            {col.items.length === 0 && (
              <div className="rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400 dark:border-ink-700">
                No items
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
