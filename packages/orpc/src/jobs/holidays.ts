import type { MessageChannel } from "@ritorno/common/consent"
import { HOLIDAYS, type HolidayChannel, type HolidayKey, holidaysOn } from "@ritorno/common/holidays"
import { isQuietHour, localTime } from "@ritorno/common/hotel-time"
import { guestConsents, guests, hotelHolidays, hotelSettings } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { and, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { claimSend } from "../lib/automations"
import { sendToGuest } from "../lib/messages"
import type { JobServices } from "./welcome"

export const HOLIDAY_JOB = "holiday-guests"

export const holidayChannels = (channel: HolidayChannel): MessageChannel[] =>
  channel === "both" ? ["email", "whatsapp"] : [channel]

/**
 * Runs every hour. A hotel is handled on its first run after 09:00 local time (never in quiet hours) on a day that is
 * a holiday it switched on, and sends to guests who agreed to a channel the hotel picked for that holiday. A guest
 * gets one holiday message per channel and day, so two holidays on the same date send only the first.
 */
export const holidayJob = (services: JobServices) =>
  defineJob({
    name: HOLIDAY_JOB,
    description: "Send the holiday greetings a hotel switched on",
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
          console.error("[holidays] hotel has an invalid timezone")
          continue
        }
        const today = holidaysOn(local.date)
        if (!today.length || local.hour < 9 || isQuietHour(local.hour)) continue
        const chosen = await services.db
          .select({ key: hotelHolidays.holidayKey, channel: hotelHolidays.channel })
          .from(hotelHolidays)
          .where(
            and(
              eq(hotelHolidays.hotelId, hotelId),
              eq(hotelHolidays.enabled, true),
              inArray(hotelHolidays.holidayKey, today),
            ),
          )
        for (const key of today) {
          const holiday = chosen.find((row) => row.key === key)
          if (holiday) await greet(services, hotelId, key, holidayChannels(holiday.channel), local.date)
        }
      }
    },
  })

async function greet(
  services: JobServices,
  hotelId: string,
  key: HolidayKey,
  channels: MessageChannel[],
  date: string,
) {
  const recipients = await services.db
    .select({ guestId: guests.id, language: guests.language, channel: guestConsents.channel })
    .from(guestConsents)
    .innerJoin(guests, and(eq(guests.id, guestConsents.guestId), eq(guests.hotelId, guestConsents.hotelId)))
    .where(
      and(
        eq(guestConsents.hotelId, hotelId),
        eq(guestConsents.granted, true),
        inArray(guestConsents.channel, channels),
      ),
    )
  for (const { guestId, language, channel } of recipients) {
    if (channel === "profile") continue
    if (!(await claimSend(services.db, { hotelId, guestId, kind: "holiday", period: date, channel }))) continue
    const text = HOLIDAYS[key].text[language]
    await sendToGuest(services, {
      hotelId,
      guestId,
      channel,
      template: "message",
      props: { subject: `${text.name} · {hotel}`, title: `${text.name}, {name}`, body: text.body },
    })
  }
}
