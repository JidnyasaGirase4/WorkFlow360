import { useState } from 'react'
import Pagination from '../common/Pagination'
import { cn } from '../../utils/cn'

// Card list with pagination — used as the mobile alternative to a data table.
export default function PagedCards({ items, renderItem, keyField = 'id', pageSize = 6, className }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = items.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className={className}>
      <ul className={cn('space-y-3 sm:space-y-4')}>
        {slice.map((item, i) => (
          <li key={item[keyField]} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
            {renderItem(item)}
          </li>
        ))}
      </ul>
      <Pagination page={safePage} totalPages={totalPages} onChange={setPage} totalItems={items.length} pageSize={pageSize} />
    </div>
  )
}
