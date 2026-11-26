import { isQuietHour, localTime } from "@ritorno/common/hotel-time"
import {
  SURVEY_DAYS_WITHOUT_CHECKOUT,
  SURVEY_HOURS_AFTER_STAY,
  SURVEY_INVITE_DAYS,
  signSurveyToken,
  surveyPageUrl,
} from "@ritorno/common/survey"
import { guests, hotelSettings, surveyInvites } from "@ritorno/db"
import { defineJob } from "@ritorno/jobs"
import { and, eq, isNotNull, isNull, ne, notInArray, or, sql } from "drizzle-orm"
import { z } from "zod"
import { claimAndSend, consentedChannels, type SendPacing } from "../lib/automations"
import { surveyExpiry } from "../lib/surveys"
import type { JobServices } from "./welcome"

export const SURVEY_JOB = "survey-invites"

/** Check-out is a date; the stay is counted over at noon hotel time, so the survey goes out the next noon. */
const dueAt = sql`coalesce(
  (${guests.stayCheckOut} + time '12:00') at time zone ${hotelSettings.timezone} + make_interval(hours => ${SURVEY_HOURS_AFTER_STAY}),
  ${guests.createdAt} + make_interval(days => ${SURVEY_DAYS_WITHOUT_CHECKOUT})
)`

/**
 * Runs every hour. A guest is due 24 hours after check-out, or 8 days after being captured when no check-out is
 * known (never for a csv import or a restaurant table, which say nothing about a stay),
 * outside the hotel's quiet hours, and only for 14 days, so a fresh deploy never surveys old guests. One invite per
 * guest (unique) and one claim per channel keep it to one message each however often this runs, and a crash
 * between the invite and the send is picked up by the next run.
 */
export const surveyJob = (services: JobServices, pacing?: SendPacing) =>
  defineJob({
    name: SURVEY_JOB,
    description: "Send the post-stay survey 24 hours after check-out",
    payload: z.object({}),
    cron: "20 * * * *",
    scheduleData: {},
    handler: async (_payload, { now }) => {
      const at = now()
      const hotels = await services.db
        .select({ hotelId: hotelSettings.organizationId, timezone: hotelSettings.timezone })
        .from(hotelSettings)
        .where(ne(hotelSettings.status, "suspended"))
      for (const { hotelId, timezone } of hotels) {
        try {
          if (isQuietHour(localTime(at, timezone).hour)) continue
        } catch {
          console.error("[survey] hotel has an invalid timezone")
          continue
        }
        const due = await services.db
          .select({ id: guests.id, language: guests.language })
          .from(guests)
          .innerJoin(hotelSettings, eq(hotelSettings.organizationId, guests.hotelId))
          .leftJoin(surveyInvites, eq(surveyInvites.guestId, guests.id))
          .where(
            and(
              eq(guests.hotelId, hotelId),
              isNull(surveyInvites.sentAt),
              // An import has no capture moment and a table scan may not be a stay: only a check-out makes them due.
              or(notInArray(guests.source, ["csv", "qr_table"]), isNotNull(guests.stayCheckOut)),
              sql`${dueAt} <= ${at.toISOString()}::timestamptz`,
              sql`${dueAt} > ${new Date(at.getTime() - SURVEY_INVITE_DAYS * 864e5).toISOString()}::timestamptz`,
            ),
          )
        for (const guest of due) {
          const channels = await consentedChannels(services.db, hotelId, guest.id)
          if (!channels.length) continue
          const [invite] = await services.db
            .insert(surveyInvites)
            .values({ hotelId, guestId: guest.id, expiresAt: surveyExpiry(at) })
            .onConflictDoUpdate({ target: surveyInvites.guestId, set: { guestId: guest.id } })
            .returning({ id: surveyInvites.id })
          if (!invite) continue
          const ctaUrl = surveyPageUrl(
            services.config.webUrl,
            signSurveyToken(services.config.tokenSecret, "survey", { hotelId, inviteId: invite.id }),
          )
          for (const channel of channels) {
            await claimAndSend(
              services,
              { kind: "survey" },
              { hotelId, guestId: guest.id, channel, template: "survey", props: { ctaUrl } },
              pacing,
            )
          }
          await services.db.update(surveyInvites).set({ sentAt: at }).where(eq(surveyInvites.id, invite.id))
        }
      }
    },
  })
