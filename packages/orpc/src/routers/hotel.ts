import { LOGO_MAX_BYTES, LOGO_TYPES } from "@le-hoetel/common/hotel"
import {
  hotelAdminUpdateSchema,
  hotelCreateSchema,
  hotelSchema,
  hotelUpdateSchema,
  logoUploadInputSchema,
  logoUploadSchema,
} from "@le-hoetel/common/schemas"
import { hotelSettings, organization, user } from "@le-hoetel/db"
import { hotelPublicPrefix } from "@le-hoetel/storage"
import { ORPCError } from "@orpc/server"
import { asc, eq } from "drizzle-orm"
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
