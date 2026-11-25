import { pickContent } from "@le-hoetel/common/campaigns"
import { isQuietHour, localTime } from "@le-hoetel/common/hotel-time"
import { campaignRecipients, campaigns, hotelSettings, offers } from "@le-hoetel/db"
import { defineJob } from "@le-hoetel/jobs"
import { and, eq, inArray, lte, ne } from "drizzle-orm"
import { z } from "zod"
import { perkFor } from "../lib/automations"
import { campaignChannels, recipientsQuery } from "../lib/campaigns"
import { sendToGuest } from "../lib/messages"
import type { JobServices } from "./welcome"

export const CAMPAIGN_JOB = "campaign-dispatch"

/** Messages per campaign per minute: at most `BATCH_SIZE` sends, `PAUSE_MS` apart, so a provider never sees a burst. */
const BATCH_SIZE = 20
const PAUSE_MS = 250

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs every minute. Takes the campaigns that are due (scheduled, or still sending), skips hotels in quiet hours
 * (21:00 to 08:00 local), and sends the next batch to guests the campaign has not reached yet. A campaign is done
 * when a batch finds nobody left. The recipient row is written before the send, so a crash or a second worker
 * never sends twice. Cancelling stops it at the next batch.
 */
export const campaignJob = (services: JobServices, options: { batchSize?: number; pauseMs?: number } = {}) =>
  defineJob({
    name: CAMPAIGN_JOB,
    description: "Send the next batch of every due campaign",
    payload: z.object({}),
    cron: "* * * * *",
    scheduleData: {},
    retry: { limit: 1, delaySeconds: 30, backoff: false },
    handler: async (_payload, { now }) => {
      const due = await services.db
        .select({
          campaign: campaigns,
          timezone: hotelSettings.timezone,
          defaultLanguage: hotelSettings.defaultLanguage,
        })
        .from(campaigns)
        .innerJoin(hotelSettings, eq(hotelSettings.organizationId, campaigns.hotelId))
        .where(
          and(
            inArray(campaigns.status, ["scheduled", "sending"]),
            lte(campaigns.scheduledAt, now()),
            ne(hotelSettings.status, "suspended"),
          ),
        )
      for (const { campaign, timezone, defaultLanguage } of due) {
        let local: ReturnType<typeof localTime>
        try {
          local = localTime(now(), timezone)
        } catch {
          console.error("[campaigns] hotel has an invalid timezone")
          continue
        }
        if (isQuietHour(local.hour)) continue
        await services.db
          .update(campaigns)
          .set({ status: "sending" })
          .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "scheduled")))
        const batch = await recipientsQuery(services.db, {
          hotelId: campaign.hotelId,
          channel: campaign.channel,
          segment: campaign.segment,
          timezone,
          now: now(),
          campaignId: campaign.id,
        }).limit(options.batchSize ?? BATCH_SIZE)
        if (!batch.length) {
          await services.db
            .update(campaigns)
            .set({ status: "sent", completedAt: now() })
            .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "sending")))
          continue
        }
        const [offer] = campaign.offerId
          ? await services.db
              .select()
              .from(offers)
              .where(and(eq(offers.id, campaign.offerId), eq(offers.hotelId, campaign.hotelId)))
          : []
        for (const { guestId, language, channel } of batch) {
          if (channel === "profile" || !campaignChannels(campaign.channel).includes(channel)) continue
          const [claimed] = await services.db
            .insert(campaignRecipients)
            .values({ campaignId: campaign.id, hotelId: campaign.hotelId, guestId, channel })
            .onConflictDoNothing()
            .returning({ id: campaignRecipients.id })
          if (!claimed) continue
          try {
            const perk = offer ? await perkFor(services, offer, guestId, language) : null
            const text = pickContent(campaign.content, language, defaultLanguage)
            const outcome = await sendToGuest(services, {
              hotelId: campaign.hotelId,
              guestId,
              channel,
              template: "message",
              props: {
                subject: text.subject,
                title: text.subject,
                body: text.body,
                offer: perk?.offer,
                ctaUrl: perk?.ctaUrl,
              },
            })
            await services.db
              .update(campaignRecipients)
              .set({ messageId: outcome.messageId })
              .where(eq(campaignRecipients.id, claimed.id))
          } catch {
            console.error("[campaigns] a message could not be sent")
          }
          await sleep(options.pauseMs ?? PAUSE_MS)
        }
      }
    },
  })
