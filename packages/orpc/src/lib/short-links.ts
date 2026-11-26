import { ORPCError } from "@orpc/server"
import { newShortCode, normalizeShortCode } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { hotelSettings, organization, shortLinks } from "@ritorno/db"
import { and, eq, inArray, ne } from "drizzle-orm"
import type { Context } from "../context"

/** A taken code only costs one more round, and with 28^8 codes even one is unlikely. */
const ATTEMPTS = 4
/** Rows are never removed, so this bounds what typos and scripts can pile up: four times `HOTEL_SPOTS_MAX`. */
export const SHORT_LINKS_PER_HOTEL = 2000

/**
 * The stable short code of each spot of one hotel, made on first use. `""` is the code without a spot. With
 * `create` false nothing is written and a spot nobody made a code for is missing from the result.
 */
export async function shortCodes(
  db: Context["db"],
  hotelId: string,
  source: CaptureSource,
  locations: string[],
  create: boolean,
): Promise<Map<string, string>> {
  // sorted, so two calls inserting the same spots lock them in the same order instead of deadlocking
  const wanted = [...new Set(locations)].sort()
  for (let inserts = 0; ; inserts++) {
    const rows = await db
      .select({ code: shortLinks.code, location: shortLinks.location })
      .from(shortLinks)
      .where(and(eq(shortLinks.hotelId, hotelId), eq(shortLinks.source, source), inArray(shortLinks.location, wanted)))
    const found = new Map(rows.map((row) => [row.location, row.code]))
    const missing = wanted.filter((location) => !found.has(location))
    if (!missing.length || !create) return found
    if (inserts === ATTEMPTS) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not make the short links." })
    }
    // checked without a lock: two calls at the same moment can pass it by one batch
    const made = await db.$count(shortLinks, eq(shortLinks.hotelId, hotelId))
    if (made + missing.length > SHORT_LINKS_PER_HOTEL) {
      throw new ORPCError("UNPROCESSABLE_CONTENT", {
        message: `A hotel can have ${SHORT_LINKS_PER_HOTEL} printed codes. Ask us to free some.`,
      })
    }
    await db
      .insert(shortLinks)
      .values(missing.map((location) => ({ code: newShortCode(), hotelId, source, location })))
      .onConflictDoNothing()
  }
}

/**
 * Where a printed code leads today: the hotel's current slug, whatever it was when the code was printed. A suspended
 * hotel is hidden, as in `public.hotel`.
 */
export async function findShortLink(db: Context["db"], code: string) {
  const [link] = await db
    .select({ slug: organization.slug, source: shortLinks.source, location: shortLinks.location })
    .from(shortLinks)
    .innerJoin(organization, eq(organization.id, shortLinks.hotelId))
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
    .where(and(eq(shortLinks.code, normalizeShortCode(code)), ne(hotelSettings.status, "suspended")))
  if (!link?.slug) throw new ORPCError("NOT_FOUND", { message: "Code not found." })
  return { slug: link.slug, source: link.source, location: link.location || null }
}
