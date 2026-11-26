"use client"

import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { createORPCClientUtils } from "./client"

/** The hotel this tab shows. Another tab may have switched since, and the api must act on this one or refuse. */
let screenHotelId: string | null = null

/** Browser client: same-origin `/api/rpc`, which the app's route handler proxies to the api. */
export const { client: browserClient } = createORPCClientUtils({
  url: () => `${window.location.origin}/api/rpc`,
  getHeaders: (): Record<string, string> => (screenHotelId ? { "x-hotel-id": screenHotelId } : {}),
})

export const orpc = createTanstackQueryUtils(browserClient)

/**
 * One QueryClient per browser tab (never shared between server requests). `hotelId` is the hotel on screen (null for
 * none), sent with every call; leave it out where no hotel is shown.
 */
export function QueryProvider({ children, hotelId }: { children: ReactNode; hotelId?: string | null }) {
  // Set while rendering: the children's first queries run before any effect of this component.
  if (hotelId !== undefined && typeof window !== "undefined") screenHotelId = hotelId
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
  )
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
