import { HOTEL_ROLES, hotelHealth, LOGO_MAX_BYTES, LOGO_TYPES } from "@le-hoetel/common/hotel"
import { captureUrl } from "@le-hoetel/common/qr"
import {
  adminHotelSchema,
  CAPTURE_SOURCES,
  captureStatSchema,
  hotelAdminUpdateSchema,
  hotelCreateSchema,
  hotelSchema,
  hotelUpdateSchema,
  logoUploadInputSchema,
  logoUploadSchema,
  qrCodeSchema,
  qrCodesInputSchema,
} from "@le-hoetel/common/schemas"
import { guests, hotelSettings, member, organization } from "@le-hoetel/db"
import { hotelPublicPrefix } from "@le-hoetel/storage"
import { ORPCError } from "@orpc/server"
import { and, asc, count, eq, inArray, like, max, sql } from "drizzle-orm"
import { toString as qrSvg } from "qrcode"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { bestRole } from "../lib/hotel"
import { activeMembership } from "../lib/org"
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
  googleReviewUrl: hotelSettings.googleReviewUrl,
  managerWhatsapp: hotelSettings.managerWhatsapp,
  managerTelegram: hotelSettings.managerTelegram,
  plan: hotelSettings.plan,
  status: hotelSettings.status,
  pilotEndsAt: hotelSettings.pilotEndsAt,
  createdAt: organization.createdAt,
}

const selectHotels = (db: Context["db"]) =>
  db.select(hotelColumns).from(organization).innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))

async function loadHotel(db: Context["db"], hotelId: string) {
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
      const active = await activeMembership(context)
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
      const { slug } = await loadHotel(context.db, context.hotel.hotelId)
      const spots = input.spots.length ? input.spots : [null]
      return Promise.all(
        spots.map(async (location) => {
          const url = captureUrl(context.config.webUrl, slug, input.source, location)
          return { location, url, svg: await qrSvg(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" }) }
        }),
      )
    }),

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

export const adminHotelsRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/hotels",
      summary: "All hotels with guest counts and health",
      tags: ["admin"],
    })
    .output(z.array(adminHotelSchema))
    .handler(async ({ context }) => {
      const { db } = context
      const [hotels, guestStats, owners] = await Promise.all([
        selectHotels(db).orderBy(asc(organization.name)),
        db
          .select({ hotelId: guests.hotelId, guestCount: count(), lastGuestAt: max(guests.createdAt) })
          .from(guests)
          .groupBy(guests.hotelId),
        db
          .select({ hotelId: member.organizationId, ownerCount: count() })
          .from(member)
          .where(like(member.role, "%owner%"))
          .groupBy(member.organizationId),
      ])
      const guestsOf = new Map(guestStats.map((row) => [row.hotelId, row]))
      const ownersOf = new Map(owners.map((row) => [row.hotelId, row.ownerCount]))
      const now = context.now()
      return hotels.map((hotel) => {
        const guestCount = guestsOf.get(hotel.id)?.guestCount ?? 0
        const lastGuestAt = guestsOf.get(hotel.id)?.lastGuestAt ?? null
        const ownerCount = ownersOf.get(hotel.id) ?? 0
        const health = hotelHealth({ status: hotel.status, ownerCount, guestCount, lastGuestAt, now })
        return { ...hotel, guestCount, ownerCount, lastGuestAt, health }
      })
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
    .handler(async ({ context, input: { id, ...patch } }) => {
      await loadHotel(context.db, id)
      if (Object.keys(patch).length) {
        await context.db.update(hotelSettings).set(patch).where(eq(hotelSettings.organizationId, id))
        await audit(context, { action: "hotel.admin-update", targetId: id, metadata: { fields: Object.keys(patch) } })
      }
      return loadHotel(context.db, id)
    }),
}
