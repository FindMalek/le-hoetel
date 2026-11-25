import type { MessageChannel } from "@ritorno/common/consent"
import type { HotelLanguage } from "@ritorno/common/hotel"
import type { MessageStatus } from "@ritorno/common/message"
import { whatsappPriceMillimes } from "@ritorno/common/pricing"
import { listUnsubscribeHeaders, signUnsubscribeToken, unsubscribePageUrl } from "@ritorno/common/unsubscribe"
import { guestConsents, guests, hotelSettings, messages, organization } from "@ritorno/db"
import {
  type EmailProps,
  GUEST_WHATSAPP_TEMPLATES,
  guestTemplateParams,
  type HotelEmailKey,
  renderEmail,
} from "@ritorno/notification"
import { and, eq, inArray } from "drizzle-orm"
import type { Context } from "../context"
import { debit, refund } from "./balance"
import { hotelGuest, recordConsent } from "./guests"

type Ctx = Pick<Context, "db" | "config" | "now" | "notification">

export interface GuestMessage<Key extends HotelEmailKey = HotelEmailKey> {
  hotelId: string
  guestId: string
  channel: MessageChannel
  template: Key
  props: EmailProps[Key]
}

export interface MessageOutcome {
  messageId: string
  status: MessageStatus
}

const LOG_ONLY_ID = "log-only"

async function hotelBranding(context: Ctx, hotelId: string) {
  const [hotel] = await context.db
    .select({
      name: organization.name,
      displayName: hotelSettings.displayName,
      logoKey: hotelSettings.logoKey,
      primaryColor: hotelSettings.primaryColor,
      accentColor: hotelSettings.accentColor,
      replyTo: hotelSettings.replyToEmail,
      address: hotelSettings.address,
    })
    .from(organization)
    .leftJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
    .where(eq(organization.id, hotelId))
  if (!hotel) throw new Error("Hotel not found.")
  const name = hotel.displayName ?? hotel.name
  return {
    name,
    replyTo: hotel.replyTo,
    email: {
      name,
      logoUrl: hotel.logoKey ? `${context.config.apiUrl}/files/${hotel.logoKey}` : null,
      primaryColor: hotel.primaryColor,
      accentColor: hotel.accentColor,
      address: hotel.address,
    },
  }
}

/**
 * The only way a message reaches a guest. Checks the guest's current consent for the channel, refuses without it
 * (a `skipped_no_consent` row) and logs one row. A WhatsApp message first takes its price off the hotel's prepaid balance (`skipped_no_balance` when short, refunded if the send fails); email is free. The row has no body and no recipient. Emails are rendered with
 * the hotel's branding, sent from the hotel's name with its reply-to, and carry the List-Unsubscribe headers; the
 * template's own footer holds the one unsubscribe link. Providers only send when messaging is live; otherwise the
 * row says `sent` with the provider id `log-only`.
 */
export async function sendToGuest<Key extends HotelEmailKey>(
  context: Ctx,
  input: GuestMessage<Key>,
): Promise<MessageOutcome> {
  const { hotelId, guestId, channel } = input
  const [guest] = await context.db
    .select({ name: guests.name, language: guests.language, email: guests.email, phoneE164: guests.phoneE164 })
    .from(guests)
    .where(hotelGuest(hotelId, guestId))
  if (!guest) throw new Error("Guest not found in this hotel.")
  const [consent] = await context.db
    .select({ granted: guestConsents.granted })
    .from(guestConsents)
    .where(
      and(eq(guestConsents.hotelId, hotelId), eq(guestConsents.guestId, guestId), eq(guestConsents.channel, channel)),
    )

  const row = { hotelId, guestId, channel, templateKey: input.template, language: guest.language }
  const record = async (values: Partial<typeof messages.$inferInsert> & { status: MessageStatus }) => {
    const [created] = await context.db
      .insert(messages)
      .values({ ...row, ...values })
      .returning({ id: messages.id })
    return { messageId: created!.id, status: values.status }
  }

  if (!consent?.granted) return record({ status: "skipped_no_consent" })
  const to = channel === "email" ? guest.email : guest.phoneE164
  if (!to) return record({ status: "failed", errorCode: "no_recipient", failedAt: context.now() })

  const queued = await record({ status: "queued" })
  const price = channel === "whatsapp" ? whatsappPriceMillimes(input.template) : 0
  if (price > 0 && !(await debit(context.db, hotelId, price, queued.messageId))) {
    await context.db.update(messages).set({ status: "skipped_no_balance" }).where(eq(messages.id, queued.messageId))
    return { messageId: queued.messageId, status: "skipped_no_balance" }
  }
  const finish = async (values: Partial<typeof messages.$inferInsert> & { status: MessageStatus }) => {
    if (price > 0 && values.status === "failed") await refund(context.db, hotelId, price, queued.messageId)
    await context.db.update(messages).set(values).where(eq(messages.id, queued.messageId))
    return { messageId: queued.messageId, status: values.status }
  }
  try {
    const result = await deliver(context, input, { to, guest })
    if (result.sent || !context.notification.live) {
      return finish({ status: "sent", providerId: result.id ?? LOG_ONLY_ID, sentAt: context.now() })
    }
    return finish({ status: "failed", errorCode: "channel_not_configured", failedAt: context.now() })
  } catch (error) {
    const code = (error as { code?: unknown })?.code
    return finish({
      status: "failed",
      errorCode: typeof code === "string" ? code : "send_failed",
      failedAt: context.now(),
    })
  }
}

