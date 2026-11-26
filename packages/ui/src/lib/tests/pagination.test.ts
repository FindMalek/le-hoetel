import { expect, test } from "bun:test"
import { pageWindow } from "../pagination"

test("a page past the end or broken in the url snaps to a real page", () => {
  expect(pageWindow({ page: 9, pageSize: 20, total: 45 })).toEqual({
    page: 3,
    pageCount: 3,
    from: 41,
    to: 45,
    hasPrevious: true,
    hasNext: false,
  })
  expect(pageWindow({ page: Number.NaN, pageSize: 20, total: 45 }).page).toBe(1)
})

test("an empty list is one page showing nothing", () => {
  expect(pageWindow({ page: 1, pageSize: 20, total: 0 })).toMatchObject({
    pageCount: 1,
    from: 0,
    to: 0,
    hasNext: false,
  })
})
