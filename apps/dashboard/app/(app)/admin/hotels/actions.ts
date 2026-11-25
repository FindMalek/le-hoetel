"use server"

import type { Route } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { call } from "@/lib/api"
import { VIEW_HOTEL_COOKIE, VIEW_HOTEL_MAX_AGE, viewCookieValue } from "@/lib/view-hotel"

const SAFE_TARGETS: string[] = ["/", "/guests", "/hotel", "/qr-codes", "/offers", "/team"]

/** The api checks the admin role on `admin.hotels.get`, so a non admin can't set the cookie to anything useful. */
export async function openAsHotel(hotelId: string, target: string): Promise<void> {
  const hotel = await call((api) => api.admin.hotels.get({ id: hotelId }))
  const value = await viewCookieValue(hotel.id)
  if (!value) redirect("/sign-in")
  ;(await cookies()).set(VIEW_HOTEL_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VIEW_HOTEL_MAX_AGE,
  })
  redirect((SAFE_TARGETS.includes(target) ? target : "/") as Route)
}

export async function leaveHotel(hotelId: string): Promise<void> {
  ;(await cookies()).delete(VIEW_HOTEL_COOKIE)
  redirect(`/admin/hotels/${hotelId}`)
}
