import { hotelAdminUpdateSchema, hotelCreateSchema, hotelSchema, hotelUpdateSchema } from "@le-hoetel/common/schemas"
import { hotelSettings, member, organization, user } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { activeOrganizationId } from "../lib/org"
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
        hotels: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    )
    .handler(async ({ context }) => ({
      activeId: await activeOrganizationId(context),
      hotels: await context.db
        .select({ id: organization.id, name: hotelSettings.displayName })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
        .where(eq(member.userId, context.user.id))
        .orderBy(asc(organization.name)),
    })),

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
    .route({ method: "GET", path: "/admin/hotels", summary: "All hotels (admins only)", tags: ["admin"] })
    .output(z.array(hotelSchema))
    .handler(({ context }) => selectHotels(context.db).orderBy(asc(organization.name))),

  create: adminProcedure
    .route({ method: "POST", path: "/admin/hotels", summary: "Create a hotel for an existing user", tags: ["admin"] })
    .input(hotelCreateSchema)
    .output(hotelSchema)
    .handler(async ({ context, input }) => {
      const [owner] = await context.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.ownerEmail.toLowerCase()))
      if (!owner) throw new ORPCError("NOT_FOUND", { message: "No user with that email: create the user first." })
      const [taken] = await context.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, input.slug))
      if (taken) throw new ORPCError("CONFLICT", { message: "That slug is taken." })
      const created = await context.auth.api.createOrganization({
        body: { name: input.name, slug: input.slug, userId: owner.id },
      })
      if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "The hotel could not be created." })
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
