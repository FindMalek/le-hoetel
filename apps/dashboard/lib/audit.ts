import type { AppRouterClient } from "@ritorno/orpc/client"
import type { orpc } from "@ritorno/orpc/react"
import { forHotel } from "./lists"

/** The audit filters' "no filter" value: an empty one renders as the Select placeholder, muted. */
export const AUDIT_ALL = "all"

export type AdminAuditFilter = Omit<NonNullable<Parameters<AppRouterClient["admin"]["audit"]["list"]>[0]>, "cursor">
export type HotelAuditFilter = Omit<NonNullable<Parameters<AppRouterClient["audit"]["list"]>[0]>, "cursor">

const paging = {
  initialPageParam: null as string | null,
  getNextPageParam: (page: { nextCursor: string | null }) => page.nextCursor,
}

/** Shared by the server prefetch and the browser, so both use one cache key. */
export const adminAuditPages = (utils: typeof orpc, filter: AdminAuditFilter) =>
  utils.admin.audit.list.infiniteOptions({ input: (cursor: string | null) => ({ ...filter, cursor }), ...paging })

/** Of the hotel the page was rendered for, like the lists in `lists.ts`. */
export const hotelAuditPages = (utils: typeof orpc, hotelId: string, filter: HotelAuditFilter) =>
  forHotel(
    utils.audit.list.infiniteOptions({
      input: (cursor: string | null) => ({ ...filter, cursor }),
      context: { hotelId },
      ...paging,
    }),
    hotelId,
  )

/** A `YYYY-MM-DD` from the url, or nothing when it is not a real day. */
export function urlDay(value: string | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && value.length === 10
    ? value
    : undefined
}

export const picked = (value: string | undefined): string | undefined =>
  value && value !== AUDIT_ALL ? value : undefined

/** The translated action, falling back to the raw name for a row written by a newer api. */
// i18n-used: adminAudit.actions
export function actionLabel(t: { has: (key: never) => boolean }, action: string): string {
  const key = `actions.${action}` as never
  return t.has(key) ? (t as unknown as (key: never) => string)(key) : action.replace(/[._-]+/g, " ")
}
