import "server-only"
import { createHash } from "node:crypto"
import { cookies } from "next/headers"

export const VIEW_HOTEL_COOKIE = "lh-view-hotel"
export const VIEW_HOTEL_MAX_AGE = 60 * 60 * 8

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"]

const sessionHash = (jar: Awaited<ReturnType<typeof cookies>>): string | null => {
  const token = SESSION_COOKIES.map((name) => jar.get(name)?.value).find(Boolean)
  return token ? createHash("sha256").update(token).digest("hex").slice(0, 16) : null
}

export async function viewCookieValue(hotelId: string): Promise<string | null> {
  const hash = sessionHash(await cookies())
  return hash ? `${hotelId}.${hash}` : null
}

/**
 * The hotel the app admin chose to open. The cookie is bound to the session it was made in, so signing out or in
 * as someone else makes it inert: the api refuses `x-hotel-id` for anyone but the admin.
 */
export async function viewedHotelId(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(VIEW_HOTEL_COOKIE)?.value
  const hash = sessionHash(jar)
  if (!value || !hash) return null
  const split = value.lastIndexOf(".")
  return value.slice(split + 1) === hash ? value.slice(0, split) : null
}
