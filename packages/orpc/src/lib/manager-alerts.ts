import { randomBytes } from "node:crypto"
import { type Db, hotelSettings, member, user } from "@ritorno/db"
import { renderTemplate, type TemplateData } from "@ritorno/notification"
import { and, eq, gt } from "drizzle-orm"
import type { Context } from "../context"

const LINK_TTL_MS = 15 * 60 * 1000

type Ctx = Pick<Context, "db" | "config" | "now" | "notification">

export async function createTelegramLinkCode(db: Db, hotelId: string, now: Date): Promise<string> {
  const code = randomBytes(12).toString("base64url")
  await db
    .update(hotelSettings)
    .set({ telegramLinkCode: code, telegramLinkExpiresAt: new Date(now.getTime() + LINK_TTL_MS) })
    .where(eq(hotelSettings.organizationId, hotelId))
  return code
}

/** `/start <code>` from the bot: binds the chat to the hotel that issued the unexpired code, once. */
export async function linkTelegramChat(db: Db, code: string, chatId: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(hotelSettings)
    .set({ telegramChatId: chatId, telegramLinkCode: null, telegramLinkExpiresAt: null })
    .where(and(eq(hotelSettings.telegramLinkCode, code), gt(hotelSettings.telegramLinkExpiresAt, now)))
    .returning({ id: hotelSettings.organizationId })
  return rows.length > 0
}

async function fallbackEmails(db: Db, hotelId: string, replyTo: string | null): Promise<string[]> {
  if (replyTo) return [replyTo]
  const owners = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, hotelId), eq(member.role, "owner")))
  return owners.map((owner) => owner.email)
}

export type ManagerChannel = "telegram" | "email" | "none"

/**
 * Tells the hotel's manager: their linked Telegram chat first, then email when there is no chat or it fails. The email
 * is the `alert` template; without `email` it carries `text` as its title, in English.
 */
export async function notifyManager(
  context: Ctx,
  hotelId: string,
  text: string,
  email?: TemplateData<"alert">,
): Promise<ManagerChannel> {
  const [hotel] = await context.db
    .select({
      chatId: hotelSettings.telegramChatId,
      name: hotelSettings.displayName,
      replyTo: hotelSettings.replyToEmail,
    })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  if (!hotel) return "none"
  if (hotel.chatId) {
    const sent = await context.notification.sendTelegram(hotel.chatId, text).then(
      () => true,
      () => false,
    )
    if (sent) return "telegram"
  }
  const [to] = await fallbackEmails(context.db, hotelId, hotel.replyTo)
  if (!to) return "none"
  const rendered = await renderTemplate(
    "alert",
    email ?? { title: text, items: [], locale: "en" },
    context.config.dashboardUrl.replace(/\/$/, ""),
  )
  await context.notification.sendEmail({ to, email: rendered, fromName: hotel.name })
  return "email"
}
