import { ORPCError } from "@orpc/server"
import { MESSAGE_CHANNELS, type MessageChannel } from "@ritorno/common/consent"
import { isStopKeyword, stopConfirmation, verifyUnsubscribeToken } from "@ritorno/common/unsubscribe"
import { type Db, guestConsents, guests, hotelSettings, messages, organization } from "@ritorno/db"
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm"
import type { Context } from "../context"
import { hotelGuest, recordConsent } from "./guests"
import { hotelBranding } from "./hotel"
import { type KapsoPayload, kapsoSender } from "./messages"
import { forgetScans, scanHotels } from "./whatsapp-scans"

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

/** An older message went to the guest's old number, so it says nothing about who holds the current one. */
const sentToCurrentNumber = or(isNull(guests.phoneChangedAt), gt(messages.createdAt, guests.phoneChangedAt))

/** The number we sent this WhatsApp message to: all that is left to match a sender who hides theirs. */
async function recipientOf(db: Db, providerId: string | undefined): Promise<string | undefined> {
  if (!providerId) return undefined
  const [row] = await db
    .select({ phoneE164: guests.phoneE164 })
    .from(messages)
    .innerJoin(guests, and(eq(guests.id, messages.guestId), eq(guests.hotelId, messages.hotelId)))
    .where(and(eq(messages.providerId, providerId), eq(messages.channel, "whatsapp"), sentToCurrentNumber))
  return row?.phoneE164
}

/**
 * An inbound WhatsApp message from Kapso. Anything but a whole-message STOP keyword is ignored. One business number
 * serves every hotel, so the number alone says nothing: the guest leaves the hotel whose message they got last and
 * every hotel whose QR welcome they still have a scan for (a welcome writes no `messages` row). A number we never
 * messaged is unsubscribed everywhere, the safe side. The scans are dropped too. One confirmation when a consent
 * changed or a scan was removed; a repeated delivery changes nothing and says nothing. A sender without a phone
 * (WhatsApp username) is matched only through the message they reply to, otherwise the STOP is logged.
 */
export async function handleInboundWhatsApp(context: InboundCtx, payload: KapsoPayload): Promise<boolean> {
  const { type, text, context: repliedTo } = payload.message ?? {}
  if (type !== "text" || !isStopKeyword(text?.body ?? "")) return false
  const phoneE164 = kapsoSender(payload).phoneE164 ?? (await recipientOf(context.db, repliedTo?.id))
  if (!phoneE164) {
    // No ids here: a user id is personal data, and a message id can encode the number.
    console.warn("[whatsapp-stop] sender not matched, no consent changed")
    return false
  }

  const [last] = await context.db
    .select({ hotelId: messages.hotelId })
    .from(messages)
    .innerJoin(guests, and(eq(guests.id, messages.guestId), eq(guests.hotelId, messages.hotelId)))
    .where(
      and(
        eq(guests.phoneE164, phoneE164),
        eq(messages.channel, "whatsapp"),
        inArray(messages.status, ["sent", "delivered"]),
        sentToCurrentNumber,
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1)
  const scanned = await scanHotels(context.db, phoneE164)
  const hotelIds = last ? [...new Set([last.hotelId, ...scanned])] : [undefined]
  const [guest] = await context.db
    .select({ language: guests.language })
    .from(guests)
    .where(
      last ? and(eq(guests.phoneE164, phoneE164), eq(guests.hotelId, last.hotelId)) : eq(guests.phoneE164, phoneE164),
    )

  let changed = 0
  if (guest) {
    for (const hotelId of hotelIds) {
      changed += await applyStopReply(context.db, { phoneE164, hotelId, at: context.now() })
    }
  }
  // After the withdrawals: a failure above leaves the scans for the redelivery to read.
  const scans = await forgetScans(context.db, phoneE164)
  const language = guest?.language ?? scans[0]?.language
  if (!language || (!changed && !scans.length)) return false
  await context.notification.replyWhatsApp(phoneE164, stopConfirmation(language)).catch(() => null)
  return true
}
