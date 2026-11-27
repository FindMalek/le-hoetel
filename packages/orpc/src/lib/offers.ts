import { ORPCError } from "@orpc/server"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { UNDO_WINDOW_MS } from "@ritorno/common/hotel-time"
import {
  newGuestCode,
  offerPageUrl,
  signSignUpToken,
  signUpCode,
  verifyOfferToken,
  verifySignUpToken,
} from "@ritorno/common/offer-tokens"
import { localizedOffer, normalizeCode, offerState } from "@ritorno/common/offers"
import type { offerLookupSchema, signUpPerkSchema } from "@ritorno/common/schemas"
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

/** What a `/o/<token>` link points at: a guest's own link from a message, or the code shown after a sign-up. */
async function linkSubject(context: Ctx, token: string) {
  const mine = verifyOfferToken(context.config.tokenSecret, token)
  if (mine) {
    const [guest] = await context.db
      .select({ language: guests.language })
      .from(guests)
      .where(hotelGuest(mine.hotelId, mine.guestId))
    return guest ? { ...mine, language: guest.language, code: null } : null
  }
  const signUp = verifySignUpToken(context.config.tokenSecret, token)
  if (!signUp) return null
  const [holder] = await context.db
    .select({ guestId: offerCodes.guestId })
    .from(offerCodes)
    .where(
      and(
        eq(offerCodes.code, signUp.code),
        eq(offerCodes.offerId, signUp.offerId),
        eq(offerCodes.hotelId, signUp.hotelId),
      ),
    )
  // A code nobody holds reads like a fresh one: telling them apart would say whether the phone was already known.
  return { ...signUp, guestId: holder?.guestId ?? null }
}

/** The page behind `/o/<token>`: the hotel's look, the offer and the code as a QR. Nothing about the guest. */
export async function offerPage(context: Ctx, token: string) {
  const subject = await linkSubject(context, token)
  if (!subject) throw invalid()
  const { hotelId, offerId, guestId, language } = subject
  const [offer] = await context.db
    .select()
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.hotelId, hotelId)))
  if (!offer) throw invalid()
  const [redemption] = guestId
    ? await context.db
        .select({ id: offerRedemptions.id })
        .from(offerRedemptions)
        .where(and(eq(offerRedemptions.offerId, offerId), eq(offerRedemptions.guestId, guestId)))
    : []
  const state = redemption
    ? ("redeemed" as const)
    : offerState(offer, await redeemedCount(context.db, offer.id), context.now())
  const code = subject.code ?? (await guestCode(context.db, hotelId, offerId, guestId!))
  const { title, text, translations, validFrom, validUntil } = offer
  return {
    hotel: await hotelBranding(context, hotelId),
    language,
    // every language travels: the page may be read in another one than the link's (`?lang`)
    offer: { title, text, translations, validFrom, validUntil },
    state,
    code,
    qrSvg: await qrSvg(code),
  }
}

/** The newest welcome offer that can be redeemed right now: what the capture page promises and gives. */
async function openWelcomeOffer(db: Db | Tx, hotelId: string, now: Date) {
  const candidates = await db
    .select()
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
  for (const offer of candidates) {
    if (offerState(offer, await redeemedCount(db, offer.id), now) === "ready") return offer
  }
  return null
}

/** The perk a capture page shows. */
export async function welcomeOffer(db: Db | Tx, hotelId: string, now: Date) {
  const offer = await openWelcomeOffer(db, hotelId, now)
  if (!offer) return null
  const { title, text, translations, validUntil } = offer
  return { title, text, translations, validUntil }
}

/**
 * The code on the thank-you screen of a public sign-up. It needs no consent: showing it is not a message.
 *
 * The form takes any phone, so the answer is built the same way whoever the phone belongs to. The code is derived from
 * this sign-up and only becomes the guest's when they hold none for the offer. A guest who already has one keeps it,
 * and the code shown redeems nothing: a stranger typing their number never learns or gets theirs. `claim` is the
 * browser's own random value, so the retry of a lost answer shows the code that was stored. Null `guestId` (a bot)
 * stores nothing.
 */
export async function signUpPerk(
  context: Ctx,
  signUp: { hotelId: string; guestId: string | null; phone: string; claim: string; language: HotelLanguage },
): Promise<z.infer<typeof signUpPerkSchema> | null> {
  const { hotelId, guestId, phone, claim, language } = signUp
  const offer = await openWelcomeOffer(context.db, hotelId, context.now())
  if (!offer) return null
  const code = signUpCode(context.config.tokenSecret, [hotelId, offer.id, phone, claim])
  if (guestId) {
    await context.db.insert(offerCodes).values({ hotelId, offerId: offer.id, guestId, code }).onConflictDoNothing()
  }
  const token = signSignUpToken(context.config.tokenSecret, { hotelId, offerId: offer.id, code, language })
  const { validFrom, validUntil } = offer
  return {
    ...localizedOffer(offer, language),
    validFrom,
    validUntil,
    code,
    qrSvg: await qrSvg(code),
    url: offerPageUrl(context.config.webUrl, token, language),
  }
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
