import { ORPCError } from "@orpc/server"
import { MESSAGE_CHANNELS } from "@ritorno/common/consent"
import { isDemoViewer } from "@ritorno/common/demo"
import { HOTEL_ROLES, hotelHealth, LOGO_MAX_BYTES, LOGO_TYPES } from "@ritorno/common/hotel"
import { LOW_BALANCE_MILLIMES } from "@ritorno/common/pricing"
import { captureUrl, HOTEL_SPOTS_MAX, previewUrl, shortUrl } from "@ritorno/common/qr"
import {
  adminHotelDetailSchema,
  adminHotelSchema,
  adminOverviewSchema,
  CAPTURE_SOURCES,
  captureStatSchema,
  hotelAdminUpdateSchema,
  hotelCreateSchema,
  hotelSchema,
  hotelUpdateSchema,
  logoUploadInputSchema,
  logoUploadSchema,
  printOfferSchema,
  qrCodeSchema,
  qrCodesInputSchema,
  spotSchema,
  spotsAddInputSchema,
  testLinkInputSchema,
} from "@ritorno/common/schemas"
import {
  captureSpots,
  guestConsents,
  guests,
  guestVisits,
  hotelBalance,
  hotelSettings,
  invitation,
  member,
  messages,
  organization,
  user,
} from "@ritorno/db"
import { hotelPublicPrefix } from "@ritorno/storage"
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  like,
  lt,
  max,
  ne,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm"
import { toString as qrSvg } from "qrcode"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { bestRole, HOTEL_HEADER } from "../lib/hotel"
import { welcomeOffer } from "../lib/offers"
import { activeMembership } from "../lib/org"
import { shortCodes } from "../lib/short-links"
import { adminProcedure, can, hotelProcedure, protectedProcedure } from "../procedures"

const hotelColumns = {
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  displayName: hotelSettings.displayName,
  logoKey: hotelSettings.logoKey,
  primaryColor: hotelSettings.primaryColor,
  accentColor: hotelSettings.accentColor,
  replyToEmail: hotelSettings.replyToEmail,
  defaultLanguage: hotelSettings.defaultLanguage,
  timezone: hotelSettings.timezone,
  address: hotelSettings.address,
  googleReviewUrl: hotelSettings.googleReviewUrl,
  lowScoreThreshold: hotelSettings.lowScoreThreshold,
  managerWhatsapp: hotelSettings.managerWhatsapp,
  weeklyDigest: hotelSettings.weeklyDigest,
  plan: hotelSettings.plan,
  status: hotelSettings.status,
  pilotEndsAt: hotelSettings.pilotEndsAt,
  createdAt: organization.createdAt,
}

const selectHotels = (db: Context["db"]) =>
  db.select(hotelColumns).from(organization).innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))

export async function loadHotel(db: Context["db"], hotelId: string) {
  const [row] = await selectHotels(db).where(eq(organization.id, hotelId))
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Hotel not found." })
  return row
}