interface Recipient {
  to: string
  guest: { name: string; language: HotelLanguage }
}

async function deliver<Key extends HotelEmailKey>(
  context: Ctx,
  { hotelId, guestId, channel, template, props }: GuestMessage<Key>,
  { to, guest }: Recipient,
): Promise<{ sent: boolean; id?: string }> {
  if (channel === "whatsapp") {
    const { name } = await hotelBranding(context, hotelId)
    return context.notification.sendWhatsApp({
      to,
      template: GUEST_WHATSAPP_TEMPLATES[template].name,
      language: guest.language,
      params: guestTemplateParams(template, { guestName: guest.name, hotelName: name, props }),
    })
  }
  const token = signUnsubscribeToken(context.config.tokenSecret, { hotelId, guestId, channel })
  const hotel = await hotelBranding(context, hotelId)
  const email = await renderEmail(template, {
    hotel: hotel.email,
    guest: { name: guest.name, unsubscribeUrl: unsubscribePageUrl(context.config.webUrl, token, guest.language) },
    locale: guest.language,
    props,
  })
  return context.notification.sendEmail({
    to,
    email,
    fromName: hotel.name,
    replyTo: hotel.replyTo ?? undefined,
    headers: listUnsubscribeHeaders(context.config.apiUrl, token),
  })
}

export interface DeliveryUpdate {
  providerId: string
  status: "sent" | "delivered" | "failed"
  errorCode?: string
  at: Date
}

/**
 * A status webhook from a provider. Moves a message forward only: a late `sent` never undoes `delivered`, and
 * `failed` is final. Returns the rows it changed (hotel and guest, so the caller can act on a bounce).
 */
export async function applyDeliveryUpdate(db: Context["db"], update: DeliveryUpdate) {
  const from: MessageStatus[] =
    update.status === "delivered"
      ? ["queued", "sent"]
      : update.status === "sent"
        ? ["queued"]
        : ["queued", "sent", "delivered"]
  const timestamps = {
    sent: { sentAt: update.at },
    delivered: { deliveredAt: update.at },
    failed: { failedAt: update.at },
  }[update.status]
  return db
    .update(messages)
    .set({ status: update.status, ...timestamps, ...(update.errorCode ? { errorCode: update.errorCode } : {}) })
    .where(and(eq(messages.providerId, update.providerId), inArray(messages.status, from)))
    .returning({ id: messages.id, hotelId: messages.hotelId, guestId: messages.guestId, channel: messages.channel })
}

export interface ResendEvent {
  type: string
  created_at?: string
  data?: { email_id?: string }
}

/**
 * A Resend webhook event. Delivered and bounced move the message row. A complaint (the guest hit "spam")
 * withdraws their email consent as a `guest_request` event, so no further email goes out. Anything else is
 * ignored. Returns whether the event changed something.
 */
export async function applyResendEvent(db: Context["db"], event: ResendEvent): Promise<boolean> {
  const providerId = event.data?.email_id
  if (!providerId) return false
  const at = event.created_at ? new Date(event.created_at) : new Date()
  if (event.type === "email.delivered")
    return (await applyDeliveryUpdate(db, { providerId, status: "delivered", at })).length > 0
  if (event.type === "email.bounced" || event.type === "email.failed") {
    return (await applyDeliveryUpdate(db, { providerId, status: "failed", errorCode: "bounced", at })).length > 0
  }
  if (event.type !== "email.complained") return false
  const [message] = await db
    .select({ hotelId: messages.hotelId, guestId: messages.guestId })
    .from(messages)
    .where(and(eq(messages.providerId, providerId), eq(messages.channel, "email")))
  if (!message) return false
  return recordConsent(db, { ...message, channel: "email", granted: false, source: "guest_request", at })
}

export interface KapsoPayload {
  message?: {
    id?: string
    from?: string
    type?: string
    text?: { body?: string }
    kapso?: { direction?: string; statuses?: Array<{ status?: string; errors?: Array<{ code?: number | string }> }> }
  }
}

/**
 * A Kapso status webhook (`X-Webhook-Event` header plus the json body) for a message we sent. `sent`, `delivered`
 * and `failed` go through `applyDeliveryUpdate`; a failure keeps Meta's numeric code as `error_code`, never its text.
 * `read` is a delivery we already have. Returns whether a row changed.
 */
export async function applyKapsoEvent(db: Context["db"], event: string, payload: KapsoPayload): Promise<boolean> {
  const providerId = payload.message?.id
  if (!providerId || payload.message?.kapso?.direction !== "outbound") return false
  const status = {
    "whatsapp.message.sent": "sent",
    "whatsapp.message.delivered": "delivered",
    "whatsapp.message.failed": "failed",
  }[event] as DeliveryUpdate["status"] | undefined
  if (!status) return false
  const code = payload.message.kapso.statuses?.filter((entry) => entry.status === "failed").at(-1)?.errors?.[0]?.code
  const errorCode = status === "failed" ? (code === undefined ? "send_failed" : String(code)) : undefined
  return (await applyDeliveryUpdate(db, { providerId, status, errorCode, at: new Date() })).length > 0
}
