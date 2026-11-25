import { leadInputSchema } from "@ritorno/common/schemas"
import { leads } from "@ritorno/db"
import { z } from "zod"
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit"
import { publicProcedure } from "../procedures"

export const leadsRouter = {
  request: publicProcedure
    .route({
      method: "POST",
      path: "/public/leads",
      summary: "A hotel asks for a demo on the landing page",
      tags: ["public"],
    })
    .input(leadInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      await enforceRateLimit(context, "leads.demo", RATE_LIMITS.lead)
      if (input.website) return { ok: true as const }
      await context.db.insert(leads).values({
        name: input.name,
        hotelName: input.hotel,
        phone: input.phone,
        city: input.city,
        language: input.language,
      })
      const to = context.config.leadsEmail
      if (to) {
        await context.notification
          .send({
            channel: "email",
            to,
            template: "alert",
            data: {
              title: `Demo request: ${input.hotel}`,
              items: [
                { label: "Name", value: input.name },
                { label: "Hotel", value: input.hotel },
                { label: "City", value: input.city },
                { label: "Phone", value: input.phone },
                { label: "Language", value: input.language },
              ],
            },
          })
          .catch(() => console.error("[leads] the notification email failed"))
      }
      return { ok: true as const }
    }),
}
