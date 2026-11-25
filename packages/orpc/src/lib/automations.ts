import type { MessageChannel } from "@le-hoetel/common/consent"
import type { HotelLanguage } from "@le-hoetel/common/hotel"
import { offerPageUrl, signOfferToken } from "@le-hoetel/common/offer-tokens"
import { type OfferTrigger, offerState } from "@le-hoetel/common/offers"
import { automationSends, type Db, guestConsents, offers } from "@le-hoetel/db"
import type { EmailOffer } from "@le-hoetel/notification"
import { and, desc, eq } from "drizzle-orm"
import type { Context } from "../context"
import { guestCode, redeemedCount } from "./offers"

/** Returns true for the one caller that may send: the first to write the row. Everyone after gets false. */
export async function claimSend(
  db: Db,
  send: { hotelId: string; guestId: string; kind: string; period?: string; channel: MessageChannel },
): Promise<boolean> {
  const [claimed] = await db
    .insert(automationSends)
    .values({ ...send, period: send.period ?? "" })
    .onConflictDoNothing()
    .returning({ id: automationSends.id })
  return Boolean(claimed)
}

export async function consentedChannels(db: Db, hotelId: string, guestId: string): Promise<MessageChannel[]> {
  const rows = await db
    .select({ channel: guestConsents.channel })
    .from(guestConsents)
    .where(and(eq(guestConsents.hotelId, hotelId), eq(guestConsents.guestId, guestId), eq(guestConsents.granted, true)))
  return rows.map((row) => row.channel).filter((channel): channel is MessageChannel => channel !== "profile")
}

type OfferRow = typeof offers.$inferSelect
type PerkContext = Pick<Context, "db" | "config" | "now">
export interface Perk {
  offer: EmailOffer
  ctaUrl: string
}

/** The offer as one guest sees it: their own code and the page link. Null when it cannot be redeemed right now. */
export async function perkFor(
  context: PerkContext,
  offer: OfferRow,
  guestId: string,
  language: HotelLanguage,
): Promise<Perk | null> {
  if (offerState(offer, await redeemedCount(context.db, offer.id), context.now()) !== "ready") return null
  const token = signOfferToken(context.config.tokenSecret, { hotelId: offer.hotelId, offerId: offer.id, guestId })
  return {
    offer: {
      title: offer.title,
      description: offer.text || null,
      validUntil: offer.validUntil?.toISOString().slice(0, 10) ?? null,
      code: await guestCode(context.db, offer.hotelId, offer.id, guestId),
    },
    ctaUrl: offerPageUrl(context.config.webUrl, token, language),
  }
}

/**
 * The newest offer of a hotel for an automatic trigger that can be redeemed right now, with this guest's own code
 * and the page link that shows it. Null when the hotel has none, so the message goes out without one.
 */
export async function triggerOffer(
  context: PerkContext,
  input: { hotelId: string; guestId: string; language: HotelLanguage; trigger: OfferTrigger },
): Promise<Perk | null> {
  const { hotelId, guestId, language, trigger } = input
  const candidates = await context.db
    .select()
    .from(offers)
    .where(and(eq(offers.hotelId, hotelId), eq(offers.trigger, trigger), eq(offers.active, true)))
    .orderBy(desc(offers.createdAt))
  for (const offer of candidates) {
    const perk = await perkFor(context, offer, guestId, language)
    if (perk) return perk
  }
  return null
}
