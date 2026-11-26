import { ORPCError } from "@orpc/server"
import {
  CAMPAIGN_CHANNELS,
  type CampaignInput,
  campaignInputSchema,
  campaignSchema,
  campaignSegmentSchema,
  pickContent,
} from "@ritorno/common/campaigns"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { unsubscribePageUrl } from "@ritorno/common/unsubscribe"
import { campaigns, hotelSettings, offers } from "@ritorno/db"
import { type EmailHotel, renderEmail, sampleGuest } from "@ritorno/notification"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { campaignResults, countRecipients } from "../lib/campaigns"
import { enforceKey, RATE_LIMITS } from "../lib/rate-limit"
import { can, hotelProcedure } from "../procedures"
import { loadHotel } from "./hotel"

const notFound = () => new ORPCError("NOT_FOUND", { message: "Campaign not found." })
const idSchema = z.object({ id: z.uuid() })
const previewSchema = z.object({ channel: z.enum(CAMPAIGN_CHANNELS), segment: campaignSegmentSchema })

type HotelContext = Context & { hotel: { hotelId: string } }

async function timezoneOf(context: HotelContext) {
  const [row] = await context.db
    .select({ timezone: hotelSettings.timezone })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, context.hotel.hotelId))
  return row?.timezone ?? "Africa/Tunis"
}

async function loadCampaign(context: HotelContext, id: string) {
  const [row] = await context.db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.hotelId, context.hotel.hotelId)))
  if (!row) throw notFound()
  return row
}

async function withResults(context: HotelContext, rows: (typeof campaigns.$inferSelect)[]) {
  const results = await campaignResults(
    context.db,
    rows.map((row) => row.id),
  )
  return rows.map(({ hotelId: _hotelId, updatedAt: _updatedAt, ...row }) => ({ ...row, results: results.get(row.id)! }))
}

async function checkOffer(context: HotelContext, offerId: string | null) {
  if (!offerId) return
  const [offer] = await context.db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.hotelId, context.hotel.hotelId)))
  if (!offer) throw new ORPCError("BAD_REQUEST", { message: "That offer is not one of this hotel's offers." })
}

function requireEditable(status: string) {
  if (status !== "draft") throw new ORPCError("CONFLICT", { message: "Only a draft can be changed." })
}

const values = (input: CampaignInput) => ({
  name: input.name,
  channel: input.channel,
  content: input.content,
  segment: input.segment,
  offerId: input.offerId,
})

