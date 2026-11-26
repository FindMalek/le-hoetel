import { guests } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { z } from "zod"
import type { Context } from "../context"
import { claimAndSend, consentedChannels, type SendPacing, triggerOffer } from "../lib/automations"
import { hotelGuest } from "../lib/guests"

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
