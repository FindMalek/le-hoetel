import { ORPCError } from "@orpc/server"
import { newShortCode, normalizeShortCode } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { organization, shortLinks } from "@ritorno/db"
import { and, eq, inArray } from "drizzle-orm"
import type { Context } from "../context"

/** A taken code only costs one more round, and with 31^6 codes a second one is already unlikely. */
const ATTEMPTS = 4

/** The stable short code of each spot of one hotel, made on first use. `""` is the code without a spot. */
export async function shortCodes(
  db: Context["db"],
  hotelId: string,
  source: CaptureSource,
  locations: string[],
): Promise<Map<string, string>> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const rows = await db
      .select({ code: shortLinks.code, location: shortLinks.location })
      .from(shortLinks)
      .where(
        and(eq(shortLinks.hotelId, hotelId), eq(shortLinks.source, source), inArray(shortLinks.location, locations)),
      )
    const found = new Map(rows.map((row) => [row.location, row.code]))
    const missing = locations.filter((location) => !found.has(location))
    if (!missing.length) return found
    await db
      .insert(shortLinks)
      .values(missing.map((location) => ({ code: newShortCode(), hotelId, source, location })))
      .onConflictDoNothing()
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not make the short links." })
}

/** Where a printed code leads today: the hotel's current slug, whatever it was when the code was printed. */
export async function findShortLink(db: Context["db"], code: string) {
  const [link] = await db
    .select({ slug: organization.slug, source: shortLinks.source, location: shortLinks.location })
    .from(shortLinks)
    .innerJoin(organization, eq(organization.id, shortLinks.hotelId))
    .where(eq(shortLinks.code, normalizeShortCode(code)))
  if (!link?.slug) throw new ORPCError("NOT_FOUND", { message: "Code not found." })
  return { slug: link.slug, source: link.source, location: link.location || null }
}
