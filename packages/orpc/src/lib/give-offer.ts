import { ORPCError } from "@orpc/server"
import type { MessageChannel } from "@ritorno/common/consent"
import { offerPageUrl, signOfferToken } from "@ritorno/common/offer-tokens"
import { localizedOffer, offerState } from "@ritorno/common/offers"
import { isWhatsappCapable } from "@ritorno/common/phone"
import type { GivenOffer } from "@ritorno/common/schemas"
import { guests, offerCodes, offerRedemptions, offers } from "@ritorno/db"
import { COPY, fill } from "@ritorno/notification"
import { and, eq } from "drizzle-orm"
import type { Context } from "../context"
import { consentedChannels } from "./automations"
import { hotelGuest } from "./guests"
import { type MessageOutcome, sendToGuest } from "./messages"
import { guestCode, redeemedCount } from "./offers"
import { qrSvg } from "./qr"

export interface Gift {
  hotelId: string
  guestId: string
  offerId: string
}

async function load(context: Pick<Context, "db" | "now">, { hotelId, guestId, offerId }: Gift) {
  const [row] = await context.db
    .select({ offer: offers, guest: { language: guests.language, email: guests.email, phone: guests.phoneE164 } })
    .from(offers)
    .innerJoin(guests, hotelGuest(hotelId, guestId))
    .where(and(eq(offers.id, offerId), eq(offers.hotelId, hotelId)))
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Guest or offer not found." })
  const [redeemed] = await context.db
    .select({ id: offerRedemptions.id })
    .from(offerRedemptions)
    .where(and(eq(offerRedemptions.offerId, offerId), eq(offerRedemptions.guestId, guestId)))
  const state = redeemed
    ? ("redeemed" as const)
    : offerState(row.offer, await redeemedCount(context.db, offerId), context.now())
  return { ...row, state }
}

/**
 * Makes the guest's code for an offer, or shows the one they already hold. A new code is only made for an offer that
 * can be redeemed now. Showing it needs no consent: nothing is sent.
 */
export async function giveOffer(
  context: Pick<Context, "db" | "now">,
  gift: Gift,
): Promise<GivenOffer & { made: boolean }> {
  const { offer, guest, state } = await load(context, gift)
  const [held] = await context.db
    .select({ id: offerCodes.id })
    .from(offerCodes)
    .where(and(eq(offerCodes.offerId, gift.offerId), eq(offerCodes.guestId, gift.guestId)))
  if (!held && state !== "ready") {
    throw new ORPCError("CONFLICT", { message: "This offer cannot be given right now." })
  }
  const code = await guestCode(context.db, gift.hotelId, gift.offerId, gift.guestId)
  const consented = await consentedChannels(context.db, gift.hotelId, gift.guestId)
  const reachable: Record<MessageChannel, boolean> = {
    email: !!guest.email,
    whatsapp: isWhatsappCapable(guest.phone),
  }
  return {
    title: offer.title,
    code,
    qrSvg: await qrSvg(code),
    state,
    channels: consented.filter((channel) => reachable[channel]),
    made: !held,
  }
}

/** Sends the code and its page on one channel. `sendToGuest` refuses without consent. */
export async function sendOffer(
  context: Pick<Context, "db" | "config" | "now" | "notification">,
  gift: Gift,
  channel: MessageChannel,
): Promise<MessageOutcome> {
  const { offer, guest, state } = await load(context, gift)
  if (state !== "ready") throw new ORPCError("CONFLICT", { message: "This offer cannot be redeemed any more." })
  const code = await guestCode(context.db, gift.hotelId, gift.offerId, gift.guestId)
  const token = signOfferToken(context.config.tokenSecret, gift)
  const url = offerPageUrl(context.config.webUrl, token, guest.language)
  const copy = COPY[guest.language].gift
  const words = localizedOffer(offer, guest.language)
  const { subject, title } = copy
  const props =
    channel === "email"
      ? {
          subject,
          title,
          body: copy.body,
          offer: {
            title: words.title,
            description: words.text || null,
            validUntil: offer.validUntil?.toISOString().slice(0, 10) ?? null,
            code,
          },
          ctaUrl: url,
          ctaLabel: copy.cta,
        }
      : // One WhatsApp variable, so the code and the link travel inside the approved `guest_message` text.
        { subject, title, body: fill(copy.whatsapp, { offer: words.title, code, url }, guest.language === "ar") }
  return sendToGuest(context, { ...gift, channel, template: "message", props })
}
