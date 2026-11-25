import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { unsubscribePageUrl } from "@le-hoetel/common/unsubscribe"
import {
  type EmailHotel,
  HOTEL_EMAIL_KEYS,
  type HotelEmailKey,
  renderEmail,
  sampleGuest,
  sampleProps,
} from "@le-hoetel/notification"
import { ORPCError } from "@orpc/server"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { enforceKey, RATE_LIMITS } from "../lib/rate-limit"
import { hotelProcedure } from "../procedures"
import { loadHotel } from "./hotel"
import { TEST_EMAIL_ACTION } from "./overview"

const input = z.object({ template: z.enum(HOTEL_EMAIL_KEYS), locale: z.enum(HOTEL_LANGUAGES) })
const rendered = z.object({ subject: z.string(), html: z.string(), text: z.string() })

/** The hotel's own branding and a sample guest: nothing here is a real guest, so a preview can't leak one. */
async function renderSample(
  context: Context & { hotel: { hotelId: string } },
  template: HotelEmailKey,
  locale: HotelLanguage,
) {
  const hotel = await loadHotel(context.db, context.hotel.hotelId)
  const emailHotel: EmailHotel = {
    name: hotel.displayName ?? hotel.name,
    logoUrl: hotel.logoKey ? `${context.config.apiUrl}/files/${hotel.logoKey}` : null,
    primaryColor: hotel.primaryColor,
    accentColor: hotel.accentColor,
    address: hotel.address,
  }
  const guest = sampleGuest(locale, unsubscribePageUrl(context.config.webUrl, "preview", locale))
  return renderEmail(template, {
    hotel: emailHotel,
    guest,
    locale,
    props: sampleProps(template, locale, context.config.webUrl) as never,
  })
}

export const emailsRouter = {
  preview: hotelProcedure
    .route({
      method: "POST",
      path: "/emails/preview",
      summary: "A hotel email as a sample guest sees it",
      tags: ["emails"],
    })
    .input(input)
    .output(rendered)
    .handler(({ context, input }) => renderSample(context, input.template, input.locale)),

  sendTest: hotelProcedure
    .route({ method: "POST", path: "/emails/send-test", summary: "Send a sample email to yourself", tags: ["emails"] })
    .input(input)
    .output(z.object({ sent: z.boolean(), to: z.string() }))
    .handler(async ({ context, input }) => {
      await enforceKey(context.rateLimiter, `emails.test-send:${context.user.id}`, RATE_LIMITS.emailTest)
      const email = await renderSample(context, input.template, input.locale)
      try {
        const result = await context.notification.sendEmail({
          to: context.user.email,
          email: { ...email, subject: `[Test] ${email.subject}` },
        })
        await audit(context, { action: TEST_EMAIL_ACTION, metadata: { hotelId: context.hotel.hotelId } })
        return { sent: result.sent, to: context.user.email }
      } catch (error) {
        console.error("[emails.sendTest]", error instanceof Error ? error.message : error)
        throw new ORPCError("BAD_GATEWAY", { message: "The email could not be sent." })
      }
    }),
}