export const hotelRouter = {
  mine: protectedProcedure
    .route({ method: "GET", path: "/hotels/mine", summary: "The hotels you belong to", tags: ["hotel"] })
    .output(
      z.object({
        activeId: z.string().nullable(),
        role: z.enum(HOTEL_ROLES).nullable(),
        hotels: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    )
    .handler(async ({ context }) => {
      // The app admin's `x-hotel-id` wins here like in `resolveHotel`, so no page mixes two hotels.
      const named = context.user.role === "admin" ? context.headers.get(HOTEL_HEADER) : null
      const active = named ? { organizationId: named, role: "owner" } : await activeMembership(context)
      return {
        activeId: active?.organizationId ?? null,
        role: active ? bestRole(active.role) : null,
        hotels: await context.db
          .select({ id: organization.id, name: hotelSettings.displayName })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
          .where(eq(member.userId, context.user.id))
          .orderBy(asc(organization.name)),
      }
    }),

  get: hotelProcedure
    .route({ method: "GET", path: "/hotel", summary: "The active hotel and its branding", tags: ["hotel"] })
    .output(hotelSchema)
    .handler(({ context }) => loadHotel(context.db, context.hotel.hotelId)),

  qrCodes: hotelProcedure
    .route({
      method: "POST",
      path: "/hotel/qr-codes",
      summary: "QR codes (svg) for rooms, tables or the front desk of the active hotel",
      tags: ["hotel"],
    })
    .input(qrCodesInputSchema)
    .output(z.array(qrCodeSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const { slug } = await loadHotel(context.db, hotelId)
      const spots = input.spots.length ? input.spots : [null]
      // the view only demo account writes nothing: a spot without a code yet gets the long address
      const codes = await shortCodes(
        context.db,
        hotelId,
        input.source,
        spots.map((location) => location ?? ""),
        !isDemoViewer(context.session.user.email),
      )
      return Promise.all(
        spots.map(async (location) => {
          const code = codes.get(location ?? "")
          const url = code
            ? shortUrl(context.config.webUrl, code)
            : captureUrl(context.config.webUrl, slug!, input.source, location)
          return { location, url, svg: await qrSvg(url, { type: "svg", margin: 2, errorCorrectionLevel: "H" }) }
        }),
      )
    }),

  testLink: hotelProcedure
    .route({
      method: "GET",
      path: "/hotel/test-link",
      summary: "A try-out of the capture page that saves nothing, with its QR code",
      tags: ["hotel"],
    })
    .input(testLinkInputSchema)
    .output(z.object({ url: z.string(), svg: z.string() }))
    .handler(async ({ context, input }) => {
      const { slug } = await loadHotel(context.db, context.hotel.hotelId)
      const url = previewUrl(context.config.webUrl, slug!, input.source, input.language, input.location)
      return { url, svg: await qrSvg(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) }
    }),

  welcomeOffer: hotelProcedure
    .route({
      method: "GET",
      path: "/hotel/welcome-offer",
      summary: "The welcome offer printed on the QR cards, and when it ends",
      tags: ["hotel"],
    })
    .output(printOfferSchema)
    .handler(({ context }) => welcomeOffer(context.db, context.hotel.hotelId, context.now())),

  captureStats: hotelProcedure
    .route({
      method: "GET",
      path: "/hotel/capture-stats",
      summary: "How many guests each QR source and spot captured",
      tags: ["hotel"],
    })
    .output(z.array(captureStatSchema))
    .handler(({ context }) =>
      context.db
        .select({ source: guests.source, location: guests.captureLocation, guests: count() })
        .from(guests)
        .where(and(eq(guests.hotelId, context.hotel.hotelId), inArray(guests.source, Object.values(CAPTURE_SOURCES))))
        .groupBy(guests.source, guests.captureLocation)
        .orderBy(sql`count(*) desc`, guests.source, guests.captureLocation),
    ),

  update: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({ method: "PATCH", path: "/hotel", summary: "Update the active hotel's branding", tags: ["hotel"] })
    .input(hotelUpdateSchema)
    .output(hotelSchema)
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      if (Object.keys(input).length) {
        await context.db.update(hotelSettings).set(input).where(eq(hotelSettings.organizationId, hotelId))
        await audit(context, { action: "hotel.update", targetId: hotelId, metadata: { fields: Object.keys(input) } })
      }
      return loadHotel(context.db, hotelId)
    }),
}

const listSpots = (db: Context["db"], hotelId: string) =>
  db
    .select({ source: captureSpots.source, name: captureSpots.name })
    .from(captureSpots)
    .where(eq(captureSpots.hotelId, hotelId))
    // numbers in number order: 2 before 10
    .orderBy(captureSpots.source, sql`length(${captureSpots.name})`, captureSpots.name)

