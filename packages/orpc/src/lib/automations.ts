import type { MessageChannel } from "@ritorno/common/consent"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { offerPageUrl, signOfferToken } from "@ritorno/common/offer-tokens"
import { type OfferTrigger, offerState } from "@ritorno/common/offers"
import { automationSends, type Db, guestConsents, offers } from "@ritorno/db"
import type { EmailOffer } from "@ritorno/notification"
import { type AnyColumn, and, desc, eq, type SQL, sql } from "drizzle-orm"
import type { Context } from "../context"
import { type GuestMessage, sendToGuest } from "./messages"
import { guestCode, redeemedCount } from "./offers"

/** Returns the claim id for the one caller that may send: the first to write the row. Everyone after gets null. */
export async function claimSend(
  db: Db,
  send: { hotelId: string; guestId: string; kind: string; period?: string; channel: MessageChannel },
): Promise<string | null> {
  const [claimed] = await db
    .insert(automationSends)
    .values({ ...send, period: send.period ?? "" })
    .onConflictDoNothing()
    .returning({ id: automationSends.id })
  return claimed?.id ?? null
}

export interface SendPacing {
  /** Between two sends, so a provider never sees a burst. */
  pauseMs: number
  /** Before the first retry, doubled for the next one. */
  retryDelayMs: number
  /** Sends per hotel per run of a bulk job, so one run stays short and the next minute picks up the rest. */
  batchSize: number
}

export const SEND_PACING: SendPacing = { pauseMs: 250, retryDelayMs: 2000, batchSize: 20 }

/** A bulk job that sends one batch per hotel each minute; a run that hangs is failed long before the next hour. */
export const BULK_JOB_EXPIRE_SECONDS = 600

/** The guest has no claim yet for this automation, period and channel. */
export const notClaimed = (send: {
  guestId: SQL | AnyColumn
  kind: string
  period: string
  channel: SQL | AnyColumn
}) =>
  sql`not exists (select 1 from ${automationSends} where ${automationSends.guestId} = ${send.guestId} and ${automationSends.kind} = ${send.kind} and ${automationSends.period} = ${send.period} and ${automationSends.channel}::text = ${send.channel}::text)`
const SEND_ATTEMPTS = 3

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Claims the send, then sends with up to `SEND_ATTEMPTS` tries on a retryable provider error (see
 * `isRetryableSendError`; every try reuses an idempotency key made from the claim id) and
 * pauses after it. The claim is held through the retries so no other worker can send it too, which is also why the
 * retries live here and not in pg-boss: a rerun of the job finds the claim and sends nothing. A permanent failure is
 * not retried, and a send still failing after the last try stays failed. Returns false when someone else had the claim.
 */
export async function claimAndSend(
  context: Parameters<typeof sendToGuest>[0],
  claim: { kind: string; period?: string },
  message: GuestMessage,
  pacing: SendPacing = SEND_PACING,
): Promise<boolean> {
  const { hotelId, guestId, channel } = message
  const claimId = await claimSend(context.db, { hotelId, guestId, channel, ...claim })
  if (!claimId) return false
  for (let attempt = 1; ; attempt++) {
    const outcome = await sendToGuest(context, { ...message, idempotencyKey: `automation-send:${claimId}` })
    if (!outcome.retryable || attempt >= SEND_ATTEMPTS) break
    await sleep(pacing.retryDelayMs * 2 ** (attempt - 1))
  }
  await sleep(pacing.pauseMs)
  return true
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
