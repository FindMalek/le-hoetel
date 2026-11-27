import type { Piece } from "./art"

/** All sizes in mm. */
export const A4 = { width: 210, height: 297 }
/** How far a print shop piece runs past its cut. */
export const BLEED = 3
/** From the cut to the start of a crop mark, outside the bleed, and the length of the mark. */
export const MARK = { gap: 3.5, length: 5 }

/** `office` prints on the hotel's own A4 printer, `shop` goes to a print shop. */
export type Paper = "office" | "shop"
export type StickerSize = "small" | "large"

type Size = { width: number; height: number }

export type Layout = {
  page: Size
  /** One piece between its cut lines. */
  cell: Size
  columns: number
  rows: number
  /** Space between two pieces: room for both bleeds. */
  gutter: number
  /** How far the art runs past the cut. Stickers are white at the edge, so theirs is blank. */
  bleed: number
}

const turned = { width: A4.height, height: A4.width }

/** Final size of each piece, as a print shop makes it. */
export const TRIM: Record<"room" | "table" | "desk" | StickerSize, Size> = {
  room: { width: 105, height: 148 },
  table: { width: 148, height: 210 },
  desk: { width: 148, height: 210 },
  small: { width: 45, height: 52 },
  large: { width: 78.75, height: 91 },
}

const scaled = (size: Size, width: number): Size => ({ width, height: (width * size.height) / size.width })

/**
 * On A4 the cards are a little under A6 and A5, so the crop marks and the white edge no office printer can reach fit
 * around them.
 */
const OFFICE: Record<keyof typeof TRIM, Layout> = {
  room: { page: A4, cell: scaled(TRIM.room, 90), columns: 2, rows: 2, gutter: 2 * BLEED, bleed: BLEED },
  table: { page: turned, cell: scaled(TRIM.table, 131), columns: 2, rows: 1, gutter: 2 * BLEED, bleed: BLEED },
  desk: { page: turned, cell: scaled(TRIM.desk, 131), columns: 2, rows: 1, gutter: 2 * BLEED, bleed: BLEED },
  small: { page: A4, cell: TRIM.small, columns: 4, rows: 5, gutter: 0, bleed: 0 },
  large: { page: A4, cell: TRIM.large, columns: 2, rows: 3, gutter: 0, bleed: 0 },
}

export function layoutFor(piece: Piece, paper: Paper, stickers: StickerSize): Layout {
  const key = piece === "sticker" ? stickers : piece
  if (paper === "office") return OFFICE[key]
  // one piece per page at its true size, with room around it for the bleed and the marks
  const edge = 2 * (MARK.gap + MARK.length)
  const cell = TRIM[key]
  return {
    page: { width: cell.width + edge, height: cell.height + edge },
    cell,
    columns: 1,
    rows: 1,
    gutter: 0,
    bleed: BLEED,
  }
}

const starts = (count: number, size: number, gutter: number, page: number) => {
  const first = (page - count * size - (count - 1) * gutter) / 2
  return Array.from({ length: count }, (_, i) => first + i * (size + gutter))
}

/** The left edge of each column and the top of each row. */
export const gridOf = ({ page, cell, columns, rows, gutter }: Layout) => ({
  lefts: starts(columns, cell.width, gutter, page.width),
  tops: starts(rows, cell.height, gutter, page.height),
})

/** Short ticks outside the pieces at every cut line, so no line is ever printed on one. */
export function cropMarks(layout: Layout): string {
  const { lefts, tops } = gridOf(layout)
  const { width, height } = layout.cell
  const xs = [...new Set(lefts.flatMap((x) => [x, x + width]))]
  const ys = [...new Set(tops.flatMap((y) => [y, y + height]))]
  const [first, last] = [
    { x: xs[0]!, y: ys[0]! },
    { x: xs.at(-1)!, y: ys.at(-1)! },
  ]
  const { gap, length } = MARK
  return [
    ...xs.map((x) => `M${x} ${first.y - gap - length}v${length}M${x} ${last.y + gap}v${length}`),
    ...ys.map((y) => `M${first.x - gap - length} ${y}h${length}M${last.x + gap} ${y}h${length}`),
  ].join("")
}
