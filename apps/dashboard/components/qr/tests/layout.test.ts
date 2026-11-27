import { expect, test } from "bun:test"
import { A4, gridOf, type Layout, layoutFor, MARK, type StickerSize } from "../layout"

const PIECES = ["room", "table", "desk", "sticker"] as const
const STICKERS: StickerSize[] = ["small", "large"]

/** Room around the grid on the tightest side. */
const margin = (layout: Layout) => {
  const { lefts, tops } = gridOf(layout)
  return Math.min(lefts[0]!, tops[0]!)
}

test("every piece fits A4 with its crop marks on the paper and no bleed over a neighbor", () => {
  for (const piece of PIECES) {
    for (const stickers of STICKERS) {
      const layout = layoutFor(piece, "office", stickers)
      expect([layout.page.width, layout.page.height].sort()).toEqual([A4.width, A4.height])
      // at least 3 mm of every mark stays where an office printer reaches (about 4 mm from the edge)
      expect(margin(layout) - MARK.gap - 4).toBeGreaterThanOrEqual(3)
      expect(layout.gutter).toBeGreaterThanOrEqual(2 * layout.bleed)
    }
  }
  const room = layoutFor("room", "office", "small")
  const large = layoutFor("sticker", "office", "large")
  expect([room.columns * room.rows, large.columns, large.rows]).toEqual([4, 2, 3])
  expect(layoutFor("table", "office", "small").columns).toBe(2)
})

test("a print shop page is one piece at its true size, with bleed and marks inside the page", () => {
  const layout = layoutFor("room", "shop", "small")
  expect(layout).toMatchObject({ cell: { width: 105, height: 148 }, bleed: 3, columns: 1, rows: 1 })
  expect(margin(layout)).toBeCloseTo(MARK.gap + MARK.length)
  expect(MARK.gap).toBeGreaterThan(layout.bleed)
})
