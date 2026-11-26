export type PageWindow = {
  page: number
  pageCount: number
  /** 1-based index of the first row shown, 0 when there are no rows. */
  from: number
  to: number
  hasPrevious: boolean
  hasNext: boolean
}

/** Where a page sits in a list of `total` rows. An out of range or broken page (from the url) snaps to the nearest real one. */
export function pageWindow({ page, pageSize, total }: { page: number; pageSize: number; total: number }): PageWindow {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Number.isFinite(page) ? Math.min(Math.max(1, Math.trunc(page)), pageCount) : 1
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  return {
    page: current,
    pageCount,
    from,
    to: Math.min(current * pageSize, total),
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  }
}
