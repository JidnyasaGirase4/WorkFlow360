import { useState } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../../utils/cn'
import { TONES, toneForDot, stagger } from './ProjectTones'

// Coloured drag & drop board used by the Tasks page and the Leads pipeline.
// Same behaviour as common/KanbanBoard (drag between columns, Enter to open a
// card, Alt+Arrow to move it) with tinted column headers and soft cards.
//   columns: [{ key, label, items }]   columnTone: { [key]: 'bg-info-500' ... }
// On phones the board scrolls sideways inside its own container and snaps to
// each column.
export default function TaskBoard({ columns, itemKey = 'id', onMove, renderCard, columnTone, onCardClick, cardAccent }) {
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
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 sm:gap-4 sm:pb-5 xl:snap-none">
      {columns.map((col, colIdx) => {
        const tone = TONES[toneForDot(columnTone?.[col.key])]
        const isOver = overColumn === col.key
        return (
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
            style={stagger(colIdx, 50)}
            className={cn(
              'animate-slide-up flex w-[82vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-2xl border border-t-4 bg-ink-50/70 transition-all duration-200 sm:w-72 xl:min-w-[15rem] xl:flex-1 xl:shrink dark:bg-ink-900/50',
              tone.top,
              isOver
                ? 'border-brand-300 bg-brand-50/80 shadow-glow ring-2 ring-brand-300/70 dark:border-brand-500/50 dark:bg-brand-500/10'
                : 'border-ink-100 dark:border-ink-800'
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', tone.bar)} />
                <h3 className="truncate text-sm font-bold text-ink-800 dark:text-ink-100">{col.label}</h3>
              </div>
              <span className={cn('min-w-[1.75rem] rounded-full px-2 py-0.5 text-center text-xs font-bold tabular-nums', tone.chip)}>
                {col.items.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-3">
              {col.items.map((item, i) => (
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
                  onDragEnd={() => {
                    setDragItem(null)
                    setOverColumn(null)
                  }}
                  style={stagger(i + colIdx, 40, 10)}
                  className={cn(
                    'animate-slide-up focus-ring cursor-grab rounded-xl border border-l-4 border-ink-100 bg-white p-3.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:cursor-grabbing dark:border-ink-800 dark:bg-ink-900',
                    cardAccent ? cardAccent(item) : 'border-l-transparent!',
                    dragItem === item[itemKey] && 'scale-[0.98] opacity-50'
                  )}
                >
                  {renderCard(item)}
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400 dark:border-ink-700">
                  <Inbox size={18} aria-hidden="true" className="text-ink-300" />
                  No items
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
