import { z } from "zod"
import { notifyManager } from "../lib/manager-alerts"
import { can, hotelProcedure } from "../procedures"

export const managerAlertsRouter = {
  test: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "POST",
      path: "/hotel/alerts/test",
      summary: "Email a test alert to the manager",
      tags: ["hotel"],
    })
    .output(z.object({ sent: z.boolean() }))
    .handler(async ({ context }) => ({
      sent: await notifyManager(context, context.hotel.hotelId, "Test alert: your hotel alerts work."),
    })),
}
