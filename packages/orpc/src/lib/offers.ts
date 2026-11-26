import { ORPCError } from "@orpc/server"
import { UNDO_WINDOW_MS } from "@ritorno/common/hotel-time"
import { newGuestCode, verifyOfferToken } from "@ritorno/common/offer-tokens"
import { normalizeCode, offerState } from "@ritorno/common/offers"
import type { offerLookupSchema } from "@ritorno/common/schemas"
import { type Db, guests, guestVisits, offerCodes, offerRedemptions, offers, user } from "@ritorno/db"
import { and, count, desc, eq, gt, isNull, lte, or } from "drizzle-orm"
import type { z } from "zod"
import type { Context } from "../context"
import { hotelGuest, recordVisit } from "./guests"
import { hotelBranding } from "./hotel"
import { qrSvg } from "./qr"

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]
type Ctx = Pick<Context, "db" | "config" | "now">

const invalid = () => new ORPCError("NOT_FOUND", { message: "This link is not valid." })

export async function redeemedCount(db: Db | Tx, offerId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(offerRedemptions).where(eq(offerRedemptions.offerId, offerId))
  return row?.n ?? 0
}

/** The guest's code for an offer, made on first ask and the same afterwards. A rare code collision is retried with a new code. */
export async function guestCode(db: Db | Tx, hotelId: string, offerId: string, guestId: string): Promise<string> {
  const where = and(eq(offerCodes.offerId, offerId), eq(offerCodes.guestId, guestId))
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select({ code: offerCodes.code }).from(offerCodes).where(where)
    if (existing) return existing.code
    await db.insert(offerCodes).values({ hotelId, offerId, guestId, code: newGuestCode() }).onConflictDoNothing()
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not make a code." })
}

/** The page behind `/o/<token>`: the hotel's look, the offer and the guest's code as a QR. Nothing about the guest. */
export async function offerPage(context: Ctx, token: string) {
  const subject = verifyOfferToken(context.config.tokenSecret, token)
  if (!subject) throw invalid()
  const [row] = await context.db
    .select({ offer: offers, language: guests.language })
    .from(offers)
    .innerJoin(guests, hotelGuest(subject.hotelId, subject.guestId))
    .where(and(eq(offers.id, subject.offerId), eq(offers.hotelId, subject.hotelId)))
  if (!row) throw invalid()
  const [redemption] = await context.db
    .select({ id: offerRedemptions.id })
    .from(offerRedemptions)
    .where(and(eq(offerRedemptions.offerId, subject.offerId), eq(offerRedemptions.guestId, subject.guestId)))
  const state = redemption
    ? ("redeemed" as const)
    : offerState(row.offer, await redeemedCount(context.db, row.offer.id), context.now())
  const code = await guestCode(context.db, subject.hotelId, subject.offerId, subject.guestId)
  const { title, text, validFrom, validUntil } = row.offer
  return {
    hotel: await hotelBranding(context, subject.hotelId),
    language: row.language,
    offer: { title, text, validFrom, validUntil },
    state,
    code,
    qrSvg: await qrSvg(code),
  }
}

/** The perk a capture page shows: the newest active welcome offer that is open right now. */
export async function welcomeOffer(db: Db | Tx, hotelId: string, now: Date) {
  const [row] = await db
    .select({ title: offers.title, text: offers.text })
    .from(offers)
    .where(
      and(
        eq(offers.hotelId, hotelId),
        eq(offers.trigger, "welcome"),
        eq(offers.active, true),
        lte(offers.validFrom, now),
        or(isNull(offers.validUntil), gt(offers.validUntil, now)),
      ),
    )
    .orderBy(desc(offers.createdAt))
    .limit(1)
  return row ?? null
}

type Lookup = z.infer<typeof offerLookupSchema>

const empty = (status: Lookup["status"]): Lookup => ({
  status,
  offer: null,
  guestFirstName: null,
  redeemed: null,
  justNow: false,
  guestId: null,
  redemptionId: null,
})

const GUEST_CODE = /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? ""

interface Resolved {
  offer: typeof offers.$inferSelect
  guest: { id: string; name: string } | null
}

