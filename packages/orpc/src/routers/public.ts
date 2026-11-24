import {
  CAPTURE_SOURCES,
  captureInputSchema,
  guestCreateSchema,
  publicHotelSchema,
  statusSchema,
} from "@le-hoetel/common/schemas"
import { hotelSettings, organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { repoInfo } from "../lib/github"
import { upsertGuest } from "../lib/guests"
import { publicProcedure } from "../procedures"

const hotelNotFound = () => new ORPCError("NOT_FOUND", { message: "Hotel not found." })

async function findPublicHotel(db: Context["db"], slug: string) {
  const [hotel] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      displayName: hotelSettings.displayName,
      primaryColor: hotelSettings.primaryColor,
      accentColor: hotelSettings.accentColor,
      defaultLanguage: hotelSettings.defaultLanguage,
    })
    .from(organization)
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
    .where(and(eq(organization.slug, slug), ne(hotelSettings.status, "suspended")))
  if (!hotel) throw hotelNotFound()
  return hotel
}

export const publicRouter = {
  status: publicProcedure
    .route({ method: "GET", path: "/public/status", summary: "Live api and database health", tags: ["public"] })
    .output(statusSchema)
    .handler(async ({ context }) => {
      const started = performance.now()
      const up = await context.db
        .execute(sql`select 1`)
        .then(() => true)
        .catch(() => false)
      return {
        api: "ok" as const,
        database: up ? ("ok" as const) : ("down" as const),
        databaseMs: up ? Math.round(performance.now() - started) : null,
        env: context.config.deployEnv,
      }
    }),

  repo: publicProcedure
    .route({ method: "GET", path: "/public/repo", summary: "The project's GitHub repo and stars", tags: ["public"] })
    .output(z.object({ name: z.string(), url: z.string(), stars: z.number() }).nullable())
    .handler(async ({ context }) => {
      const info = await repoInfo(context.config.githubRepo, context.config.githubToken)
      return info && context.config.githubRepo ? { name: context.config.githubRepo, ...info } : null
    }),

  authProviders: publicProcedure
    .route({ method: "GET", path: "/public/auth-providers", summary: "Sign-in methods enabled here", tags: ["public"] })
    .output(z.object({ email: z.boolean(), github: z.boolean() }))
    .handler(({ context }) => ({ email: true, github: context.config.githubAuth })),

  hotel: publicProcedure
    .route({
      method: "GET",
      path: "/public/hotels/{slug}",
      summary: "The public branding of a hotel, for its QR capture page",
      tags: ["public"],
    })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(publicHotelSchema)
    .handler(async ({ context, input }) => {
      const { id: _id, ...hotel } = await findPublicHotel(context.db, input.slug)
      return hotel
    }),

  capture: publicProcedure
    .route({
      method: "POST",
      path: "/public/hotels/{slug}/guests",
      summary: "A guest signs up from a QR code: name, phone, language and their own consents",
      tags: ["public"],
    })
    .input(captureInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const hotel = await findPublicHotel(context.db, input.slug)
      const guest = guestCreateSchema.safeParse({
        name: input.name,
        phone: input.phone,
        language: input.language,
        email: input.email,
        birthday: input.birthday,
        source: CAPTURE_SOURCES[input.source],
        captureLocation: input.location,
        consents: { ...input.consents, profile: false },
      })
      if (!guest.success) {
        throw new ORPCError("BAD_REQUEST", { message: guest.error.issues[0]?.message ?? "Check your details." })
      }
      await context.db.transaction((tx) => upsertGuest(tx, hotel.id, guest.data, context.now()))
      return { ok: true as const }
    }),
}
