import type { CampaignChannel, CampaignResults, CampaignSegment } from "@le-hoetel/common/campaigns"
import type { MessageChannel } from "@le-hoetel/common/consent"
import { localTime } from "@le-hoetel/common/hotel-time"
import { campaignRecipients, type Db, guestConsents, guests, messages } from "@le-hoetel/db"
import { and, count, eq, gte, inArray, notExists, sql } from "drizzle-orm"

export const campaignChannels = (channel: CampaignChannel): MessageChannel[] =>
  channel === "both" ? ["email", "whatsapp"] : [channel]

const lower = (values: string[]) => values.map((value) => value.trim().toLowerCase())

/**
 * The guests and channels a segment reaches: current consent for the channel, plus the filters. With `campaignId`
 * it leaves out whoever the campaign already went to, so it can be called again for the next batch.
 */
export function recipientsQuery(
  db: Db,
  input: {
    hotelId: string
    channel: CampaignChannel
    segment: CampaignSegment
    timezone: string
    now: Date
    campaignId?: string
  },
) {
  const { hotelId, segment } = input
  const filters = [
    eq(guests.hotelId, hotelId),
    eq(guestConsents.granted, true),
    inArray(guestConsents.channel, campaignChannels(input.channel)),
  ]
  if (segment.languages.length) filters.push(inArray(guests.language, segment.languages))
  if (segment.sources.length) filters.push(inArray(guests.source, segment.sources))
  if (segment.countries.length) filters.push(inArray(sql`lower(${guests.country})`, lower(segment.countries)))
  if (segment.lastVisitDays) {
    const today = localTime(input.now, input.timezone)
    const since = new Date(Date.UTC(today.year, today.month - 1, today.day - segment.lastVisitDays))
    filters.push(gte(guests.stayCheckOut, since.toISOString().slice(0, 10)))
  }
  if (input.campaignId) {
    filters.push(
      notExists(
        db
          .select({ one: sql`1` })
          .from(campaignRecipients)
          .where(
            and(
              eq(campaignRecipients.campaignId, input.campaignId),
              eq(campaignRecipients.guestId, guests.id),
              sql`${campaignRecipients.channel}::text = ${guestConsents.channel}::text`,
            ),
          ),
      ),
    )
  }
  return db
    .select({ guestId: guests.id, language: guests.language, channel: guestConsents.channel })
    .from(guestConsents)
    .innerJoin(guests, and(eq(guests.id, guestConsents.guestId), eq(guests.hotelId, guestConsents.hotelId)))
    .where(and(...filters))
}

/** How many guests a segment reaches on each channel right now, for the preview. */
export async function countRecipients(db: Db, input: Parameters<typeof recipientsQuery>[1]) {
  const rows = await recipientsQuery(db, input)
  const byChannel = { email: 0, whatsapp: 0 }
  for (const row of rows) if (row.channel !== "profile") byChannel[row.channel]++
  return { guests: new Set(rows.map((row) => row.guestId)).size, ...byChannel }
}

/** What happened to a campaign's messages, read from the message log. */
export async function campaignResults(db: Db, campaignIds: string[]): Promise<Map<string, CampaignResults>> {
  const results = new Map<string, CampaignResults>()
  if (!campaignIds.length) return results
  const rows = await db
    .select({ campaignId: campaignRecipients.campaignId, status: messages.status, n: count() })
    .from(campaignRecipients)
    .leftJoin(messages, eq(messages.id, campaignRecipients.messageId))
    .where(inArray(campaignRecipients.campaignId, campaignIds))
    .groupBy(campaignRecipients.campaignId, messages.status)
  for (const id of campaignIds) results.set(id, { targeted: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 })
  for (const { campaignId, status, n } of rows) {
    const result = results.get(campaignId)!
    result.targeted += n
    if (status === "sent") result.sent += n
    else if (status === "delivered") result.delivered += n
    else if (status === "failed") result.failed += n
    else if (status === "skipped_no_consent" || status === "skipped_no_balance") result.skipped += n
  }
  return results
}