/** Open to every role: placing codes on doors and tables is front desk work. */
export const captureSpotsRouter = {
  list: hotelProcedure
    .route({ method: "GET", path: "/hotel/spots", summary: "The saved rooms and tables", tags: ["hotel"] })
    .output(z.array(spotSchema))
    .handler(({ context }) => listSpots(context.db, context.hotel.hotelId)),

  add: hotelProcedure
    .route({ method: "POST", path: "/hotel/spots", summary: "Save rooms or tables, in bulk", tags: ["hotel"] })
    .input(spotsAddInputSchema)
    .output(z.array(spotSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const saved = await listSpots(context.db, hotelId)
      const known = new Set(saved.filter((spot) => spot.source === input.source).map((spot) => spot.name))
      const fresh = [...new Set(input.names)].filter((name) => !known.has(name))
      if (saved.length + fresh.length > HOTEL_SPOTS_MAX) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", {
          message: `A hotel can save ${HOTEL_SPOTS_MAX} rooms and tables.`,
        })
      }
      if (fresh.length) {
        await context.db
          .insert(captureSpots)
          .values(fresh.map((name) => ({ hotelId, source: input.source, name })))
          .onConflictDoNothing()
      }
      return listSpots(context.db, hotelId)
    }),

  remove: hotelProcedure
    .route({ method: "DELETE", path: "/hotel/spots", summary: "Forget saved rooms or tables", tags: ["hotel"] })
    .input(z.object({ spots: z.array(spotSchema).min(1).max(HOTEL_SPOTS_MAX) }))
    .output(z.array(spotSchema))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      await context.db
        .delete(captureSpots)
        .where(
          and(
            eq(captureSpots.hotelId, hotelId),
            or(
              ...input.spots.map((spot) => and(eq(captureSpots.source, spot.source), eq(captureSpots.name, spot.name))),
            ),
          ),
        )
      return listSpots(context.db, hotelId)
    }),
}

const requireStorage = (context: Context) => {
  if (!context.storage) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Storage isn't configured here." })
  return context.storage
}

export const hotelLogoRouter = {
  uploadUrl: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({
      method: "POST",
      path: "/hotel/logo/upload-url",
      summary: "A presigned url to upload the logo",
      tags: ["hotel"],
    })
    .input(logoUploadInputSchema)
    .output(logoUploadSchema)
    .handler(({ context, input }) => {
      const storage = requireStorage(context)
      const key = `${hotelPublicPrefix(storage, context.hotel.hotelId)}logo-${crypto.randomUUID()}.${LOGO_TYPES[input.type]}`
      return { key, url: storage.presignPut(key, input.type), headers: { "content-type": input.type } }
    }),

  set: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({ method: "PUT", path: "/hotel/logo", summary: "Use an uploaded file as the logo", tags: ["hotel"] })
    .input(z.object({ key: z.string().max(300) }))
    .output(hotelSchema)
    .handler(async ({ context, input }) => {
      const storage = requireStorage(context)
      const { hotelId } = context.hotel
      const folder = hotelPublicPrefix(storage, hotelId)
      if (!input.key.startsWith(folder) || input.key.slice(folder.length).includes("/")) {
        throw new ORPCError("FORBIDDEN", { message: "That file is not in your hotel's folder." })
      }
      const file = await storage.stat(input.key)
      if (!file) throw new ORPCError("NOT_FOUND", { message: "Upload the file first." })
      if (!LOGO_TYPES[file.type] || file.size > LOGO_MAX_BYTES) {
        await storage.remove(input.key)
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: "Use a PNG, JPEG or WebP logo of 1 MB at most." })
      }
      const { logoKey: previous } = await loadHotel(context.db, hotelId)
      await context.db
        .update(hotelSettings)
        .set({ logoKey: input.key })
        .where(eq(hotelSettings.organizationId, hotelId))
      if (previous && previous !== input.key && previous.startsWith(folder)) await storage.remove(previous)
      await audit(context, { action: "hotel.logo-set", targetId: hotelId })
      return loadHotel(context.db, hotelId)
    }),

  remove: hotelProcedure
    .use(can({ organization: ["update"] }))
    .route({ method: "DELETE", path: "/hotel/logo", summary: "Remove the logo", tags: ["hotel"] })
    .output(hotelSchema)
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const { logoKey } = await loadHotel(context.db, hotelId)
      await context.db.update(hotelSettings).set({ logoKey: null }).where(eq(hotelSettings.organizationId, hotelId))
      if (logoKey && context.storage && logoKey.startsWith(hotelPublicPrefix(context.storage, hotelId))) {
        await context.storage.remove(logoKey)
      }
      await audit(context, { action: "hotel.logo-remove", targetId: hotelId })
      return loadHotel(context.db, hotelId)
    }),
}

