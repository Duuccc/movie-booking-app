import { ChevronLeft, ChevronRight } from 'lucide-react'

// Trả về dạng [1, '...', 4, 5, 6, '...', 20]. Nếu chỉ thiếu đúng một số
// giữa hai mốc thì hiện luôn số đó thay vì dấu '...'.
function getPageNumbers(page, total) {
  const wanted = new Set([1, total, page - 1, page, page + 1])
  const sorted = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const result = []
  sorted.forEach((p, i) => {
    if (i > 0) {
      const gap = p - sorted[i - 1]
      // if (gap === 2) result.push(p - 1)
      if (gap >= 2) result.push('...')
    }
    result.push(p)
  })
  return result
}

function Pagination({ page, totalPages, totalItems, start, end, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="pagination">
      <p className="pagination-info">
        Showing {start + 1}–{end} of {totalItems}
      </p>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`gap-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              type="button"
              className={'pagination-btn' + (p === page ? ' pagination-btn-active' : '')}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="pagination-btn"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export default Pagination