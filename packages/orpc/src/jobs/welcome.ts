import { guests, messages } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { and, eq, gt } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { claimAndSend, consentedChannels, type SendPacing, triggerOffer } from "../lib/automations"
import { hotelGuest } from "../lib/guests"
import { RATE_LIMITS } from "../lib/rate-limit"

export type JobServices = Pick<Context, "db" | "config" | "now" | "notification">

export const WELCOME_JOB = "welcome-guest"

const payload = z.object({ hotelId: z.string(), guestId: z.uuid() })

/** Welcome message on every channel the guest agreed to, once per guest, hotel and channel. */
export const welcomeJob = (services: JobServices, pacing?: SendPacing) =>
  defineJob({
    name: WELCOME_JOB,
    description: "Send the welcome message to a new guest",
    payload,
    handler: async ({ hotelId, guestId }) => {
      const channels = await consentedChannels(services.db, hotelId, guestId)
      if (!channels.length) return
      const [guest] = await services.db
        .select({ language: guests.language })
        .from(guests)
        .where(hotelGuest(hotelId, guestId))
      if (!guest) return
      const perk = await triggerOffer(services, { hotelId, guestId, language: guest.language, trigger: "welcome" })
      for (const channel of channels) {
        await claimAndSend(
          services,
          { kind: "welcome" },
          { hotelId, guestId, channel, template: "welcome", props: { offer: perk?.offer, ctaUrl: perk?.ctaUrl } },
          pacing,
        )
      }
    },
  })

/** Called right after a guest is saved. A queue that is down must not fail the sign-up, so errors are only logged. */
export async function enqueueWelcome(
  context: Pick<Context, "jobs">,
  hotelId: string,
  guestId: string,
  consents: { email: boolean; whatsapp: boolean },
): Promise<void> {
  if (!consents.email && !consents.whatsapp) return
  const result = await context.jobs.enqueue(WELCOME_JOB, { hotelId, guestId }).catch(() => null)
  if (!result?.ok) console.error("[welcome] could not queue the welcome message")
}

export const PUBLIC_WELCOME_REPEAT_MS = 30 * 24 * 60 * 60_000

/**
 * The public form takes any phone, and every welcome costs the hotel WhatsApp balance and Meta rating: at most one
 * welcome per guest (so per phone) every 30 days, and a per-hotel hourly cap. Skips are logged without the phone.
 */
export async function enqueuePublicWelcome(
  context: Pick<Context, "jobs" | "db" | "rateLimiter" | "now">,
  hotelId: string,
  guestId: string,
  consents: { email: boolean; whatsapp: boolean },
): Promise<void> {
  if (!consents.email && !consents.whatsapp) return
  const since = new Date(context.now().getTime() - PUBLIC_WELCOME_REPEAT_MS)
  const [recent] = await context.db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.hotelId, hotelId),
        eq(messages.guestId, guestId),
        eq(messages.templateKey, "welcome"),
        gt(messages.createdAt, since),
      ),
    )
    .limit(1)
  if (recent) {
    console.warn("[welcome] skipped, this guest got a welcome in the last 30 days", { hotelId })
    return
  }
  const cap = await context.rateLimiter.hit(`public.welcome:hotel:${hotelId}`, RATE_LIMITS.welcomeHotel)
  if (!cap.ok) {
    console.warn("[welcome] skipped, hotel hit its hourly welcome cap", { hotelId })
    return
  }
  await enqueueWelcome(context, hotelId, guestId, consents)
}
