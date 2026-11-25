import { ORPCError } from "@orpc/server"
import { hotelSettings } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
import { createTelegramLinkCode, notifyManager } from "../lib/manager-alerts"
import { can, hotelProcedure } from "../procedures"

const statusSchema = z.object({ linked: z.boolean(), botConfigured: z.boolean() })
const linkSchema = z.object({ code: z.string(), url: z.string().nullable(), expiresAt: z.date() })

export const managerAlertsRouter = {
  status: hotelProcedure
    .route({
      method: "GET",
      path: "/hotel/alerts",
      summary: "Whether manager alerts reach a Telegram chat",
      tags: ["hotel"],
    })
    .output(statusSchema)
    .handler(async ({ context }) => {
      const [row] = await context.db
        .select({ chatId: hotelSettings.telegramChatId })
        .from(hotelSettings)
        .where(eq(hotelSettings.organizationId, context.hotel.hotelId))
      return { linked: Boolean(row?.chatId), botConfigured: Boolean(context.config.telegramBot) }
    }),

  link: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "POST",
      path: "/hotel/alerts/link",
      summary: "A one-time code (15 minutes) and the bot link to connect a Telegram chat",
      tags: ["hotel"],
    })
    .output(linkSchema)
    .handler(async ({ context }) => {
      if (!context.config.telegramBot) {
        throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Telegram alerts are not set up yet." })
      }
      const now = context.now()
      const code = await createTelegramLinkCode(context.db, context.hotel.hotelId, now)
      await audit(context, { action: "hotel.alerts.link", targetId: context.hotel.hotelId })
      return {
        code,
        url: `https://t.me/${context.config.telegramBot}?start=${code}`,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
      }
    }),

  unlink: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({ method: "DELETE", path: "/hotel/alerts", summary: "Stop sending alerts to Telegram", tags: ["hotel"] })
    .output(statusSchema)
    .handler(async ({ context }) => {
      await context.db
        .update(hotelSettings)
        .set({ telegramChatId: null, telegramLinkCode: null, telegramLinkExpiresAt: null })
        .where(eq(hotelSettings.organizationId, context.hotel.hotelId))
      await audit(context, { action: "hotel.alerts.unlink", targetId: context.hotel.hotelId })
      return { linked: false, botConfigured: Boolean(context.config.telegramBot) }
    }),

  test: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({ method: "POST", path: "/hotel/alerts/test", summary: "Send a test alert to the manager", tags: ["hotel"] })
    .output(z.object({ channel: z.enum(["telegram", "email", "none"]) }))
    .handler(async ({ context }) => ({
      channel: await notifyManager(context, context.hotel.hotelId, "Test alert: your hotel alerts work."),
    })),
}
