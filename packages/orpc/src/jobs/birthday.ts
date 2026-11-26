import { birthdaysToday, isQuietHour, localTime } from "@ritorno/common/hotel-time"
import { guestConsents, guests, hotelSettings } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { and, eq, inArray, ne, sql } from "drizzle-orm"
import { z } from "zod"
import {
  BULK_JOB_EXPIRE_SECONDS,
  claimAndSend,
  notClaimed,
  SEND_PACING,
  type SendPacing,
  triggerOffer,
} from "../lib/automations"
import type { JobServices } from "./welcome"

export const BIRTHDAY_JOB = "birthday-guests"

/**
 * Runs every minute: pg-boss cron is UTC, hotels are not. From 09:00 local time until quiet hours each run sends one
 * paced batch per hotel to guests not reached yet, like campaigns, so a late worker still sends the same day and no
 * run gets long. The claim, one per guest, channel and year, keeps it to one message a year however often this runs.
 * A hotel without a birthday offer sends nothing.
 */
export const birthdayJob = (services: JobServices, pacing: SendPacing = SEND_PACING) =>
  defineJob({
    name: BIRTHDAY_JOB,
    description: "Send the birthday offer to guests whose birthday is today",
    payload: z.object({}),
    cron: "* * * * *",
    expireInSeconds: BULK_JOB_EXPIRE_SECONDS,
    scheduleData: {},
    handler: async (_payload, { now }) => {
      const hotels = await services.db
        .select({ hotelId: hotelSettings.organizationId, timezone: hotelSettings.timezone })
        .from(hotelSettings)
        .where(ne(hotelSettings.status, "suspended"))
      for (const { hotelId, timezone } of hotels) {
        let local: ReturnType<typeof localTime>
        try {
          local = localTime(now(), timezone)
        } catch {
          console.error("[birthday] hotel has an invalid timezone")
          continue
        }
        if (local.hour < 9 || isQuietHour(local.hour)) continue
        const period = String(local.year)
        const batch = await services.db
          .select({ guestId: guests.id, language: guests.language, channel: guestConsents.channel })
          .from(guestConsents)
          .innerJoin(guests, and(eq(guests.id, guestConsents.guestId), eq(guests.hotelId, guestConsents.hotelId)))
          .where(
            and(
              eq(guestConsents.hotelId, hotelId),
              eq(guestConsents.granted, true),
              inArray(guestConsents.channel, ["email", "whatsapp"]),
              inArray(sql`to_char(${guests.birthday}, 'MM-DD')`, birthdaysToday(local)),
              notClaimed({ guestId: guests.id, kind: "birthday", period, channel: guestConsents.channel }),
            ),
          )
          .limit(pacing.batchSize)
        for (const { guestId, language, channel } of batch) {
          if (channel === "profile") continue
          const perk = await triggerOffer(services, { hotelId, guestId, language, trigger: "birthday" })
          // Whether an offer can be redeemed does not depend on the guest: without one nobody here gets a message.
          if (!perk) break
          await claimAndSend(
            services,
            { kind: "birthday", period },
            { hotelId, guestId, channel, template: "birthday", props: perk },
            pacing,
          )
        }
      }
    },
  })
