import "server-only"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import type { AppRouterClient } from "@ritorno/orpc/client"
import { isForbidden, isUnauthorized } from "@ritorno/orpc/errors"
import { createServerClient } from "@ritorno/orpc/server"
import { QueryClient } from "@tanstack/react-query"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { cache } from "react"
import { viewedHotelId } from "@/lib/view-hotel"

/** Server calls carry the visitor's cookie (and the csrf header the link adds), straight to the api service. An admin who opened a hotel also sends `x-hotel-id`. */
const api = createServerClient(async () => {
  const hotelId = await viewedHotelId()
  return { cookie: (await cookies()).toString(), ...(hotelId ? { "x-hotel-id": hotelId } : {}) }
})

/** Same keys as the browser's `orpc` utils, so what the server prefetches hydrates the client cache. */
export const serverOrpc = createTanstackQueryUtils(api)

/** One QueryClient per request, shared by every server component that prefetches into it. */
export const getQueryClient = cache(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }))

/**
 * The hotel this request's data calls act on: the one the admin opened, else the member's active one. Null when the
 * api refuses (none, or suspended).
 */
export const currentHotel = cache(() =>
  call((client) => client.hotel.get()).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  }),
)

/** The caller's role on that hotel, null with none on screen. */
export const hotelRole = cache(async () => {
  const [{ role }, hotel] = await Promise.all([call((client) => client.hotel.mine()), currentHotel()])
  return hotel ? role : null
})

/** The platform pages do not exist for anyone else. Call before the page's own data, which the api would refuse. */
export async function requireAdmin(): Promise<void> {
  const me = await call((client) => client.me.get())
  if (me.role !== "admin") notFound()
}

/** A direct call for server components; an expired session goes back to sign-in. */
export async function call<T>(fn: (client: AppRouterClient) => Promise<T>): Promise<T> {
  try {
    return await fn(api)
  } catch (error) {
    if (isUnauthorized(error)) redirect("/sign-in")
    throw error
  }
}
