import { type AnyColumn, and, eq, gt, lt, or, sql } from "drizzle-orm"

/** The sort timestamp as text: a js date would drop the microseconds and skip or repeat rows. */
export const cursorAt = (at: AnyColumn) => sql<string>`${at}::text`

/** Rows after the cursor in a `desc(at), id` ordering. */
export function afterCursor(at: AnyColumn, id: AnyColumn, cursor: string | undefined) {
  if (!cursor) return undefined
  const [time, lastId] = cursor.split("|") as [string, string]
  const boundary = sql`${time}::timestamptz`
  return or(lt(at, boundary), and(eq(at, boundary), gt(id, lastId)))
}

/** Takes `limit + 1` rows: the extra one only says there is another page. */
export function cursorPage<T extends { id: string; cursorAt: string }>(rows: T[], limit: number) {
  const page = rows.slice(0, limit)
  const last = rows.length > limit ? page.at(-1) : undefined
  return {
    items: page.map(({ cursorAt: _, ...row }) => row),
    nextCursor: last ? `${last.cursorAt}|${last.id}` : null,
  }
}