const DAY_MS = 24 * 60 * 60 * 1000

type AdminHotelRow = Awaited<ReturnType<typeof loadHotel>>

async function withHealth(context: Context, hotels: AdminHotelRow[]) {
  const { db } = context
  const now = context.now()
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS)
  const localDay = (at: SQLWrapper) => sql`(${at} at time zone ${hotelSettings.timezone})::date`
  const [guestStats, consents, owners, activity] = await Promise.all([
    db
      .select({
        hotelId: guests.hotelId,
        guestCount: count(),
        guestsLast7Days: count(sql`case when ${gte(guests.createdAt, weekAgo)} then 1 end`),
        lastGuestAt: max(guests.createdAt),
      })
      .from(guests)
      .groupBy(guests.hotelId),
    db
      .select({ hotelId: guestConsents.hotelId, consentedCount: countDistinct(guestConsents.guestId) })
      .from(guestConsents)
      .where(and(eq(guestConsents.granted, true), inArray(guestConsents.channel, MESSAGE_CHANNELS.slice())))
      .groupBy(guestConsents.hotelId),
    db
      .select({ hotelId: member.organizationId, ownerCount: count() })
      .from(member)
      .where(like(member.role, "%owner%"))
      .groupBy(member.organizationId),
    db
      .select({ hotelId: guestVisits.hotelId, activeDays: countDistinct(localDay(guestVisits.at)) })
      .from(guestVisits)
      .innerJoin(hotelSettings, eq(hotelSettings.organizationId, guestVisits.hotelId))
      .where(sql`${localDay(guestVisits.at)} > ${localDay(sql`${now.toISOString()}::timestamptz`)} - 7`)
      .groupBy(guestVisits.hotelId),
  ])
  const guestsOf = new Map(guestStats.map((row) => [row.hotelId, row]))
  const consentsOf = new Map(consents.map((row) => [row.hotelId, row.consentedCount]))
  const ownersOf = new Map(owners.map((row) => [row.hotelId, row.ownerCount]))
  const activityOf = new Map(activity.map((row) => [row.hotelId, row.activeDays]))
  return hotels.map((hotel) => {
    const guestCount = guestsOf.get(hotel.id)?.guestCount ?? 0
    const lastGuestAt = guestsOf.get(hotel.id)?.lastGuestAt ?? null
    const ownerCount = ownersOf.get(hotel.id) ?? 0
    const consentedCount = consentsOf.get(hotel.id) ?? 0
    const health = hotelHealth({ status: hotel.status, ownerCount, guestCount, lastGuestAt, now })
    const guestsLast7Days = guestsOf.get(hotel.id)?.guestsLast7Days ?? 0
    const activeDays = activityOf.get(hotel.id) ?? 0
    return { ...hotel, guestCount, guestsLast7Days, activeDays, consentedCount, ownerCount, lastGuestAt, health }
  })
}

const PILOT_ENDING_DAYS = 14

