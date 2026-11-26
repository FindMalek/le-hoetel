import type { orpc } from "@ritorno/orpc/react"

/**
 * The long lists, built the same way on the server (prefetch) and in the browser so the cache hydrates. `hotelId`
 * is the hotel the page was rendered for: it is part of the key and sent with every page, so a hotel switched in
 * another tab can never add its rows under this one's.
 */
type Api = typeof orpc

const PAGE_SIZE = 25
const first = undefined as string | undefined
const next = (page: { nextCursor: string | null }) => page.nextCursor ?? undefined

export function forHotel<T extends { queryKey: readonly unknown[] }>(options: T, hotelId: string): T {
  return { ...options, queryKey: [...options.queryKey, hotelId] as unknown as T["queryKey"] }
}

type GuestFilters = Omit<Parameters<Api["guests"]["list"]["call"]>[0], "cursor" | "limit">
type MessageFilters = Omit<NonNullable<Parameters<Api["messages"]["list"]["call"]>[0]>, "cursor" | "limit">
type CaseFilters = Omit<NonNullable<Parameters<Api["feedbackCases"]["list"]["call"]>[0]>, "cursor" | "limit">

export const guestsList = (api: Api, hotelId: string, filters: GuestFilters) =>
  forHotel(
    api.guests.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ ...filters, limit: PAGE_SIZE, cursor }),
      initialPageParam: first,
      getNextPageParam: next,
      staleTime: 60_000,
      context: { hotelId },
    }),
    hotelId,
  )

/** Delivery statuses move on their own, so this one goes stale soonest. */
export const messagesList = (api: Api, hotelId: string, filters: MessageFilters) =>
  forHotel(
    api.messages.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ ...filters, limit: PAGE_SIZE, cursor }),
      initialPageParam: first,
      getNextPageParam: next,
      staleTime: 15_000,
      context: { hotelId },
    }),
    hotelId,
  )

export const feedbackCasesList = (api: Api, hotelId: string, filters: CaseFilters) =>
  forHotel(
    api.feedbackCases.list.infiniteOptions({
      input: (cursor: string | undefined) => ({ ...filters, limit: PAGE_SIZE, cursor }),
      initialPageParam: first,
      getNextPageParam: next,
      staleTime: 30_000,
      context: { hotelId },
    }),
    hotelId,
  )

export const redemptionsList = (api: Api, hotelId: string) =>
  forHotel(
    api.offers.redemptions.infiniteOptions({
      input: (cursor: string | undefined) => ({ limit: PAGE_SIZE, cursor }),
      initialPageParam: first,
      getNextPageParam: next,
      staleTime: 30_000,
      context: { hotelId },
    }),
    hotelId,
  )

/** The counts above the redemptions list, so both are of one hotel. */
export const redemptionStats = (api: Api, hotelId: string) =>
  forHotel(api.offers.redemptionStats.queryOptions({ context: { hotelId } }), hotelId)