/** A code typed or scanned by the staff of `hotelId`. Another hotel's guest code is told apart from an unknown one, and its offer is never shown. */
async function resolve(db: Db | Tx, hotelId: string, raw: string): Promise<Resolved | Lookup["status"]> {
  const code = normalizeCode(raw)
  if (GUEST_CODE.test(code)) {
    const key = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`
    const [row] = await db
      .select({ offer: offers, guest: { id: guests.id, name: guests.name }, codeHotel: offerCodes.hotelId })
      .from(offerCodes)
      .innerJoin(offers, eq(offers.id, offerCodes.offerId))
      .innerJoin(guests, eq(guests.id, offerCodes.guestId))
      .where(eq(offerCodes.code, key))
    if (row) return row.codeHotel === hotelId ? { offer: row.offer, guest: row.guest } : "wrongHotel"
  }
  const [offer] = await db
    .select()
    .from(offers)
    .where(and(eq(offers.hotelId, hotelId), eq(offers.promoCode, code)))
  return offer ? { offer, guest: null } : "unknown"
}

async function describe(db: Db | Tx, found: Resolved, now: Date, rowId?: string): Promise<Lookup> {
  const { offer, guest } = found
  const whose = rowId
    ? eq(offerRedemptions.id, rowId)
    : guest
      ? and(eq(offerRedemptions.offerId, offer.id), eq(offerRedemptions.guestId, guest.id))
      : undefined
  const [past] = whose
    ? await db
        .select({ at: offerRedemptions.redeemedAt, by: user.name })
        .from(offerRedemptions)
        .leftJoin(user, eq(user.id, offerRedemptions.redeemedBy))
        .where(whose)
    : []
  const status = past ? "redeemed" : offerState(offer, await redeemedCount(db, offer.id), now)
  const { id, title, text, validFrom, validUntil } = offer
  return {
    status,
    offer: { id, title, text, validFrom, validUntil },
    guestFirstName: guest ? firstName(guest.name) : null,
    redeemed: past ? { at: past.at, by: past.by } : null,
    justNow: false,
    guestId: guest?.id ?? null,
    redemptionId: null,
  }
}

export async function lookupCode(context: Pick<Context, "db" | "now">, hotelId: string, raw: string): Promise<Lookup> {
  const found = await resolve(context.db, hotelId, raw)
  return typeof found === "string" ? empty(found) : describe(context.db, found, context.now())
}

export const isUniqueViolation = (error: unknown): boolean =>
  [error, (error as { cause?: unknown } | null)?.cause].some((e) => (e as { code?: string } | null)?.code === "23505")

/**
 * Marks a code redeemed, once. The offer row is locked while the limit is counted, and a guest's second redemption
 * hits the unique `(offer_id, guest_id)`, so two phones scanning together cannot both succeed.
 * A guest's code also counts their visit, stamped with the redemption's time so the undo finds it.
 */
export async function redeemCode(
  context: Pick<Context, "db" | "now">,
  hotelId: string,
  userId: string,
  raw: string,
): Promise<Lookup> {
  const found = await resolve(context.db, hotelId, raw)
  if (typeof found === "string") return empty(found)
  return context.db.transaction(async (tx) => {
    await tx.select({ id: offers.id }).from(offers).where(eq(offers.id, found.offer.id)).for("update")
    const before = await describe(tx, found, context.now())
    if (before.status !== "ready") return before
    const at = context.now()
    try {
      const [row] = await tx.transaction((inner) =>
        inner
          .insert(offerRedemptions)
          .values({
            offerId: found.offer.id,
            hotelId,
            guestId: found.guest?.id ?? null,
            redeemedBy: userId,
            redeemedAt: at,
          })
          .returning({ id: offerRedemptions.id }),
      )
      if (found.guest) await recordVisit(tx, { hotelId, guestId: found.guest.id, source: "staff", at })
      return { ...(await describe(tx, found, at, row!.id)), justNow: true, redemptionId: row!.id }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      return describe(tx, found, context.now())
    }
  })
}

/** Takes back a redemption made moments ago, and the visit it counted. Null when it is gone or too old. */
export async function undoRedemption(
  context: Pick<Context, "db" | "now">,
  hotelId: string,
  redemptionId: string,
): Promise<{ offerId: string } | null> {
  return context.db.transaction(async (tx) => {
    const [gone] = await tx
      .delete(offerRedemptions)
      .where(
        and(
          eq(offerRedemptions.id, redemptionId),
          eq(offerRedemptions.hotelId, hotelId),
          gt(offerRedemptions.redeemedAt, new Date(context.now().getTime() - UNDO_WINDOW_MS)),
        ),
      )
      .returning()
    if (!gone) return null
    if (gone.guestId) {
      await tx
        .delete(guestVisits)
        .where(
          and(
            eq(guestVisits.hotelId, hotelId),
            eq(guestVisits.guestId, gone.guestId),
            eq(guestVisits.source, "staff"),
            eq(guestVisits.at, gone.redeemedAt),
          ),
        )
    }
    return { offerId: gone.offerId }
  })
}
