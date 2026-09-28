import { useState } from 'react'

export function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  // Tính lại mỗi lần render thay vì lưu vào state: nếu xoá dòng cuối của
  // trang cuối, trang hiện tại tự lùi về, không bị kẹt ở trang trống.
  const currentPage = Math.min(page, totalPages)

  const start = (currentPage - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return {
    pageItems,
    paginationProps: {
      page: currentPage,
      totalPages,
      totalItems: items.length,
      start,
      end: start + pageItems.length,
      onPageChange: setPage,
    },
  }
}