export const adminHotelsRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/hotels",
      summary: "All hotels with guest counts and health",
      tags: ["admin"],
    })
    .output(z.array(adminHotelSchema))
    .handler(async ({ context }) =>
      withHealth(context, await selectHotels(context.db).orderBy(asc(organization.name))),
    ),

  get: adminProcedure
    .route({
      method: "GET",
      path: "/admin/hotels/{id}",
      summary: "One hotel with its numbers, people and pending invitations",
      tags: ["admin"],
    })
    .input(z.object({ id: z.string() }))
    .output(adminHotelDetailSchema)
    .handler(async ({ context, input }) => {
      const { db } = context
      const [hotel] = await withHealth(context, [await loadHotel(db, input.id)])
      const [people, invites, [sent]] = await Promise.all([
        db
          .select({
            userId: user.id,
            name: user.name,
            email: user.email,
            role: member.role,
            joinedAt: member.createdAt,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(eq(member.organizationId, input.id))
          .orderBy(asc(member.createdAt)),
        db
          .select({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
          })
          .from(invitation)
          .where(and(eq(invitation.organizationId, input.id), eq(invitation.status, "pending")))
          .orderBy(asc(invitation.createdAt)),
        db.select({ n: count() }).from(messages).where(eq(messages.hotelId, input.id)),
      ])
      return {
        ...hotel!,
        capturePageUrl: captureUrl(context.config.webUrl, hotel!.slug, "desk"),
        messageCount: sent?.n ?? 0,
        members: people,
        invitations: invites,
      }
    }),

  slugAvailable: adminProcedure
    .route({
      method: "GET",
      path: "/admin/hotels/slug-available",
      summary: "Is this slug free for a new hotel",
      tags: ["admin"],
    })
    .input(z.object({ slug: z.string().trim().min(1).max(60) }))
    .output(z.object({ available: z.boolean() }))
    .handler(async ({ context, input }) => {
      const [taken] = await context.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, input.slug))
      return { available: !taken }
    }),

  overview: adminProcedure
    .route({
      method: "GET",
      path: "/admin/overview",
      summary: "Pilot funnel numbers across every hotel",
      tags: ["admin"],
    })
    .output(adminOverviewSchema)
    .handler(async ({ context }) => {
      const now = context.now()
      const hotels = await withHealth(context, await selectHotels(context.db))
      const soon = new Date(now.getTime() + PILOT_ENDING_DAYS * DAY_MS)
      const [[recent], [sent], [delivered], [failed], balances] = await Promise.all([
        context.db
          .select({ n: count() })
          .from(guests)
          .where(gte(guests.createdAt, new Date(now.getTime() - 7 * DAY_MS))),
        context.db.select({ n: count() }).from(messages),
        context.db
          .select({ n: count() })
          .from(messages)
          .where(inArray(messages.status, ["sent", "delivered"])),
        context.db.select({ n: count() }).from(messages).where(eq(messages.status, "failed")),
        context.db
          .select({ id: hotelBalance.hotelId, balanceMillimes: hotelBalance.balanceMillimes })
          .from(hotelBalance)
          .where(lt(hotelBalance.balanceMillimes, LOW_BALANCE_MILLIMES))
          .orderBy(asc(hotelBalance.balanceMillimes)),
      ])
      const open = new Map(
        hotels.filter((hotel) => hotel.status !== "suspended").map((hotel) => [hotel.id, hotel.displayName]),
      )
      const sum = (pick: (hotel: (typeof hotels)[number]) => number) =>
        hotels.reduce((total, hotel) => total + pick(hotel), 0)
      return {
        hotels: {
          total: hotels.length,
          pilot: hotels.filter((hotel) => hotel.status === "pilot").length,
          active: hotels.filter((hotel) => hotel.status === "active").length,
          suspended: hotels.filter((hotel) => hotel.status === "suspended").length,
          withOwner: hotels.filter((hotel) => hotel.ownerCount > 0).length,
          withGuests: hotels.filter((hotel) => hotel.guestCount > 0).length,
          pilotsEndingSoon: hotels.filter(
            (hotel) => hotel.status === "pilot" && hotel.pilotEndsAt && hotel.pilotEndsAt <= soon,
          ).length,
        },
        guests: {
          total: sum((hotel) => hotel.guestCount),
          last7Days: recent?.n ?? 0,
          consented: sum((hotel) => hotel.consentedCount),
        },
        messages: { total: sent?.n ?? 0, delivered: delivered?.n ?? 0, failed: failed?.n ?? 0 },
        lowBalance: balances.flatMap((row) => {
          const displayName = open.get(row.id)
          return displayName ? [{ ...row, displayName }] : []
        }),
      }
    }),

  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/hotels",
      summary: "Create a hotel with its branding and invite its owner by email",
      tags: ["admin"],
    })
    .input(hotelCreateSchema)
    .output(hotelSchema)
    .handler(async ({ context, input }) => {
      const { ownerEmail, name, slug, ...branding } = input
      const [taken] = await context.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, slug))
      if (taken) throw new ORPCError("CONFLICT", { message: "That slug is taken." })
      // better-auth needs a member to invite from: the admin joins for a moment, the owner replaces them.
      const created = await context.auth.api.createOrganization({ body: { name, slug, userId: context.user.id } })
      if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "The hotel could not be created." })
      try {
        await context.auth.api.createInvitation({
          body: { email: ownerEmail.toLowerCase(), role: "owner", organizationId: created.id },
          headers: context.headers,
        })
        await context.db
          .delete(member)
          .where(and(eq(member.organizationId, created.id), eq(member.userId, context.user.id)))
        const patch = Object.fromEntries(Object.entries(branding).filter(([, value]) => value !== undefined))
        if (Object.keys(patch).length) {
          await context.db.update(hotelSettings).set(patch).where(eq(hotelSettings.organizationId, created.id))
        }
      } catch (error) {
        await context.db.delete(organization).where(eq(organization.id, created.id))
        throw error
      }
      await audit(context, { action: "hotel.create", targetId: created.id })
      return loadHotel(context.db, created.id)
    }),

  update: adminProcedure
    .route({ method: "PATCH", path: "/admin/hotels/{id}", summary: "Update any hotel", tags: ["admin"] })
    .input(hotelAdminUpdateSchema.extend({ id: z.string() }))
    .output(hotelSchema)
    .handler(async ({ context, input: { id, name, slug, ...patch } }) => {
      const current = await loadHotel(context.db, id)
      if (slug !== undefined && slug !== current.slug) {
        const [taken] = await context.db
          .select({ id: organization.id })
          .from(organization)
          .where(and(eq(organization.slug, slug), ne(organization.id, id)))
        if (taken) throw new ORPCError("CONFLICT", { message: "That slug is taken." })
      }
      const renamed = Object.fromEntries(Object.entries({ name, slug }).filter(([, value]) => value !== undefined))
      if (Object.keys(renamed).length) await context.db.update(organization).set(renamed).where(eq(organization.id, id))
      if (Object.keys(patch).length) {
        await context.db.update(hotelSettings).set(patch).where(eq(hotelSettings.organizationId, id))
      }
      const fields = [...Object.keys(renamed), ...Object.keys(patch)]
      if (fields.length) {
        await audit(context, {
          action: "hotel.admin-update",
          targetId: id,
          metadata: { fields, ...(slug !== undefined && slug !== current.slug ? { previousSlug: current.slug } : {}) },
        })
      }
      return loadHotel(context.db, id)
    }),

  remove: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/hotels/{id}",
      summary: "Delete a hotel with its guests, offers and team. Needs the slug typed again.",
      tags: ["admin"],
    })
    .input(z.object({ id: z.string(), confirmSlug: z.string() }))
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const hotel = await loadHotel(context.db, input.id)
      if (hotel.slug !== input.confirmSlug.trim().toLowerCase()) {
        throw new ORPCError("UNPROCESSABLE_CONTENT", { message: "Type the hotel's slug to confirm." })
      }
      await context.db.delete(organization).where(eq(organization.id, input.id))
      if (hotel.logoKey && context.storage) await context.storage.remove(hotel.logoKey).catch(() => undefined)
      await audit(context, { action: "hotel.delete", targetId: input.id, metadata: { slug: hotel.slug } })
      return { ok: true as const }
    }),
}
