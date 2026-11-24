import { hotelHealth } from "@le-hoetel/common/hotel"
import {
  adminHotelSchema,
  hotelAdminUpdateSchema,
  hotelCreateSchema,
  hotelSchema,
  hotelUpdateSchema,
} from "@le-hoetel/common/schemas"
import { guests, hotelSettings, member, organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, asc, count, eq, like, max } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { adminProcedure, can, hotelProcedure } from "../procedures"

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
  get: hotelProcedure
    .route({ method: "GET", path: "/hotel", summary: "The active hotel and its branding", tags: ["hotel"] })
    .output(hotelSchema)
    .handler(({ context }) => loadHotel(context.db, context.hotel.hotelId)),

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
