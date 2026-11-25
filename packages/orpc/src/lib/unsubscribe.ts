import { MESSAGE_CHANNELS, type MessageChannel } from "@le-hoetel/common/consent"
import { isStopKeyword, stopConfirmation, verifyUnsubscribeToken } from "@le-hoetel/common/unsubscribe"
import { type Db, guestConsents, guests, hotelSettings, messages, organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray } from "drizzle-orm"
import type { Context } from "../context"
import { hotelGuest, recordConsent } from "./guests"
import { hotelBranding } from "./hotel"
import type { KapsoPayload } from "./messages"

type Ctx = Pick<Context, "db" | "config" | "now">
type InboundCtx = Pick<Context, "db" | "now" | "notification">

export type ChannelChoices = Partial<Record<MessageChannel, boolean>>

async function openToken(context: Ctx, token: string) {
  const subject = verifyUnsubscribeToken(context.config.tokenSecret, token)
  const [guest] = subject
    ? await context.db
        .select({ id: guests.id, language: guests.language, email: guests.email })
        .from(guests)
        .where(hotelGuest(subject.hotelId, subject.guestId))
    : []
  if (!subject || !guest) throw new ORPCError("NOT_FOUND", { message: "This link is not valid." })
  return { subject, guest }
}

async function pageState(context: Ctx, hotelId: string, guestId: string, hasEmail: boolean) {
  const rows = await context.db
    .select({ channel: guestConsents.channel, granted: guestConsents.granted })
    .from(guestConsents)
    .where(and(eq(guestConsents.hotelId, hotelId), eq(guestConsents.guestId, guestId)))
  return MESSAGE_CHANNELS.filter((channel) => channel !== "email" || hasEmail).map((channel) => ({
    channel,
    granted: rows.some((row) => row.channel === channel && row.granted),
  }))
}

/** What the public page shows: the hotel's branding and the guest's own switches. Never the guest's name, phone or email. */
export async function unsubscribePage(context: Ctx, token: string) {
  const { subject, guest } = await openToken(context, token)
  const hotel = await hotelBranding(context, subject.hotelId)
  return {
    hotel,
    language: guest.language,
    channel: subject.channel,
    channels: await pageState(context, subject.hotelId, subject.guestId, Boolean(guest.email)),
  }
}

/** The guest's own choices from the page. Each real change is a consent event with source `unsubscribe_link`. */
export async function changeChoices(context: Ctx, token: string, choices: ChannelChoices) {
  const { subject, guest } = await openToken(context, token)
  const at = context.now()
  await context.db.transaction(async (tx) => {
    for (const channel of MESSAGE_CHANNELS) {
      const granted = choices[channel]
      if (granted === undefined || (channel === "email" && !guest.email)) continue
      await recordConsent(tx, {
        hotelId: subject.hotelId,
        guestId: subject.guestId,
        channel,
        granted,
        source: "unsubscribe_link",
        at,
      })
    }
  })
  return pageState(context, subject.hotelId, subject.guestId, Boolean(guest.email))
}

export const unsubscribeAll = (context: Ctx, token: string) =>
  changeChoices(context, token, Object.fromEntries(MESSAGE_CHANNELS.map((channel) => [channel, false])))

/**
 * A STOP reply on WhatsApp: withdraws the WhatsApp consent of every guest with that number. The inbound webhook
 * passes `hotelId` when the receiving number belongs to one hotel; without it the number is out everywhere, which
 * is the safe side. Returns how many guests changed.
 */
export async function applyStopReply(
  db: Db,
  input: { phoneE164: string; hotelId?: string; at: Date },
): Promise<number> {
  return db.transaction(async (tx) => {
    const matches = await tx
      .select({ id: guests.id, hotelId: guests.hotelId })
      .from(guests)
      .where(
        input.hotelId
          ? and(eq(guests.phoneE164, input.phoneE164), eq(guests.hotelId, input.hotelId))
          : eq(guests.phoneE164, input.phoneE164),
      )
    let changed = 0
    for (const guest of matches) {
      const done = await recordConsent(tx, {
        hotelId: guest.hotelId,
        guestId: guest.id,
        channel: "whatsapp",
        granted: false,
        source: "stop_reply",
        at: input.at,
      })
      if (done) changed += 1
    }
    return changed
  })
}

/**
 * An inbound WhatsApp message from Kapso. Anything but a whole-message STOP keyword is ignored. The hotel is the
 * one whose message this number got last (one business number serves every hotel, so the number alone says
 * nothing); a number we never wrote to is unsubscribed everywhere, the safe side. When a consent really changed
 * the guest gets one confirmation in their language; a repeated delivery changes nothing and says nothing.
 */
export async function handleInboundWhatsApp(context: InboundCtx, payload: KapsoPayload): Promise<boolean> {
  const { from, type, text } = payload.message ?? {}
  const digits = from?.replace(/\D/g, "")
  if (!digits || type !== "text" || !isStopKeyword(text?.body ?? "")) return false
  const phoneE164 = `+${digits}`

  const [last] = await context.db
    .select({ hotelId: messages.hotelId })
    .from(messages)
    .innerJoin(guests, and(eq(guests.id, messages.guestId), eq(guests.hotelId, messages.hotelId)))
    .where(
      and(
        eq(guests.phoneE164, phoneE164),
        eq(messages.channel, "whatsapp"),
        inArray(messages.status, ["sent", "delivered"]),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1)
  const hotelId = last?.hotelId
  const [guest] = await context.db
    .select({ language: guests.language })
    .from(guests)
    .where(
      hotelId ? and(eq(guests.phoneE164, phoneE164), eq(guests.hotelId, hotelId)) : eq(guests.phoneE164, phoneE164),
    )
  if (!guest) return false

  const changed = await applyStopReply(context.db, { phoneE164, hotelId, at: context.now() })
  if (changed > 0)
    await context.notification.replyWhatsApp(phoneE164, stopConfirmation(guest.language)).catch(() => null)
  return changed > 0
}
