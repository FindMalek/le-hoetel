import { z } from "zod"

/** Opaque "after this row" marker of a list: the row's exact database timestamp and its id. */
export const cursorSchema = z
  .string()
  .regex(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d{1,6})?[+-]\d\d(:\d\d)?\|[0-9a-f-]{36}$/)
