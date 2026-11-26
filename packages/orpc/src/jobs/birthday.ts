import { birthdaysToday, isQuietHour, localTime } from "@ritorno/common/hotel-time"
import { guests, hotelSettings } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { and, eq, inArray, ne, sql } from "drizzle-orm"
import { z } from "zod"
import { claimAndSend, consentedChannels, type SendPacing, triggerOffer } from "../lib/automations"
import type { JobServices } from "./welcome"

export const BIRTHDAY_JOB = "birthday-guests"

/**
 * Runs every hour: pg-boss cron is UTC, hotels are not. A hotel is handled on its first run after 09:00 local time
 * (and before quiet hours), so a late worker still sends the same day. The claim, one per guest, channel and year,
 * keeps it to one message a year however often this runs. A hotel without a birthday offer sends nothing.
 */
export const birthdayJob = (services: JobServices, pacing?: SendPacing) =>
  defineJob({
    name: BIRTHDAY_JOB,
    description: "Send the birthday offer to guests whose birthday is today",
    payload: z.object({}),
    cron: "0 * * * *",
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
        const due = await services.db
          .select({ id: guests.id, language: guests.language })
          .from(guests)
          .where(
            and(eq(guests.hotelId, hotelId), inArray(sql`to_char(${guests.birthday}, 'MM-DD')`, birthdaysToday(local))),
          )
        for (const guest of due) {
          const channels = await consentedChannels(services.db, hotelId, guest.id)
          if (!channels.length) continue
          const perk = await triggerOffer(services, {
            hotelId,
            guestId: guest.id,
            language: guest.language,
            trigger: "birthday",
          })
          if (!perk) continue
          for (const channel of channels) {
            await claimAndSend(
              services,
              { kind: "birthday", period: String(local.year) },
              { hotelId, guestId: guest.id, channel, template: "birthday", props: perk },
              pacing,
            )
          }
        }
      }
    },
  })
