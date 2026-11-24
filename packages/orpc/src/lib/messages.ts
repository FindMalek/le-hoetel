import type { MessageChannel } from "@le-hoetel/common/consent"
import type { MessageStatus } from "@le-hoetel/common/message"
import { signUnsubscribeToken, unsubscribeFooter, unsubscribePageUrl } from "@le-hoetel/common/unsubscribe"
import { guestConsents, guests, messages } from "@le-hoetel/db"
import type { TemplateData, TemplateName } from "@le-hoetel/notification"
import { and, eq, inArray } from "drizzle-orm"
import type { Context } from "../context"
import { hotelGuest } from "./guests"

type Ctx = Pick<Context, "db" | "config" | "now" | "notification">

export interface GuestMessage<Name extends TemplateName = TemplateName> {
  hotelId: string
  guestId: string
  channel: MessageChannel
  template: Name
  data: TemplateData<Name>
}

export interface MessageOutcome {
  messageId: string
  status: MessageStatus
}

const LOG_ONLY_ID = "log-only"

/**
 * The only way a message reaches a guest. Checks the guest's current consent for the channel, refuses without it
 * (a `skipped_no_consent` row), ends the message with the unsubscribe or STOP line, and logs one row. The row
 * has no body and no recipient. Providers only send when messaging is live; otherwise the row says `sent` with
 * the provider id `log-only`.
 */
export async function sendToGuest<Name extends TemplateName>(
  context: Ctx,
  input: GuestMessage<Name>,
): Promise<MessageOutcome> {
  const { hotelId, guestId, channel } = input
  const [guest] = await context.db
    .select({ language: guests.language, email: guests.email, phoneE164: guests.phoneE164 })
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

  const token = signUnsubscribeToken(context.config.tokenSecret, { hotelId, guestId, channel })
  const footer = unsubscribeFooter(
    channel,
    guest.language,
    unsubscribePageUrl(context.config.webUrl, token, guest.language),
  )
  const queued = await record({ status: "queued" })
  const finish = async (values: Partial<typeof messages.$inferInsert> & { status: MessageStatus }) => {
    await context.db.update(messages).set(values).where(eq(messages.id, queued.messageId))
    return { messageId: queued.messageId, status: values.status }
  }
  try {
    const result = await context.notification.send({ channel, to, template: input.template, data: input.data, footer })
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
