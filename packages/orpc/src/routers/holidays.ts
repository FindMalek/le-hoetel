import { HOLIDAY_CHANNELS, HOLIDAY_KEYS, type HolidayChannel, nextHolidayDate } from "@le-hoetel/common/holidays"
import { localTime } from "@le-hoetel/common/hotel-time"
import { hotelHolidays, hotelSettings } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
import { can, hotelProcedure } from "../procedures"

const holidaySchema = z.object({
  key: z.enum(HOLIDAY_KEYS),
  enabled: z.boolean(),
  channel: z.enum(HOLIDAY_CHANNELS),
  /** The next date this holiday falls on, `YYYY-MM-DD`, or null past the built-in table. */
  next: z.string().nullable(),
})

export const holidaysRouter = {
  list: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "GET",
      path: "/holidays",
      summary: "The holidays and what the hotel chose for each",
      tags: ["holidays"],
    })
    .output(z.array(holidaySchema))
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const [settings] = await context.db
        .select({ timezone: hotelSettings.timezone })
        .from(hotelSettings)
        .where(eq(hotelSettings.organizationId, hotelId))
      const today = localTime(context.now(), settings?.timezone ?? "Africa/Tunis").date
      const rows = await context.db.select().from(hotelHolidays).where(eq(hotelHolidays.hotelId, hotelId))
      return HOLIDAY_KEYS.map((key) => {
        const row = rows.find((candidate) => candidate.holidayKey === key)
        return {
          key,
          enabled: row?.enabled ?? false,
          channel: (row?.channel ?? "both") as HolidayChannel,
          next: nextHolidayDate(key, today),
        }
      })
    }),

  update: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "PATCH",
      path: "/holidays/{key}",
      summary: "Switch a holiday message on or off and pick its channel",
      tags: ["holidays"],
    })
    .input(z.object({ key: z.enum(HOLIDAY_KEYS), enabled: z.boolean(), channel: z.enum(HOLIDAY_CHANNELS) }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const state = { enabled: input.enabled, channel: input.channel }
      await context.db
        .insert(hotelHolidays)
        .values({ hotelId, holidayKey: input.key, ...state })
        .onConflictDoUpdate({ target: [hotelHolidays.hotelId, hotelHolidays.holidayKey], set: state })
      await audit(context, { action: "holiday.update", targetId: input.key, metadata: { hotelId, ...state } })
      return { ok: true as const }
    }),
}
