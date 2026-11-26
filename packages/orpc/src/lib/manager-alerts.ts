import { type Db, hotelSettings, member, user } from "@ritorno/db"
import { renderTemplate, type TemplateData } from "@ritorno/notification"
import { and, eq } from "drizzle-orm"
import type { Context } from "../context"

type Ctx = Pick<Context, "db" | "config" | "now" | "notification">

async function managerEmails(db: Db, hotelId: string, replyTo: string | null): Promise<string[]> {
  if (replyTo) return [replyTo]
  const owners = await db
    .select({ email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, hotelId), eq(member.role, "owner")))
  return owners.map((owner) => owner.email)
}

/**
 * Emails the hotel's manager (the reply-to, else the first owner), false when there is nobody to email. The email is
 * the `alert` template; without `email` it carries `text` as its title, in English.
 */
export async function notifyManager(
  context: Ctx,
  hotelId: string,
  text: string,
  email?: TemplateData<"alert">,
): Promise<boolean> {
  const [hotel] = await context.db
    .select({ name: hotelSettings.displayName, replyTo: hotelSettings.replyToEmail })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  if (!hotel) return false
  const [to] = await managerEmails(context.db, hotelId, hotel.replyTo)
  if (!to) return false
  const rendered = await renderTemplate(
    "alert",
    email ?? { title: text, items: [], locale: "en" },
    context.config.dashboardUrl.replace(/\/$/, ""),
  )
  await context.notification.sendEmail({ to, email: rendered, fromName: hotel.name })
  return true
}