export const campaignsRouter = {
  list: hotelProcedure
    .use(can({ campaign: ["read"] }))
    .route({ method: "GET", path: "/campaigns", summary: "The active hotel's campaigns", tags: ["campaigns"] })
    .output(z.array(campaignSchema))
    .handler(async ({ context }) =>
      withResults(
        context,
        await context.db
          .select()
          .from(campaigns)
          .where(eq(campaigns.hotelId, context.hotel.hotelId))
          .orderBy(desc(campaigns.createdAt)),
      ),
    ),

  get: hotelProcedure
    .use(can({ campaign: ["read"] }))
    .route({ method: "GET", path: "/campaigns/{id}", summary: "One campaign with its results", tags: ["campaigns"] })
    .input(idSchema)
    .output(campaignSchema)
    .handler(async ({ context, input }) => (await withResults(context, [await loadCampaign(context, input.id)]))[0]!),

  create: hotelProcedure
    .use(can({ campaign: ["create"] }))
    .route({ method: "POST", path: "/campaigns", summary: "Save a campaign as a draft", tags: ["campaigns"] })
    .input(campaignInputSchema)
    .output(campaignSchema)
    .handler(async ({ context, input }) => {
      await checkOffer(context, input.offerId)
      const [row] = await context.db
        .insert(campaigns)
        .values({ ...values(input), hotelId: context.hotel.hotelId })
        .returning()
      await audit(context, { action: "campaign.create", targetId: row!.id })
      return (await withResults(context, [row!]))[0]!
    }),

  update: hotelProcedure
    .use(can({ campaign: ["update"] }))
    .route({ method: "PATCH", path: "/campaigns/{id}", summary: "Change a draft campaign", tags: ["campaigns"] })
    .input(campaignInputSchema.extend(idSchema.shape))
    .output(campaignSchema)
    .handler(async ({ context, input }) => {
      requireEditable((await loadCampaign(context, input.id)).status)
      await checkOffer(context, input.offerId)
      const [row] = await context.db
        .update(campaigns)
        .set(values(input))
        .where(
          and(eq(campaigns.id, input.id), eq(campaigns.hotelId, context.hotel.hotelId), eq(campaigns.status, "draft")),
        )
        .returning()
      if (!row) throw new ORPCError("CONFLICT", { message: "Only a draft can be changed." })
      return (await withResults(context, [row]))[0]!
    }),

  delete: hotelProcedure
    .use(can({ campaign: ["delete"] }))
    .route({
      method: "DELETE",
      path: "/campaigns/{id}",
      summary: "Delete a draft or cancelled campaign",
      tags: ["campaigns"],
    })
    .input(idSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const campaign = await loadCampaign(context, input.id)
      if (campaign.status !== "draft" && campaign.status !== "cancelled") {
        throw new ORPCError("CONFLICT", { message: "Cancel the campaign before deleting it." })
      }
      await context.db.delete(campaigns).where(eq(campaigns.id, campaign.id))
      await audit(context, { action: "campaign.delete", targetId: campaign.id })
      return { ok: true as const }
    }),

  preview: hotelProcedure
    .use(can({ campaign: ["read"] }))
    .route({
      method: "POST",
      path: "/campaigns/preview",
      summary: "How many guests a segment reaches",
      tags: ["campaigns"],
    })
    .input(previewSchema)
    .output(z.object({ guests: z.number(), email: z.number(), whatsapp: z.number() }))
    .handler(async ({ context, input }) =>
      countRecipients(context.db, {
        hotelId: context.hotel.hotelId,
        channel: input.channel,
        segment: input.segment,
        timezone: await timezoneOf(context),
        now: context.now(),
      }),
    ),

  testSend: hotelProcedure
    .use(can({ campaign: ["read"] }))
    .route({
      method: "POST",
      path: "/campaigns/{id}/test",
      summary: "Email the campaign to yourself",
      tags: ["campaigns"],
    })
    .input(idSchema.extend({ language: z.enum(HOTEL_LANGUAGES) }))
    .output(z.object({ sent: z.boolean(), to: z.string() }))
    .handler(async ({ context, input }) => {
      await enforceKey(context.rateLimiter, `campaigns.test-send:${context.user.id}`, RATE_LIMITS.emailTest)
      const campaign = await loadCampaign(context, input.id)
      const hotel = await loadHotel(context.db, context.hotel.hotelId)
      const emailHotel: EmailHotel = {
        name: hotel.displayName ?? hotel.name,
        logoUrl: hotel.logoKey ? `${context.config.apiUrl}/files/${hotel.logoKey}` : null,
        primaryColor: hotel.primaryColor,
        accentColor: hotel.accentColor,
        address: hotel.address,
      }
      const text = pickContent(campaign.content, input.language, hotel.defaultLanguage)
      const email = await renderEmail("message", {
        hotel: emailHotel,
        guest: sampleGuest(input.language, unsubscribePageUrl(context.config.webUrl, "preview", input.language)),
        locale: input.language,
        props: { subject: text.subject, title: text.subject, body: text.body },
      })
      try {
        const result = await context.notification.sendEmail({
          to: context.user.email,
          email: { ...email, subject: `[Test] ${email.subject}` },
        })
        return { sent: result.sent, to: context.user.email }
      } catch {
        throw new ORPCError("BAD_GATEWAY", { message: "The email could not be sent." })
      }
    }),

  schedule: hotelProcedure
    .use(can({ campaign: ["send"] }))
    .route({
      method: "POST",
      path: "/campaigns/{id}/schedule",
      summary: "Send now or at a later time",
      tags: ["campaigns"],
    })
    .input(idSchema.extend({ at: z.date().nullable() }))
    .output(campaignSchema)
    .handler(async ({ context, input }) => {
      const campaign = await loadCampaign(context, input.id)
      requireEditable(campaign.status)
      const now = context.now()
      if (input.at && input.at.getTime() < now.getTime() - 60_000) {
        throw new ORPCError("BAD_REQUEST", { message: "Pick a time in the future." })
      }
      const reach = await countRecipients(context.db, {
        hotelId: campaign.hotelId,
        channel: campaign.channel,
        segment: campaign.segment,
        timezone: await timezoneOf(context),
        now,
      })
      if (!reach.guests) throw new ORPCError("BAD_REQUEST", { message: "No guest matches this audience yet." })
      const [row] = await context.db
        .update(campaigns)
        .set({ status: "scheduled", scheduledAt: input.at ?? now })
        .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, "draft")))
        .returning()
      if (!row) throw new ORPCError("CONFLICT", { message: "Only a draft can be sent." })
      await audit(context, { action: "campaign.schedule", targetId: row.id, metadata: { guests: reach.guests } })
      return (await withResults(context, [row]))[0]!
    }),

  cancel: hotelProcedure
    .use(can({ campaign: ["send"] }))
    .route({
      method: "POST",
      path: "/campaigns/{id}/cancel",
      summary: "Stop a scheduled or running campaign",
      tags: ["campaigns"],
    })
    .input(idSchema)
    .output(campaignSchema)
    .handler(async ({ context, input }) => {
      const campaign = await loadCampaign(context, input.id)
      if (campaign.status !== "scheduled" && campaign.status !== "sending") {
        throw new ORPCError("CONFLICT", { message: "Only a scheduled or running campaign can be cancelled." })
      }
      const [row] = await context.db
        .update(campaigns)
        .set({ status: "cancelled", completedAt: context.now() })
        .where(eq(campaigns.id, campaign.id))
        .returning()
      await audit(context, { action: "campaign.cancel", targetId: campaign.id })
      return (await withResults(context, [row!]))[0]!
    }),
}
