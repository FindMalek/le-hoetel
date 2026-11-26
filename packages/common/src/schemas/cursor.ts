import { z } from "zod"

const SHAPE =
  /^\d{4}-\d\d-\d\d ([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?[+-](0\d|1[0-5])(:[0-5]\d)?\|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

/** Postgres would fail on a day like 02-30 with a 500, so it is refused here. */
const isRealDay = (cursor: string) => {
  const day = cursor.slice(0, 10)
  const date = new Date(`${day}T00:00:00Z`)
  return !day.startsWith("0000") && !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day)
}

/** Opaque "after this row" marker of a list: the row's exact database timestamp and its id. */
export const cursorSchema = z.string().regex(SHAPE).refine(isRealDay, "Not a cursor.")
