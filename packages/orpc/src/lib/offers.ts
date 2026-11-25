import { newGuestCode, verifyOfferToken } from "@le-hoetel/common/offer-tokens"
import { offerState } from "@le-hoetel/common/offers"
import { type Db, guests, offerCodes, offerRedemptions, offers } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, gt, isNull, lte, or } from "drizzle-orm"
import type { Context } from "../context"
import { hotelGuest } from "./guests"
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
